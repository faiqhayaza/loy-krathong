// POST /api/identity/restore — sign-in with a nickname + recovery ID (E1).
//
// The gate (components/IdentityDialog.tsx) calls this when a visitor
// says "I already have a key". The server checks whether it holds any
// state for that ID and returns it (`me`), so progress made on another
// device comes back. A nickname is validated (1–40 chars, display-only)
// but never stored server-side.
//
// RATE LIMITS — the ID is a bearer token, so guessing must not pay:
//   - 5 attempts per minute per IP (scope 'restore');
//   - 10 attempts per hour per ID (a second bucket keyed on the ID
//     itself, so hammering one ID from many IPs still stops).
// Either limit returns 429 `restore_limited`. The response never says
// whether an ID "exists" as a separate signal: `found` is simply
// whether any state came back with the `me` payload, which the restore
// has to return anyway.
//
// No identity is created here — sign-up generates the ID on the device
// (lib/identity.ts) and the server learns it on first contact.

import { NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/clientIp';
import { isValidNickname, isValidRecoveryId } from '@/lib/identity';
import { checkRateLimit, checkRestoreIdLimit, getVisitorState, visitorStateExists } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!isValidNickname(nickname) || !isValidRecoveryId(id)) {
    return NextResponse.json(
      { error: 'invalid_identity', message: 'A nickname (1–40 characters) and a 10-digit key are needed.' },
      { status: 400 },
    );
  }

  if (!(await checkRateLimit(clientIp(req), 'restore'))) {
    return NextResponse.json(
      { error: 'restore_limited', message: 'Too many tries. Wait a minute and try again.' },
      { status: 429 },
    );
  }
  // Per-ID bucket: 10 tries per hour for one ID, whatever the IPs, so
  // hammering a single ID from many addresses still stops.
  if (!(await checkRestoreIdLimit(id))) {
    return NextResponse.json(
      { error: 'restore_limited', message: 'Too many tries for this key. Wait a while and try again.' },
      { status: 429 },
    );
  }

  const found = await visitorStateExists(id);
  const me = found ? await getVisitorState(id) : null;
  return NextResponse.json({ ok: true, found, me });
}
