// Chunk A — Missions + River Light + milestones (device-local first).
//
// Ported from the original single-file site's solo mode
// (loy-krathong-seven-nights__1.html): 21 missions (3 slots x 7 nights),
// claims, and per-night milestones. The plan's shared-mode shape (server
// community totals, per-night targets [2000...3300]) arrives with E1; until
// then the solo rule applies — the milestone total is the sum of THIS
// device's own claims, against the solo target DEFAULT_TARGET = 45 — and
// the milestone card says so in the UI (see components/Missions.tsx).
// Nothing here is presented as a community total.
//
// State machine (from the plan, A1): locked (night not open) / available
// (live night, no progress yet) / in_progress (live night, some progress)
// / completed (progress >= goal) / claimed / missed (night over, never
// completed). A completed mission stays claimable through the archive
// phase (canClaim: phase not before, today <= claimUntil 2026-12-08).
//
// Evidence comes from the D1 event store (lib/events.ts): visit_place
// (ref = day number), react (ref = wish id, distinct ids count toward
// kindness), and the night's special evidence (SPECIAL_EVIDENCE). Nights
// whose specials are not built yet (chunk B) simply show their special
// mission as available/in_progress — never as complete — until B records
// the evidence event. The night-1 float evidence IS wired (B6-minimal in
// components/Builder.tsx: a successful float records 'float' + 'float_slot').
//
// Claims are device-local for now (localStorage `loy:claims`, the store
// in lib/claims.ts — chunk C; this module imports it, it does not keep
// a second copy); the server claim route comes with E1 — this chunk
// builds NO server route.

import { canClaim, type FestivalCalendar } from './festival';
import { DESTINATIONS, SPECIAL_ICON, type Localised } from './destinations';
import { eventsFor, type EventKind, type FestivalEvent } from './events';
// The claim shape + store live in lib/claims.ts (chunk C) — the single
// `loy:claims` store for this device. Re-exported so existing
// `from '@/lib/missions'` imports keep working.
import { loadClaims, saveClaims, type Claim } from './claims';
export { loadClaims };
export type { Claim };

export const MISSION_SLOTS = ['visit', 'special', 'kindness'] as const;
export type MissionSlot = (typeof MISSION_SLOTS)[number];

/** River Light per completed mission (plan A1b). */
export const REWARDS: Record<MissionSlot, number> = { visit: 5, special: 20, kindness: 15 };

/** Kindness mission: react to this many distinct friends' wishes a night. */
export const KINDNESS_GOAL = 3;

/** Which event kinds count as evidence for each night's special (plan A1b).
 *  A blessing also counts as `share` evidence. */
export const SPECIAL_EVIDENCE: Record<string, EventKind[]> = {
  float: ['float'],
  quiz: ['quiz'],
  blessing: ['blessing'],
  candle: ['candle'],
  gratitude: ['gratitude'],
  share: ['share', 'blessing'],
  finale: ['finale'],
};

/** Solo per-night target (plan A3b). Shared per-night targets arrive with E1. */
export const DEFAULT_TARGET = 45;

export type MissionState = 'locked' | 'available' | 'in_progress' | 'completed' | 'claimed' | 'missed';

export interface Mission {
  day: number;
  slot: MissionSlot;
  title: Localised;
  detail: Localised;
  icon: string;
  reward: number;
  progress: number;
  goal: number;
  state: MissionState;
}

// The claim shape ({day, slot, rl, at}) lives in lib/claims.ts.
// Secret finds (chunk C) use slot 'secret-<slug>' with rl 5 and feed
// tonight's milestone the same way.
export interface Milestone {
  day: number;
  riverLight: number;
  target: number;
  pct: number;
  stage: number;
}

/** stageFor: pct >= 1 -> 4, >= 0.75 -> 3, >= 0.5 -> 2, >= 0.25 -> 1, else 0. */
export function stageFor(riverLight: number, target: number): number {
  if (target <= 0) return 0;
  const pct = riverLight / target;
  if (pct >= 1) return 4;
  if (pct >= 0.75) return 3;
  if (pct >= 0.5) return 2;
  if (pct >= 0.25) return 1;
  return 0;
}

function dateForDay(cal: FestivalCalendar, day: number): string {
  return cal.dates[day - 1];
}

/** Progress (0..goal) for one mission, from the event store. */
export function missionProgress(
  cal: FestivalCalendar,
  events: FestivalEvent[],
  day: number,
  slot: MissionSlot,
): { progress: number; goal: number } {
  const date = dateForDay(cal, day);
  const dayEvents = events.filter((e) => e.day === date);
  if (slot === 'visit') {
    return {
      progress: dayEvents.some((e) => e.kind === 'visit_place' && e.ref === day) ? 1 : 0,
      goal: 1,
    };
  }
  if (slot === 'kindness') {
    const distinct = new Set(
      dayEvents.filter((e) => e.kind === 'react').map((e) => String(e.ref)),
    );
    return { progress: Math.min(distinct.size, KINDNESS_GOAL), goal: KINDNESS_GOAL };
  }
  // special: any of the night's evidence kinds recorded that day.
  const dest = DESTINATIONS.find((d) => d.day === day);
  const kinds = dest ? (SPECIAL_EVIDENCE[dest.special.kind] ?? []) : [];
  return {
    progress: dayEvents.some((e) => kinds.includes(e.kind)) ? 1 : 0,
    goal: 1,
  };
}

/** One mission's state, from progress + claims + the calendar. */
export function missionState(
  cal: FestivalCalendar,
  events: FestivalEvent[],
  claims: Claim[],
  day: number,
  slot: MissionSlot,
): MissionState {
  if (claims.some((c) => c.day === day && c.slot === slot)) return 'claimed';
  const { progress, goal } = missionProgress(cal, events, day, slot);
  if (progress >= goal) return 'completed';
  if (day > cal.openedDays) return 'locked';
  if (cal.liveDay === day) return progress > 0 ? 'in_progress' : 'available';
  return 'missed';
}

function missionTitle(day: number, slot: MissionSlot): Localised {
  const dest = DESTINATIONS.find((d) => d.day === day);
  if (slot === 'visit') {
    return {
      en: `Visit ${dest?.name.en ?? ''}`.trim(),
      th: `มาเยือน${dest?.name.th ?? ''}`,
    };
  }
  if (slot === 'kindness') {
    return { en: 'A little kindness', th: 'น้ำใจเล็ก ๆ' };
  }
  return dest?.special.title ?? { en: '', th: '' };
}

function missionDetail(day: number, slot: MissionSlot): Localised {
  const dest = DESTINATIONS.find((d) => d.day === day);
  if (slot === 'visit') {
    return {
      en: `Visit ${dest?.name.en ?? 'tonight’s destination'} tonight`,
      th: `มาเยือน${dest?.name.th ?? 'จุดหมายคืนนี้'}ในคืนนี้`,
    };
  }
  if (slot === 'kindness') {
    return {
      en: `React to ${KINDNESS_GOAL} friends’ wishes`,
      th: `ส่งความรู้สึกให้คำอธิษฐานของเพื่อน ${KINDNESS_GOAL} ใบ`,
    };
  }
  return dest?.special.detail ?? { en: '', th: '' };
}

function missionIcon(day: number, slot: MissionSlot): string {
  const dest = DESTINATIONS.find((d) => d.day === day);
  if (slot === 'visit') return '📍';
  if (slot === 'kindness') return '💛';
  return SPECIAL_ICON[dest?.special.kind ?? ''] ?? '✨';
}

/** All 21 missions for the given calendar + event/claim state. */
export function missionsFor(
  cal: FestivalCalendar,
  events: FestivalEvent[],
  claims: Claim[],
): Mission[] {
  const out: Mission[] = [];
  for (const dest of DESTINATIONS) {
    for (const slot of MISSION_SLOTS) {
      const { progress, goal } = missionProgress(cal, events, dest.day, slot);
      out.push({
        day: dest.day,
        slot,
        title: missionTitle(dest.day, slot),
        detail: missionDetail(dest.day, slot),
        icon: missionIcon(dest.day, slot),
        reward: REWARDS[slot],
        progress,
        goal,
        state: missionState(cal, events, claims, dest.day, slot),
      });
    }
  }
  return out;
}

/** Tonight's (or one night's) 3 missions. */
export function missionsForDay(
  cal: FestivalCalendar,
  events: FestivalEvent[],
  claims: Claim[],
  day: number,
): Mission[] {
  return missionsFor(cal, events, claims).filter((m) => m.day === day);
}

// ---- Claims: the store lives in lib/claims.ts --------------------------
// `loadClaims` / `saveClaims` / `Claim` are imported (and re-exported)
// above. The pure helpers below read a claims array; the no-argument
// store readers live in lib/claims.ts.

export function hasClaim(claims: Claim[], day: number, slot: string): boolean {
  return claims.some((c) => c.day === day && c.slot === slot);
}

export function claimsForDay(claims: Claim[], day: number): Claim[] {
  return claims.filter((c) => c.day === day);
}

/**
 * Claim a completed mission for its River Light. Only while canClaim
 * (phase not before, today <= claimUntil 2026-12-08) and only when the
 * mission state is `completed`. Returns the claim, or null when the
 * mission cannot be claimed (locked / in progress / missed / already
 * claimed / outside the claim window).
 */
export function claimMission(
  cal: FestivalCalendar,
  day: number,
  slot: MissionSlot,
  events?: FestivalEvent[],
): Claim | null {
  if (!canClaim(cal)) return null;
  const evs = events ?? eventsFor();
  const claims = loadClaims();
  if (missionState(cal, evs, claims, day, slot) !== 'completed') return null;
  const claim: Claim = { day, slot, rl: REWARDS[slot], at: Date.now() };
  saveClaims([...claims, claim]);
  return claim;
}

/** Total River Light this device has given (all nights, all claims). */
export function totalRiverLight(claims: Claim[]): number {
  return claims.reduce((sum, c) => sum + c.rl, 0);
}

// ---- Milestones ----------------------------------------------------------

/**
 * Tonight's (or one night's) milestone: River Light is the sum of this
 * device's claimed mission rewards for that night (plus secret finds,
 * chunk C — same claim shape), against the device-local target 45.
 * The community total comes with E1; until then the card flags this as
 * device-local and never presents it as the shared total.
 */
export function milestoneFor(day: number, claims: Claim[]): Milestone {
  const riverLight = claimsForDay(claims, day).reduce((sum, c) => sum + c.rl, 0);
  const target = DEFAULT_TARGET;
  return { day, riverLight, target, pct: target > 0 ? riverLight / target : 0, stage: stageFor(riverLight, target) };
}
