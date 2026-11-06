// The festival calendar, ported from the Rules block of the original
// single-file site (loy-krathong-seven-nights__1.html, "Rules, ported from
// lib/festival/schedule.ts ..."): festivalCalendar, canEarn, canClaim,
// isOpenDay, isOpen, defaultDestination.
//
// Seven nights, 18–24 November 2026, one destination a night (see
// lib/destinations.ts). Mode is 'none': no opening night, no finale-night
// extension — the last night is Loy Krathong night itself, 24 November.
// After the last night the festival sits in its archive phase for
// ARCHIVE_CLAIM_DAYS, during which every destination stays open to
// explore; after that it is closed.

import { bangkokDay } from './bangkok';
import { DESTINATIONS } from './destinations';

export const FESTIVAL_START_DAY = '2026-11-18';
export const ARCHIVE_CLAIM_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export type FestivalPhase = 'before' | 'opening' | 'live' | 'finale_night' | 'archive' | 'closed';

export interface FestivalCalendar {
  today: string;
  dates: string[];
  firstDay: string;
  lastDay: string;
  claimUntil: string;
  phase: FestivalPhase;
  liveDay: number | null;
  openedDays: number;
}

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function isCalendarDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;
}

export function festivalCalendar(startDay: string, mode: 'none' | 'opening_night' | 'finale_night', today: string): FestivalCalendar {
  const offset = mode === 'opening_night' ? 1 : 0;
  const dates = DESTINATIONS.map((_, i) => addDays(startDay, i + offset));
  const lastDestination = dates[dates.length - 1];
  const lastDay = mode === 'finale_night' ? addDays(lastDestination, 1) : lastDestination;
  const claimUntil = addDays(lastDay, ARCHIVE_CLAIM_DAYS);
  const base = { today, dates, firstDay: startDay, lastDay, claimUntil };
  if (today < startDay) {
    return { ...base, phase: 'before', liveDay: null, openedDays: 0 };
  }
  if (mode === 'opening_night' && today === startDay) {
    return { ...base, phase: 'opening', liveDay: null, openedDays: 0 };
  }
  const index = dates.indexOf(today);
  if (index >= 0) {
    return { ...base, phase: 'live', liveDay: index + 1, openedDays: index + 1 };
  }
  const all = dates.length;
  if (mode === 'finale_night' && today === lastDay) {
    return { ...base, phase: 'finale_night', liveDay: all, openedDays: all };
  }
  return { ...base, phase: today <= claimUntil ? 'archive' : 'closed', liveDay: null, openedDays: all };
}

/** Today's calendar, from the Bangkok day. */
export function calendar(): FestivalCalendar {
  return festivalCalendar(FESTIVAL_START_DAY, 'none', bangkokDay());
}

/** A night's missions can be earned only while that night is live. */
export function canEarn(cal: FestivalCalendar, day: number): boolean {
  return cal.phase === 'live' && cal.liveDay === day;
}

/** Rewards can be claimed from the first night until the archive closes. */
export function canClaim(cal: FestivalCalendar): boolean {
  return cal.phase !== 'before' && cal.today <= cal.claimUntil;
}

/** A destination's night has arrived (or passed). */
export function isOpenDay(cal: FestivalCalendar, day: number): boolean {
  return day >= 1 && day <= cal.openedDays;
}

export function destByDay(day: number) {
  return DESTINATIONS.find((d) => d.day === day);
}

export function isOpen(cal: FestivalCalendar, id: string): boolean {
  const d = DESTINATIONS.find((x) => x.id === id);
  return d != null && d.day <= cal.openedDays;
}

/** Tonight's destination, or the latest opened one before the festival. */
export function defaultDestination(cal: FestivalCalendar) {
  const day = cal.liveDay ?? Math.max(1, cal.openedDays);
  return destByDay(day) ?? DESTINATIONS[0];
}
