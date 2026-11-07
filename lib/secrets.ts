// The seven secrets (Chunk C1), ported from the original single-file
// site. Each destination hides one riddle; the content (name, symbol,
// hint, riddle, options, story) already lives in lib/destinations.ts —
// this module is only the mechanics: the per-destination display order,
// the answers, and the found/claim bookkeeping.
//
// Rules, from the plan:
// - Every correct answer is option 0 in the data; the options are shown
//   in the per-destination SECRET_ORDER, so the right answer is never
//   in the same place twice.
// - A correct answer reveals the secret's story fragment and adds +5
//   River Light (SECRET_RIVER_LIGHT) to TONIGHT's milestone as a claim
//   `{day: liveDay, slot: 'secret-<slug>', rl: 5}` — once per secret;
//   a repeat correct answer gives 0.
// - A secret can only be found while its night is open.
// - The seven fragments together tell one story; the last (Roi Et,
//   "The Heart of the Moon") gathers them.
//
// Storage: localStorage key `loy:secrets`, an array of found slugs.
// The +5 claim lives in lib/claims.ts (`loy:claims`). Server side —
// POST api/secret, `me.secrets` in api/state — comes with E1; until
// then secrets are device-local only.

import { calendar } from './festival';
import { DESTINATIONS } from './destinations';
import { addClaim, hasClaim, SECRET_RIVER_LIGHT } from './claims';
import { recordEvent } from './events';

/** River Light a found secret adds to tonight's milestone. Single
 * definition — it lives in lib/claims.ts; re-exported here so existing
 * importers (`@/lib/secrets`) keep working. */
export { SECRET_RIVER_LIGHT };

/** The correct option index in the data — 0 for every secret. */
export const SECRET_ANSWERS: Record<string, number> = {
  bangkok: 0,
  sukhothai: 0,
  chiang_mai: 0,
  tak: 0,
  ayutthaya: 0,
  amphawa: 0,
  roi_et: 0,
};

/** The order the three options are displayed in, per destination. */
export const SECRET_ORDER: Record<string, [number, number, number]> = {
  bangkok: [1, 0, 2],
  sukhothai: [2, 1, 0],
  chiang_mai: [1, 2, 0],
  tak: [0, 2, 1],
  ayutthaya: [2, 0, 1],
  amphawa: [1, 0, 2],
  roi_et: [2, 1, 0],
};

const SECRETS_KEY = 'loy:secrets';

/** Slugs of the secrets found on this device. */
export function loadSecrets(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(SECRETS_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    const valid = new Set(DESTINATIONS.map((d) => d.id));
    return [...new Set(raw.filter((s): s is string => typeof s === 'string' && valid.has(s)))];
  } catch {
    return [];
  }
}

function saveSecrets(secrets: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SECRETS_KEY, JSON.stringify(secrets));
  } catch {
    // private mode: the found state still stands for this visit
  }
}

export function isSecretFound(slug: string): boolean {
  return loadSecrets().includes(slug);
}

/**
 * The three options in display order for one destination: each entry
 * carries the option's index in the data (0 = the correct answer) so
 * the dialog can check the answer without knowing the order.
 */
export function secretDisplayOptions(slug: string): { index: number; en: string; th: string }[] {
  const dest = DESTINATIONS.find((d) => d.id === slug);
  if (!dest) return [];
  const order = SECRET_ORDER[slug] ?? [0, 1, 2];
  return order.map((index) => ({ index, ...dest.secret.options[index] }));
}

export type SecretAnswerResult =
  | { outcome: 'correct'; alreadyFound: false; claimed: boolean }
  | { outcome: 'correct'; alreadyFound: true; claimed: false }
  | { outcome: 'wrong' };

/**
 * Answer one secret. A correct answer records the secret as found and,
 * while a night is live, pushes the +5 claim to TONIGHT (the live day
 * number — discrepancy 3), once only: a repeat correct answer is still
 * 'correct' (the story stays revealed) but claims nothing. When no
 * night is live (archive phase) the secret is still found but no claim
 * is pushed — exactly as the original does. Returns 'wrong' for any
 * other option. The caller checks the night is open first.
 */
export function answerSecret(slug: string, optionIndex: number): SecretAnswerResult {
  if (SECRET_ANSWERS[slug] !== optionIndex) return { outcome: 'wrong' };
  if (isSecretFound(slug)) return { outcome: 'correct', alreadyFound: true, claimed: false };
  saveSecrets([...loadSecrets(), slug]);
  // Chunk F: the find is also a server event (`secret`, ref = slug) —
  // the claim route verifies a `secret-<slug>` claim against the
  // server log (or `me.secrets` after migration), so a found secret is
  // never dropped for lack of evidence. The event is fire-and-forget
  // (recordEvent mirrors to POST /api/event when an identity exists);
  // the device-local record above is still the source of truth.
  recordEvent('secret', slug);
  const cal = calendar();
  // Tonight, as a festival day number — the claim only exists while a
  // night is live. In the archive phase the find counts but adds no
  // River Light (the original pushes no claim when liveDay is null).
  const claimed =
    cal.liveDay != null && addClaim(cal.liveDay, `secret-${slug}`, SECRET_RIVER_LIGHT) != null;
  return { outcome: 'correct', alreadyFound: false, claimed };
}

/** True when the secret's claim is already in the claims store. */
export function hasSecretClaim(slug: string): boolean {
  return hasClaim(`secret-${slug}`);
}
