// The gratitude lantern (night 5 special, B3 of the restoration).
//
// Ported verbatim from the original single-file site
// (loy-krathong-seven-nights__1.html): GRATITUDE_CARDS (6 cards),
// CARD_COLOR (the paper colour of each card's lantern on the water),
// MAX_THANKS_CHARS = 60, THANKS_RELEASE_S = 16 (seconds the lantern
// takes to release onto the water).
//
// Rules (setThanks in the HTML): pick one of the 6 cards, optionally
// add a short note (denylist-checked — a rejected note answers
// `thanksRejected` and nothing is stored); once only — if a thanks
// lantern already exists it is shown and cannot be changed; requires
// night 5 open. Setting it records a `gratitude` event (evidence for
// the night-5 special mission).
//
// Device-local first: this device's lantern lives in localStorage
// (`loy:thanks`, mirroring the HTML solo mode's `S.thanks`). Community
// counts and the lanterns drifting on the water for everyone live on
// the server (POST/GET /api/thanks) — no visitor identity is stored
// with them, only the card id and the note the visitor chose to show.

import type { Localised } from './destinations';

export interface GratitudeCard {
  id: number;
  icon: string;
  label: Localised;
}

export const GRATITUDE_CARDS: GratitudeCard[] = [
  { id: 1, icon: '👨‍👩‍👧', label: { en: 'My family', th: 'ครอบครัวของฉัน' } },
  { id: 2, icon: '🤝', label: { en: 'My friends', th: 'เพื่อน ๆ ของฉัน' } },
  { id: 3, icon: '💼', label: { en: 'My team', th: 'ทีมของฉัน' } },
  { id: 4, icon: '🌿', label: { en: 'My health', th: 'สุขภาพของฉัน' } },
  { id: 5, icon: '📚', label: { en: 'A teacher or mentor', th: 'ครูหรือพี่เลี้ยง' } },
  { id: 6, icon: '🌕', label: { en: 'This moment', th: 'ช่วงเวลานี้' } },
];

/** The paper colour of each card's lantern on the water (HTML: CARD_COLOR). */
export const CARD_COLOR: Record<number, string> = {
  1: '#ff9fbf',
  2: '#ffb36b',
  3: '#ffd36b',
  4: '#9fe8a8',
  5: '#9fd0ff',
  6: '#fff2d6',
};

export const MAX_THANKS_CHARS = 60;

/** Seconds the lantern takes to release onto the water (HTML: THANKS_RELEASE_S). */
export const THANKS_RELEASE_S = 16;

export function gratitudeCardById(id: number): GratitudeCard | undefined {
  return GRATITUDE_CARDS.find((c) => c.id === id);
}

export function isValidGratitudeCard(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6;
}

// ---- This device's lantern of thanks (solo-mode `S.thanks`) ---------------

export interface Thanks {
  card: number;
  note: string | null;
  at: number;
}

const THANKS_KEY = 'loy:thanks';

export function loadThanks(): Thanks | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = JSON.parse(localStorage.getItem(THANKS_KEY) ?? 'null') as unknown;
    if (!raw || typeof raw !== 'object') return null;
    const { card, note, at } = raw as Record<string, unknown>;
    if (typeof card !== 'number' || !isValidGratitudeCard(card)) return null;
    return { card, note: typeof note === 'string' ? note : null, at: typeof at === 'number' ? at : Date.now() };
  } catch {
    return null;
  }
}

/** Store this device's lantern of thanks (once only — callers check loadThanks first). */
export function saveThanks(thanks: Thanks): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THANKS_KEY, JSON.stringify(thanks));
  } catch {
    // private mode: the dialog still shows the set state for this visit
  }
}
