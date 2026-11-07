// Device-local River Light claims (Chunk C1 + A2/A3 shape, ported from
// the original site's solo-mode `S.claims`).
//
// A claim is `{day, slot, rl, at}`: the festival DAY NUMBER the light
// is credited to (1–7, `cal.liveDay` — the plan's shape, matching the
// original site's solo mode), the slot that earned it (a mission slot
// like `visit-3` or a secret slot `secret-<slug>`), how much River
// Light it is worth, and when it was claimed. Per the plan's
// discrepancy 3, a secret's +5 goes to TONIGHT (the live day number),
// not the secret's own night — so a claim's `day` is the live night
// it was claimed on, and the milestone it feeds is tonight's. When
// there is no live night (archive phase) the original pushes no claim
// at all; this store follows that: `addClaim` is only called with a
// live day number.
//
// Storage: localStorage key `loy:claims`. This is the device-local
// record only. The server side — POST /api/claim (chunk A2) and the
// community totals (A3/E1) — is not built yet: claims do not survive a
// device change and do not count toward anyone else's milestone until
// then. See VERIFICATION.md for the exact server contract this store
// expects, so the migration can read `loy:claims` as-is.
//
// Chunk F adds the server claim route's reward table below (REWARDS,
// rewardForSlot, parseClaimDay, ...): the route (app/api/claim) is the
// authority for River Light, and it reads the rewards from here so the
// device-local store and the server can never disagree on a value.
// NOTE: this file's `Claim.day` is a festival DAY NUMBER (1–7) — the
// device-local shape. The server claim (`VisitorClaim` in
// lib/festivalState.ts) carries the festival DATE string instead; the
// two shapes are deliberately different types, and this file holds the
// only `Claim` type in the tree.

import { DESTINATIONS } from './destinations';
import { calendar, canClaim, destByDay, type FestivalCalendar } from './festival';
import { bangkokDay } from './bangkok';

export interface Claim {
  day: number; // festival day number 1–7 (the live night credited)
  slot: string; // e.g. 'secret-bangkok', 'visit-1', 'kindness-3'
  rl: number;
  at: number; // ms epoch
}


/** Mission rewards (plan A1b): visit 5, special 20, kindness 15. */
export const REWARDS = { visit: 5, special: 20, kindness: 15 } as const;

/** River Light for finding one secret (plan C1). Single definition —
// lib/secrets.ts imports it from here. */
export const SECRET_RIVER_LIGHT = 5;

/** Kindness goal: react to 3 distinct wishes in one night (plan A1b). */
export const KINDNESS_GOAL = 3;

export type ClaimSlot = 'visit' | 'special' | 'kindness' | `secret-${string}`;

/** The reward for a slot, or null when the slot is not a claimable one. */
export function rewardForSlot(slot: string): number | null {
  if (slot === 'visit') return REWARDS.visit;
  if (slot === 'special') return REWARDS.special;
  if (slot === 'kindness') return REWARDS.kindness;
  if (slot.startsWith('secret-')) {
    const slug = slot.slice('secret-'.length);
    return DESTINATIONS.some((d) => d.id === slug) ? SECRET_RIVER_LIGHT : null;
  }
  return null;
}

/** True when the slot is a secret claim (`secret-<destination slug>`). */
export function isSecretSlot(slot: string): slot is `secret-${string}` {
  return slot.startsWith('secret-') && rewardForSlot(slot) === SECRET_RIVER_LIGHT;
}

/**
 * Normalise a claim `day`: a night number 1–7, or a festival date
 * string. Returns the night number + festival date, or null when the
 * value is neither.
 */
export function parseClaimDay(value: unknown): { dayNumber: number; date: string } | null {
  const cal = calendar();
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7) {
    return { dayNumber: value, date: cal.dates[value - 1] };
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const dayNumber = cal.dates.indexOf(value) + 1;
    if (dayNumber >= 1) return { dayNumber, date: value };
  }
  return null;
}

/** The destination (and its special kind) of a claimed night. */
export function claimDestination(dayNumber: number) {
  return destByDay(dayNumber);
}

/**
 * Whether a claim window is open for this calendar. Split out so the
 * route can run it against a dev-preview calendar (see
 * app/api/claim/route.ts) as well as the real one.
 */
export function claimWindowOpen(cal: FestivalCalendar): boolean {
  return canClaim(cal);
}

/** Today (Bangkok day) for the claim window check. */
export function claimToday(): string {
  return bangkokDay();
}

const CLAIMS_KEY = 'loy:claims';

function parseClaims(raw: unknown): Claim[] {
  if (!Array.isArray(raw)) return [];
  const out: Claim[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { day, slot, rl, at } = item as Record<string, unknown>;
    if (typeof day !== 'number' || typeof slot !== 'string') continue;
    if (typeof rl !== 'number' || typeof at !== 'number') continue;
    out.push({ day, slot, rl, at });
  }
  return out;
}

/** All stored claims (SSR-safe: [] when `window` is undefined). */
export function loadClaims(): Claim[] {
  if (typeof window === 'undefined') return [];
  try {
    return parseClaims(JSON.parse(localStorage.getItem(CLAIMS_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

/**
 * Store claims. Exported for lib/missions.ts — the mission-claim writer
 * shares this one store, so there is a single `loy:claims` writer and a
 * secret's +5 and a mission's reward can never diverge in shape.
 * Dispatches 'loy:claims-changed' so the missions panel and milestone
 * re-read after any claim, secret or mission.
 */
export function saveClaims(claims: Claim[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
  } catch {
    // private mode: the in-memory record still stands for this visit
  }
  window.dispatchEvent(new Event('loy:claims-changed'));
}

/** True when a claim with this slot already exists (slots are once-only). */
export function hasClaim(slot: string): boolean {
  return loadClaims().some((c) => c.slot === slot);
}

/**
 * Record a claim. Returns the claim, or null when this slot was already
 * claimed — a repeat earns 0, it never double-counts.
 */
export function addClaim(day: number, slot: string, rl: number): Claim | null {
  if (hasClaim(slot)) return null;
  const claim: Claim = { day, slot, rl, at: Date.now() };
  saveClaims([...loadClaims(), claim]);
  return claim;
}

/** Claims credited to one festival night (day number 1–7). */
export function claimsForDay(day: number): Claim[] {
  return loadClaims().filter((c) => c.day === day);
}

/** The visitor's total claimed River Light, all days. */
export function totalRiverLight(): number {
  return loadClaims().reduce((sum, c) => sum + c.rl, 0);
}

/** River Light credited to one festival night (day number 1–7). */
export function riverLightForDay(day: number): number {
  return claimsForDay(day).reduce((sum, c) => sum + c.rl, 0);
}
