// One-time migration: Upstash Redis -> Cloudflare KV (2026-11-12).
//
// Reads every `loy:*` key out of the Upstash store and writes the
// equivalent JSON documents into the Cloudflare KV namespace the app
// now uses (see lib/kv.ts for the document model). Run it ONCE from
// the PC, where both sets of credentials live:
//
//   # Upstash creds come from a Vercel env pull (never printed):
//   vercel env pull .env.local   # in the loy-krathong project dir
//   # KV token is in C:/Muse/loy-kv-token.txt (never printed):
//   set LOY_KV_API_TOKEN=<value from that file>
//   set CLOUDFLARE_ACCOUNT_ID=51c5399f6ba9530d7c85ecad4dae0f2e
//   set LOY_KV_NAMESPACE_ID=843cc73c01c441399b79924d7623809f
//   node scripts/migrate-upstash-to-kv.mjs
//
// Env vars read (all required):
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
//   CLOUDFLARE_ACCOUNT_ID, LOY_KV_NAMESPACE_ID, LOY_KV_API_TOKEN
//
// What it copies: the wishes list, per-wish reaction counts and
// blessing lanterns, gratitude counts + thanks list, visitor states,
// event logs, sent-blessing sets, config, community counters,
// floaters, report sets, and the audit log. Ephemeral keys are NOT
// copied (rate limits, daily float slots, restore-id attempts,
// candle-lit dedupe) — those start fresh on KV.
//
// What it does NOT do: it never deletes or writes anything in
// Upstash (the old store stays as a rollback), and it never prints a
// secret value — only counts. Re-running it is safe: it overwrites
// the same KV documents with the same data.

const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL ?? '').replace(/\/$/, '');
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID ?? '';
const CF_NS = process.env.LOY_KV_NAMESPACE_ID ?? '';
const CF_TOKEN = process.env.LOY_KV_API_TOKEN ?? '';

for (const [name, value] of [
  ['UPSTASH_REDIS_REST_URL', UPSTASH_URL],
  ['UPSTASH_REDIS_REST_TOKEN', UPSTASH_TOKEN],
  ['CLOUDFLARE_ACCOUNT_ID', CF_ACCOUNT],
  ['LOY_KV_NAMESPACE_ID', CF_NS],
  ['LOY_KV_API_TOKEN', CF_TOKEN],
]) {
  if (!value) {
    console.error(`[migrate] missing env var ${name}`);
    process.exit(1);
  }
}

const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${CF_NS}`;

// --- Upstash REST helpers -------------------------------------------------

async function upstash(path) {
  const res = await fetch(`${UPSTASH_URL}/${path}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Upstash ${path} -> HTTP ${res.status}`);
  const data = await res.json();
  return data.result;
}

async function upstashScan(match) {
  const keys = [];
  let cursor = '0';
  do {
    const [next, found] = await upstash(`scan/${cursor}/match/${encodeURIComponent(match)}/count/500`);
    cursor = next;
    keys.push(...found);
    if (keys.length >= 20000) break;
  } while (cursor !== '0');
  return keys;
}

// --- KV REST helpers ------------------------------------------------------

async function kvPut(key, value) {
  const res = await fetch(`${KV_BASE}/values/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'text/plain' },
    body: typeof value === 'string' ? value : JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`KV PUT ${key} -> HTTP ${res.status}`);
}

// --- The migration --------------------------------------------------------

const summary = {};
function note(label, count) {
  summary[label] = count;
  console.log(`[migrate] ${label}: ${count}`);
}

// 1. Wishes list (the river itself).
const wishRaw = (await upstash('lrange/loy:wishes/0/-1')) ?? [];
const wishes = [];
for (const item of wishRaw) {
  try {
    const w = typeof item === 'string' ? JSON.parse(item) : item;
    if (w && typeof w.id === 'string' && typeof w.wish === 'string') wishes.push(w);
  } catch {
    // skip a corrupt entry
  }
}
await kvPut('loy:wishes', wishes);
note('wishes', wishes.length);

// 2. Per-wish reactions -> one map doc; blessing lanterns -> one doc each.
const reactions = {};
const blessingCounts = {};
for (const w of wishes) {
  const row = (await upstash(`hgetall/loy:reactions:${w.id}`)) ?? {};
  reactions[w.id] = {
    sathu: Number(row.sathu ?? 0) || 0,
    love: Number(row.love ?? 0) || 0,
    hug: Number(row.hug ?? 0) || 0,
    care: Number(row.care ?? 0) || 0,
    peace: Number(row.peace ?? 0) || 0,
  };
  const lanternsRaw = (await upstash(`lrange/loy:blessings:${w.id}/0/-1`)) ?? [];
  const lanterns = [];
  for (const item of lanternsRaw) {
    try {
      const b = typeof item === 'string' ? JSON.parse(item) : item;
      if (b && typeof b.message === 'number') lanterns.push(b);
    } catch {
      // skip a corrupt entry
    }
  }
  if (lanterns.length > 0) {
    await kvPut(`loy:blessings:${w.id}`, lanterns);
    blessingCounts[w.id] = lanterns.length;
  }
}
await kvPut('loy:reactions', reactions);
await kvPut('loy:blessing-counts', blessingCounts);
note('reaction rows', Object.keys(reactions).length);
note('wishes with lanterns', Object.keys(blessingCounts).length);

// 3. Gratitude counts (hash) + thanks list.
const gratitudeRow = (await upstash('hgetall/loy:gratitude-counts')) ?? {};
const gratitudeCounts = {};
for (const [k, v] of Object.entries(gratitudeRow)) gratitudeCounts[k] = Number(v) || 0;
await kvPut('loy:gratitude-counts', gratitudeCounts);
note('gratitude cards', Object.keys(gratitudeCounts).length);

const thanksRaw = (await upstash('lrange/loy:thanks-list/0/-1')) ?? [];
const thanks = [];
for (const item of thanksRaw) {
  try {
    const t = typeof item === 'string' ? JSON.parse(item) : item;
    if (t && typeof t.card === 'number') thanks.push(t);
  } catch {
    // skip a corrupt entry
  }
}
await kvPut('loy:thanks-list', thanks);
note('thanks entries', thanks.length);

// 4. Visitor states + event logs + sent-blessing sets.
const visitorKeys = await upstashScan('loy:visitor:*');
let visitors = 0;
for (const key of visitorKeys) {
  const id = key.slice('loy:visitor:'.length);
  const raw = await upstash(`get/${encodeURIComponent(key)}`);
  if (raw) {
    await kvPut(`loy:visitor:${id}`, typeof raw === 'string' ? raw : JSON.stringify(raw));
    visitors += 1;
  }
  const eventsRaw = (await upstash(`lrange/loy:events:${encodeURIComponent(id)}/0/-1`)) ?? [];
  if (eventsRaw.length > 0) {
    const events = [];
    for (const item of eventsRaw) {
      try {
        events.push(typeof item === 'string' ? JSON.parse(item) : item);
      } catch {
        // skip a corrupt entry
      }
    }
    await kvPut(`loy:events:${id}`, events);
  }
  const sent = (await upstash(`smembers/loy:sent:${encodeURIComponent(id)}`)) ?? [];
  if (sent.length > 0) await kvPut(`loy:sent:${id}`, sent);
  const thanksBy = await upstash(`get/loy:thanks-by:${encodeURIComponent(id)}`);
  if (thanksBy) await kvPut(`loy:thanks-by:${id}`, typeof thanksBy === 'string' ? thanksBy : JSON.stringify(thanksBy));
}
note('visitor states', visitors);

// 5. Config.
const config = await upstash('get/loy:config');
if (config) {
  await kvPut('loy:config', typeof config === 'string' ? config : JSON.stringify(config));
  note('config', 1);
} else {
  note('config', 0);
}

// 6. Community counters (non-zero only) + floaters + reports + audit.
const counterKeys = await upstashScan('loy:daylight:*');
counterKeys.push(...(await upstashScan('loy:candles:*')));
counterKeys.push(...(await upstashScan('loy:gratitude:*:*')));
counterKeys.push(...(await upstashScan('loy:blessings:20*')));
counterKeys.push(...(await upstashScan('loy:thanks:20*')));
let counters = 0;
for (const key of [...new Set(counterKeys)]) {
  // Skip the per-wish blessing lists and thanks-by docs (handled above).
  if (key.startsWith('loy:blessings:') && !/^loy:blessings:20\d\d-/.test(key)) continue;
  if (key.startsWith('loy:thanks:') && !/^loy:thanks:20\d\d-/.test(key)) continue;
  const value = await upstash(`get/${encodeURIComponent(key)}`);
  const n = Number(value) || 0;
  if (n !== 0) {
    await kvPut(key, String(n));
    counters += 1;
  }
}
note('counters (non-zero)', counters);

const totalCandles = await upstash('get/loy:candles');
if (Number(totalCandles) || 0) {
  await kvPut('loy:candles', String(Number(totalCandles)));
  note('total candles', Number(totalCandles));
}

const floaters = (await upstash('smembers/loy:floaters')) ?? [];
if (floaters.length > 0) await kvPut('loy:floaters', floaters);
note('floaters', floaters.length);

const reportedKeys = await upstashScan('loy:reported-by:*');
for (const key of reportedKeys) {
  const members = (await upstash(`smembers/${encodeURIComponent(key)}`)) ?? [];
  if (members.length > 0) await kvPut(key, members);
}
note('reported-by sets', reportedKeys.length);

const auditRaw = (await upstash('lrange/loy:audit/0/-1')) ?? [];
const audit = [];
for (const item of auditRaw) {
  try {
    audit.push(typeof item === 'string' ? JSON.parse(item) : item);
  } catch {
    // skip a corrupt entry
  }
}
if (audit.length > 0) await kvPut('loy:audit', audit);
note('audit entries', audit.length);

console.log('[migrate] done. Upstash untouched (rollback intact).');
console.log(`[migrate] summary: ${JSON.stringify(summary)}`);
