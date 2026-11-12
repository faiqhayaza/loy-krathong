// GET /api/admin/config — the current organiser config (E2).
// POST /api/admin/config — patch it (E2/E3/E4).
//
// Patchable fields (validateConfigPatch in lib/config.ts): startDay,
// mode, targets[7], paused, simDay, celebrate (true = start a 60 s
// celebration now, false = clear it), kiosk. Unknown or invalid fields
// are reported in `rejected` and ignored; the rest apply. Every change
// is written to the audit log (E5) and is visible to all visitors on
// the next api/state poll.
//
// Admin-only: `x-admin-token` must match LOY_ADMIN_TOKEN (404 when the
// env var is not set). Rate-limited 5/minute/IP (scope 'admin') on
// POST, so a leaked token cannot be used to hammer the config.

import { NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/clientIp';
import { validateConfigPatch } from '@/lib/config';
import { appendAudit, checkRateLimit, getConfig, saveConfig } from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json({ config: await getConfig() });
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  // 30/min in its own bucket ('admin-config'): an organiser
  // legitimately saves settings several times while working (the
  // default 5/min locked the form on the 6th save). The token is still
  // the gate; this only stops hammering.
  if (!(await checkRateLimit(clientIp(req), 'admin-config', 30))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const { patch, rejected } = validateConfigPatch(body);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: 'nothing_valid', rejected, message: 'No valid config fields in the request.' },
      { status: 400 },
    );
  }
  const current = await getConfig();
  const next = { ...current, ...patch };
  await saveConfig(next);
  const changed = Object.keys(patch)
    .map((k) => (k === 'celebrate' ? 'celebrate' : `${k}=${JSON.stringify((patch as Record<string, unknown>)[k])}`))
    .join(', ');
  await appendAudit('config', `Config changed: ${changed}`);
  return NextResponse.json({ ok: true, config: next, rejected });
}
