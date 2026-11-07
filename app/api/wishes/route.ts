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
import { addFloater, addWish, checkDailyLimit, checkRateLimit, clearDailyLimit, deleteWish, invalidateWishesCache, listStoredWishesRaw, listWishesCached, recordServerEvent } from '@/lib/store';
import { bangkokDay } from '@/lib/bangkok';
import { isValidRecoveryId } from '@/lib/identity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The shared river is backed by a free-tier Redis with a daily command
// budget, and every visitor polls this endpoint. A short server-side
// cache (one Redis read per 30s per instance, at most) keeps a busy
// festival night from exhausting it. Writes clear the cache, so a new
// wish still shows up immediately. The cache itself lives in
// lib/store.ts (listWishesCached) because a route file may not export
// anything but route handlers — the bless route invalidates it the
// same way after hanging a lantern.

export async function GET() {
  const payload = await listWishesCached();
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

  // E1: when the floater is signed in (the gate guarantees an identity
  // in normal use), link the wish to their recovery ID — server-side
  // only, never sent to any client (listWishes strips it). It keys My
  // wishes matching (C4), the "people floated" count (E5) and the
  // owner's own view in api/state. The header is optional: a float
  // without one still works, it just has no owner.
  const visitorId = req.headers.get('x-visitor-id');
  if (visitorId && isValidRecoveryId(visitorId)) {
    wish.visitorId = visitorId;
  }

  await addWish(wish);
  invalidateWishesCache(); // A fresh wish must be visible on the next read.
  // B6 (night-1 special evidence): floating records two events — the
  // once-per-day slot and the float itself with the wish id as ref.
  // The client records the same two on the device (lib/events.ts) and
  // mirrors them here; the server log dedupes by day+kind+ref, so the
  // two paths never double-count. Only when the visitor's recovery ID
  // arrives (header `x-visitor-id`) can the server attribute them.
  if (wish.visitorId) {
    const day = bangkokDay();
    await recordServerEvent(wish.visitorId, { day, kind: 'float_slot', ref: 0 });
    await recordServerEvent(wish.visitorId, { day, kind: 'float', ref: wish.id });
    await addFloater(wish.visitorId);
  }
  // The response carries the public wish only — the internal visitorId
  // never leaves the server, not even back to its owner.
  const { visitorId: _v, ...publicWish } = wish;
  void _v;
  return NextResponse.json({ wish: publicWish }, { status: 201 });
}

// DELETE — remove your own floated krathong (fix round, 2026-11-07).
//
// The visitor's recovery ID (the `x-visitor-id` header, the same bearer <redacted>
// the float used) is the only credential: the wish is found in the
// server-internal list (which carries visitorId — the public list strips
// it), and the delete only runs when the wish's visitorId matches the
// header exactly. A wish floated without an ID has no owner and can
// never be removed this way. On success the river cache is cleared and
// today's daily slot is released, so the owner can float again the
// same day; the client also forgets its ledger entry and reopens the
// float form. The id arrives as a query parameter (?id=...).
export async function DELETE(req: NextRequest) {
  const visitorId = req.headers.get('x-visitor-id');
  if (!visitorId || !isValidRecoveryId(visitorId)) {
    return NextResponse.json({ error: 'identity_required' }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!id) {
    return NextResponse.json({ error: 'id_required' }, { status: 400 });
  }
  const stored = await listStoredWishesRaw();
  const wish = stored.find((w) => w.id === id);
  if (!wish) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (wish.visitorId !== visitorId) {
    return NextResponse.json({ error: 'not_owner' }, { status: 403 });
  }
  const removed = await deleteWish(id);
  if (!removed) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  invalidateWishesCache();
  // The owner floated today and just took it back: release today's
  // slot so they can float again. The 5/min rate limit still applies.
  await clearDailyLimit(clientIp(req), bangkokDay());
  return NextResponse.json({ ok: true });
}
