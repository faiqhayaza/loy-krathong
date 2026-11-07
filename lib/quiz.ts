// The Sukhothai quiz (night 2 special, B1 of the restoration).
//
// Ported verbatim from the original single-file site
// (loy-krathong-seven-nights__1.html): SUKHOTHAI_QUIZ,
// SUKHOTHAI_QUIZ_ANSWER = 0, QUIZ_ORDER = [1, 0, 2]. A story + one
// question; the correct answer is option 0 in the data but is shown
// second (display order [1, 0, 2]).
//
// Correct answers record a `quiz` event (the evidence for the night-2
// special mission, A1) — but only when the server confirms the answer
// (POST /api/quiz), so the client never self-awards it. Wrong answers
// can be retried as often as the visitor likes.

import { loadEvents } from './events';
import type { Localised } from './destinations';

export const SUKHOTHAI_QUIZ: {
  story: Localised;
  question: Localised;
  options: Localised[];
} = {
  story: {
    en: 'According to legend, during the Sukhothai era a lady of the royal court named Nang Noppamas folded banana leaves and flowers into the shape of a lotus, placed a candle in it, and floated it on the river. Many say this was the first krathong.',
    th: 'ตามตำนานเล่าว่า ในสมัยสุโขทัย นางนพมาศ สตรีในราชสำนัก ได้ประดิษฐ์ใบตองและดอกไม้เป็นรูปดอกบัว ปักเทียนแล้วนำไปลอยในสายน้ำ หลายคนเชื่อว่านี่คือกระทงใบแรก',
  },
  question: {
    en: 'According to legend, who made the first lotus-shaped krathong?',
    th: 'ตามตำนาน ใครเป็นผู้ประดิษฐ์กระทงรูปดอกบัวใบแรก',
  },
  options: [
    { en: 'Nang Noppamas', th: 'นางนพมาศ' },
    { en: 'Phra Mae Khongkha', th: 'พระแม่คงคา' },
    { en: 'A Chiang Mai lantern maker', th: 'ช่างทำโคมจากเชียงใหม่' },
  ],
};

export const SUKHOTHAI_QUIZ_ANSWER = 0;

/** Display order of the three options (the correct one shows second). */
export const QUIZ_ORDER = [1, 0, 2] as const;

/** True when this device has ever answered the quiz correctly. */
export function quizDone(): boolean {
  return loadEvents().some((e) => e.kind === 'quiz');
}
