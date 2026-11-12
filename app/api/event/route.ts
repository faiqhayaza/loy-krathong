// POST /api/event — the server side of the D1 event store.
//
// Accepts `{kind, ref}` (or `{kind, ref, remove: true}` to take an event
// back, e.g. a reaction removed). The kind must be one of the event kinds
// in `lib/events.ts`; `ref` is a string or number as the kind requires
// (day number for visit_place, wish id for react, 0 for day-wide kinds).
// Requires the `x-visitor-id` header carrying the visitor's 10-digit
// recovery ID (`lib/identity.ts`) — that ID keys the KV log
// (`loy:events:<recovery-id>`). Rate-limited at 5/minute/IP in its own
// bucket (scope 'event'), so event traffic can never eat the float
// budget. The device-local store remains the source of truth; this log
// is the forward-compatible record E1 will later read as `me.events`.
//
// E1: the recorded event also feeds the community aggregates
// (noteCommunityEvent in lib/store.ts — candles, blessings, gratitude
// counts). E4: when rewards are paused (`config.paused`), reward-bearing
// kinds (quiz, blessing, candle, gratitude, share, finale) are rejected
// with 409 `paused` — pausing stops rewards, not participation
// (visit_place, react, float, float_slot keep working).
//
// A worry is never part of an event and is never read here.

import { NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/clientIp';
import { EVENT_KINDS, isEventKind, type EventKind } from '@/lib/events';
import { isValidRecoveryId } from '@/lib/identity';
import { bangkokDay } from '@/lib/bangkok';
import {
  checkRateLimit,
  getConfig,
  noteCommunityEvent,
  recordServerEvent,
  removeServerEvent,
} from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Event kinds that earn rewards — blocked while rewards are paused (E4). */
const REWARD_KINDS: EventKind[] = ['quiz', 'blessing', 'candle', 'gratitude', 'share', 'finale'];

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const kind = body.kind;
  if (!isEventKind(kind)) {
    return NextResponse.json(
      { error: 'unknown_kind', message: `kind must be one of: ${EVENT_KINDS.join(', ')}` },
      { status: 400 },
    );
  }
  const ref = body.ref ?? 0;
  if (typeof ref !== 'string' && typeof ref !== 'number') {
    return NextResponse.json({ error: 'invalid_ref', message: 'ref must be a string or a number.' }, { status: 400 });
  }
  const remove = body.remove === true;

  const visitorId = req.headers.get('x-visitor-id');
  if (!visitorId) {
    return NextResponse.json(
      { error: 'missing_visitor', message: 'Send your recovery ID as the x-visitor-id header.' },
      { status: 401 },
    );
  }
  if (!isValidRecoveryId(visitorId)) {
    return NextResponse.json(
      { error: 'invalid_visitor', message: 'x-visitor-id must be a 10-digit recovery ID.' },
      { status: 400 },
    );
  }

  if (!(await checkRateLimit(clientIp(req), 'event'))) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many events at once. Give the river a moment.' },
      { status: 429 },
    );
  }

  const day = bangkokDay();
  if (remove) {
    const removed = await removeServerEvent(visitorId, day, kind as EventKind, ref);
    return NextResponse.json({ ok: true, removed });
  }
  // E4: rewards paused — reward-bearing kinds are refused, participation
  // kinds (visit_place, react, float, float_slot) still record.
  if ((REWARD_KINDS as string[]).includes(kind as string)) {
    const config = await getConfig();
    if (config.paused) {
      return NextResponse.json(
        { error: 'paused', message: 'Rewards are paused by the organisers right now.' },
        { status: 409 },
      );
    }
  }
  const recorded = await recordServerEvent(visitorId, { day, kind: kind as EventKind, ref });
  if (recorded) await noteCommunityEvent(kind as EventKind, ref, day);
  return NextResponse.json({ ok: true, recorded, day });
}
