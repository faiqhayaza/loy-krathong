// POST /api/report — report a wish (visitor moderation, F2).
//
// Body: `{wishId}`. One report per reporter (dedupe by recovery ID
// when the `x-visitor-id` header is sent, else by IP), so a single
// visitor cannot hide a wish alone. At REPORT_THRESHOLD (3) distinct
// reports the wish's status becomes `reported`: it leaves the public
// river (GET /api/wishes filters it out) and waits in the admin queue
// (E5 reads it via listStoredWishes, unfiltered).
//
// Response: `{ok, reports, status, already, hidden}` — `status` is
// the wish's river-wide status (`approved` | `reported` | `hidden`),
// `hidden` is true once it is off the river. A repeat report from the
// same reporter answers `already: true` and counts nothing new.
//
// The reporter also hides the wish on their own device immediately
// (the solo rule, `hideWish` in lib/report.ts, `loy:hidden`) — the
// client does that, so the reporter's view is clean even before the
// third report. The server never sees a worry here, and a report
// carries no reason text — only the wish id and the reporter's key.
//
// Rate-limited at 5/minute/IP in its own bucket (scope 'report').

import { NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/clientIp';
import { isValidRecoveryId } from '@/lib/identity';
import { checkRateLimit, invalidateWishesCache, reportWish, wishExists } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const wishId = body.wishId;
  if (typeof wishId !== 'string' || wishId.trim() === '') {
    return NextResponse.json({ error: 'wish_required', message: 'wishId is required.' }, { status: 400 });
  }
  if (!(await wishExists(wishId))) {
    return NextResponse.json({ error: 'not_found', message: 'No wish with that id is on the river.' }, { status: 404 });
  }

  if (!(await checkRateLimit(clientIp(req), 'report'))) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many reports at once. Give the river a moment.' },
      { status: 429 },
    );
  }

  const visitorId = req.headers.get('x-visitor-id');
  const reporterKey =
    visitorId && isValidRecoveryId(visitorId) ? visitorId : `ip:${clientIp(req)}`;
  const result = await reportWish(wishId, reporterKey);
  // `wishExists` above already proved the id is real, so a null here
  // would mean the wish vanished mid-request — treat it as not found.
  if (!result) {
    return NextResponse.json({ error: 'not_found', message: 'No wish with that id is on the river.' }, { status: 404 });
  }
  // A fresh report count is part of what the river shows; clear the
  // 30 s cache so the next read is current (reportWish already bumps
  // the river version when the status flips).
  invalidateWishesCache();
  return NextResponse.json({
    ok: true,
    reports: result.wish.reports ?? 0,
    status: result.wish.status ?? 'approved',
    already: result.already,
    hidden: (result.wish.status ?? 'approved') !== 'approved',
  });
}
