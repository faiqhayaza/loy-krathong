// POST /api/claim — claim a completed mission for River Light
// (A2, leftover: neither chunk A nor chunk E built this route).
//
// Body: `{day, slot}` — `day` is a night number 1–7 or a festival
// date string; `slot` is `visit` | `special` | `kindness` |
// `secret-<destination slug>`. Requires the `x-visitor-id` header
// carrying the visitor's 10-digit recovery ID — claims are keyed by
// it, never by nickname.
//
// The server is the authority, so a claim can never be self-asserted:
// the reward (`rl`) is computed here from the slot (visit 5, special
// 20, kindness 15, secret 5 — lib/claims.ts), never taken from the
// client; the claim window is enforced (`canClaim`: phase is not
// `before`, today is on or before the archive close, 2026-12-08);
// paused rewards answer 409; and the mission must actually be
// complete — the route reads the visitor's D1 server event log for
// the evidence chunk A checks device-locally (`visit_place` with ref
// = the night for `visit`; the night's special evidence kinds for
// `special`; 3 distinct `react` events that night for `kindness`).
// A `secret-<slug>` claim is verified the same way: the riddle solve
// records a `secret` event in the server log (lib/secrets.ts), and a
// secret that arrived through migration is in `me.secrets` —
// `hasSecretEvidence` in lib/store.ts accepts either, so the claim
// route and the migration agree and a secret claim is never silently
// dropped in either path.
//
// Response: `{ok, claim: {day, slot, rl, at}, daylight, already}` —
// `daylight` is the night's community River Light total after this
// claim (claims + secret finds). A repeat claim for the same day+slot
// answers with the first claim and `already: true`, and adds no
// daylight — a double-tap can never double-pay.
//
// A `previewNight` in the body is honoured only when the server runs
// with LOY_PREVIEW_NIGHTS=1 (the dev server for chunk verification —
// see lib/specials.ts): the claim window is then judged against the
// previewed festival date, and evidence recorded on the real today
// counts for the previewed night (the /api/event route stamps events
// with the real Bangkok day). In production the variable is unset and
// the real calendar is the only gate.
// Rate-limited at 5/minute/IP in its own bucket (scope 'claim').

import { NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/clientIp';
import { isValidRecoveryId } from '@/lib/identity';
import { calendar, destByDay, festivalCalendar, FESTIVAL_START_DAY } from '@/lib/festival';
import { previewNightFromBody } from '@/lib/specials';
import { SPECIAL_EVIDENCE } from '@/lib/specials';
import { bangkokDay } from '@/lib/bangkok';
import {
  checkRateLimit,
  countDistinctReacts,
  getConfig,
  getDaylight,
  getVisitorState,
  hasSecretEvidence,
  hasServerEvent,
  hasServerEventKinds,
  recordClaim,
} from '@/lib/store';
import {
  KINDNESS_GOAL,
  claimWindowOpen,
  isSecretSlot,
  parseClaimDay,
  rewardForSlot,
} from '@/lib/claims';
import type { VisitorClaim } from '@/lib/festivalState';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

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

  const parsedDay = parseClaimDay(body.day);
  if (!parsedDay) {
    return NextResponse.json(
      { error: 'invalid_day', message: 'day must be a night number 1–7 or a festival date.' },
      { status: 400 },
    );
  }
  const { dayNumber, date } = parsedDay;

  const slot = body.slot;
  if (typeof slot !== 'string' || rewardForSlot(slot) === null) {
    return NextResponse.json(
      { error: 'invalid_slot', message: 'slot must be visit, special, kindness, or secret-<destination>.' },
      { status: 400 },
    );
  }
  const rl = rewardForSlot(slot) as number;

  // The claim window: the real calendar, or the previewed festival
  // date when the dev server honours a previewNight.
  const preview = previewNightFromBody(body);
  const cal =
    preview !== null
      ? festivalCalendar(FESTIVAL_START_DAY, 'none', calendar().dates[preview - 1])
      : calendar();
  if (!claimWindowOpen(cal)) {
    return NextResponse.json(
      { error: 'claims_closed', message: 'Claims open on the first night and close 14 days after the last.' },
      { status: 409 },
    );
  }
  if ((await getConfig()).paused) {
    return NextResponse.json(
      { error: 'rewards_paused', message: 'Rewards are paused by the organisers right now.' },
      { status: 409 },
    );
  }
  // A night that has not happened yet cannot have been completed.
  if (date > cal.today) {
    return NextResponse.json(
      { error: 'not_completed', message: 'That night has not happened yet.' },
      { status: 403 },
    );
  }

  if (!(await checkRateLimit(clientIp(req), 'claim'))) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many claims at once. Give the river a moment.' },
      { status: 429 },
    );
  }

  // Evidence: the mission must actually be complete in the visitor's
  // D1 server event log. In preview mode the event log is stamped with
  // the real Bangkok day, so evidence from real-today counts too.
  const evidenceDays = preview !== null ? [date, bangkokDay()] : [date];
  let completed = false;
  if (isSecretSlot(slot)) {
    completed = await hasSecretEvidence(visitorId, slot.slice('secret-'.length));
  } else if (slot === 'visit') {
    for (const d of evidenceDays) {
      if (await hasServerEvent(visitorId, d, 'visit_place', dayNumber)) completed = true;
    }
  } else if (slot === 'special') {
    const dest = destByDay(dayNumber);
    const kinds = dest ? SPECIAL_EVIDENCE[dest.special.kind as keyof typeof SPECIAL_EVIDENCE] : [];
    for (const d of evidenceDays) {
      if (await hasServerEventKinds(visitorId, d, kinds)) completed = true;
    }
  } else if (slot === 'kindness') {
    for (const d of evidenceDays) {
      if ((await countDistinctReacts(visitorId, d)) >= KINDNESS_GOAL) completed = true;
    }
  }
  if (!completed) {
    return NextResponse.json(
      { error: 'not_completed', message: 'That mission is not complete yet.' },
      { status: 403 },
    );
  }

  const claim: VisitorClaim = { day: date, slot, rl, at: Date.now() };
  // E's recordClaim is idempotent (false on a repeat) and adds the
  // daylight itself on a first claim — so no second addDaylight here.
  const recorded = await recordClaim(visitorId, claim);
  const stored =
    recorded
      ? claim
      : ((await getVisitorState(visitorId)).claims.find((c) => c.day === date && c.slot === slot) ?? claim);
  const daylight = await getDaylight(date);
  return NextResponse.json({
    ok: true,
    claim: stored,
    daylight,
    already: !recorded,
    ...(preview !== null ? { preview: true } : {}),
  });
}
