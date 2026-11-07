// GET /api/admin/summary — the organiser's dashboard data (E5).
//
// Returns, in one call:
// - `counts`: wishes · people floated · reactions · blessing lanterns ·
//   candles · thanks lanterns · stamps · secrets found (today's
//   community numbers for blessings/candles/thanks; all-time for the
//   rest — see adminCounts in lib/store.ts).
// - `queue`: wishes with status 'reported' or 'hidden', newest first,
//   each with its report count and status label.
// - `audit`: the most recent organiser changes (default 50).
// - `config`: the current organiser config.
//
// Admin-only: `x-admin-token` must match LOY_ADMIN_TOKEN (404 when the
// env var is not set). No visitor recovery IDs appear anywhere in this
// response.

import { NextRequest, NextResponse } from 'next/server';
import { bangkokDay } from '@/lib/bangkok';
import { adminCounts, getConfig, listAudit, listQueuedWishes } from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const today = bangkokDay();
  const [counts, queue, audit, config] = await Promise.all([
    adminCounts(today),
    listQueuedWishes(),
    listAudit(50),
    getConfig(),
  ]);
  return NextResponse.json({ counts, queue, audit, config, today });
}
