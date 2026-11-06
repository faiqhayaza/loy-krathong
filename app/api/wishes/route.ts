import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_BOAT,
  DEFAULT_FLAME,
  DEFAULT_FLOWER,
  EMPTY_REACTIONS,
  MAX_NAME_CHARS,
  MAX_WISH_CHARS,
  containsBlocked,
  isAllowedCustomEmoji,
  isKnownBoat,
  isKnownFlame,
  isKnownFlower,
  type Lang,
  type Wish,
} from '@/lib/data';
import { addWish, checkDailyLimit, checkRateLimit, listWishes, usingRedis } from '@/lib/store';
import { bangkokDay } from '@/lib/bangkok';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The shared river is backed by a free-tier Redis with a daily command
// budget, and every visitor polls this endpoint. A short server-side
// cache (one Redis read per 30s per instance, at most) keeps a busy
// festival night from exhausting it. Writes clear the cache, so a new
// wish still shows up immediately.
const CACHE_TTL_MS = 30_000;
let cached: { at: number; payload: { wishes: Wish[]; count: number; totalReactions: number; storage: string } } | null = null;

export async function GET() {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }
  const { wishes, totalReactions } = await listWishes();
  // `storage` is a first-hand health signal: "redis" proves wishes are
  // shared through Upstash; "memory" means the env vars are missing and
  // each server instance only remembers its own wishes.
  const payload = { wishes, count: wishes.length, totalReactions, storage: usingRedis() ? 'redis' : 'memory' };
  cached = { at: now, payload };
  return NextResponse.json(payload);
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // The worry is never accepted: it is not read, not validated, not stored.
  // If a client sends one anyway, it is dropped here, silently.
  const { worry: _dropped, ...rest } = body;
  void _dropped;
  void rest;

  const wishRaw = typeof body.wish === 'string' ? body.wish.trim() : '';
  const nameRaw = typeof body.name === 'string' ? body.name.trim() : '';
  // A flower is a known one, or one allowed emoji of the visitor's own
  // (Rules: isAllowedCustomEmoji); anything else falls back to lotus.
  const flower =
    typeof body.flower === 'string' && (isKnownFlower(body.flower) || isAllowedCustomEmoji(body.flower))
      ? body.flower.trim()
      : DEFAULT_FLOWER;
  const boat = typeof body.boat === 'string' && isKnownBoat(body.boat) ? body.boat : DEFAULT_BOAT;
  const flame = typeof body.flame === 'string' && isKnownFlame(body.flame) ? body.flame : DEFAULT_FLAME;
  const lang: Lang = body.lang === 'th' ? 'th' : 'en';

  if (wishRaw.length < 1 || wishRaw.length > MAX_WISH_CHARS) {
    return NextResponse.json(
      { error: 'wish_required', message: 'Write a wish first (1–280 characters).' },
      { status: 400 },
    );
  }
  if (nameRaw.length > MAX_NAME_CHARS) {
    return NextResponse.json(
      { error: 'name_too_long', message: 'Nickname must be 40 characters or fewer.' },
      { status: 400 },
    );
  }
  if (containsBlocked(wishRaw) || (nameRaw && containsBlocked(nameRaw))) {
    return NextResponse.json(
      { error: 'blocked_content', message: 'That wish or name cannot go on the public river.' },
      { status: 400 },
    );
  }

  if (!(await checkRateLimit(clientIp(req)))) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'You have floated a few krathongs already. Give the river a moment.' },
      { status: 429 },
    );
  }

  // One float per Bangkok day per IP, like the original site. A distinct
  // error body so the client can show the "come back tomorrow" state
  // instead of the generic rate-limit message.
  if (!(await checkDailyLimit(clientIp(req), bangkokDay()))) {
    return NextResponse.json(
      { error: 'daily_limit', message: 'You already floated a krathong today. Come back tomorrow for your next stamp.' },
      { status: 429 },
    );
  }

  const wish: Wish = {
    id: crypto.randomUUID(),
    name: nameRaw,
    wish: wishRaw,
    flower,
    boat,
    flame,
    lang,
    createdAt: Date.now(),
    reactions: { ...EMPTY_REACTIONS },
  };

  await addWish(wish);
  cached = null; // A fresh wish must be visible on the next read.
  return NextResponse.json({ wish }, { status: 201 });
}
