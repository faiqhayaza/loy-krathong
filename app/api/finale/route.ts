// POST /api/finale — join the grand finale (night 7 special, B5).
//
// Body: `{}` (an optional `previewNight` is honoured only when the
// server runs with LOY_PREVIEW_NIGHTS=1 — the dev server for chunk
// verification; see lib/specials.ts). Returns `{ok, joined}`.
//
// Joining records a `finale` event (the evidence for the night-7
// special mission): on the server log when the visitor's recovery ID
// arrives as `x-visitor-id`, and on the device by the client
// (lib/events.ts) — the server log dedupes by day+kind+ref, so the two
// paths never double-count. Requires night 7 open. Rate-limited at
// 5/minute/IP in its own bucket (scope 'finale').
//
// The 8.5 s finale scene itself (FINALE_MS in the HTML) runs on the
// client: the krathong drifts to the centre of the lake, the crowd
// gathers, fireworks play, and then the finale message appears.

import { NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/clientIp';
import { isValidRecoveryId } from '@/lib/identity';
import { bangkokDay } from '@/lib/bangkok';
import { calendar } from '@/lib/festival';
import { previewNightFromBody, serverSpecialOpen } from '@/lib/specials';
import { checkRateLimit, recordServerEvent } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // an empty body joins the finale too
  }

  const preview = previewNightFromBody(body);
  if (!serverSpecialOpen(calendar(), 'finale', preview)) {
    return NextResponse.json(
      { error: 'not_open', message: 'The grand finale opens on night 7 (24 November).' },
      { status: 403 },
    );
  }

  if (!(await checkRateLimit(clientIp(req), 'finale'))) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many joins at once. Give the river a moment.' },
      { status: 429 },
    );
  }

  const visitorId = req.headers.get('x-visitor-id');
  let recorded = false;
  if (visitorId && isValidRecoveryId(visitorId)) {
    recorded = await recordServerEvent(visitorId, { day: bangkokDay(), kind: 'finale', ref: 0 });
  }
  return NextResponse.json({ ok: true, joined: true, recorded, ...(preview !== null ? { preview: true } : {}) });
}
