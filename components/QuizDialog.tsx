// The Sukhothai quiz dialog (night 2 special, B1).
//
// A story + one question (lib/quiz.ts). The answer is checked by the
// server (POST /api/quiz); only a correct answer records the `quiz`
// event. Wrong answers show `quizWrong` and can be retried. Once done,
// the dialog shows only the right-answer banner (the HTML's rule:
// `done = S.events.some(e => e.kind === 'quiz')`).

'use client';

import { useState } from 'react';
import type { Lang } from '@/lib/data';
import { calendar } from '@/lib/festival';
import { shortDate, t } from '@/lib/i18n';
import { QUIZ_ORDER, SUKHOTHAI_QUIZ, quizDone } from '@/lib/quiz';
import { previewNight, specialOpen } from '@/lib/specials';
import { recordEvent } from '@/lib/events';
import SpecialDialog from './SpecialDialog';

export default function QuizDialog({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const s = t(lang);
  const cal = calendar();
  const [done, setDone] = useState(() => quizDone());
  const [status, setStatus] = useState<'ask' | 'wrong' | 'right'>(() => (quizDone() ? 'right' : 'ask'));
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(false);
  const open = specialOpen(cal, 'quiz');

  async function answer(optionIndex: number) {
    setChecking(true);
    setError(false);
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: optionIndex, ...(previewNight() !== null ? { previewNight: previewNight() } : {}) }),
      });
      const data = (await res.json().catch(() => ({}))) as { correct?: boolean };
      if (!res.ok || typeof data.correct !== 'boolean') {
        setError(true);
        return;
      }
      if (data.correct) {
        recordEvent('quiz', 0);
        setDone(true);
        setStatus('right');
      } else {
        setStatus('wrong');
      }
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <SpecialDialog lang={lang} title={`📜 ${s.quizTitle}`} onClose={onClose} testId="quiz-dialog">
      {!open ? (
        <>
          <p className="hint">{s.specialLocked(shortDate(cal.dates[1], lang))}</p>
          <button type="button" className="btn primary" onClick={onClose}>
            {s.done}
          </button>
        </>
      ) : done || status === 'right' ? (
        <>
          <p className="dlg-story">{SUKHOTHAI_QUIZ.story[lang]}</p>
          <p className="banner success" role="status">
            {s.quizRight}
          </p>
          <button type="button" className="btn primary" onClick={onClose}>
            {s.done}
          </button>
        </>
      ) : (
        <>
          <p className="dlg-story">{SUKHOTHAI_QUIZ.story[lang]}</p>
          <p className="dlg-question">{SUKHOTHAI_QUIZ.question[lang]}</p>
          <div className="choice-grid" role="group" aria-label={SUKHOTHAI_QUIZ.question[lang]}>
            {QUIZ_ORDER.map((optionIndex) => (
              <button
                key={optionIndex}
                type="button"
                className="btn ghost choice-btn"
                disabled={checking}
                onClick={() => answer(optionIndex)}
              >
                {SUKHOTHAI_QUIZ.options[optionIndex][lang]}
              </button>
            ))}
          </div>
          {status === 'wrong' && (
            <p className="banner warning" role="status">
              {s.quizWrong}
            </p>
          )}
          {error && (
            <p className="banner error" role="alert">
              {s.errorGeneric}
            </p>
          )}
        </>
      )}
    </SpecialDialog>
  );
}
