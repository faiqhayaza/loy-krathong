// Admin authentication, shared by every /api/admin/* route (E2/E5).
//
// The rebuild's approach, kept (plan Q8): the admin token is sent as
// the `x-admin-token` header on every request and is never stored by the
// client. The HTML stored its key in localStorage and sent `X-Admin-Key`;
// that is deliberately NOT restored. When LOY_ADMIN_TOKEN is not set
// the route does not exist (404), same as the export route.

import { NextRequest, NextResponse } from 'next/server';

export function requireAdmin(req: NextRequest): NextResponse | null {
  const token = process.env.LOY_ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (req.headers.get('x-admin-token') !== token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}
