import { NextRequest, NextResponse } from 'next/server';
import { deleteWish } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Admin-only delete, so a test or abusive wish can be removed from the
 * river. When LOY_ADMIN_TOKEN is not set the route does not exist (404).
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = process.env.LOY_ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (req.headers.get('x-admin-token') !== token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const removed = await deleteWish(params.id);
  if (!removed) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
