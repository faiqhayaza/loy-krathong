// Storage watcher — pages the team when the river stops using Cloudflare KV.
//
// GET /api/wishes carries a public `storage` field: 'kv' when wishes
// are shared through Cloudflare KV, 'memory' when the store has fallen back
// to a per-instance in-memory store (KV unreachable or unconfigured).
// In 'memory' mode a POST still returns 201, but the wish lives
// only in that one server instance's memory — other visitors never see
// it, and it vanishes when the instance recycles. There is no alert for
// that anywhere in the app, so this script is the alert.
//
// Run it on a schedule (see .github/workflows/storage-watch.yml, every
// 5 minutes). Exit 0 = river is on KV. Exit 1 = fallback engaged or
// the site did not answer — the workflow opens/updates a GitHub issue.
//
//   SITE_URL=https://loykrathong.web.id node scripts/storage-watch.mjs
//
// Local check against a dev server:
//
//   SITE_URL=http://localhost:3000 node scripts/storage-watch.mjs

const SITE_URL = (process.env.SITE_URL ?? 'https://loykrathong.web.id').replace(/\/$/, '');
const TIMEOUT_MS = 10_000;

function fail(message) {
  console.error(`[storage-watch] FAIL ${SITE_URL}: ${message}`);
  process.exit(1);
}

let res;
try {
  res = await fetch(`${SITE_URL}/api/wishes`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'loy-krathong-storage-watch' },
  });
} catch (err) {
  fail(`no answer from ${SITE_URL}/api/wishes (${err.cause?.code ?? err.message})`);
}

if (!res.ok) fail(`GET /api/wishes returned HTTP ${res.status}`);

let payload;
try {
  payload = await res.json();
} catch {
  fail('GET /api/wishes did not return JSON');
}

const storage = payload?.storage;
const redisOk = payload?.redisOk;
if (storage !== 'kv' || redisOk === false) {
  fail(
    `river is on storage='${String(storage)}' (redisOk=${String(redisOk)}), ` +
      `count=${String(payload?.count)} — wishes are NOT shared through Cloudflare KV. ` +
      'See RUNBOOK.md "River is on in-memory storage".',
  );
}

console.log(
  `[storage-watch] OK ${SITE_URL}: storage='kv', count=${payload.count}, ` +
    `totalReactions=${payload.totalReactions}`,
);
