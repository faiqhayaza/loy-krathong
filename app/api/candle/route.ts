// POST /api/candle + GET /api/candle — the daily candle
// (night 4 special, F1).
//
// POST body: `{flame}` — one of the 7 flame ids (lib/data.ts
// FLAMES). Outcomes, mirroring the HTML's `lightCandle`:
//   lit   — the candle is in the chain (or recoloured, when one was
//           already lit today — the community count does not move)
//   error — unknown flame, or night 4 not open yet
// Lighting records a `candle` event (ref = flame id) in the visitor's
// server event log when the recovery ID is sent (header
// `x-visitor-id`); lighting again the same day replaces that day's
// candle event (the HTML overwrites the existing event's ref), so the
// mission evidence (chunk A) still sees exactly one candle event per
// day. The community chain count (`candles`) counts one per visitor
// per day (`incrementCandlesOnce` in lib/store.ts — E's per-day
// counter plus the once-per-visitor dedupe; the event funnel does NOT
// count candles, or one lighting would count twice).
//
// GET returns `{candles}` — the community chain count.
//
// Night gating: night 4 must be open. A `previewNight` in the body is
// honoured only when the server runs with LOY_PREVIEW_NIGHTS=1 (the
// dev server for chunk verification — see lib/specials.ts).
// Rate-limited at 5/minute/IP in its own bucket (scope 'candle').
//
// A worry is never part of a candle and is never read here.

import { NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/clientIp';
import { isKnownFlame } from '@/lib/data';
import { isValidRecoveryId } from '@/lib/identity';
import { calendar } from '@/lib/festival';
import { previewNightFromBody, serverSpecialOpen } from '@/lib/specials';
import { bangkokDay } from '@/lib/bangkok';
import {
  checkRateLimit,
  getCandleCount,
  incrementCandlesOnce,
  listServerEvents,
  recordServerEvent,
  removeServerEvent,
} from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ candles: await getCandleCount() });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body.flame !== 'string' || !isKnownFlame(body.flame)) {
    return NextResponse.json(
      { outcome: 'error', message: 'flame must be one of the seven flame ids.' },
      { status: 400 },
    );
  }
  const flame = body.flame;

  const preview = previewNightFromBody(body);
  if (!serverSpecialOpen(calendar(), 'candle', preview)) {
    return NextResponse.json(
      { outcome: 'error', message: 'The daily candle opens on night 4 (21 November).' },
      { status: 403 },
    );
  }

  if (!(await checkRateLimit(clientIp(req), 'candle'))) {
    return NextResponse.json(
      { outcome: 'error', message: 'Too many candles at once. Give the river a moment.' },
      { status: 429 },
    );
  }

  const day = bangkokDay();
  const visitorId = req.headers.get('x-visitor-id');
  const validVisitor = visitorId && isValidRecoveryId(visitorId) ? visitorId : null;
  if (validVisitor) {
    // Recolour: the HTML overwrites the existing candle event's ref,
    // so remove today's candle event (whatever its flame) before
    // recording the new one — one candle event per day, always.
    const todays = (await listServerEvents(validVisitor)).filter(
      (e) => e.day === day && e.kind === 'candle',
    );
    for (const e of todays) await removeServerEvent(validVisitor, day, 'candle', e.ref);
    await recordServerEvent(validVisitor, { day, kind: 'candle', ref: flame });
  }
  const visitorKey = validVisitor ?? `ip:${clientIp(req)}`;
  const { count, first } = await incrementCandlesOnce(visitorKey, day);
  return NextResponse.json({
    outcome: 'lit',
    flame,
    candles: count,
    recoloured: !first,
    ...(preview !== null ? { preview: true } : {}),
  });
}
