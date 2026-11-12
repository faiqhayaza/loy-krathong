// POST /api/thanks + GET /api/thanks — the gratitude lantern
// (night 5 special, B3).
//
// POST body: `{card, note}` — the gratitude card id (1–6,
// lib/gratitude.ts) and an optional short note (max 60 chars, shown on
// the lantern for everyone to read). Outcomes, mirroring the HTML's
// setThanks:
//   shown     — the lantern is on the water
//   rejected  — the note cannot go on the water (denylist); reword it
//   error     — unknown card, or night 5 not open yet
// Once only: a visitor who already set a lantern answers `shown` with
// `already: true` and their first lantern stands — the dialog then
// shows it instead of the picker. The client enforces the same rule
// from its own stored thanks; the server enforces it per recovery ID
// when one is sent (header `x-visitor-id`).
//
// The note is the only visitor text this route stores, and only
// because the visitor chose to show it on a public lantern
// (thanksNoteHint). A worry is never part of a thanks lantern and is
// never read here.
//
// GET returns `{counts, thanks}` — the community lantern count per
// card (what the picker shows) and the lanterns drifting on the water,
// newest first (max 30). No visitor identity is stored with them.
//
// Night gating: night 5 must be open. A `previewNight` in the body is
// honoured only when the server runs with LOY_PREVIEW_NIGHTS=1 (the
// dev server for chunk verification — see lib/specials.ts).
// Rate-limited at 5/minute/IP in its own bucket (scope 'thanks').

import { NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/clientIp';
import { containsBlocked } from '@/lib/data';
import { isValidGratitudeCard, MAX_THANKS_CHARS } from '@/lib/gratitude';
import { isValidRecoveryId } from '@/lib/identity';
import { calendar } from '@/lib/festival';
import { previewNightFromBody, serverSpecialOpen } from '@/lib/specials';
import { addThanks, checkRateLimit, getGratitudeCounts, getThanksList } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const [counts, thanks] = await Promise.all([getGratitudeCounts(), getThanksList()]);
  return NextResponse.json({ counts, thanks });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!isValidGratitudeCard(body.card)) {
    return NextResponse.json({ outcome: 'error', message: 'card must be a gratitude card id (1–6).' }, { status: 400 });
  }
  const noteRaw = typeof body.note === 'string' ? body.note.trim() : '';
  if (noteRaw.length > MAX_THANKS_CHARS) {
    return NextResponse.json({ outcome: 'error', message: 'The note is at most 60 characters.' }, { status: 400 });
  }
  // The note is denylist-checked like a wish: a rejected note stores
  // nothing and the dialog asks for a reword.
  if (noteRaw && containsBlocked(noteRaw)) {
    return NextResponse.json({ outcome: 'rejected', message: 'That note cannot go on the water. Please reword it and try again.' });
  }

  const preview = previewNightFromBody(body);
  if (!serverSpecialOpen(calendar(), 'gratitude', preview)) {
    return NextResponse.json(
      { outcome: 'error', message: 'The lantern of thanks opens on night 5 (22 November).' },
      { status: 403 },
    );
  }

  if (!(await checkRateLimit(clientIp(req), 'thanks'))) {
    return NextResponse.json(
      { outcome: 'error', message: 'Too many lanterns at once. Give the river a moment.' },
      { status: 429 },
    );
  }

  const visitorId = req.headers.get('x-visitor-id');
  const validVisitor = visitorId && isValidRecoveryId(visitorId) ? visitorId : null;
  const stored = await addThanks(body.card as number, noteRaw === '' ? null : noteRaw, validVisitor);
  if (stored === null) {
    return NextResponse.json({ outcome: 'shown', already: true });
  }
  return NextResponse.json({ outcome: 'shown', ...(preview !== null ? { preview: true } : {}) });
}
