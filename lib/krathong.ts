// The visitor's krathong choices (flower / boat / flame / design), kept
// on this device — the float form's own source of truth: the builder
// auto-saves on every change, so a return visit finds the same krathong
// picked. (The My Krathong panel used to stage edits and save them
// explicitly against the same `loy:krathong` key; it was removed — the
// float form is the one editor now, so there is nothing to disagree with.)
//
// The server save of the krathong (POST api/krathong) comes with E1;
// until then this device-local key is the krathong.

import {
  BOATS,
  DEFAULT_BOAT,
  DEFAULT_DESIGN,
  DEFAULT_FLAME,
  DEFAULT_FLOWER,
  FLAMES,
  isAllowedCustomEmoji,
  isKnownDesign,
  isKnownFlower,
} from './data';

export interface KrathongChoice {
  flower: string;
  boat: string;
  flame: string;
  design: string;
}

export const KRATHONG_KEY = 'loy:krathong';

export const DEFAULT_KRATHONG: KrathongChoice = {
  flower: DEFAULT_FLOWER,
  boat: DEFAULT_BOAT,
  flame: DEFAULT_FLAME,
  design: DEFAULT_DESIGN,
};

/** The stored krathong, or the defaults when nothing is stored yet. */
export function loadKrathongChoice(): KrathongChoice {
  if (typeof window === 'undefined') return { ...DEFAULT_KRATHONG };
  try {
    const raw = localStorage.getItem(KRATHONG_KEY);
    if (!raw) return { ...DEFAULT_KRATHONG };
    const parsed = JSON.parse(raw) as { flower?: unknown; boat?: unknown; flame?: unknown; design?: unknown };
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
    const design =
      typeof parsed.design === 'string' && isKnownDesign(parsed.design)
        ? parsed.design
        : DEFAULT_DESIGN;
    return { flower, boat, flame, design };
  } catch {
    return { ...DEFAULT_KRATHONG };
  }
}

/** Store the krathong on this device. Returns false when storage fails. */
export function saveKrathongChoice(choice: KrathongChoice): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(KRATHONG_KEY, JSON.stringify(choice));
    // Tell the builder the krathong changed (it re-reads the choice),
    // so the form preview and the saved choice never disagree.
    window.dispatchEvent(new Event('loy:krathong-changed'));
    return true;
  } catch {
    return false;
  }
}
