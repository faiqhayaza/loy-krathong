// GET /api/state — the server-side passport (E1).
//
// One call returns the whole festival state, the way the HTML's shared
// mode did: `today`, `serverNow` (the client computes
// `offset = serverNow - Date.now()` so the Bangkok day agrees), `config`,
// `wishes` (with `status`; non-approved wishes arrive `hidden: true`),
// `me` (the requesting visitor's own state), `community` (aggregates),
// `isAdmin`, `kiosk`, `authorVisible`, plus an ETag for cheap polling
// (`If-None-Match` → 304, no body).
//
// Identity: the `x-visitor-id` header carries the visitor's 10-digit
// recovery ID (lib/identity.ts). Without it the call still works —
// `me` is empty and `myWishes` is [] — so the river stays readable
// while the gate (which every visitor passes first) is what normally
// supplies the ID. `me` is ONLY ever the requesting visitor's own
// state; one visitor's ID is never shown to another.
//
// Hidden wishes: a wish with status 'reported' or 'hidden' arrives with
// `hidden: true`. Its text is redacted for everyone except its owner —
// an owner sees their own wish as under review, with its text; other
// visitors get an empty wish/name so moderated content never leaks
// through the payload. The client filters hidden wishes out of the
// river either way.
//
// PATCH /api/state — incremental `me` updates (krathong, stamps,
// visits, secrets, thanks, sent). Claims and events are server-owned
// and cannot be written here — claims go through the claim route (A2),
// events through /api/event (D1). Rate-limited 5/minute/IP (scope
// 'state'). The one-time bulk move from device-local storage is
// POST /api/state/migrate.

import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/clientIp';
import { bangkokDay } from '@/lib/bangkok';
import { calendarFromConfig } from '@/lib/festival';
import { isValidRecoveryId } from '@/lib/identity';
import { DESTINATIONS, isKnownBoat, isKnownFlower, type Wish } from '@/lib/data';
import {
  checkRateLimit,
  getBlessingsCount,
  getCandles,
  getConfig,
  getDayLight,
  getGratitudeCountsForDay,
  getVisitorState,
  listSkyLanterns,
  listStoredWishesRaw,
  listThanksLanterns,
  patchVisitorState,
} from '@/lib/store';
import type { StatePayload, StateWish, VisitorState } from '@/lib/festivalState';
import { emptyCommunity } from '@/lib/festivalState';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isAdminRequest(req: NextRequest): boolean {
  const token = process.env.LOY_ADMIN_TOKEN;
  return !!token && req.headers.get('x-admin-token') === token;
}

async function buildPayload(req: NextRequest): Promise<StatePayload> {
  const config = await getConfig();
  const cal = calendarFromConfig(config);
  const today = cal.today;
  const visitorId = req.headers.get('x-visitor-id');
  const mine = visitorId && isValidRecoveryId(visitorId) ? visitorId : null;

  const stored = await listStoredWishesRaw();
  const wishes: StateWish[] = stored.map((w) => {
    const hidden = (w.status ?? 'approved') !== 'approved';
    const isMine = mine !== null && w.visitorId === mine;
    const { visitorId: _v, ...pub } = w as Wish & { visitorId?: string };
    void _v;
    // Redact moderated content for everyone but its owner.
    if (hidden && !isMine) return { ...pub, name: '', wish: '', hidden };
    return { ...pub, hidden };
  });
  // Newest first, like the public river.
  wishes.sort((a, b) => b.createdAt - a.createdAt);

  const me: VisitorState = mine ? await getVisitorState(mine) : {
    krathong: null,
    events: [],
    claims: [],
    stamps: [],
    visits: [],
    secrets: [],
    thanks: null,
    sent: [],
    received: {},
  };
  const myWishes = mine
    ? wishes.filter((w) => stored.some((s) => s.id === w.id && s.visitorId === mine))
    : [];

  const community = {
    ...emptyCommunity(),
    dayLight: await getDayLight(cal.dates),
    candles: await getCandles(today),
    gratitude: await getGratitudeCountsForDay(today),
    thanks: await listThanksLanterns(today),
    sky: await listSkyLanterns(today),
    blessings: await getBlessingsCount(today),
  };

  const isAdmin = isAdminRequest(req);
  return {
    app: 'loy-krathong',
    today,
    serverNow: Date.now(),
    config,
    wishes,
    me: { ...me, myWishes },
    community,
    isAdmin,
    kiosk: config.kiosk,
    authorVisible: isAdmin,
  };
}

export async function GET(req: NextRequest) {
  const payload = await buildPayload(req);
  // The ETag covers everything EXCEPT serverNow: the clock moves on
  // every request, so hashing it in would make the ETag change every
  // time and If-None-Match could never match (a 304 would be
  // unreachable). The client still gets the live serverNow in the body.
  const etagBody = JSON.stringify({ ...payload, serverNow: 0 });
  const etag = `"${createHash('sha1').update(etagBody).digest('hex')}"`;
  if (req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }
  const body = JSON.stringify(payload);
  return new NextResponse(body, {
    headers: { 'Content-Type': 'application/json', ETag: etag },
  });
}

function isSlugList(value: unknown, allowed: Set<string>): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((v) => typeof v === 'string' && allowed.has(v))
  );
}

export async function PATCH(req: NextRequest) {
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

  const patch: Partial<VisitorState> = {};
  const rejected: string[] = [];
  const destIds = new Set(DESTINATIONS.map((d) => d.id));

  if ('krathong' in body) {
    const k = body.krathong;
    if (
      k && typeof k === 'object' &&
      typeof (k as Record<string, unknown>).flower === 'string' &&
      typeof (k as Record<string, unknown>).boat === 'string' &&
      isKnownFlower((k as Record<string, unknown>).flower as string) &&
      isKnownBoat((k as Record<string, unknown>).boat as string)
    ) {
      patch.krathong = {
        flower: (k as { flower: string }).flower,
        boat: (k as { boat: string }).boat,
      };
    } else if (k === null) {
      patch.krathong = null;
    } else {
      rejected.push('krathong');
    }
  }
  if ('stamps' in body) {
    if (isSlugList(body.stamps, destIds)) patch.stamps = [...new Set(body.stamps)];
    else rejected.push('stamps');
  }
  if ('visits' in body) {
    if (isSlugList(body.visits, destIds)) patch.visits = [...new Set(body.visits)];
    else rejected.push('visits');
  }
  if ('secrets' in body) {
    if (
      Array.isArray(body.secrets) &&
      body.secrets.every((v) => typeof v === 'string' && destIds.has(v))
    ) {
      patch.secrets = [...new Set(body.secrets as string[])];
    } else rejected.push('secrets');
  }
  if ('thanks' in body) {
    const t = body.thanks;
    if (
      t && typeof t === 'object' &&
      typeof (t as Record<string, unknown>).card === 'number' &&
      Number.isInteger((t as Record<string, unknown>).card) &&
      (t as { card: number }).card >= 1 &&
      (t as { card: number }).card <= 6 &&
      typeof (t as Record<string, unknown>).note === 'string' &&
      ((t as { note: string }).note.length <= 60) &&
      typeof (t as Record<string, unknown>).at === 'number'
    ) {
      patch.thanks = t as VisitorState['thanks'];
    } else if (t === null) {
      patch.thanks = null;
    } else {
      rejected.push('thanks');
    }
  }
  if ('sent' in body) {
    if (
      Array.isArray(body.sent) &&
      body.sent.every(
        (s) =>
          !!s && typeof s === 'object' &&
          typeof (s as Record<string, unknown>).wishId === 'string' &&
          typeof (s as Record<string, unknown>).message === 'number' &&
          typeof (s as Record<string, unknown>).at === 'number',
      )
    ) {
      patch.sent = body.sent as VisitorState['sent'];
    } else {
      rejected.push('sent');
    }
  }

  const next = await patchVisitorState(visitorId, patch);
  return NextResponse.json({ ok: true, me: next, rejected });
}
