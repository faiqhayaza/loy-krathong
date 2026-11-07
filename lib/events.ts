// The client-side event store (D1 of the restoration).
//
// Ported from the original single-file site's solo mode
// (loy-krathong-seven-nights__1.html): `recordEvent(kind, ref = 0)`
// appends `{day, kind, ref}` for the current Bangkok day and repeats on
// the same day are ignored; `hasEvent(day, kind, ref)` is how everything
// else checks progress. The day comes from the festival calendar
// (`lib/festival.ts` → Bangkok day), never from a second date system.
//
// Storage: localStorage key `loy:events`, an array of events for the
// current device. This device-local store is the source of truth for now.
// Each record is also mirrored to the server (`POST /api/event`, header
// `x-visitor-id` = the visitor's recovery ID from `lib/identity.ts`) as
// the forward-compatible log E1 will later read — fire-and-forget, so a
// missing identity or an offline server never blocks the local record.
//
// Event kinds (from the plan, ported from the HTML):
//   visit_place (ref = day number), react (ref = wish id),
//   float (ref = wish id), float_slot (ref 0), quiz (0),
//   blessing (ref = wish id), candle (ref = flame id),
//   gratitude (ref = card id), share (0), finale (0),
//   secret (ref = destination slug — chunk F: the claim route verifies
//   a `secret-<slug>` claim against this event, or `me.secrets`),
//   flight_done (0), flight_skip (0).
// Only visit_place and react are wired in D1; the rest are recorded by
// their own chunks (B/F) when they land.

import { bangkokDay } from './bangkok';
import { getVisitorId } from './identity';

export const EVENT_KINDS = [
  'visit_place',
  'react',
  'float',
  'float_slot',
  'quiz',
  'blessing',
  'candle',
  'gratitude',
  'share',
  'finale',
  'secret',
  'flight_done',
  'flight_skip',
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

export function isEventKind(value: unknown): value is EventKind {
  return typeof value === 'string' && (EVENT_KINDS as readonly string[]).includes(value);
}

export interface FestivalEvent {
  day: string; // 'YYYY-MM-DD', Bangkok day
  kind: EventKind;
  ref: string | number;
}

const EVENTS_KEY = 'loy:events';

function parseEvents(raw: unknown): FestivalEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: FestivalEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { day, kind, ref } = item as Record<string, unknown>;
    if (typeof day !== 'string' || !isEventKind(kind)) continue;
    if (typeof ref !== 'string' && typeof ref !== 'number') continue;
    out.push({ day, kind, ref });
  }
  return out;
}

/** All stored events (SSR-safe: [] when `window` is undefined). */
export function loadEvents(): FestivalEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    return parseEvents(JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

function saveEvents(events: FestivalEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  } catch {
    // private mode: the in-memory record still stands for this visit
  }
}

/** True when an event with this day + kind + ref is already stored. */
export function hasEvent(day: string, kind: EventKind, ref: string | number): boolean {
  return loadEvents().some((e) => e.day === day && e.kind === kind && e.ref === ref);
}

/** Events for one Bangkok day (all days when `day` is omitted). */
export function eventsFor(day?: string): FestivalEvent[] {
  const all = loadEvents();
  return day ? all.filter((e) => e.day === day) : all;
}

// ---- Server mirror (fire-and-forget; local is the source of truth) ------

function syncToServer(kind: EventKind, ref: string | number, remove: boolean): void {
  if (typeof window === 'undefined') return;
  const visitorId = getVisitorId();
  if (!visitorId) return; // no identity yet — the local record stands alone
  void fetch('/api/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-visitor-id': visitorId },
    body: JSON.stringify({ kind, ref, ...(remove ? { remove: true } : {}) }),
  }).catch(() => {
    // offline / server down: the device-local store is the source of truth
  });
}

/**
 * Record one event for today (Bangkok day); a repeat on the same day is
 * ignored. Returns true when a new event was stored.
 */
export function recordEvent(kind: EventKind, ref: string | number = 0): boolean {
  const day = bangkokDay();
  if (hasEvent(day, kind, ref)) return false;
  saveEvents([...loadEvents(), { day, kind, ref }]);
  syncToServer(kind, ref, false);
  // Chunk A: the missions UI re-reads the store on this event, so a
  // visit / reaction / float updates the missions without a reload.
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('loy:events-changed'));
  return true;
}

/**
 * Remove today's event with this kind + ref (e.g. a reaction taken back,
 * so the distinct-reacted count stays truthful). Returns true when an
 * event was removed. D2's float-slot refund uses the same shape.
 */
export function removeEvent(kind: EventKind, ref: string | number = 0): boolean {
  const day = bangkokDay();
  const events = loadEvents();
  const kept = events.filter((e) => !(e.day === day && e.kind === kind && e.ref === ref));
  if (kept.length === events.length) return false;
  saveEvents(kept);
  syncToServer(kind, ref, true);
  // Chunk A: see recordEvent — the missions UI re-reads on this event.
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('loy:events-changed'));
  return true;
}
