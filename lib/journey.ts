// The journey card's data (Chunk C2): `journeyFor(cal)` gathers
// everything the card shows, from the device-local stores — the D1
// event store, the claims store (C1), the secrets store (C1), the
// passport (`loy:visits` / `loy:stamps`), the krathong choice and the
// my-wishes ledger (C4).
//
// Fields that belong to chunks not built yet are null, and the card
// says so instead of inventing a number:
// - `missions` — chunk A (missions + claims). The riverLight total
//   here counts claims only (secrets so far); mission rewards join it
//   when A lands.
// - `gratitudeCard` — chunk B3 (the gratitude lantern is once-only
//   and its card is part of the journey).
// - `candleLit` / `flameToday` — chunk F1 (daily candle).
// `quizDone` and `finaleJoined` read the D1 event store (B1/B5 record
// those events when they land); until then they are simply false.
// `floated` needs the destination tag (D3); device-locally it comes
// from the my-wishes ledger (C4), and the server tag replaces it
// with E1.

import type { FestivalCalendar } from './festival';
import { eventsFor } from './events';
import { totalRiverLight } from './claims';
import { loadSecrets } from './secrets';
import { loadKrathongChoice, type KrathongChoice } from './krathong';
import { floatedMap, loadMyWishes } from './myWishes';
import { bangkokDay } from './bangkok';

export interface Journey {
  krathong: KrathongChoice;
  /** Destination ids visited (passport), in festival order. */
  visited: string[];
  /** Destination ids stamped (passport), in festival order. */
  stamps: string[];
  /** Secret slugs found. */
  secrets: string[];
  /** Distinct festival dates with any recorded event. */
  participationDays: number;
  /** The visitor's total claimed River Light (claims store). */
  riverLight: number;
  /** Chunk A — null until missions exist. */
  missions: { done: number; total: number } | null;
  /** A quiz event exists (night 2, chunk B1). */
  quizDone: boolean;
  /** Chunk B3 — the gratitude card id, once the lantern is set. */
  gratitudeCard: number | null;
  /** Chunk F1 — whether today's candle is lit. */
  candleLit: boolean | null;
  /** Chunk F1 — today's flame id. */
  flameToday: string | null;
  /** A finale event exists (night 7, chunk B5). */
  finaleJoined: boolean;
  /** Whether the visitor floated today. */
  floatedToday: boolean;
  /** Destination slug → the visitor's most recent krathong there. */
  floated: Record<string, { flower: string; boat: string }>;
  /** How many wishes this device floated. */
  wishesFloated: number;
  /** Which journey fields are still waiting on another chunk. */
  pending: string[];
}

function loadStringArray(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function journeyFor(cal: FestivalCalendar): Journey {
  const events = eventsFor();
  // Participation days are distinct festival dates with any event —
  // a visit, a reaction, a float — on a night of the festival.
  const festivalDates = new Set(cal.dates);
  const participationDays = new Set(
    events.filter((e) => festivalDates.has(e.day)).map((e) => e.day),
  ).size;
  const today = bangkokDay();
  let floatedToday = false;
  try {
    floatedToday = localStorage.getItem('loy:floated-day') === today;
  } catch {
    floatedToday = false;
  }
  const pending: string[] = ['missions', 'gratitudeCard', 'candleLit'];
  return {
    krathong: loadKrathongChoice(),
    visited: loadStringArray('loy:visits'),
    stamps: loadStringArray('loy:stamps'),
    secrets: loadSecrets(),
    participationDays,
    riverLight: totalRiverLight(),
    missions: null,
    quizDone: events.some((e) => e.kind === 'quiz'),
    gratitudeCard: null,
    candleLit: null,
    flameToday: null,
    finaleJoined: events.some((e) => e.kind === 'finale'),
    floatedToday,
    floated: floatedMap(),
    wishesFloated: loadMyWishes().length,
    pending,
  };
}
