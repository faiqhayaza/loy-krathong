// The visitor's krathong choices (flower / boat / flame), kept on this
// device — one shared source of truth for the builder (which auto-saves
// on every change) and the My Krathong panel (Chunk C4, which stages
// edits and saves them explicitly). Both read and write the same
// `loy:krathong` key, so the two editors can never disagree about what
// the krathong is — only about when an edit lands.
//
// The server save of the krathong (POST api/krathong) comes with E1;
// until then this device-local key is the krathong.

import {
  BOATS,
  DEFAULT_BOAT,
  DEFAULT_FLAME,
  DEFAULT_FLOWER,
  FLAMES,
  isAllowedCustomEmoji,
  isKnownFlower,
} from './data';

export interface KrathongChoice {
  flower: string;
  boat: string;
  flame: string;
}

export const KRATHONG_KEY = 'loy:krathong';

export const DEFAULT_KRATHONG: KrathongChoice = {
  flower: DEFAULT_FLOWER,
  boat: DEFAULT_BOAT,
  flame: DEFAULT_FLAME,
};

/** The stored krathong, or the defaults when nothing is stored yet. */
export function loadKrathongChoice(): KrathongChoice {
  if (typeof window === 'undefined') return { ...DEFAULT_KRATHONG };
  try {
    const raw = localStorage.getItem(KRATHONG_KEY);
    if (!raw) return { ...DEFAULT_KRATHONG };
    const parsed = JSON.parse(raw) as { flower?: unknown; boat?: unknown; flame?: unknown };
    const flower =
      typeof parsed.flower === 'string' &&
      (isKnownFlower(parsed.flower) || isAllowedCustomEmoji(parsed.flower))
        ? parsed.flower
        : DEFAULT_FLOWER;
    const boat =
      typeof parsed.boat === 'string' && BOATS.some((b) => b.id === parsed.boat)
        ? parsed.boat
        : DEFAULT_BOAT;
    const flame =
      typeof parsed.flame === 'string' && FLAMES.some((f) => f.id === parsed.flame)
        ? parsed.flame
        : DEFAULT_FLAME;
    return { flower, boat, flame };
  } catch {
    return { ...DEFAULT_KRATHONG };
  }
}

/** Store the krathong on this device. Returns false when storage fails. */
export function saveKrathongChoice(choice: KrathongChoice): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(KRATHONG_KEY, JSON.stringify(choice));
    // Tell the other editor (the builder, or the panel) that the
    // krathong changed, so the two never show different colours.
    window.dispatchEvent(new Event('loy:krathong-changed'));
    return true;
  } catch {
    return false;
  }
}
