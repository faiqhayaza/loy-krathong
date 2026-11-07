// POST /api/bless + GET /api/bless?wishId= — blessing lanterns
// (night 3 special, B2).
//
// POST body: `{wishId, message}` — the wish to bless and the blessing
// template id (0–5, lib/blessings.ts). An optional `from` carries the
// sender's display nickname (never an id); it is what the receiver
// sees. Outcomes, mirroring the HTML's sendBlessing:
//   sent      — the lantern is hung on the wish (count +1)
//   already   — this visitor already sent this krathong a lantern
//   error     — unknown wish, or a bad blessing id
// The `own_wish` outcome is decided client-side (the server cannot
// know whose wish is whose until D2/C4's ownership lands) — the dialog
// shows it without posting.
//
// Night gating: night 3 must be open. A `previewNight` in the body is
// honoured only when the server runs with LOY_PREVIEW_NIGHTS=1 (the
// dev server for chunk verification — see lib/specials.ts).
//
// The `blessing` event itself is recorded by the client (lib/events.ts
// → POST /api/event, deduped by day+kind+ref), so this route only owns
// the lantern: the per-wish count, the lantern list the receiver reads,
// and the per-visitor sent set behind the `already` rule.
//
// GET ?wishId=… returns `{count, blessings: [{message, from, at}]}` —
// the lanterns a wish received, oldest first. This is what the My
// Krathong panel (C4) shows; the wall only needs the count, which
// rides on the Wish object from GET /api/wishes.
//
// Rate-limited at 5/minute/IP in its own bucket (scope 'bless').

import { NextRequest, NextResponse } from 'next/server';
import { isValidBlessingId } from '@/lib/blessings';
import { isValidRecoveryId } from '@/lib/identity';
import { calendar } from '@/lib/festival';
import { previewNightFromBody, serverSpecialOpen } from '@/lib/specials';
import { addBlessing, checkRateLimit, getBlessings, invalidateWishesCache, markSentBlessing, wishExists } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function GET(req: NextRequest) {
  const wishId = req.nextUrl.searchParams.get('wishId');
  if (!wishId) {
    return NextResponse.json({ error: 'wish_required', message: 'Pass ?wishId=…' }, { status: 400 });
  }
  const blessings = await getBlessings(wishId);
  return NextResponse.json({ count: blessings.length, blessings });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const wishId = body.wishId;
  if (typeof wishId !== 'string' || wishId.length === 0) {
    return NextResponse.json({ error: 'invalid_wish', message: 'wishId must be a wish id.' }, { status: 400 });
  }
  if (!isValidBlessingId(body.message)) {
    return NextResponse.json({ error: 'invalid_blessing', message: 'message must be a blessing id (0–5).' }, { status: 400 });
  }
  const from = typeof body.from === 'string' ? body.from.trim().slice(0, 40) : '';

  const preview = previewNightFromBody(body);
  if (!serverSpecialOpen(calendar(), 'blessing', preview)) {
    return NextResponse.json(
      { error: 'not_open', message: 'Blessing lanterns open on night 3 (20 November).' },
      { status: 403 },
    );
  }

  if (!(await checkRateLimit(clientIp(req), 'bless'))) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many lanterns at once. Give the river a moment.' },
      { status: 429 },
    );
  }

  if (!(await wishExists(wishId))) {
    return NextResponse.json({ outcome: 'error', message: 'No such krathong on the river.' }, { status: 404 });
  }

  // One lantern per krathong per visitor (the HTML's `already` rule),
  // enforced here when the visitor's recovery ID is known. Without it
  // the client enforces the same rule from its own sent list.
  const visitorId = req.headers.get('x-visitor-id');
  if (visitorId && isValidRecoveryId(visitorId)) {
    const first = await markSentBlessing(visitorId, wishId);
    if (!first) {
      return NextResponse.json({ outcome: 'already', message: 'You have already sent this krathong a lantern.' });
    }
  }

  const count = await addBlessing(wishId, body.message as number, from);
  // A fresh lantern changes the wall (the count rides on the Wish), so
  // the river cache must go — otherwise the count lags up to 30 s.
  invalidateWishesCache();
  return NextResponse.json({ outcome: 'sent', count, ...(preview !== null ? { preview: true } : {}) });
}
