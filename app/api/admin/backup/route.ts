// GET /api/admin/backup — download a JSON snapshot of the whole store (E5).
//
// The snapshot holds the config, all stored wishes, per-visitor state
// and the audit log. Visitor state is keyed by a SHA-256 hash of the
// recovery ID, never the raw ID (see hashVisitorId in lib/store.ts):
// the backup is for inspection and safekeeping, not for restoring one
// visitor's progress, and a downloaded file must never carry a bearer
// token. Wishes carry no visitorId at all.
//
// Admin-only: `x-admin-token` must match LOY_ADMIN_TOKEN (404 when the
// env var is not set).

import { NextRequest, NextResponse } from 'next/server';
import { buildBackup } from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const backup = await buildBackup();
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="loy-krathong-backup-${stamp}.json"`,
    },
  });
}
