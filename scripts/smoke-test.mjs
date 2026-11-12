// HTTP smoke tests for the festival site — no dependencies, Node 18+.
//
// What it proves against a real built server (`next start`):
//   - the pages and the river read answer
//   - POST /api/wishes validation: empty wish, over-long name, blocked
//     word, malformed JSON all 400 with the right error code
//   - the worry-never-stored property: a POST carrying a `worry` field
//     returns 201, and no `worry` key appears anywhere in the river
//     afterwards (nor `visitorId`, which never leaves the server)
//   - one float per Bangkok day per IP (second float → 429 daily_limit)
//   - owner DELETE works and releases the day slot
//   - GET /api/state is rate-limited (31 rapid reads → at least one 429)
//
// Usage:
//   npm run build && npm test            # boots its own server on :3101
//   SMOKE_BASE_URL=http://localhost:3000 npm test   # against a running server (read-only checks only for non-local URLs)
//
// The write checks float one real wish and delete it again, so they
// only run against a local server. Against a remote BASE_URL only the
// read-only checks run — never float test data onto the live river.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.SMOKE_PORT ?? 3101);
const BASE_URL = (process.env.SMOKE_BASE_URL ?? '').replace(/\/$/, '');
const LOCAL = !BASE_URL || /localhost|127\.0\.0\.1/.test(BASE_URL);
const BASE = BASE_URL || `http://localhost:${PORT}`;
// A fixed 10-digit recovery ID for the float/delete round-trip.
const VISITOR_ID = '1234567890';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

async function req(p, opts = {}) {
  const res = await fetch(`${BASE}${p}`, opts);
  let body = null;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, text };
}

const json = (obj, extraHeaders = {}) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...extraHeaders },
  body: JSON.stringify(obj),
});

async function waitForServer(deadlineMs = 60_000) {
  const started = Date.now();
  for (;;) {
    try {
      const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    if (Date.now() - started > deadlineMs) return false;
    await new Promise((r) => setTimeout(r, 500));
  }
}

let child = null;
if (!BASE_URL) {
  if (!existsSync(path.join(ROOT, '.next', 'BUILD_ID'))) {
    console.error('FAIL  no .next build found — run `npm run build` first');
    process.exit(1);
  }
  const nextBin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  child = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT)], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  const up = await waitForServer();
  if (!up) {
    console.error(`FAIL  server did not answer on :${PORT} within 60 s`);
    child.kill('SIGTERM');
    process.exit(1);
  }
}

try {
  // --- reads ---------------------------------------------------------------
  let r = await req('/');
  check('GET / returns 200', r.status === 200, `HTTP ${r.status}`);

  r = await req('/api/wishes');
  const wishesOk =
    r.status === 200 &&
    Array.isArray(r.body?.wishes) &&
    typeof r.body?.count === 'number' &&
    (r.body?.storage === 'redis' || r.body?.storage === 'memory') &&
    typeof r.body?.redisOk === 'boolean' &&
    r.body.redisOk === (r.body.storage === 'redis');
  check(
    'GET /api/wishes returns river + truthful storage field',
    wishesOk,
    `HTTP ${r.status}, storage=${r.body?.storage}, redisOk=${r.body?.redisOk}`,
  );

  r = await req('/api/state');
  check('GET /api/state returns 200 without an identity', r.status === 200, `HTTP ${r.status}`);

  if (!LOCAL) {
    console.log('SKIP  write checks (remote BASE_URL — never float test data onto the live river)');
  } else {
    // --- validation --------------------------------------------------------
    r = await req('/api/wishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    check('POST invalid JSON → 400 invalid_json', r.status === 400 && r.body?.error === 'invalid_json', `HTTP ${r.status}`);

    r = await req('/api/wishes', json({ wish: '   ', name: 'smoke' }));
    check('POST empty wish → 400 wish_required', r.status === 400 && r.body?.error === 'wish_required', `HTTP ${r.status}`);

    r = await req('/api/wishes', json({ wish: 'a wish', name: 'x'.repeat(41) }));
    check('POST 41-char name → 400 name_too_long', r.status === 400 && r.body?.error === 'name_too_long', `HTTP ${r.status}`);

    r = await req('/api/wishes', json({ wish: 'this shit wish must be refused', name: 'smoke' }));
    check('POST blocked word → 400 blocked_content', r.status === 400 && r.body?.error === 'blocked_content', `HTTP ${r.status}`);

    // Leetspeak evasion is still caught: the lookalike-unmasker reads
    // 'sh1t' as 'shit' — the word-boundary fix must not let it through.
    r = await req('/api/wishes', json({ wish: 'sh1t happens', name: 'smoke' }));
    check('POST leetspeak blocked word → 400 blocked_content', r.status === 400 && r.body?.error === 'blocked_content', `HTTP ${r.status}`);

    // --- happy path: float, verify, daily limit, delete -------------------
    // REGRESSION: the wish text deliberately starts "I wish 17…" — the
    // blocklist's collapsed+unmasked match used to turn "wish" + "17…"
    // into "wishit", which contains "shit", and the float was refused
    // as blocked_content. The matcher now checks word boundaries, so
    // this floats (see containsBlocked in lib/data.ts).
    const wishText = `I wish 17 people find peace ${Date.now()}`;
    r = await req(
      '/api/wishes',
      json(
        { wish: wishText, name: 'smoke', worry: 'this worry must never be stored' },
        { 'x-visitor-id': VISITOR_ID },
      ),
    );
    const wishId = r.body?.wish?.id;
    const noLeak =
      r.status === 201 &&
      typeof wishId === 'string' &&
      !('worry' in (r.body?.wish ?? {})) &&
      !('visitorId' in (r.body?.wish ?? {}));
    check('POST valid wish (+ worry field) → 201, no worry/visitorId echoed', noLeak, `HTTP ${r.status}, error=${r.body?.error ?? 'none'}`);

    if (wishId) {
      r = await req('/api/wishes');
      const found = r.body?.wishes?.some((w) => w.id === wishId);
      const worryAbsent = !JSON.stringify(r.body).includes('"worry"');
      check('floated wish is on the river; no worry key anywhere in the payload', found === true && worryAbsent, `found=${found}, worryAbsent=${worryAbsent}`);

      r = await req('/api/wishes', json({ wish: 'second float same day', name: 'smoke' }));
      check(
        'second float same day/IP → 429 daily_limit',
        r.status === 429 && r.body?.error === 'daily_limit',
        `HTTP ${r.status}, error=${r.body?.error}`,
      );

      r = await req(`/api/wishes?id=${wishId}`, {
        method: 'DELETE',
        headers: { 'x-visitor-id': VISITOR_ID },
      });
      check('owner DELETE → 200 ok', r.status === 200 && r.body?.ok === true, `HTTP ${r.status}`);

      r = await req('/api/wishes');
      check('deleted wish is gone from the river', !r.body?.wishes?.some((w) => w.id === wishId));
    } else {
      check('floated wish is on the river (skipped — no wish id from POST)', false);
      check('second float same day/IP → 429 daily_limit (skipped)', false);
      check('owner DELETE → 200 ok (skipped)', false);
      check('deleted wish is gone from the river (skipped)', false);
    }

    // --- GET /api/state rate limit ----------------------------------------
    // 30/min/IP; the checks above already made 1 GET, so 31 rapid reads
    // must trip it at least once.
    let limited = 0;
    for (let i = 0; i < 31; i++) {
      const s = await req('/api/state');
      if (s.status === 429) limited += 1;
    }
    check('31 rapid GET /api/state → at least one 429', limited >= 1, `${limited} throttled`);
  }
} finally {
  if (child) {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 1000));
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}

if (failures > 0) {
  console.error(`\n${failures} smoke check(s) failed`);
  process.exit(1);
}
console.log('\nAll smoke checks passed');
