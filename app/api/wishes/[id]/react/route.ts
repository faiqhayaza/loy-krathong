import { NextRequest, NextResponse } from 'next/server';
import { isKnownReaction } from '@/lib/data';
import { addReaction } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const reaction = body.reaction;
  if (typeof reaction !== 'string' || !isKnownReaction(reaction)) {
    return NextResponse.json({ error: 'unknown_reaction' }, { status: 400 });
  }

  const counts = await addReaction(params.id, reaction);
  if (!counts) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ reactions: counts });
}
