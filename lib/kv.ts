// Cloudflare KV (REST) client for the shared river.
//
// The wishes store moved off Upstash Redis (2026-11-12) to Cloudflare KV:
// free tier, 100K reads/day and 1K writes/day, far above festival traffic
// (thousands of reads/day, dozens of writes/day), and reachable from
// Vercel serverless over plain HTTPS — no persistent connection.
//
// Config from env (Vercel: Production + Preview):
//   CLOUDFLARE_ACCOUNT_ID, LOY_KV_NAMESPACE_ID, LOY_KV_API_TOKEN
// The token needs only Account → Workers KV Storage → Edit on the account.
// When any of the three is missing, getKv() returns null and the store
// falls back to its in-memory store (the same pattern the Redis client
// had). Nothing here throws on a missing backend — callers catch and
// fall back.
//
// KV is eventually consistent: a write can take up to ~60 s to be visible
// from every region (usually seconds). The river already caches for 30 s,
// so a newly floated wish may take up to about a minute to appear for
// everyone — acceptable for a wishes river, and far better than the
// Upstash quota refusals that made the river flap to memory.
//
// KV values are stored as plain text; JSON documents are stringified on
// write and parsed on read. Keys are URL-encoded (the namespace supports
// URL encoding).

const KV_BASE = 'https://api.cloudflare.com/client/v4';

export interface KvClient {
  accountId: string;
  namespaceId: string;
  token: string;
}

let kv: KvClient | null = null;
let kvTried = false;

export function getKv(): KvClient | null {
  if (kvTried) return kv;
  kvTried = true;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const namespaceId = process.env.LOY_KV_NAMESPACE_ID;
  const token = process.env.LOY_KV_API_TOKEN;
  if (accountId && namespaceId && token) {
    kv = { accountId, namespaceId, token };
  }
  return kv;
}

/** True when the KV backend is configured (not a guarantee it answers). */
export function usingKv(): boolean {
  return getKv() !== null;
}

function kvUrl(client: KvClient, path: string): string {
  return `${KV_BASE}/accounts/${client.accountId}/storage/kv/namespaces/${client.namespaceId}${path}`;
}

function kvHeaders(client: KvClient): Record<string, string> {
  return { Authorization: `Bearer ${client.token}` };
}

/** Read a raw value. Null when the key does not exist. Throws on other failures. */
export async function kvGet(client: KvClient, key: string): Promise<string | null> {
  const res = await fetch(kvUrl(client, `/values/${encodeURIComponent(key)}`), {
    headers: kvHeaders(client),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`KV GET ${key} -> HTTP ${res.status}`);
  return res.text();
}

/** Write a raw value. Throws on failure. */
export async function kvPut(
  client: KvClient,
  key: string,
  value: string,
  opts?: { expirationTtl?: number },
): Promise<void> {
  // KV requires expiration_ttl >= 60 s; clamp so a sub-minute TTL (e.g.
  // a daily-limit key set seconds before Bangkok midnight) does not error.
  const ttl =
    opts?.expirationTtl !== undefined
      ? `?expiration_ttl=${Math.max(60, opts.expirationTtl)}`
      : '';
  const res = await fetch(kvUrl(client, `/values/${encodeURIComponent(key)}${ttl}`), {
    method: 'PUT',
    headers: { ...kvHeaders(client), 'Content-Type': 'text/plain' },
    body: value,
  });
  if (!res.ok) throw new Error(`KV PUT ${key} -> HTTP ${res.status}`);
}

/** Delete a value. Missing keys are fine. Throws on other failures. */
export async function kvDelete(client: KvClient, key: string): Promise<void> {
  const res = await fetch(kvUrl(client, `/values/${encodeURIComponent(key)}`), {
    method: 'DELETE',
    headers: kvHeaders(client),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`KV DELETE ${key} -> HTTP ${res.status}`);
  }
}

/** List key names with a prefix (paginated). Throws on failure. */
export async function kvList(client: KvClient, prefix: string): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | null = null;
  for (;;) {
    const q = `?prefix=${encodeURIComponent(prefix)}&limit=1000${
      cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
    }`;
    const res = await fetch(kvUrl(client, `/keys${q}`), { headers: kvHeaders(client) });
    if (!res.ok) throw new Error(`KV LIST ${prefix} -> HTTP ${res.status}`);
    const data = (await res.json()) as {
      result?: { name: string }[];
      result_info?: { cursor?: string };
    };
    for (const row of data.result ?? []) names.push(row.name);
    cursor = data.result_info?.cursor ?? null;
    if (!cursor) break;
    if (names.length >= 20000) break;
  }
  return names;
}

/** Delete many keys in one bulk call (max 10,000 per call). Throws on failure. */
export async function kvDeleteMany(client: KvClient, keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 10000) {
    const chunk = keys.slice(i, i + 10000);
    const res = await fetch(kvUrl(client, '/bulk'), {
      method: 'DELETE',
      headers: { ...kvHeaders(client), 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) throw new Error(`KV BULK DELETE -> HTTP ${res.status}`);
  }
}

/** Read a JSON document. Null when the key does not exist. Throws on other failures. */
export async function kvGetJSON<T>(client: KvClient, key: string): Promise<T | null> {
  const raw = await kvGet(client, key);
  if (raw === null) return null;
  return JSON.parse(raw) as T;
}

/** Write a JSON document. Throws on failure. */
export async function kvPutJSON(
  client: KvClient,
  key: string,
  value: unknown,
  opts?: { expirationTtl?: number },
): Promise<void> {
  await kvPut(client, key, JSON.stringify(value), opts);
}

/**
 * Set-if-absent with a TTL (the Redis SET NX EX shape). Returns true when
 * this call claimed the key, false when it already existed. KV has no
 * atomic NX, so this is a read-then-write — the race window is
 * milliseconds and the callers are fairness limits, not security gates.
 */
export async function kvSetNX(
  client: KvClient,
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<boolean> {
  if ((await kvGet(client, key)) !== null) return false;
  await kvPut(client, key, value, { expirationTtl: ttlSeconds });
  return true;
}

/**
 * Increment a numeric document by `by` (the Redis INCRBY shape). Reads
 * the current value (0 when absent), adds, writes back. Not atomic —
 * the race window is milliseconds and festival counter traffic is a
 * handful of increments a day.
 */
export async function kvIncr(client: KvClient, key: string, by: number): Promise<number> {
  const current = Number((await kvGet(client, key)) ?? 0) || 0;
  const next = current + by;
  await kvPut(client, key, String(next));
  return next;
}

/**
 * Count up to a cap with a TTL (the Redis INCR + EXPIRE shape used by
 * the restore-id and rate-limit guards). Returns true when the new
 * count is within the cap, false when it is already at/over it. The
 * TTL resets on each write, so the window slides — fine for a guard.
 */
export async function kvCountUp(
  client: KvClient,
  key: string,
  max: number,
  ttlSeconds: number,
): Promise<boolean> {
  const current = Number((await kvGet(client, key)) ?? 0) || 0;
  if (current >= max) return false;
  await kvPut(client, key, String(current + 1), { expirationTtl: ttlSeconds });
  return true;
}
