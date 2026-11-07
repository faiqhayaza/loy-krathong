import { NextRequest, NextResponse } from 'next/server';
import { isKnownReaction, type ReactionId } from '@/lib/data';
import { setReaction, wishExists } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// One reaction per wish per visitor (Rules: toggleReaction). The client
// sends the reaction it is moving from and the one it is moving to; either
// may be null (tapping the same reaction again removes it).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const reaction = body.reaction ?? null;
  const previous = body.previous ?? null;
  if (reaction !== null && (typeof reaction !== 'string' || !isKnownReaction(reaction))) {
    return NextResponse.json({ error: 'unknown_reaction' }, { status: 400 });
  }
  if (previous !== null && (typeof previous !== 'string' || !isKnownReaction(previous))) {
    return NextResponse.json({ error: 'unknown_reaction' }, { status: 400 });
  }

  // Reacting to a wish that is not on the river is a 404: the original
  // site no-ops when the wish is not found, and the store would
  // otherwise invent a reaction row for an id that does not exist.
  if (!(await wishExists(params.id))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const counts = await setReaction(
    params.id,
    previous as ReactionId | null,
    reaction as ReactionId | null,
  );
  if (!counts) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ reactions: counts });
}
