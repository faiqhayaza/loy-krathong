// The daily candle (night 4 special, chunk F1 of the restoration).
//
// Ported from the original single-file site
// (loy-krathong-seven-nights__1.html): from night 4 (`liveDay >= 4`)
// the visitor lights one candle a day — pick one of the 7 flames,
// light it, and the candle joins Tak's chain. Lighting again the same
// day RECOLOURS it: the HTML overwrites the existing `candle` event's
// `ref` with the new flame id (`lightCandle`), so there is still one
// candle event per day. The chosen flame is the flame on the visitor's
// own wishes on the river that day.
//
// Device-local first: today's candle lives in localStorage
// (`loy:candle`, mirroring the HTML solo mode's `candle` event). The
// community chain count lives on the server (POST/GET /api/candle) —
// one count per visitor per day, so a recolour never inflates it.
//
// The candle is the night-4 special mission evidence (chunk A maps it
// as `candle`): lighting records a `candle` event (ref = flame id) in
// the D1 event store, and the server route mirrors it into the
// per-visitor server log when the recovery ID is sent.
//
// Candle community counting lives in lib/store.ts (`incrementCandles`,
// `getCandleCount`) — the F integrator rewires it to chunk E's helpers
// if they exist; this file is the client half and does not depend on E.

import { bangkokDay } from './bangkok';
import { isKnownFlame } from './data';

/** One day's candle: the flame id, from `loy:candle`. */
export interface Candle {
  day: string; // 'YYYY-MM-DD', Bangkok day
  flame: string; // flame id (lib/data.ts FLAMES)
  at: number;
}

const CANDLE_KEY = 'loy:candle';

/** This device's candle for today, or null when none is lit yet. */
export function loadCandleToday(): Candle | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = JSON.parse(localStorage.getItem(CANDLE_KEY) ?? 'null') as unknown;
    if (!raw || typeof raw !== 'object') return null;
    const { day, flame, at } = raw as Record<string, unknown>;
    if (day !== bangkokDay()) return null;
    if (typeof flame !== 'string' || !isKnownFlame(flame)) return null;
    return { day: day as string, flame, at: typeof at === 'number' ? at : Date.now() };
  } catch {
    return null;
  }
}

/** Today's candle flame id, or null when no candle is lit today. */
export function candleFlameToday(): string | null {
  return loadCandleToday()?.flame ?? null;
}

/**
 * Store today's candle (lighting, or a recolour — the caller replaces
 * the old `candle` event's ref the same way, see
 * components/CandleDialog.tsx).
 */
export function saveCandle(flame: string): void {
  if (typeof window === 'undefined') return;
  if (!isKnownFlame(flame)) return;
  try {
    localStorage.setItem(
      CANDLE_KEY,
      JSON.stringify({ day: bangkokDay(), flame, at: Date.now() } satisfies Candle),
    );
  } catch {
    // private mode: the dialog still shows the lit state for this visit
  }
}
