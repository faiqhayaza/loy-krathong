// Report a wish / hideWish (chunk F2 of the restoration).
//
// Two rules from the original single-file site
// (loy-krathong-seven-nights__1.html), both shipped here:
//
// - Shared mode: `POST /api/report {wishId}` — the wish is hidden
//   after reports (`status: 'reported'`, auto-hidden at 3 reports —
//   the threshold is a server decision, Q7 in the plan; 3 is this
//   chunk's recorded choice, matching the semantics chunk E's store
//   defines) and lands in the admin queue (E5). The reporter sees
//   `reported` ("Thanks. An admin will take a look.").
// - Solo mode: reporting calls `hideWish(wishId)` — the wish is hidden
//   on THIS DEVICE ONLY (`w.hidden = true`), shown as `hiddenHere`
//   ("Hidden on this device."). The river filters hidden wishes out.
//
// This rebuild is server-shared, so both apply at once: reporting
// posts to the server AND hides the wish on this device (the solo
// rule, `loy:hidden`), so the reporter's own view is clean immediately
// while the server count decides the river-wide hide. A wish hidden on
// this device can be shown again (unhide) — the server report stands
// either way; unhiding only affects this device's view.
//
// The server helper is `reportWish` in lib/store.ts (same name as the
// semantics chunk E defines, so the F integrator can rewire to E's
// helper if it exists). This file is the client half.

/** The wish ids hidden on this device (`loy:hidden`). */
export function loadHiddenIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem('loy:hidden') ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.filter((id): id is string => typeof id === 'string'))];
  } catch {
    return [];
  }
}

function saveHiddenIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('loy:hidden', JSON.stringify(ids));
  } catch {
    // private mode: the hide still applies for this visit
  }
}

/** Hide a wish on this device only (the HTML's `hideWish`). */
export function hideWish(wishId: string): void {
  const ids = loadHiddenIds();
  if (ids.includes(wishId)) return;
  saveHiddenIds([...ids, wishId]);
}

/** Show a wish hidden on this device again. */
export function unhideWish(wishId: string): void {
  saveHiddenIds(loadHiddenIds().filter((id) => id !== wishId));
}

/** True when the wish is hidden on this device. */
export function isHidden(wishId: string): boolean {
  return loadHiddenIds().includes(wishId);
}

// ---- The server report ----------------------------------------------------

export interface ReportResult {
  ok: boolean;
  reports?: number;
  /** 'approved' | 'reported' | 'hidden' — the wish's river-wide status. */
  status?: string;
  /** True when the reporter's own earlier report already counted. */
  already?: boolean;
  /** True when the wish is now hidden from the river. */
  hidden?: boolean;
}

/**
 * Report a wish to the server, then hide it on this device (the solo
 * rule). Returns the server's answer; on a network failure the local
 * hide still applies and `ok` is false, so the card leaves this
 * device's view either way.
 */
export async function reportWish(wishId: string, visitorId: string | null): Promise<ReportResult> {
  let result: ReportResult = { ok: false };
  try {
    const res = await fetch('/api/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(visitorId ? { 'x-visitor-id': visitorId } : {}),
      },
      body: JSON.stringify({ wishId }),
    });
    result = (await res.json().catch(() => ({}))) as ReportResult;
    result = { ...result, ok: res.ok };
  } catch {
    // offline: the local hide below still applies
  }
  hideWish(wishId);
  return result;
}
