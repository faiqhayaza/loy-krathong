// POST /api/admin/kiosk — mark this server as a kiosk / shared screen (E4).
//
// Body: `{on: true | false}`. Sets `config.kiosk`, which api/state
// reports to every visitor. That is ALL it does:
//
// - It does NOT lift the once-per-day float limit. The hard rule at the
//   top of the restoration plan stands — the kiosk/shared bypass is not
//   restored by default (Q6) — and `dailyLimitApplies()` in lib/config.ts
//   always returns true. The /admin page labels the toggle exactly that
//   way, so no organiser switches it on expecting a bypass.
// - It does NOT change any other behaviour. A kiosk is a record that
//   this device is shared, for the organiser's own bookkeeping and for
//   any future chunk Faiq approves.
//
// Admin-only: `x-admin-token` must match LOY_ADMIN_TOKEN (404 when the
// env var is not set).

import { NextRequest, NextResponse } from 'next/server';
import { appendAudit, checkRateLimit, getConfig, saveConfig } from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!(await checkRateLimit(clientIp(req), 'admin-kiosk'))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (typeof body.on !== 'boolean') {
    return NextResponse.json(
      { error: 'invalid_kiosk', message: 'Body must be {on: true | false}.' },
      { status: 400 },
    );
  }
  const config = await getConfig();
  config.kiosk = body.on;
  await saveConfig(config);
  await appendAudit('kiosk', `Kiosk/shared screen ${body.on ? 'ON' : 'OFF'} (record only — the once-per-day limit still applies).`);
  return NextResponse.json({ ok: true, kiosk: config.kiosk });
}
