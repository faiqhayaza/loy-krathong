// The welcome dialog's gentle lines (Chunk C3), ported verbatim from
// the original single-file site's WELCOME_FALLBACK. Five lines per
// language; one is picked per Bangkok day (deterministic by date, so the
// line does not change if the dialog is reopened that day).
//
// The dialog itself (components/WelcomeDialog.tsx) shows once per
// Bangkok day: title is the night + tonight's destination, body is the
// destination's story (lib/destinations.ts), then one of these lines.

import type { Lang } from './data';

export const WELCOME_FALLBACK: Record<Lang, string[]> = {
  en: [
    'May tonight’s full moon remind you to slow down a little. Rest is not a reward you have to earn.',
    'Before you float your krathong, take one slow breath. You have been carrying a lot, and you are allowed to put some of it down.',
    'May the river carry away what weighs on you, and may you find time today for water, food and a proper break.',
    'Be as gentle with yourself tonight as you are with the people you care about. You deserve the same kindness.',
    'May this festival bring you a quiet moment of your own, and an early night when you need it.',
  ],
  th: [
    'ขอให้พระจันทร์เต็มดวงคืนนี้ชวนให้คุณได้ช้าลงสักนิด การพักผ่อนไม่ใช่รางวัลที่ต้องรอให้สมควรได้นะ',
    'ก่อนลอยกระทง ลองหายใจช้า ๆ สักครั้ง คุณแบกอะไรไว้มากแล้ว วางลงบ้างก็ได้นะ',
    'ขอให้สายน้ำพาสิ่งที่หนักใจออกไป และขอให้วันนี้คุณมีเวลาได้ดื่มน้ำ กินข้าว และพักจริง ๆ สักหน่อย',
    'ใจดีกับตัวเองในคืนนี้ เหมือนที่คุณใจดีกับคนที่คุณรัก คุณเองก็ควรได้รับความอ่อนโยนแบบนั้นเหมือนกัน',
    'ขอให้เทศกาลนี้มอบช่วงเวลาสงบ ๆ ให้คุณได้อยู่กับตัวเอง และได้เข้านอนเร็วในคืนที่ต้องการนะ',
  ],
};

export const WELCOME_DAY_KEY = 'loy:welcome-day';

/** The gentle line for one Bangkok day ('YYYY-MM-DD'), stable all day. */
export function welcomeLineFor(day: string, lang: Lang): string {
  const lines = WELCOME_FALLBACK[lang];
  let hash = 0;
  for (const ch of day) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return lines[hash % lines.length];
}

/** The Bangkok day the welcome dialog was last shown, or null. */
export function loadWelcomeDay(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WELCOME_DAY_KEY);
    return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Record that the welcome dialog was shown for this Bangkok day. */
export function saveWelcomeDay(day: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WELCOME_DAY_KEY, day);
  } catch {
    // the dialog may simply show again tomorrow
  }
}
