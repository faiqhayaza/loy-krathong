// Blessing lanterns (night 3 special, B2 of the restoration).
//
// Ported verbatim from the original single-file site
// (loy-krathong-seven-nights__1.html): BLESSINGS (6 templates),
// LANTERN_S = 11 (seconds a sent lantern rises in the scene).
//
// Rules (sendBlessing in the HTML): a lantern goes to a FRIEND's
// krathong — your own krathong answers `blessingOwn`; one lantern per
// krathong per visitor (`blessingAgain`); a sent lantern records a
// `blessing` event, which is evidence for the night-3 special mission
// AND for the night-6 `share` mission (SPECIAL_EVIDENCE.share =
// ['share', 'blessing']).
//
// Device-local first: lanterns this device sent live in localStorage
// (`loy:sent-blessings`, mirroring the HTML solo mode's `S.sent`). The
// per-wish counts and the lanterns a visitor RECEIVED live on the
// server (POST /api/bless stores them per wish; GET /api/bless?wishId=
// reads them back) — the receiver side is completed by chunk C's My
// Krathong panel (C4), which is where received lanterns are displayed.

import type { Localised } from './destinations';

export interface Blessing {
  id: number;
  glyph: string;
  text: Localised;
}

export const BLESSINGS: Blessing[] = [
  { id: 0, glyph: '🌟', text: { en: 'May your wish come true', th: 'ขอให้คำอธิษฐานของคุณเป็นจริง' } },
  { id: 1, glyph: '💪', text: { en: 'Sending you strength', th: 'ส่งกำลังใจให้นะ' } },
  { id: 2, glyph: '🌿', text: { en: 'Wishing you good health', th: 'ขอให้สุขภาพแข็งแรง' } },
  { id: 3, glyph: '🤝', text: { en: 'You are not alone', th: 'คุณไม่ได้อยู่คนเดียว' } },
  { id: 4, glyph: '☀️', text: { en: 'May the year ahead be bright', th: 'ขอให้ปีที่จะมาถึงสดใส' } },
  { id: 5, glyph: '🪷', text: { en: 'Happy Loy Krathong!', th: 'สุขสันต์วันลอยกระทง!' } },
];

/** Seconds a sent lantern rises through the scene (HTML: LANTERN_S). */
export const LANTERN_S = 11;

export function blessingById(id: number): Blessing | undefined {
  return BLESSINGS.find((b) => b.id === id);
}

export function isValidBlessingId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < BLESSINGS.length;
}

// ---- Lanterns this device sent (solo-mode `S.sent`) -----------------------

export interface SentBlessing {
  wishId: string;
  message: number;
  at: number;
}

const SENT_KEY = 'loy:sent-blessings';

export function loadSentBlessings(): SentBlessing[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(SENT_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (b): b is SentBlessing =>
        !!b &&
        typeof b === 'object' &&
        typeof (b as SentBlessing).wishId === 'string' &&
        typeof (b as SentBlessing).message === 'number',
    );
  } catch {
    return [];
  }
}

function saveSentBlessings(list: SentBlessing[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(list));
  } catch {
    // private mode: the sent list is a keepsake; the river is unaffected
  }
}

/** True when this device already sent a lantern to this wish. */
export function hasSentBlessing(wishId: string): boolean {
  return loadSentBlessings().some((b) => b.wishId === wishId);
}

/** Remember a sent lantern on this device (no-op when already sent). */
export function addSentBlessing(wishId: string, message: number): void {
  const list = loadSentBlessings();
  if (list.some((b) => b.wishId === wishId)) return;
  saveSentBlessings([...list, { wishId, message, at: Date.now() }]);
}
