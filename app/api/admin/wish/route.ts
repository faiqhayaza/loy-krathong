// POST /api/admin/wish — moderate one wish from the queue (E5).
//
// Body: `{id, action}` where action is:
// - `approve` — status back to 'approved': the wish returns to the
//   river ("Show on the river").
// - `hide` — status 'hidden': the wish leaves the river ("Hide").
// The change is written to the audit log. Returns the wish after the
// change, or 404 when the id is unknown.
//
// Admin-only: `x-admin-token` must match LOY_ADMIN_TOKEN (404 when the
// env var is not set).

import { NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/clientIp';
import { appendAudit, checkRateLimit, setWishStatus } from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!(await checkRateLimit(clientIp(req), 'admin-wish'))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const id = typeof body.id === 'string' ? body.id : '';
  const action = body.action;
  if (!id || (action !== 'approve' && action !== 'hide')) {
    return NextResponse.json(
      { error: 'invalid_action', message: 'Body must be {id, action: "approve" | "hide"}.' },
      { status: 400 },
    );
  }
  const wish = await setWishStatus(id, action === 'approve' ? 'approved' : 'hidden');
  if (!wish) {
    return NextResponse.json({ error: 'not_found', message: 'No wish with that id.' }, { status: 404 });
  }
  await appendAudit(
    action === 'approve' ? 'wish_approve' : 'wish_hide',
    `${action === 'approve' ? 'Showed on the river' : 'Hid'} wish ${id} (${(wish.name || 'anonymous').slice(0, 40)}).`,
  );
  return NextResponse.json({ ok: true, wish });
}
