// Shared helpers for the seven specials (chunk B).
//
// Each night has one special (lib/destinations.ts): night 1 float, 2
// quiz, 3 blessing, 4 candle (chunk F — the daily candle, NOT built
// here), 5 gratitude, 6 share, 7 finale. A special is the evidence
// source for its night's `special` mission (A1): the mission reads the
// event store, so every special here records its event kind on success
// (float, quiz, blessing, gratitude, share, finale).
//
// The night-gating rule is the festival calendar's: a special opens on
// its night (`isOpenDay`). The preview override below is DEV-ONLY —
// it exists so the specials can be checked end to end before the
// festival opens (18 Nov 2026). See the note on `previewNight()`.

import type { FestivalCalendar } from './festival';
import { isOpenDay } from './festival';
import { bangkokDay } from './bangkok';
import { eventsFor } from './events';

export type SpecialKind = 'float' | 'quiz' | 'blessing' | 'candle' | 'gratitude' | 'share' | 'finale';

/** Which night each special belongs to (the destination day). */
export const SPECIAL_DAY: Record<SpecialKind, number> = {
  float: 1,
  quiz: 2,
  blessing: 3,
  candle: 4,
  gratitude: 5,
  share: 6,
  finale: 7,
};

/** The event kind(s) that prove a special was done (A1's SPECIAL_EVIDENCE). */
export const SPECIAL_EVIDENCE: Record<SpecialKind, string[]> = {
  float: ['float'],
  quiz: ['quiz'],
  blessing: ['blessing'],
  candle: ['candle'],
  gratitude: ['gratitude'],
  share: ['share', 'blessing'],
  finale: ['finale'],
};

// ---- DEV-ONLY preview ------------------------------------------------------
//
// `?night=N` (1–7) pretends tonight is night N, so a special can be
// opened and checked before the festival. It only changes what the UI
// offers: the API routes still enforce the real calendar, unless the
// dev server runs with LOY_PREVIEW_NIGHTS=1 (see previewNightFromBody
// below) — so a previewed dialog in production can never record an
// event, because the server answers `not_open`. This is the same shape
// as the `?cloud=NN` dev override in components/RiverCanvas.tsx, and
// the organiser preview E3 will formalise (`simDay`). Remove it when
// E3 lands, or keep it as the dev shortcut it is — never wire it to
// real gating.

/** The `?night=N` preview (client only), or null. */
export function previewNight(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('night');
  if (raw === null || !/^[1-7]$/.test(raw)) return null;
  return Number(raw);
}

/** True when the special's night is open (or previewed, dev-only). */
export function specialOpen(cal: FestivalCalendar, kind: SpecialKind): boolean {
  const day = SPECIAL_DAY[kind];
  const preview = previewNight();
  if (preview !== null) return preview === day;
  return isOpenDay(cal, day);
}

/**
 * True when this device has evidence for the special on its own night.
 * The old check counted an event from ANY night, so a test float from
 * before the festival made Night 1 read "Done ✓" while its missions
 * correctly read Locked (November audit) — the missions only count
 * same-day evidence. A preview (?night=N, dev-only) counts evidence
 * recorded today for that night, so preview checks still work.
 */
export function specialDone(kind: SpecialKind, cal?: FestivalCalendar): boolean {
  const kinds = SPECIAL_EVIDENCE[kind];
  const events = eventsFor();
  if (!cal) return events.some((e) => kinds.includes(e.kind));
  const day = cal.dates[SPECIAL_DAY[kind] - 1];
  const preview = previewNight();
  return events.some(
    (e) =>
      kinds.includes(e.kind) &&
      (e.day === day || (preview === SPECIAL_DAY[kind] && e.day === bangkokDay())),
  );
}

// ---- Server side -----------------------------------------------------------

/**
 * The `previewNight` a request body asks for, honoured ONLY when the
 * server runs with LOY_PREVIEW_NIGHTS=1 (the dev server for chunk
 * verification). In production the variable is unset and every preview
 * request is ignored, so the real calendar is the only gate. Returns
 * the previewed night (1–7) or null.
 */
export function previewNightFromBody(body: Record<string, unknown>): number | null {
  if (process.env.LOY_PREVIEW_NIGHTS !== '1') return null;
  const value = body.previewNight;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 7) return null;
  return value;
}

/** True when a night is open for a special, honouring a dev preview. */
export function serverSpecialOpen(cal: FestivalCalendar, kind: SpecialKind, preview: number | null): boolean {
  const day = SPECIAL_DAY[kind];
  if (preview !== null) return preview === day;
  return isOpenDay(cal, day);
}
