import { NextRequest, NextResponse } from 'next/server';
import { listStoredWishes } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Admin-only export of everything visitors inputted, so it can be kept or
 * analysed outside the site — e.g. open the CSV in Sheets/Excel.
 *
 * GET /api/admin/export?format=csv (default) or ?format=json
 * Header: x-admin-token must match LOY_ADMIN_TOKEN.
 * When LOY_ADMIN_TOKEN is not set the route does not exist (404).
 *
 * Only real submitted wishes are exported (no seeds), and only what was
 * actually stored: id, name, wish, translation, language, krathong
 * choices, timestamps and reaction counts. A visitor's worry is never
 * sent to the server and never stored, so it can never appear here.
 */

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function toCsv(wishes: Awaited<ReturnType<typeof listStoredWishes>>): string {
  const header = [
    'id',
    'created_at',
    'name',
    'wish',
    'translation',
    'lang',
    'flower',
    'boat',
    'flame',
    'sathu',
    'love',
    'hug',
    'care',
    'peace',
  ];
  const lines = [header.join(',')];
  for (const w of wishes) {
    lines.push(
      [
        w.id,
        new Date(w.createdAt).toISOString(),
        w.name,
        w.wish,
        w.translation ?? '',
        w.lang,
        w.flower,
        w.boat,
        w.flame,
        w.reactions.sathu,
        w.reactions.love,
        w.reactions.hug,
        w.reactions.care,
        w.reactions.peace,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}

export async function GET(req: NextRequest) {
  const token = process.env.LOY_ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (req.headers.get('x-admin-token') !== token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const wishes = await listStoredWishes();
  const format = req.nextUrl.searchParams.get('format') ?? 'csv';
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'json') {
    return NextResponse.json(
      { count: wishes.length, exportedAt: new Date().toISOString(), wishes },
      { headers: { 'Content-Disposition': `attachment; filename="loy-krathong-wishes-${stamp}.json"` } },
    );
  }
  return new NextResponse(toCsv(wishes), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="loy-krathong-wishes-${stamp}.csv"`,
    },
  });
}
