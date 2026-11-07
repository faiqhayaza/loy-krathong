// Storage for the shared river.
//
// Primary backend: Upstash Redis (REST) when UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are both set. Fallback: an in-memory store seeded
// with nothing (seeds are merged at read time, never written), so the site
// still works on a preview deploy with zero config. Nothing here ever
// throws on a missing or unreachable Redis — it logs and falls back.

import { Redis } from '@upstash/redis';
import type { ReactionCounts, ReactionId, Wish } from './data';
import { EMPTY_REACTIONS } from './data';
import { SEED_WISHES } from './seed';
import { msUntilBangkokMidnight } from './bangkok';

const WISHES_KEY = 'loy:wishes';
const REACTIONS_KEY = (id: string) => `loy:reactions:${id}`;
const RATE_KEY = (ip: string) => `loy:rl:${ip}`;
const DAILY_KEY = (ip: string, day: string) => `loy:daily:${ip}:${day}`;

const MAX_STORED = 200;
const POSTS_PER_MINUTE = 5;

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

// ---- In-memory fallback -------------------------------------------------

const memWishes: Wish[] = [];
const memReactions = new Map<string, ReactionCounts>();
const memRate = new Map<string, { count: number; resetAt: number }>();
const memDaily = new Map<string, number>(); // key -> ms timestamp when the day slot expires

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
      return wishes;
    } catch (err) {
      console.error('[loy] Redis read failed, falling back to memory:', err);
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
  let totalReactions = 0;
  const wishes = all
    .map((w) => {
      const reactions = counts.get(w.id) ?? { ...EMPTY_REACTIONS };
      totalReactions +=
        reactions.sathu + reactions.love + reactions.hug + reactions.care + reactions.peace;
      return { ...w, reactions };
    })
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_STORED);
  return { wishes, totalReactions };
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
      return;
    } catch (err) {
      console.error('[loy] Redis write failed, keeping wish in memory:', err);
    }
  }
  memWishes.unshift(wish);
  if (memWishes.length > MAX_STORED) memWishes.length = MAX_STORED;
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
  return true;
}

// ---- Rate limiting ---------------------------------------------------------

/** Max 5 posts per minute per IP. Returns true when the post is allowed. */
export async function checkRateLimit(ip: string): Promise<boolean> {
  const client = getRedis();
  if (client) {
    try {
      const count = await client.incr(RATE_KEY(ip));
      if (count === 1) await client.expire(RATE_KEY(ip), 60);
      return count <= POSTS_PER_MINUTE;
    } catch (err) {
      console.error('[loy] Redis rate-limit check failed, allowing:', err);
      return true;
    }
  }
  const now = Date.now();
  const entry = memRate.get(ip);
  if (!entry || now > entry.resetAt) {
    memRate.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= POSTS_PER_MINUTE;
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
