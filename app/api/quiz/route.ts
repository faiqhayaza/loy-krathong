// POST /api/quiz — the Sukhothai quiz (night 2 special, B1).
//
// Body: `{answer}` — the index (0–2) of the option the visitor picked
// in the data order (the dialog shows them in QUIZ_ORDER = [1, 0, 2]).
// Returns `{correct}`. The answer is checked here, on the server, so
// the client never self-awards the `quiz` event: the dialog records
// the event only when this route answers correct.
//
// Night gating: night 2 must be open. A `previewNight` in the body is
// honoured only when the server runs with LOY_PREVIEW_NIGHTS=1 (the
// dev server for chunk verification — see lib/specials.ts); in
// production it is ignored and the real calendar is the only gate.
// Rate-limited at 5/minute/IP in its own bucket (scope 'quiz').

import { NextRequest, NextResponse } from 'next/server';
import { SUKHOTHAI_QUIZ_ANSWER } from '@/lib/quiz';
import { calendar } from '@/lib/festival';
import { previewNightFromBody, serverSpecialOpen } from '@/lib/specials';
import { checkRateLimit } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const answer = body.answer;
  if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0 || answer > 2) {
    return NextResponse.json({ error: 'invalid_answer', message: 'answer must be 0, 1 or 2.' }, { status: 400 });
  }

  const preview = previewNightFromBody(body);
  if (!serverSpecialOpen(calendar(), 'quiz', preview)) {
    return NextResponse.json(
      { error: 'not_open', message: 'The Sukhothai quiz opens on night 2 (19 November).' },
      { status: 403 },
    );
  }

  if (!(await checkRateLimit(clientIp(req), 'quiz'))) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many answers at once. Give the river a moment.' },
      { status: 429 },
    );
  }

  return NextResponse.json({ correct: answer === SUKHOTHAI_QUIZ_ANSWER, ...(preview !== null ? { preview: true } : {}) });
}
