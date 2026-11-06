import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_BOAT,
  DEFAULT_FLAME,
  DEFAULT_FLOWER,
  EMPTY_REACTIONS,
  MAX_NAME_CHARS,
  MAX_WISH_CHARS,
  containsBlocked,
  isKnownBoat,
  isKnownFlame,
  isKnownFlower,
  type Lang,
  type Wish,
} from '@/lib/data';
import { addWish, checkRateLimit, listWishes } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const { wishes, totalReactions } = await listWishes();
  return NextResponse.json({ wishes, count: wishes.length, totalReactions });
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
  const flower = typeof body.flower === 'string' && isKnownFlower(body.flower) ? body.flower : DEFAULT_FLOWER;
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
  return NextResponse.json({ wish }, { status: 201 });
}
