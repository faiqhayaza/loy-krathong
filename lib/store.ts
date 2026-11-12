// Storage for the shared river.
//
// Primary backend: Upstash Redis (REST) when UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are both set. Fallback: an in-memory store seeded
// with nothing (seeds are merged at read time, never written), so the site
// still works on a preview deploy with zero config. Nothing here ever
// throws on a missing or unreachable Redis — it logs and falls back.

import { Redis } from '@upstash/redis';
import { createHash } from 'crypto';
import type { ReactionCounts, ReactionId, Wish } from './data';
import type { FestivalEvent } from './events';
import { EMPTY_REACTIONS } from './data';
import { SEED_WISHES } from './seed';
import { msUntilBangkokMidnight } from './bangkok';
import { DEFAULT_CONFIG, parseConfig, type FestivalConfig } from './config';
import {
  emptyVisitorState,
  type VisitorClaim,
  type VisitorState,
} from './festivalState';

const WISHES_KEY = 'loy:wishes';
const REACTIONS_KEY = (id: string) => `loy:reactions:${id}`;
const BLESSINGS_KEY = (id: string) => `loy:blessings:${id}`;
const SENT_KEY = (visitorId: string) => `loy:sent:${visitorId}`;
const GRATITUDE_COUNTS_KEY = 'loy:gratitude-counts';
const THANKS_LIST_KEY = 'loy:thanks-list';
const THANKS_BY_KEY = (visitorId: string) => `loy:thanks-by:${visitorId}`;
const RATE_KEY = (ip: string, scope = '') => `loy:rl:${scope ? `${scope}:` : ''}${ip}`;
const DAILY_KEY = (ip: string, day: string) => `loy:daily:${ip}:${day}`;
const EVENTS_KEY = (visitorId: string) => `loy:events:${visitorId}`;

const MAX_STORED = 200;
const POSTS_PER_MINUTE = 5;

// Version counter for the public river: every mutation that changes what
// GET /api/wishes returns bumps it, so the 30 s cache can tell a fresh
// read from a stale one even when the mutation happened in another
// route module (admin hide/approve in E5, report in F2). Same-process
// only — cross-instance staleness stays capped at the 30 s TTL, as
// before. The reset-all path does not bump it: reset clears the cache
// by clearing the store itself, and the version is monotonic within a
// process lifetime.
let memWishesVersion = 0;
export function wishesVersion(): number {
  return memWishesVersion;
}
export function bumpWishesVersion(): void {
  memWishesVersion += 1;
}

let redis: Redis | null = null;
let redisTried = false;

function getRedis(): Redis | null {
  if (redisTried) return redis;
  redisTried = true;
  // Primary names (Upstash dashboard default). The store this project
  // reuses — the team's free `faiq-personal` — was connected with the KV
  // prefix, so its variables are KV_REST_API_URL / KV_REST_API_TOKEN.
  // Either pair works; same store, same `loy:*` keys.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) {
    try {
      redis = new Redis({ url, token });
    } catch (err) {
      console.error('[loy] Redis init failed, using in-memory store:', err);
      redis = null;
    }
  }
  return redis;
}

/** True when the Redis backend is configured (not a guarantee it answers). */
export function usingRedis(): boolean {
  return getRedis() !== null;
}

// Where the last river read actually came from. `usingRedis()` only
// proves the env vars are set — when Upstash is over its command quota
// (or down), reads fall back to per-instance memory while `usingRedis()`
// still says true. The public `storage` field in GET /api/wishes must
// report what really served the read, or the storage watcher (see
// scripts/storage-watch.mjs) cannot see the fallback engage.
let lastWishesReadFrom: 'redis' | 'memory' | null = null;

/** What really served the last river read — the truthful health signal. */
export function storageStatus(): 'redis' | 'memory' {
  if (!usingRedis()) return 'memory';
  return lastWishesReadFrom ?? 'redis';
}

// ---- In-memory fallback -------------------------------------------------

const memWishes: Wish[] = [];
const memReactions = new Map<string, ReactionCounts>();
const memRate = new Map<string, { count: number; resetAt: number }>();
const memDaily = new Map<string, number>(); // key -> ms timestamp when the day slot expires
const memEvents = new Map<string, FestivalEvent[]>(); // visitor recovery id -> events
const memBlessings = new Map<string, { message: number; from: string; at: number }[]>(); // wish id -> lanterns received
const memSent = new Map<string, Set<string>>(); // visitor recovery id -> wish ids blessed
const memGratitudeCounts = new Map<number, number>(); // card id -> lanterns
const memThanksList: { card: number; note: string | null; at: number }[] = [];
const memThanksBy = new Map<string, { card: number; note: string | null; at: number }>(); // visitor recovery id -> thanks

// ---- Reads ---------------------------------------------------------------

async function readStoredWishes(): Promise<Wish[]> {
  const client = getRedis();
  if (client) {
    try {
      const raw = await client.lrange(WISHES_KEY, 0, MAX_STORED - 1);
      const wishes: Wish[] = [];
      for (const item of raw) {
        try {
          const w = (typeof item === 'string' ? JSON.parse(item) : item) as Wish;
          if (w && typeof w.id === 'string' && typeof w.wish === 'string') {
            wishes.push({ ...w, reactions: { ...EMPTY_REACTIONS, ...(w.reactions ?? {}) } });
          }
        } catch {
          // Skip a single corrupt entry rather than failing the whole river.
        }
      }
      lastWishesReadFrom = 'redis';
      return wishes;
    } catch (err) {
      console.error('[loy] Redis read failed, falling back to memory:', err);
      lastWishesReadFrom = 'memory';
    }
  }
  return [...memWishes];
}

async function readReactionCounts(ids: string[]): Promise<Map<string, ReactionCounts>> {
  const out = new Map<string, ReactionCounts>();
  const client = getRedis();
  if (client && ids.length > 0) {
    try {
      const pipe = client.pipeline();
      for (const id of ids) pipe.hgetall(REACTIONS_KEY(id));
      const results = await pipe.exec();
      ids.forEach((id, i) => {
        const row = (results[i] ?? {}) as Record<string, number | string>;
        out.set(id, {
          sathu: Number(row.sathu ?? 0) || 0,
          love: Number(row.love ?? 0) || 0,
          hug: Number(row.hug ?? 0) || 0,
          care: Number(row.care ?? 0) || 0,
          peace: Number(row.peace ?? 0) || 0,
        });
      });
      return out;
    } catch (err) {
      console.error('[loy] Redis reaction read failed:', err);
    }
  }
  for (const id of ids) {
    out.set(id, memReactions.get(id) ?? { ...EMPTY_REACTIONS });
  }
  return out;
}

/**
 * The whole river: stored wishes (newest first) merged with the eight seed
 * wishes, sorted newest-first by createdAt. Seeds are never written to
 * Redis — they are merged here, marked isSeed. Reaction counts are merged
 * in for every wish; seeds start at zero.
 */
export async function listWishes(): Promise<{ wishes: Wish[]; totalReactions: number }> {
  const stored = await readStoredWishes();
  const all = [...stored, ...SEED_WISHES];
  const counts = await readReactionCounts(all.map((w) => w.id));
  const blessingCounts = await readBlessingCounts(all.map((w) => w.id));
  let totalReactions = 0;
  const wishes = all
    // E1: the public river shows approved wishes only. A wish with status
    // 'reported' or 'hidden' stays in the store (the admin queue in E5
    // works on it) but never reaches the public river; the owner sees it
    // through api/state instead. The internal `visitorId` (who floated it)
    // is stripped here — it never leaves the server on a public read.
    .filter((w) => (w.status ?? 'approved') === 'approved')
    .map((w) => {
      const reactions = counts.get(w.id) ?? { ...EMPTY_REACTIONS };
      totalReactions +=
        reactions.sathu + reactions.love + reactions.hug + reactions.care + reactions.peace;
      const { visitorId: _v, ...pub } = w;
      void _v;
      return { ...pub, reactions, blessings: blessingCounts.get(w.id) ?? 0 };
    })
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_STORED);
  return { wishes, totalReactions };
}

// ---- The river's short server-side cache (GET /api/wishes) -------------
//
// The shared river is backed by a free-tier Redis with a daily command
// budget, and every visitor polls GET /api/wishes. One Redis read per
// 30 s per instance, at most. The cache lives here (not in the route
// file) because a route file may not export anything but route
// handlers — any write route that changes what the river shows
// (a float, a blessing lantern) invalidates it through
// invalidateWishesCache().

const WISHES_CACHE_TTL_MS = 30_000;
let wishesCache: {
  at: number;
  version: number;
  payload: { wishes: Wish[]; count: number; totalReactions: number; storage: string; redisOk: boolean };
} | null = null;

/** The cached river payload for GET /api/wishes. */
export async function listWishesCached(): Promise<{
  wishes: Wish[];
  count: number;
  totalReactions: number;
  storage: string;
  redisOk: boolean;
}> {
  const now = Date.now();
  // E5: the cache also keys on the river version — a moderation change
  // (admin hide/approve) or a report bumps it, so a cached page never
  // keeps serving a wish that just left the river (or hides one that
  // just came back) for the rest of the 30 s TTL.
  if (wishesCache && now - wishesCache.at < WISHES_CACHE_TTL_MS && wishesCache.version === wishesVersion()) {
    return wishesCache.payload;
  }
  const { wishes, totalReactions } = await listWishes();
  // `storage` is a first-hand health signal: "redis" proves wishes are
  // shared through Upstash; "memory" means the river is running on a
  // per-instance fallback. It reports what the read above actually hit
  // (storageStatus), NOT just whether the env vars are set — when
  // Upstash is over its quota the reads fail and the fallback engages,
  // and this field is how the watcher notices. `redisOk` is the same
  // signal as a boolean for the watcher script.
  const storage = storageStatus();
  const payload = { wishes, count: wishes.length, totalReactions, storage, redisOk: storage === 'redis' };
  wishesCache = { at: now, version: wishesVersion(), payload };
  return payload;
}

/** Drop the cached river (called by write routes that change it). */
export function invalidateWishesCache(): void {
  wishesCache = null;
}

/**
 * Stored wishes only — what real visitors floated, newest first, with
 * reaction counts merged in. Seeds are NOT included (they ship with the
 * site, they were never inputted). This is what the admin export serves.
 */
export async function listStoredWishes(): Promise<Wish[]> {
  const stored = await readStoredWishes();
  const counts = await readReactionCounts(stored.map((w) => w.id));
  return stored
    .map((w) => {
      const { visitorId: _v, ...pub } = w;
      void _v;
      return { ...pub, reactions: counts.get(w.id) ?? { ...EMPTY_REACTIONS } };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Server-internal read of stored wishes WITH the visitorId intact, so
 * api/state (and only api/state) can match a visitor to their own
 * wishes. Never returned to a client directly.
 */
export async function listStoredWishesRaw(): Promise<Wish[]> {
  const stored = await readStoredWishes();
  const counts = await readReactionCounts(stored.map((w) => w.id));
  return stored
    .map((w) => ({ ...w, reactions: counts.get(w.id) ?? { ...EMPTY_REACTIONS } }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ---- Writes ---------------------------------------------------------------

export async function addWish(wish: Wish): Promise<void> {
  const client = getRedis();
  if (client) {
    try {
      await client.lpush(WISHES_KEY, JSON.stringify(wish));
      await client.ltrim(WISHES_KEY, 0, MAX_STORED - 1);
      bumpWishesVersion();
      return;
    } catch (err) {
      console.error('[loy] Redis write failed, keeping wish in memory:', err);
    }
  }
  memWishes.unshift(wish);
  if (memWishes.length > MAX_STORED) memWishes.length = MAX_STORED;
  bumpWishesVersion();
}

/**
 * True when a wish with this id is on the river (stored or seed). The
 * react route checks it first: reacting to a wish that does not exist
 * is a 404, not a silent 200 that invents a reaction row for it.
 */
export async function wishExists(id: string): Promise<boolean> {
  if (SEED_WISHES.some((w) => w.id === id)) return true;
  const stored = await readStoredWishes();
  return stored.some((w) => w.id === id);
}

/**
 * One reaction per wish per visitor (Rules: toggleReaction in the original
 * site). The client sends the reaction it is moving FROM (or null) and the
 * one it is moving TO (or null); the counts move by one in each direction,
 * never below zero. Setting the same reaction twice removes it.
 */
export async function setReaction(
  id: string,
  previous: ReactionId | null,
  next: ReactionId | null,
): Promise<ReactionCounts | null> {
  const client = getRedis();
  if (client) {
    try {
      const row = (await client.hgetall(REACTIONS_KEY(id))) as Record<string, string>;
      const counts: ReactionCounts = {
        sathu: Number(row.sathu ?? 0) || 0,
        love: Number(row.love ?? 0) || 0,
        hug: Number(row.hug ?? 0) || 0,
        care: Number(row.care ?? 0) || 0,
        peace: Number(row.peace ?? 0) || 0,
      };
      if (previous) counts[previous] = Math.max(0, counts[previous] - 1);
      if (next) counts[next] += 1;
      await client.hset(REACTIONS_KEY(id), { ...counts } as Record<string, number>);
      return counts;
    } catch (err) {
      console.error('[loy] Redis reaction write failed:', err);
    }
  }
  const current = memReactions.get(id) ?? { ...EMPTY_REACTIONS };
  if (previous) current[previous] = Math.max(0, current[previous] - 1);
  if (next) current[next] += 1;
  memReactions.set(id, current);
  return { ...current };
}

export async function deleteWish(id: string): Promise<boolean> {
  const client = getRedis();
  if (client) {
    try {
      // LREM needs the exact stored value; fetch the list and find it.
      const raw = await client.lrange(WISHES_KEY, 0, MAX_STORED - 1);
      let removed = 0;
      for (const item of raw) {
        const text = typeof item === 'string' ? item : JSON.stringify(item);
        try {
          if ((JSON.parse(text) as Wish).id === id) {
            removed += await client.lrem(WISHES_KEY, 1, text);
          }
        } catch {
          // ignore corrupt entries
        }
      }
      await client.del(REACTIONS_KEY(id));
      if (removed > 0) bumpWishesVersion();
      return removed > 0;
    } catch (err) {
      console.error('[loy] Redis delete failed:', err);
      return false;
    }
  }
  const idx = memWishes.findIndex((w) => w.id === id);
  if (idx === -1) return false;
  memWishes.splice(idx, 1);
  memReactions.delete(id);
  bumpWishesVersion();
  return true;
}

// ---- Rate limiting ---------------------------------------------------------

const RESTORE_ID_KEY = (id: string) => `loy:restore-id:${id}`;
const RESTORE_ID_MAX_PER_HOUR = 10;
const memRestoreId = new Map<string, { count: number; resetAt: number }>();

/**
 * Restore-attempt limit per recovery ID: max 10 tries per hour for one
 * ID, whatever the IPs (E1 — the ID is a bearer token, so guessing one
 * ID from many addresses must still stop). Redis: INCR + 1h expiry;
 * in-memory fallback: same rule, same window.
 */
export async function checkRestoreIdLimit(id: string): Promise<boolean> {
  const key = RESTORE_ID_KEY(id);
  const client = getRedis();
  if (client) {
    try {
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, 3600);
      return count <= RESTORE_ID_MAX_PER_HOUR;
    } catch (err) {
      console.error('[loy] Redis restore-id limit failed, using memory:', err);
    }
  }
  const now = Date.now();
  const entry = memRestoreId.get(key);
  if (!entry || now > entry.resetAt) {
    memRestoreId.set(key, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= RESTORE_ID_MAX_PER_HOUR;
}

/**
 * Max 5 posts per minute per IP by default. Returns true when the post is allowed.
 * `scope` keeps buckets separate per endpoint family ('' is the float
 * bucket); without it, a visitor reacting a lot could eat the float
 * budget and be unable to float. The event route uses scope 'event'.
 * `max` raises the cap for an endpoint family that legitimately posts
 * more often (the admin config form, 30/min) — the guard stays, the
 * ceiling fits the use.
 */
export async function checkRateLimit(ip: string, scope = '', max: number = POSTS_PER_MINUTE): Promise<boolean> {
  const client = getRedis();
  if (client) {
    try {
      const count = await client.incr(RATE_KEY(ip, scope));
      if (count === 1) await client.expire(RATE_KEY(ip, scope), 60);
      return count <= max;
    } catch (err) {
      console.error('[loy] Redis rate-limit check failed, allowing:', err);
      return true;
    }
  }
  const now = Date.now();
  const entry = memRate.get(RATE_KEY(ip, scope));
  if (!entry || now > entry.resetAt) {
    memRate.set(RATE_KEY(ip, scope), { count: 1, resetAt: now + 60000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}

// ---- Daily limit (one float per day, Bangkok day) -------------------------

/**
 * One float per Bangkok day per IP, like the original site. The first call
 * for an IP on a day claims that day's slot and returns true; any later
 * call the same day returns false. Redis: SET NX with expiry to the next
 * Bangkok midnight, so the key cleans itself up. In-memory fallback:
 * same rule, same expiry. A Redis error falls back to memory rather than
 * blocking the river — the limit is a fairness rule, not a security gate.
 */
export async function checkDailyLimit(ip: string, day: string): Promise<boolean> {
  const key = DAILY_KEY(ip, day);
  const ttlSeconds = Math.max(1, Math.ceil(msUntilBangkokMidnight() / 1000));
  const client = getRedis();
  if (client) {
    try {
      const claimed = await client.set(key, '1', { nx: true, ex: ttlSeconds });
      return claimed === 'OK';
    } catch (err) {
      console.error('[loy] Redis daily-limit check failed, using memory:', err);
    }
  }
  const now = Date.now();
  const expiresAt = memDaily.get(key);
  if (expiresAt !== undefined && now < expiresAt) return false;
  memDaily.set(key, now + msUntilBangkokMidnight(now));
  return true;
}

/**
 * Release today's daily slot for an IP. Called only after an
 * owner-checked DELETE removes the visitor's own krathong, so they can
 * float again the same day. Redis: DEL the key; in-memory fallback:
 * drop the entry. The 5/min rate limit still applies to the re-float.
 */
export async function clearDailyLimit(ip: string, day: string): Promise<void> {
  const key = DAILY_KEY(ip, day);
  const client = getRedis();
  if (client) {
    try {
      await client.del(key);
      return;
    } catch (err) {
      console.error('[loy] Redis daily-limit clear failed, using memory:', err);
    }
  }
  memDaily.delete(key);
}

// ---- Server event log (D1) -------------------------------------------------

/**
 * The forward-compatible per-visitor event log E1 will later read as
 * `me.events`: Redis list `loy:events:<recovery-id>` (in-memory fallback
 * when Redis is absent, same pattern as wishes). Keyed by the visitor's
 * recovery ID — never by nickname, eID, or anything personal. The
 * device-local store (`lib/events.ts`) is the source of truth for now;
 * this log mirrors it. Repeats (same day + kind + ref) are ignored, so
 * the log stays deduped like the client store. Returns true when a new
 * event was recorded.
 */
const MAX_EVENTS_PER_VISITOR = 500;

export async function recordServerEvent(visitorId: string, event: FestivalEvent): Promise<boolean> {
  const key = EVENTS_KEY(visitorId);
  const client = getRedis();
  if (client) {
    try {
      const raw = await client.lrange(key, 0, MAX_EVENTS_PER_VISITOR - 1);
      for (const item of raw) {
        try {
          const e = (typeof item === 'string' ? JSON.parse(item) : item) as FestivalEvent;
          if (e.day === event.day && e.kind === event.kind && e.ref === event.ref) return false;
        } catch {
          // skip a corrupt entry; the new event still records
        }
      }
      await client.rpush(key, JSON.stringify(event));
      await client.ltrim(key, 0, MAX_EVENTS_PER_VISITOR - 1);
      // E1: the visitor doc (`loy:visitor:<id>`) is what api/state
      // returns as me.events, so the log write is mirrored there.
      await mergeEventIntoVisitorState(visitorId, event);
      return true;
    } catch (err) {
      console.error('[loy] Redis event write failed, keeping event in memory:', err);
    }
  }
  const list = memEvents.get(visitorId) ?? [];
  if (list.some((e) => e.day === event.day && e.kind === event.kind && e.ref === event.ref)) return false;
  list.push(event);
  if (list.length > MAX_EVENTS_PER_VISITOR) list.splice(0, list.length - MAX_EVENTS_PER_VISITOR);
  memEvents.set(visitorId, list);
  await mergeEventIntoVisitorState(visitorId, event);
  return true;
}

/** Remove one event from the visitor's server log. True when one was removed. */
export async function removeServerEvent(
  visitorId: string,
  day: string,
  kind: FestivalEvent['kind'],
  ref: string | number,
): Promise<boolean> {
  const key = EVENTS_KEY(visitorId);
  const client = getRedis();
  if (client) {
    try {
      const raw = await client.lrange(key, 0, MAX_EVENTS_PER_VISITOR - 1);
      let removed = false;
      for (const item of raw) {
        const text = typeof item === 'string' ? item : JSON.stringify(item);
        try {
          const e = JSON.parse(text) as FestivalEvent;
          if (e.day === day && e.kind === kind && e.ref === ref) {
            removed = (await client.lrem(key, 1, text)) > 0 || removed;
          }
        } catch {
          // ignore corrupt entries
        }
      }
      if (removed) await removeEventFromVisitorState(visitorId, day, kind, ref);
      return removed;
    } catch (err) {
      console.error('[loy] Redis event remove failed:', err);
      return false;
    }
  }
  const list = memEvents.get(visitorId) ?? [];
  const kept = list.filter((e) => !(e.day === day && e.kind === kind && e.ref === ref));
  memEvents.set(visitorId, kept);
  if (kept.length !== list.length) await removeEventFromVisitorState(visitorId, day, kind, ref);
  return kept.length !== list.length;
}

// ---- Server event reads (claim evidence, A2 / chunk F) ----------------------
//
// The claim route verifies a mission was actually completed before it
// pays River Light. The visitor document (`loy:visitor:<id>`) is the
// canonical log — recordServerEvent mirrors every event there — so
// these read it through getVisitorState, never a second key scheme.

/** The visitor's server event log, oldest first (the D1 log). */
export async function listServerEvents(visitorId: string): Promise<FestivalEvent[]> {
  return [...(await getVisitorState(visitorId)).events];
}

/** True when the visitor's server log holds any of these kinds on this day (any ref). */
export async function hasServerEventKinds(
  visitorId: string,
  day: string,
  kinds: readonly string[],
): Promise<boolean> {
  const events = await listServerEvents(visitorId);
  return events.some((e) => e.day === day && kinds.includes(e.kind));
}

/** True when the visitor's server log holds this exact event. */
export async function hasServerEvent(
  visitorId: string,
  day: string,
  kind: FestivalEvent['kind'],
  ref: string | number,
): Promise<boolean> {
  const events = await listServerEvents(visitorId);
  return events.some((e) => e.day === day && e.kind === kind && e.ref === ref);
}

/** Distinct wish ids the visitor reacted to on this day (kindness evidence). */
export async function countDistinctReacts(visitorId: string, day: string): Promise<number> {
  const events = await listServerEvents(visitorId);
  return new Set(events.filter((e) => e.day === day && e.kind === 'react').map((e) => e.ref)).size;
}

/**
 * True when the visitor found this secret — either a `secret` event in
 * the server log (the live path: lib/secrets.ts records one when the
 * riddle is solved) or the slug in the migrated `me.secrets` list
 * (the migration merges device-local secrets, and claims are never
 * migrated — see POST /api/state/migrate). The claim route and the
 * migration agree on this one check, so a secret claim is never
 * silently dropped in either path. Both sources are client-asserted,
 * exactly like every other event in the server log.
 */
export async function hasSecretEvidence(visitorId: string, slug: string): Promise<boolean> {
  const state = await getVisitorState(visitorId);
  if (state.secrets.includes(slug)) return true;
  return state.events.some((e) => e.kind === 'secret' && e.ref === slug);
}

// ---- Blessing lanterns (B2) -----------------------------------------------

export interface ReceivedBlessing {
  message: number;
  from: string;
  at: number;
}

const MAX_BLESSINGS_PER_WISH = 50;

/** Counts of blessing lanterns per wish id (Redis LLEN / memory lengths). */
export async function readBlessingCounts(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const client = getRedis();
  if (client && ids.length > 0) {
    try {
      const pipe = client.pipeline();
      for (const id of ids) pipe.llen(BLESSINGS_KEY(id));
      const results = await pipe.exec();
      ids.forEach((id, i) => out.set(id, Number(results[i] ?? 0) || 0));
      return out;
    } catch (err) {
      console.error('[loy] Redis blessing-count read failed:', err);
    }
  }
  for (const id of ids) out.set(id, memBlessings.get(id)?.length ?? 0);
  return out;
}

/**
 * Hang one blessing lantern on a wish: appends {message, from, at} to
 * `loy:blessings:<wishId>` (capped at 50) and returns the new count.
 * `from` is the sender's display nickname (never an id) — the receiver
 * sees it in their My Krathong panel (C4).
 */
export async function addBlessing(
  wishId: string,
  message: number,
  from: string,
): Promise<number> {
  const entry: ReceivedBlessing = { message, from: from.slice(0, 40), at: Date.now() };
  const client = getRedis();
  if (client) {
    try {
      const count = await client.rpush(BLESSINGS_KEY(wishId), JSON.stringify(entry));
      await client.ltrim(BLESSINGS_KEY(wishId), -MAX_BLESSINGS_PER_WISH, -1);
      return Math.min(count, MAX_BLESSINGS_PER_WISH);
    } catch (err) {
      console.error('[loy] Redis blessing write failed, keeping it in memory:', err);
    }
  }
  const list = memBlessings.get(wishId) ?? [];
  list.push(entry);
  if (list.length > MAX_BLESSINGS_PER_WISH) list.splice(0, list.length - MAX_BLESSINGS_PER_WISH);
  memBlessings.set(wishId, list);
  return list.length;
}

/** The lanterns a wish received, oldest first (max 50). */
export async function getBlessings(wishId: string): Promise<ReceivedBlessing[]> {
  const client = getRedis();
  if (client) {
    try {
      const raw = await client.lrange(BLESSINGS_KEY(wishId), 0, MAX_BLESSINGS_PER_WISH - 1);
      const out: ReceivedBlessing[] = [];
      for (const item of raw) {
        try {
          const b = (typeof item === 'string' ? JSON.parse(item) : item) as ReceivedBlessing;
          if (b && typeof b.message === 'number') out.push(b);
        } catch {
          // skip a corrupt entry
        }
      }
      return out;
    } catch (err) {
      console.error('[loy] Redis blessing read failed:', err);
    }
  }
  return [...(memBlessings.get(wishId) ?? [])];
}

/**
 * One lantern per krathong per visitor (the HTML's `blessingAgain`
 * rule), enforced server-side when the visitor's recovery ID is
 * known. Returns true when this is the visitor's FIRST lantern to
 * this wish (and remembers it); false when one was already sent.
 */
export async function markSentBlessing(visitorId: string, wishId: string): Promise<boolean> {
  const client = getRedis();
  if (client) {
    try {
      return (await client.sadd(SENT_KEY(visitorId), wishId)) === 1;
    } catch (err) {
      console.error('[loy] Redis sent-blessing write failed, using memory:', err);
    }
  }
  const set = memSent.get(visitorId) ?? new Set<string>();
  if (set.has(wishId)) return false;
  set.add(wishId);
  memSent.set(visitorId, set);
  return true;
}

// ---- Gratitude lanterns (B3) ----------------------------------------------

export interface CommunityThanks {
  card: number;
  note: string | null;
  at: number;
}

const MAX_THANKS_LISTED = 30;

/**
 * Community gratitude counts per card (the numbers the picker shows).
 * Solo-mode rule for a device with no server counts: its own thanks
 * counts as 1 for its card — the client adds that itself.
 */
export async function getGratitudeCounts(): Promise<Record<number, number>> {
  const client = getRedis();
  if (client) {
    try {
      const row = (await client.hgetall(GRATITUDE_COUNTS_KEY)) as Record<string, string>;
      const out: Record<number, number> = {};
      for (const [k, v] of Object.entries(row)) out[Number(k)] = Number(v) || 0;
      return out;
    } catch (err) {
      console.error('[loy] Redis gratitude-count read failed:', err);
    }
  }
  const out: Record<number, number> = {};
  for (const [k, v] of memGratitudeCounts) out[k] = v;
  return out;
}

/** Lanterns of thanks drifting on the water, newest first (max 30). */
export async function getThanksList(): Promise<CommunityThanks[]> {
  const client = getRedis();
  if (client) {
    try {
      const raw = await client.lrange(THANKS_LIST_KEY, 0, MAX_THANKS_LISTED - 1);
      const out: CommunityThanks[] = [];
      for (const item of raw) {
        try {
          const t = (typeof item === 'string' ? JSON.parse(item) : item) as CommunityThanks;
          if (t && typeof t.card === 'number') out.push(t);
        } catch {
          // skip a corrupt entry
        }
      }
      return out;
    } catch (err) {
      console.error('[loy] Redis thanks-list read failed:', err);
    }
  }
  return [...memThanksList].slice(0, MAX_THANKS_LISTED);
}

/**
 * Record a lantern of thanks: bump the card's community count and add
 * it to the drifting list. When a visitor id is given, the lantern is
 * also remembered per visitor — a second set from the same visitor
 * answers `already` instead of storing a second lantern (the HTML's
 * once-only rule). Returns null when the visitor already has one.
 */
export async function addThanks(
  card: number,
  note: string | null,
  visitorId?: string | null,
): Promise<CommunityThanks | null> {
  const entry: CommunityThanks = { card, note: note ? note.slice(0, 60) : null, at: Date.now() };
  const client = getRedis();
  if (client) {
    try {
      if (visitorId) {
        const existing = await client.get(THANKS_BY_KEY(visitorId));
        if (existing) return null;
        await client.set(THANKS_BY_KEY(visitorId), JSON.stringify(entry));
      }
      await client.hincrby(GRATITUDE_COUNTS_KEY, String(card), 1);
      await client.lpush(THANKS_LIST_KEY, JSON.stringify(entry));
      await client.ltrim(THANKS_LIST_KEY, 0, MAX_THANKS_LISTED - 1);
      return entry;
    } catch (err) {
      console.error('[loy] Redis thanks write failed, keeping it in memory:', err);
    }
  }
  if (visitorId) {
    if (memThanksBy.has(visitorId)) return null;
    memThanksBy.set(visitorId, entry);
  }
  memGratitudeCounts.set(card, (memGratitudeCounts.get(card) ?? 0) + 1);
  memThanksList.unshift(entry);
  if (memThanksList.length > MAX_THANKS_LISTED) memThanksList.length = MAX_THANKS_LISTED;
  return entry;
}

// ---- Festival config (E2) --------------------------------------------------

const CONFIG_KEY = 'loy:config';

let memConfig: FestivalConfig | null = null;

/** The organiser config; defaults when nothing was ever saved. */
export async function getConfig(): Promise<FestivalConfig> {
  const client = getRedis();
  if (client) {
    try {
      const raw = await client.get<Record<string, unknown>>(CONFIG_KEY);
      if (raw) return parseConfig(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch (err) {
      console.error('[loy] Redis config read failed, using memory:', err);
    }
  }
  return memConfig ?? { ...DEFAULT_CONFIG, targets: [...DEFAULT_CONFIG.targets] };
}

export async function saveConfig(config: FestivalConfig): Promise<void> {
  const parsed = parseConfig(config);
  const client = getRedis();
  if (client) {
    try {
      await client.set(CONFIG_KEY, JSON.stringify(parsed));
      return;
    } catch (err) {
      console.error('[loy] Redis config write failed, keeping in memory:', err);
    }
  }
  memConfig = parsed;
}

// ---- Per-visitor state (E1) ------------------------------------------------

const VISITOR_KEY = (visitorId: string) => `loy:visitor:${visitorId}`;

const memVisitors = new Map<string, VisitorState>();

function parseVisitorState(raw: unknown): VisitorState {
  const state = emptyVisitorState();
  if (!raw || typeof raw !== 'object') return state;
  const o = raw as Record<string, unknown>;
  if (o.krathong && typeof o.krathong === 'object') {
    const k = o.krathong as Record<string, unknown>;
    if (typeof k.flower === 'string' && typeof k.boat === 'string') {
      state.krathong = { flower: k.flower, boat: k.boat };
    }
  }
  if (Array.isArray(o.events)) {
    state.events = o.events.filter(
      (e): e is FestivalEvent =>
        !!e && typeof e === 'object' && typeof (e as FestivalEvent).day === 'string',
    );
  }
  if (Array.isArray(o.claims)) {
    state.claims = o.claims.filter(
      (c): c is VisitorClaim =>
        !!c && typeof c === 'object' && typeof (c as VisitorClaim).slot === 'string',
    );
  }
  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : [];
  state.stamps = strList(o.stamps);
  state.visits = strList(o.visits);
  state.secrets = strList(o.secrets);
  if (o.thanks && typeof o.thanks === 'object') {
    const t = o.thanks as Record<string, unknown>;
    if (typeof t.card === 'number' && typeof t.note === 'string' && typeof t.at === 'number') {
      state.thanks = { card: t.card, note: t.note, at: t.at };
    }
  }
  if (Array.isArray(o.sent)) {
    state.sent = o.sent.filter(
      (s): s is VisitorState['sent'][number] =>
        !!s && typeof s === 'object' && typeof (s as { wishId?: unknown }).wishId === 'string',
    );
  }
  if (o.received && typeof o.received === 'object') {
    const r: VisitorState['received'] = {};
    for (const [k, v] of Object.entries(o.received as Record<string, unknown>)) {
      if (Array.isArray(v)) r[k] = v.filter((x) => !!x && typeof x === 'object');
    }
    state.received = r;
  }
  return state;
}

/** The visitor's server-side state, or an empty one when they have none. */
export async function getVisitorState(visitorId: string): Promise<VisitorState> {
  const client = getRedis();
  if (client) {
    try {
      const raw = await client.get<Record<string, unknown>>(VISITOR_KEY(visitorId));
      if (raw) return parseVisitorState(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch (err) {
      console.error('[loy] Redis visitor read failed, using memory:', err);
    }
  }
  return memVisitors.get(visitorId) ?? emptyVisitorState();
}

export async function saveVisitorState(visitorId: string, state: VisitorState): Promise<void> {
  const parsed = parseVisitorState(state);
  const client = getRedis();
  if (client) {
    try {
      await client.set(VISITOR_KEY(visitorId), JSON.stringify(parsed));
      return;
    } catch (err) {
      console.error('[loy] Redis visitor write failed, keeping in memory:', err);
    }
  }
  memVisitors.set(visitorId, parsed);
}

/** Patch a few fields of a visitor's state (partial update, E1 PATCH). */
export async function patchVisitorState(
  visitorId: string,
  patch: Partial<VisitorState>,
): Promise<VisitorState> {
  const current = await getVisitorState(visitorId);
  const next: VisitorState = { ...current, ...patch };
  await saveVisitorState(visitorId, next);
  return next;
}

/**
 * Mirror one event into the visitor doc's `events` (E1). The D1 log
 * (`loy:events:<id>`) is the write-ahead record; the doc is what
 * api/state returns as `me.events`. Function declaration, so the
 * earlier recordServerEvent can call it (hoisted).
 */
export async function mergeEventIntoVisitorState(
  visitorId: string,
  event: FestivalEvent,
): Promise<void> {
  const state = await getVisitorState(visitorId);
  if (state.events.some((e) => e.day === event.day && e.kind === event.kind && e.ref === event.ref)) return;
  state.events.push(event);
  if (state.events.length > 500) state.events.splice(0, state.events.length - 500);
  await saveVisitorState(visitorId, state);
}

/** Remove one event from the visitor doc (mirrors removeServerEvent). */
export async function removeEventFromVisitorState(
  visitorId: string,
  day: string,
  kind: FestivalEvent['kind'],
  ref: string | number,
): Promise<void> {
  const state = await getVisitorState(visitorId);
  const kept = state.events.filter((e) => !(e.day === day && e.kind === kind && e.ref === ref));
  if (kept.length === state.events.length) return;
  state.events = kept;
  await saveVisitorState(visitorId, state);
}

/**
 * One-time migration of device-local state to the server (E1). Union
 * semantics: events/stamps/visits/secrets deduped together, sent/received
 * merged, krathong/thanks taken from the device only when the server has
 * none — the server's copy wins on a conflict, because it may already
 * hold progress from another device.
 */
export async function mergeVisitorState(
  visitorId: string,
  incoming: Partial<VisitorState>,
): Promise<VisitorState> {
  const current = await getVisitorState(visitorId);
  const dedupeEvents = (a: FestivalEvent[], b: FestivalEvent[]): FestivalEvent[] => {
    const seen = new Set(a.map((e) => `${e.day}|${e.kind}|${e.ref}`));
    const out = [...a];
    for (const e of b) {
      const k = `${e.day}|${e.kind}|${e.ref}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(e);
      }
    }
    return out.slice(-500);
  };
  const union = (a: string[], b: string[]): string[] => [...new Set([...a, ...b])];
  const merged: VisitorState = {
    krathong: current.krathong ?? incoming.krathong ?? null,
    events: dedupeEvents(current.events, incoming.events ?? []),
    claims: current.claims,
    stamps: union(current.stamps, incoming.stamps ?? []),
    visits: union(current.visits, incoming.visits ?? []),
    secrets: union(current.secrets, incoming.secrets ?? []),
    thanks: current.thanks ?? incoming.thanks ?? null,
    sent: [...current.sent, ...(incoming.sent ?? [])].filter(
      (s, i, arr) => arr.findIndex((x) => x.wishId === s.wishId && x.message === s.message) === i,
    ),
    received: { ...current.received },
  };
  for (const [k, v] of Object.entries(incoming.received ?? {})) {
    merged.received[k] = [...(merged.received[k] ?? []), ...v];
  }
  await saveVisitorState(visitorId, merged);
  return merged;
}

/** True when the visitor has any server-side state at all (restore check). */
export async function visitorStateExists(visitorId: string): Promise<boolean> {
  const s = await getVisitorState(visitorId);
  return (
    s.events.length > 0 ||
    s.claims.length > 0 ||
    s.stamps.length > 0 ||
    s.visits.length > 0 ||
    s.secrets.length > 0 ||
    s.krathong !== null ||
    s.thanks !== null ||
    s.sent.length > 0 ||
    Object.keys(s.received).length > 0
  );
}

/** Record a mission claim for a visitor (A2's write path) and add its
 * River Light to tonight's community total. */
export async function recordClaim(visitorId: string, claim: VisitorClaim): Promise<boolean> {
  const state = await getVisitorState(visitorId);
  if (state.claims.some((c) => c.day === claim.day && c.slot === claim.slot)) return false;
  state.claims.push(claim);
  await saveVisitorState(visitorId, state);
  await addDaylight(claim.day, claim.rl);
  return true;
}

// ---- Community aggregates (E1) ---------------------------------------------

const DAYLIGHT_KEY = (day: string) => `loy:daylight:${day}`;
const CANDLES_KEY = (day: string) => `loy:candles:${day}`;
const GRATITUDE_KEY = (day: string, card: number) => `loy:gratitude:${day}:${card}`;
const BLESSINGS_DAY_KEY = (day: string) => `loy:blessings:${day}`;
const THANKS_KEY = (day: string) => `loy:thanks:${day}`;
const SKY_KEY = (day: string) => `loy:sky:${day}`;
const FLOATERS_KEY = 'loy:floaters';

const memCounters = new Map<string, number>();
const memThanks = new Map<string, NonNullable<VisitorState['thanks']>[]>();const memSky = new Map<string, { id: string; message: number; to: string }[]>();
const memFloaters = new Set<string>();

async function incrCounter(key: string, by: number): Promise<number> {
  const client = getRedis();
  if (client) {
    try {
      return await client.incrby(key, by);
    } catch (err) {
      console.error('[loy] Redis counter failed, using memory:', err);
    }
  }
  const next = (memCounters.get(key) ?? 0) + by;
  memCounters.set(key, next);
  return next;
}

async function readCounter(key: string): Promise<number> {
  const client = getRedis();
  if (client) {
    try {
      return Number(await client.get<number>(key)) || 0;
    } catch (err) {
      console.error('[loy] Redis counter read failed, using memory:', err);
    }
  }
  return memCounters.get(key) ?? 0;
}

/** Add River Light to a night's community milestone total (A3 reads it). */
export async function addDaylight(day: string, rl: number): Promise<number> {
  return incrCounter(DAYLIGHT_KEY(day), rl);
}

export async function getDayLight(days: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const day of days) out[day] = await readCounter(DAYLIGHT_KEY(day));
  return out;
}

/** A single night's community River Light total (the claim route's reply). */
export async function getDaylight(day: string): Promise<number> {
  return readCounter(DAYLIGHT_KEY(day));
}

export async function incrementCandles(day: string): Promise<number> {
  return incrCounter(CANDLES_KEY(day), 1);
}

// ---- Daily candle counting (F1, once per visitor per day) -------------------
//
// E's `incrementCandles(day)` is a plain per-day counter; the candle
// route needs F's rule — one candle in the chain per visitor (or IP)
// per day, so lighting again the same day (a recolour) never inflates
// it. This wrapper adds the dedupe and also keeps the all-days total
// (`loy:candles`) that GET /api/candle answers with. The per-day
// counter still moves through E's `incrementCandles`, so /api/state's
// `candles` (today) and the chain total can never disagree about a
// lighting — both are written here, in the same call.

const CANDLES_TOTAL_KEY = 'loy:candles';
const CANDLE_LIT_KEY = (key: string, day: string) => `loy:candle-lit:${key}:${day}`;
const memCandleLit = new Set<string>(); // `${key}:${day}` — visitor id or `ip:<ip>`

/** Community candles in the chain, all days. */
export async function getCandleCount(): Promise<number> {
  return readCounter(CANDLES_TOTAL_KEY);
}

/**
 * Count one candle in the chain — once per visitor (or per IP when no
 * recovery ID was sent) per Bangkok day. Returns the community total
 * and whether this was the visitor's first candle today.
 */
export async function incrementCandlesOnce(
  visitorKey: string,
  day: string,
): Promise<{ count: number; first: boolean }> {
  const litKey = CANDLE_LIT_KEY(visitorKey, day);
  const ttlSeconds = Math.max(1, Math.ceil(msUntilBangkokMidnight() / 1000));
  const client = getRedis();
  if (client) {
    try {
      const first = (await client.set(litKey, '1', { nx: true, ex: ttlSeconds })) === 'OK';
      if (!first) return { count: await readCounter(CANDLES_TOTAL_KEY), first: false };
      await incrementCandles(day);
      const count = await incrCounter(CANDLES_TOTAL_KEY, 1);
      return { count, first: true };
    } catch (err) {
      console.error('[loy] Redis candle write failed, keeping it in memory:', err);
    }
  }
  const memo = `${visitorKey}:${day}`;
  if (memCandleLit.has(memo)) return { count: memCounters.get(CANDLES_TOTAL_KEY) ?? 0, first: false };
  memCandleLit.add(memo);
  await incrementCandles(day);
  const count = await incrCounter(CANDLES_TOTAL_KEY, 1);
  return { count, first: true };
}

export async function incrementBlessings(day: string): Promise<number> {
  return incrCounter(BLESSINGS_DAY_KEY(day), 1);
}

export async function incrementGratitude(day: string, card: number): Promise<number> {
  return incrCounter(GRATITUDE_KEY(day, card), 1);
}

export async function getGratitudeCountsForDay(day: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (let card = 1; card <= 6; card++) {
    const n = await readCounter(GRATITUDE_KEY(day, card));
    if (n > 0) out[String(card)] = n;
  }
  return out;
}

export async function getCandles(day: string): Promise<number> {
  return readCounter(CANDLES_KEY(day));
}

export async function getBlessingsCount(day: string): Promise<number> {
  return readCounter(BLESSINGS_DAY_KEY(day));
}

async function pushCappedList(
  key: string,
  mem: Map<string, unknown[]>,
  value: unknown,
  cap = 200,
): Promise<void> {
  const client = getRedis();
  if (client) {
    try {
      await client.lpush(key, JSON.stringify(value));
      await client.ltrim(key, 0, cap - 1);
      return;
    } catch (err) {
      console.error('[loy] Redis list write failed, keeping in memory:', err);
    }
  }
  const list = (mem.get(key) ?? []) as unknown[];
  list.unshift(value);
  if (list.length > cap) list.length = cap;
  mem.set(key, list);
}

async function readCappedList<T>(key: string, mem: Map<string, T[]>): Promise<T[]> {
  const client = getRedis();
  if (client) {
    try {
      const raw = await client.lrange(key, 0, 199);
      const out: T[] = [];
      for (const item of raw) {
        try {
          out.push((typeof item === 'string' ? JSON.parse(item) : item) as T);
        } catch {
          // skip a corrupt entry
        }
      }
      return out;
    } catch (err) {
      console.error('[loy] Redis list read failed, using memory:', err);
    }
  }
  return [...(mem.get(key) ?? [])];
}

/** A thanks lantern joins the community list (B3 calls this on POST /api/thanks). */
export async function addThanksLantern(day: string, thanks: NonNullable<VisitorState['thanks']>): Promise<void> {
  await pushCappedList(THANKS_KEY(day), memThanks, thanks);
}

export async function listThanksLanterns(day: string): Promise<NonNullable<VisitorState['thanks']>[]> {
  return readCappedList<NonNullable<VisitorState['thanks']>>(THANKS_KEY(day), memThanks);
}

/** A blessing lantern rises into the community sky (B2 calls this on POST /api/bless). */
export async function addSkyLantern(
  day: string,
  lantern: { id: string; message: number; to: string },
): Promise<void> {
  await pushCappedList(SKY_KEY(day), memSky as Map<string, unknown[]>, lantern);
}

export async function listSkyLanterns(day: string): Promise<{ id: string; message: number; to: string }[]> {
  return readCappedList(SKY_KEY(day), memSky);
}

/** Community counters fed by the event funnel: /api/event calls this
 * after recording a server event, so the aggregates stay truthful
 * without a second write path per chunk.
 *
 * Candles are NOT counted here (chunk F): the candle route owns the
 * chain count (`incrementCandlesOnce`, once per visitor per day), and
 * the client also mirrors its `candle` event through /api/event — if
 * this funnel counted candles too, one lighting would count twice
 * (route + event) and a recolour would count again. */
export async function noteCommunityEvent(
  kind: FestivalEvent['kind'],
  ref: string | number,
  day: string,
): Promise<void> {
  if (kind === 'blessing') await incrementBlessings(day);
  if (kind === 'gratitude' && typeof ref === 'number') await incrementGratitude(day, ref);
}

/** Visitors who floated with an identity (for the admin "people floated" count). */
export async function addFloater(visitorId: string): Promise<void> {
  const client = getRedis();
  if (client) {
    try {
      await client.sadd(FLOATERS_KEY, visitorId);
      return;
    } catch (err) {
      console.error('[loy] Redis floater write failed, keeping in memory:', err);
    }
  }
  memFloaters.add(visitorId);
}

export async function countFloaters(): Promise<number> {
  const client = getRedis();
  if (client) {
    try {
      return await client.scard(FLOATERS_KEY);
    } catch (err) {
      console.error('[loy] Redis floater read failed, using memory:', err);
    }
  }
  return memFloaters.size;
}

// ---- Wish status + reports (E5, F2) ----------------------------------------

const REPORT_THRESHOLD = 3; // reports that hide a wish from the river (Q7 decision)

/** The raw stored wish (server-internal: keeps visitorId). Null when absent. */
export async function getStoredWish(id: string): Promise<Wish | null> {
  const stored = await readStoredWishes();
  return stored.find((w) => w.id === id) ?? null;
}

async function writeStoredWish(next: Wish): Promise<boolean> {
  const client = getRedis();
  if (client) {
    try {
      const raw = await client.lrange(WISHES_KEY, 0, MAX_STORED - 1);
      for (let i = 0; i < raw.length; i++) {
        try {
          const item = typeof raw[i] === 'string' ? JSON.parse(raw[i]) : raw[i];
          if ((item as Wish).id === next.id) {
            await client.lset(WISHES_KEY, i, JSON.stringify(next));
            bumpWishesVersion();
            return true;
          }
        } catch {
          // skip corrupt entries
        }
      }
      return false;
    } catch (err) {
      console.error('[loy] Redis wish update failed:', err);
      return false;
    }
  }
  const idx = memWishes.findIndex((w) => w.id === next.id);
  if (idx === -1) return false;
  memWishes[idx] = next;
  bumpWishesVersion();
  return true;
}

/**
 * Set a wish's moderation status (admin approve/hide). Returns the wish
 * after the change, or null when the id is unknown.
 */
export async function setWishStatus(
  id: string,
  status: 'approved' | 'reported' | 'hidden',
): Promise<Wish | null> {
  const wish = await getStoredWish(id);
  if (!wish) return null;
  const next = { ...wish, status };
  if (!(await writeStoredWish(next))) return null;
  return next;
}

/**
 * Report a wish (F2's route calls this). Increments the report count;
 * at REPORT_THRESHOLD the wish is hidden from the river (status
 * 'reported') and lands in the admin queue. Returns the wish after the
 * change plus whether this reporter had already reported, or null when
 * the id is unknown.
 *
 * One report per reporter (chunk F semantics, reconciled with E's
 * storage — reports live on the Wish object, not in a side key): when
 * a `reporterKey` is given (recovery ID, or `ip:<ip>`), a repeat report
 * from the same reporter counts nothing new (`already: true`). Without
 * a key every call counts, as E's original shape did.
 */
export async function reportWish(
  id: string,
  reporterKey?: string,
): Promise<{ wish: Wish; already: boolean } | null> {
  const wish = await getStoredWish(id);
  if (!wish) return null;
  if (reporterKey !== undefined) {
    if (await hasReported(id, reporterKey)) {
      return { wish, already: true };
    }
    await markReported(id, reporterKey);
  }
  const reports = (wish.reports ?? 0) + 1;
  const status = reports >= REPORT_THRESHOLD ? 'reported' : (wish.status ?? 'approved');
  const next = { ...wish, reports, status };
  if (!(await writeStoredWish(next))) return null;
  return { wish: next, already: false };
}

const REPORTED_BY_KEY = (id: string) => `loy:reported-by:${id}`;
const memReportedBy = new Map<string, Set<string>>();

/** True when this reporter already reported this wish. */
async function hasReported(id: string, reporterKey: string): Promise<boolean> {
  const client = getRedis();
  if (client) {
    try {
      return (await client.sismember(REPORTED_BY_KEY(id), reporterKey)) === 1;
    } catch (err) {
      console.error('[loy] Redis report check failed:', err);
    }
  }
  return memReportedBy.get(id)?.has(reporterKey) ?? false;
}

/** Remember that this reporter reported this wish (dedupe set). */
async function markReported(id: string, reporterKey: string): Promise<void> {
  const client = getRedis();
  if (client) {
    try {
      await client.sadd(REPORTED_BY_KEY(id), reporterKey);
      return;
    } catch (err) {
      console.error('[loy] Redis report mark failed, keeping it in memory:', err);
    }
  }
  const set = memReportedBy.get(id) ?? new Set<string>();
  set.add(reporterKey);
  memReportedBy.set(id, set);
}

/** Wishes waiting in the moderation queue: status 'reported' or 'hidden'. */
export async function listQueuedWishes(): Promise<Wish[]> {
  const stored = await readStoredWishes();
  return stored
    .filter((w) => w.status === 'reported' || w.status === 'hidden')
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((w) => {
      const { visitorId: _v, ...pub } = w;
      void _v;
      return pub;
    });
}

// ---- Audit log (E5) ---------------------------------------------------------

const AUDIT_KEY = 'loy:audit';
const MAX_AUDIT = 200;

const memAudit: { at: number; action: string; detail: string }[] = [];

export interface AuditEntry {
  at: number;
  action: string;
  detail: string;
}

export async function appendAudit(action: string, detail: string): Promise<void> {
  const entry: AuditEntry = { at: Date.now(), action, detail };
  const client = getRedis();
  if (client) {
    try {
      await client.lpush(AUDIT_KEY, JSON.stringify(entry));
      await client.ltrim(AUDIT_KEY, 0, MAX_AUDIT - 1);
      return;
    } catch (err) {
      console.error('[loy] Redis audit write failed, keeping in memory:', err);
    }
  }
  memAudit.unshift(entry);
  if (memAudit.length > MAX_AUDIT) memAudit.length = MAX_AUDIT;
}

export async function listAudit(limit = 50): Promise<AuditEntry[]> {
  const client = getRedis();
  if (client) {
    try {
      const raw = await client.lrange(AUDIT_KEY, 0, limit - 1);
      const out: AuditEntry[] = [];
      for (const item of raw) {
        try {
          out.push((typeof item === 'string' ? JSON.parse(item) : item) as AuditEntry);
        } catch {
          // skip a corrupt entry
        }
      }
      return out;
    } catch (err) {
      console.error('[loy] Redis audit read failed, using memory:', err);
    }
  }
  return memAudit.slice(0, limit);
}

// ---- Admin summary + backup + reset (E5) ------------------------------------

async function scanVisitorIds(): Promise<string[]> {
  const client = getRedis();
  if (client) {
    try {
      const ids: string[] = [];
      let cursor = '0';
      do {
        const [next, keys] = await client.scan(cursor, { match: 'loy:visitor:*', count: 500 });
        cursor = next;
        for (const k of keys) ids.push(k.slice('loy:visitor:'.length));
        if (ids.length >= 5000) break;
      } while (cursor !== '0');
      return [...new Set(ids)];
    } catch (err) {
      console.error('[loy] Redis visitor scan failed:', err);
      return [];
    }
  }
  return [...memVisitors.keys()];
}

/** One-way hash for the backup: visitor IDs are bearer tokens, so the
 * downloaded backup never carries a raw one (E1: never show one
 * visitor's ID to another — the admin's own download is no exception). */
export function hashVisitorId(id: string): string {
  return createHash('sha256').update(id).digest('hex').slice(0, 16);
}

/**
 * The counts line for the admin summary (E5): wishes · people floated ·
 * reactions · blessing lanterns · candles · thanks · stamps · secrets.
 * Computed by scanning visitor state (admin-only, rare) plus the stored
 * wishes and today's community counters.
 */
export async function adminCounts(today: string): Promise<{
  wishes: number;
  people: number;
  reactions: number;
  blessings: number;
  candles: number;
  thanks: number;
  stamps: number;
  secrets: number;
}> {
  const stored = await readStoredWishes();
  const counts = await readReactionCounts(stored.map((w) => w.id));
  let reactions = 0;
  for (const c of counts.values()) {
    reactions += c.sathu + c.love + c.hug + c.care + c.peace;
  }
  const ids = await scanVisitorIds();
  let stamps = 0;
  let secrets = 0;
  let floaters = 0;
  for (const id of ids) {
    const s = await getVisitorState(id);
    stamps += s.stamps.length;
    secrets += s.secrets.length;
    if (s.events.some((e) => e.kind === 'float')) floaters += 1;
  }
  const people = Math.max(floaters, await countFloaters());
  const thanks = (await listThanksLanterns(today)).length;
  return {
    wishes: stored.length,
    people,
    reactions,
    blessings: await getBlessingsCount(today),
    candles: await getCandles(today),
    thanks,
    stamps,
    secrets,
  };
}

/**
 * Full-store snapshot for the admin backup download. Visitor state is
 * keyed by a hash of the recovery ID, never the raw ID (see
 * hashVisitorId). Wishes carry no visitorId (stripped at read time).
 */
export async function buildBackup(): Promise<Record<string, unknown>> {
  const wishes = await listStoredWishes();
  const ids = await scanVisitorIds();
  const visitors: Record<string, unknown> = {};
  for (const id of ids) {
    visitors[hashVisitorId(id)] = await getVisitorState(id);
  }
  return {
    app: 'loy-krathong',
    exportedAt: new Date().toISOString(),
    config: await getConfig(),
    wishes,
    visitors,
    audit: await listAudit(MAX_AUDIT),
  };
}

/**
 * Delete EVERYTHING: all wishes, reactions, visitor state, community
 * counters, audit log, floaters — and reset the config to defaults.
 * The river comes back BLANK: no seeds are restored (Q5 — Faiq asked
 * for a blank river on 2026-11-06; the reset copy in the HTML that
 * "puts back the 8 starter wishes" is not followed). One audit entry
 * recording the reset is written after the wipe, so the log itself
 * shows it happened.
 */
export async function resetAll(): Promise<void> {
  const client = getRedis();
  if (client) {
    try {
      let cursor = '0';
      const keys: string[] = [];
      do {
        const [next, found] = await client.scan(cursor, { match: 'loy:*', count: 500 });
        cursor = next;
        keys.push(...found);
        if (keys.length >= 20000) break;
      } while (cursor !== '0');
      if (keys.length > 0) {
        for (let i = 0; i < keys.length; i += 500) {
          await client.del(...keys.slice(i, i + 500));
        }
      }
    } catch (err) {
      console.error('[loy] Redis reset failed, clearing memory too:', err);
    }
  }
  memWishes.length = 0;
  memReactions.clear();
  // Chunk B's in-memory maps too (its Redis keys are covered by the
  // loy:* scan above).
  memBlessings.clear();
  memSent.clear();
  memGratitudeCounts.clear();
  memThanksList.length = 0;
  memThanksBy.clear();
  memRate.clear();
  memDaily.clear();
  memEvents.clear();
  memVisitors.clear();
  memCounters.clear();
  memThanks.clear();
  memSky.clear();
  memFloaters.clear();
  memAudit.length = 0;
  memRestoreId.clear();
  memConfig = null;
  await appendAudit('reset', 'Reset all: every wish, reaction, lantern, mission and stamp deleted; river left blank (no seeds).');
}
