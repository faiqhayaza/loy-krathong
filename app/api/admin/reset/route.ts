// POST /api/admin/reset — delete EVERYTHING (E5).
//
// Body: `{confirm: "RESET"}` — the exact word, typed by the organiser.
// Anything else is rejected (400). The wipe deletes all wishes,
// reactions, visitor state, community counters, the audit log and the
// floaters set, and resets the config to defaults.
//
// The river comes back BLANK: no seeds are restored. The HTML's reset
// copy said it "puts back the 8 starter wishes", but Faiq asked for a
// blank river (2026-11-06) and the seeds were removed — Q5's
// recommendation, followed here. One audit entry recording the reset is
// written after the wipe.
//
// Admin-only: `x-admin-token` must match LOY_ADMIN_TOKEN (404 when the
// env var is not set). This is the one destructive admin action; it is
// the only route that deletes visitor state.

import { NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/clientIp';
import { appendAudit, checkRateLimit, resetAll } from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!(await checkRateLimit(clientIp(req), 'admin-reset'))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (body.confirm !== 'RESET') {
    return NextResponse.json(
      { error: 'confirm_required', message: 'Type RESET to confirm deleting everything.' },
      { status: 400 },
    );
  }
  await resetAll();
  await appendAudit('reset', 'Reset-all confirmed by an organiser (typed RESET).');
  return NextResponse.json({ ok: true, message: 'Everything deleted. The river is blank.' });
}
