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

const WISHES_KEY = 'loy:wishes';
const REACTIONS_KEY = (id: string) => `loy:reactions:${id}`;
const RATE_KEY = (ip: string) => `loy:rl:${ip}`;

const MAX_STORED = 200;
const POSTS_PER_MINUTE = 5;

let redis: Redis | null = null;
let redisTried = false;

function getRedis(): Redis | null {
  if (redisTried) return redis;
  redisTried = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
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

export async function addReaction(id: string, reaction: ReactionId): Promise<ReactionCounts | null> {
  const client = getRedis();
  if (client) {
    try {
      await client.hincrby(REACTIONS_KEY(id), reaction, 1);
      const row = (await client.hgetall(REACTIONS_KEY(id))) as Record<string, string>;
      return {
        sathu: Number(row.sathu ?? 0) || 0,
        love: Number(row.love ?? 0) || 0,
        hug: Number(row.hug ?? 0) || 0,
        care: Number(row.care ?? 0) || 0,
        peace: Number(row.peace ?? 0) || 0,
      };
    } catch (err) {
      console.error('[loy] Redis reaction write failed:', err);
    }
  }
  const current = memReactions.get(id) ?? { ...EMPTY_REACTIONS };
  current[reaction] += 1;
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
