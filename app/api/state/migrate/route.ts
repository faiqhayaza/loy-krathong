// POST /api/state/migrate — the one-time move of device-local state to
// the server (E1).
//
// The client (components/useFestivalState.ts) sends what this device
// accumulated while the passport was device-local: krathong, events,
// stamps, visits, secrets, thanks, sent, received. The server merges it
// into the visitor's document (union semantics — see mergeVisitorState
// in lib/store.ts; the server's copy wins on a conflict, because it may
// already hold progress from another device). Claims are NOT migrated:
// they are server-issued (A2) and cannot be self-asserted.
//
// The client sends this at most once per device per identity (flag
// `loy:migrated:<id>` in localStorage) and retries on failure; the
// merge is idempotent, so a repeated call is harmless. Rate-limited
// 5/minute/IP (scope 'state'), same bucket as PATCH /api/state.
//
// A worry is never part of a migration payload and is never read here.

import { NextRequest, NextResponse } from 'next/server';
import { isValidRecoveryId } from '@/lib/identity';
import { checkRateLimit, mergeVisitorState } from '@/lib/store';
import { emptyVisitorState, type VisitorState } from '@/lib/festivalState';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: NextRequest) {
  const visitorId = req.headers.get('x-visitor-id');
  if (!visitorId || !isValidRecoveryId(visitorId)) {
    return NextResponse.json(
      { error: 'missing_visitor', message: 'Send your recovery ID as the x-visitor-id header.' },
      { status: 401 },
    );
  }
  if (!(await checkRateLimit(clientIp(req), 'state'))) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many updates at once. Give the river a moment.' },
      { status: 429 },
    );
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // parseVisitorState (inside mergeVisitorState) validates every field
  // and drops anything malformed; claims in the payload are ignored
  // outright — they are never accepted from a client.
  const incoming: Partial<VisitorState> = {
    ...emptyVisitorState(),
    ...body,
    claims: [],
  };
  delete (incoming as Record<string, unknown>).claims;
  const merged = await mergeVisitorState(visitorId, incoming);
  return NextResponse.json({ ok: true, me: merged });
}
