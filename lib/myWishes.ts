// The visitor's own wishes, as this device knows them (Chunk C4).
//
// The rebuild has no owner matching yet: the server does not store
// which recovery ID floated a wish (that is D3/E1's job), and the
// client only kept the single latest id in `loy:my-wish`. So this
// device keeps its own ledger — one entry per wish floated from here —
// keyed by the visitor's recovery ID in spirit (the ledger only ever
// holds wishes this identity floated on this device; on another device
// the visitor's wishes come back with E1).
//
// Each entry records the destination the wish was tagged with, per the
// D3 rule applied at float time: the destination the visitor chose if
// that night is open, else tonight's destination if there is a live
// night, else null. Until travel (F4a) exists the tag is always
// tonight's destination or null. The ledger feeds the float form's
// floated state (its Delete and Copy, for a return visit) and the
// journey card's `floated` map (C2: destination → the visitor's
// krathong there). The My wishes list it used to feed is gone —
// the float form is the one home for the visitor's own krathong now.
//
// Server migration (E1/D3): when wishes carry a `destination` field
// and are matched to the visitor by recovery ID, this ledger is
// replaced by the server list — the entry shape already matches what
// the server will return (id, destination, day, flower, boat, flame).

import { bangkokDay } from './bangkok';
import { calendar, defaultDestination } from './festival';
import { DEFAULT_DESIGN, isKnownDesign } from './data';

export interface MyWishEntry {
  id: string;
  destination: string | null;
  day: string; // Bangkok day floated
  flower: string;
  boat: string;
  flame: string;
  design: string;
  /** The wish text and name, recorded at float time — the keepsake
      download on a return visit needs both. Old entries (before this
      field existed) read back as ''. */
  name: string;
  wish: string;
  at: number;
}

export const MY_WISHES_KEY = 'loy:my-wishes';

function parseMyWishes(raw: unknown): MyWishEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: MyWishEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { id, destination, day, flower, boat, flame, design, name, wish, at } = item as Record<
      string,
      unknown
    >;
    if (typeof id !== 'string' || typeof day !== 'string') continue;
    if (typeof flower !== 'string' || typeof boat !== 'string' || typeof flame !== 'string') continue;
    if (typeof at !== 'number') continue;
    if (destination !== null && typeof destination !== 'string') continue;
    // A design the list does not know (or an old entry without one)
    // is the classic — the entry is kept, never dropped.
    const designId = typeof design === 'string' && isKnownDesign(design) ? design : DEFAULT_DESIGN;
    out.push({
      id,
      destination,
      day,
      flower,
      boat,
      flame,
      design: designId,
      name: typeof name === 'string' ? name : '',
      wish: typeof wish === 'string' ? wish : '',
      at,
    });
  }
  return out;
}

/** The wishes floated from this device, newest first. */
export function loadMyWishes(): MyWishEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return parseMyWishes(JSON.parse(localStorage.getItem(MY_WISHES_KEY) ?? '[]')).sort(
      (a, b) => b.at - a.at,
    );
  } catch {
    return [];
  }
}

function saveMyWishes(entries: MyWishEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MY_WISHES_KEY, JSON.stringify(entries));
  } catch {
    // the ledger is a keepsake; the river is unaffected
  }
}

/**
 * The destination tag for a wish floated now, per the D3 rule: tonight's
 * destination when there is a live night, else null (before the festival
 * there is no tonight; in the archive phase the latest opened night is
 * tonight's in the visitor's experience, so it is used).
 */
export function destinationForNewWish(): string | null {
  const cal = calendar();
  if (cal.phase === 'before') return null;
  return defaultDestination(cal).id;
}

/** Record a wish floated from this device (deduped by id). */
export function recordMyWish(entry: Omit<MyWishEntry, 'day' | 'at'>): MyWishEntry {
  const full: MyWishEntry = { ...entry, day: bangkokDay(), at: Date.now() };
  const kept = loadMyWishes().filter((e) => e.id !== full.id);
  saveMyWishes([full, ...kept]);
  return full;
}

/** Remove one entry from this device's ledger (not the river — see D2). */
export function forgetMyWish(id: string): boolean {
  const kept = loadMyWishes().filter((e) => e.id !== id);
  if (kept.length === loadMyWishes().length) return false;
  saveMyWishes(kept);
  return true;
}

/**
 * The journey's `floated` map: destination slug → the visitor's most
 * recent krathong there. Destinations with no wish floated are absent.
 */
export function floatedMap(): Record<string, { flower: string; boat: string; design: string }> {
  const out: Record<string, { flower: string; boat: string; design: string }> = {};
  for (const entry of loadMyWishes()) {
    if (!entry.destination) continue;
    if (!out[entry.destination])
      out[entry.destination] = { flower: entry.flower, boat: entry.boat, design: entry.design };
  }
  return out;
}
