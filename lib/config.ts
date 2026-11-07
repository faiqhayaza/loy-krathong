// Festival configuration — the organiser settings Chunk E delivers through
// api/state (E1/E2/E3/E4).
//
// One document, stored server-side (`loy:config` in lib/store.ts), read back
// by every visitor on the next api/state poll. Defaults follow the HTML
// shared mode (RESTORATION-PLAN §E2/E3): startDay 2026-11-18, mode 'none',
// per-night River Light targets [2000, 2000, 2300, 2300, 2300, 2700, 3300].
//
// DECISIONS (recorded here because the HTML's server.py is not in the
// plan — Q7):
// - `paused` enforcement: when true, reward-bearing event writes are
//   rejected (POST /api/event returns 409 `paused` for kinds quiz,
//   blessing, candle, gratitude, share, finale). Participation kinds
//   (visit_place, react, float, float_slot) and floating itself keep
//   working — pausing stops rewards, not the river. Claim enforcement
//   (A2) reads the same flag when the claim route lands.
// - `kiosk` / shared-screen: the flag is stored and reported (api/state
//   `kiosk`), but it NEVER bypasses the once-per-day float limit — the
//   hard rule at the top of the plan stands, and the bypass needs Faiq's
//   explicit go-ahead (Q6). `dailyLimitApplies()` therefore always
//   returns true; the kiosk toggle in /admin is labelled as record-only.
// - `simDay` is server-wide: when set, every visitor's calendar uses it
//   as "today" (the HTML's `previewDateAll` / `previewingAll`). The real
//   time of day is kept — only the date is pretended.
// - `celebrateUntil` is a wall-clock epoch ms; the organiser sets it by
//   posting `{celebrate: true}` and the server stamps now + 60_000.
// - `stagePreview` is deliberately NOT here: it is local-only (A4),
//   a per-device organiser preview, never a server setting.

import { isCalendarDay } from './festival';

export type FestivalMode = 'none' | 'opening_night' | 'finale_night';

export const DEFAULT_TARGETS: [number, number, number, number, number, number, number] = [
  2000, 2000, 2300, 2300, 2300, 2700, 3300,
];

export const MAX_TARGET = 1_000_000;

export interface FestivalConfig {
  startDay: string; // 'YYYY-MM-DD', first night (default '2026-11-18')
  mode: FestivalMode;
  targets: [number, number, number, number, number, number, number];
  paused: boolean;
  simDay: string | null; // pretend today is — null = real date
  celebrateUntil: number | null; // epoch ms; null = no celebration running
  kiosk: boolean; // shared screen — recorded only, see note above
}

export const DEFAULT_CONFIG: FestivalConfig = {
  startDay: '2026-11-18',
  mode: 'none',
  targets: [...DEFAULT_TARGETS],
  paused: false,
  simDay: null,
  celebrateUntil: null,
  kiosk: false,
};

export function isFestivalMode(value: unknown): value is FestivalMode {
  return value === 'none' || value === 'opening_night' || value === 'finale_night';
}

/** Validate + normalise a stored config document (unknown fields dropped). */
export function parseConfig(raw: unknown): FestivalConfig {
  const cfg: FestivalConfig = { ...DEFAULT_CONFIG, targets: [...DEFAULT_CONFIG.targets] };
  if (!raw || typeof raw !== 'object') return cfg;
  const o = raw as Record<string, unknown>;
  if (isCalendarDay(o.startDay)) cfg.startDay = o.startDay;
  if (isFestivalMode(o.mode)) cfg.mode = o.mode;
  if (Array.isArray(o.targets) && o.targets.length === 7) {
    const ts = o.targets.map((v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : NaN));
    if (ts.every((v) => v >= 1 && v <= MAX_TARGET)) cfg.targets = ts as FestivalConfig['targets'];
  }
  if (typeof o.paused === 'boolean') cfg.paused = o.paused;
  if (o.simDay === null || isCalendarDay(o.simDay)) cfg.simDay = o.simDay;
  if (typeof o.celebrateUntil === 'number' && Number.isFinite(o.celebrateUntil)) {
    cfg.celebrateUntil = o.celebrateUntil;
  } else if (o.celebrateUntil === null) {
    cfg.celebrateUntil = null;
  }
  if (typeof o.kiosk === 'boolean') cfg.kiosk = o.kiosk;
  return cfg;
}

/**
 * Validate an admin PATCH body. Returns the patch to apply plus the list
 * of rejected field names (rejected fields are ignored, the rest apply).
 * `celebrate: true` is a trigger, not a stored value: it stamps
 * celebrateUntil = now + 60s. `celebrate: false` clears it.
 */
export function validateConfigPatch(
  body: Record<string, unknown>,
  now: number = Date.now(),
): { patch: Partial<FestivalConfig>; rejected: string[] } {
  const patch: Partial<FestivalConfig> = {};
  const rejected: string[] = [];

  if ('startDay' in body) {
    if (isCalendarDay(body.startDay)) patch.startDay = body.startDay;
    else rejected.push('startDay');
  }
  if ('mode' in body) {
    if (isFestivalMode(body.mode)) patch.mode = body.mode;
    else rejected.push('mode');
  }
  if ('targets' in body) {
    const v = body.targets;
    if (
      Array.isArray(v) &&
      v.length === 7 &&
      v.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.round(n) >= 1 && Math.round(n) <= MAX_TARGET)
    ) {
      patch.targets = v.map((n) => Math.round(n as number)) as FestivalConfig['targets'];
    } else {
      rejected.push('targets');
    }
  }
  if ('paused' in body) {
    if (typeof body.paused === 'boolean') patch.paused = body.paused;
    else rejected.push('paused');
  }
  if ('simDay' in body) {
    if (body.simDay === null || isCalendarDay(body.simDay)) patch.simDay = body.simDay;
    else rejected.push('simDay');
  }
  if ('celebrate' in body) {
    if (body.celebrate === true) patch.celebrateUntil = now + 60_000;
    else if (body.celebrate === false) patch.celebrateUntil = null;
    else rejected.push('celebrate');
  }
  if ('kiosk' in body) {
    if (typeof body.kiosk === 'boolean') patch.kiosk = body.kiosk;
    else rejected.push('kiosk');
  }
  return { patch, rejected };
}

/**
 * The once-per-day float limit always applies — including on a kiosk /
 * shared screen. This function exists so the rule is stated in exactly
 * one place: if Faiq ever approves the kiosk bypass (Q6), this is the
 * function that changes, and the change must be recorded here.
 */
export function dailyLimitApplies(_config: FestivalConfig): boolean {
  return true;
}

/** True while an organiser-triggered celebration is running. */
export function isCelebrating(config: FestivalConfig, now: number = Date.now()): boolean {
  return config.celebrateUntil !== null && config.celebrateUntil > now;
}
