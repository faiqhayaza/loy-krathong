// Bangkok calendar helpers. Bangkok is UTC+7 all year (no DST), so the
// Bangkok day is just the UTC day of (now + 7h) — exact, no timezone
// database needed. Everything daily — the one-float-per-day limit and
// the daily stamps — keys off this day, never the UTC day.

const BKK_MS = 7 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

/** 'YYYY-MM-DD' in Asia/Bangkok for the given moment (default now). */
export function bangkokDay(at: number = Date.now()): string {
  return new Date(at + BKK_MS).toISOString().slice(0, 10);
}

/** Milliseconds until the next Bangkok midnight. */
export function msUntilBangkokMidnight(at: number = Date.now()): number {
  const shifted = at + BKK_MS;
  return (Math.floor(shifted / DAY_MS) + 1) * DAY_MS - shifted;
}
