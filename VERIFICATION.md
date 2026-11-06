# Verification — Seven Nights of Wishes

Run on Fri 2026-11-06, Node v24.22.1, npm 10.9.4, in `~/workspace/loy-krathong`.

## Build

```bash
npm install
npm run build
```

- Result: **pass, clean**. Compiled successfully, types checked, 4 static
  pages generated. Routes: `/` (static), `/api/wishes`, `/api/wishes/[id]`,
  `/api/wishes/[id]/react` (dynamic).
- First Load JS for `/`: 102 kB.
- One fix made during the build: a callback-signature mismatch in
  `components/WishWall.tsx` and a literal-type widening in `lib/i18n.ts`.
- Next.js was bumped **14.2.18 → 14.2.35**: npm flagged 14.2.18 with a
  security vulnerability at install time; 14.2.35 is the patched 14.2.x.
- Fonts: Prompt + Sarabun via `next/font/google` in `app/layout.tsx`
  (latin + thai), downloaded and self-hosted by Next.js at build time.
  The earlier self-hosted `public/fonts` woff2 files were removed on
  2026-11-06 so the repo stays text-only (GitHub snapshot push cannot
  carry binary files).

## Live API tests (production server, no Redis configured → in-memory store)

Started with `LOY_ADMIN_TOKEN=test-token PORT=3100 npm run start -- -p 3100`.

| Check | Command | Result |
| --- | --- | --- |
| `GET /` | `curl -o /dev/null -w %{http_code} localhost:3100/` | **200** |
| `GET /api/wishes` | `curl localhost:3100/api/wishes` | **200**, `count=8`, `totalReactions=0`, all 8 seeds present newest-first (health, shift, quiet, home, brother, rest, team, mother) |
| `POST /api/wishes` with a `worry` field | `curl -X POST … -d '{"name":"Verifier","wish":"May the river carry this test wish gently.","flower":"lotus","boat":"gold","flame":"rose","lang":"en","worry":"something private…"}'` | **201**, id `db04738f-9b16-47a3-98af-4bb211404f13`; subsequent GET shows `count=9`, the wish present, and **`worry` absent** from the stored object |
| `POST /api/wishes/:id/react` sathu, then love | two POSTs | **200** each: `{sathu:1,…}`, then `{sathu:1,love:1,…}`; GET confirms `totalReactions=2` |
| `POST /api/wishes` empty wish | `{"wish":"   ",…}` | **400** `wish_required` |
| `POST /api/wishes` blocked word | `{"wish":"fuck this",…}` | **400** `blocked_content` |
| `POST /api/wishes/:id/react` bad id | `{"reaction":"nope"}` | **400** `unknown_reaction` |
| `DELETE /api/wishes/:id` no token | | **401** `unauthorized` |
| `DELETE` wrong token | `-H 'x-admin-token: wrong'` | **401** `unauthorized` |
| `DELETE` correct token | `-H 'x-admin-token: test-token'` | **200** `{"ok":true}`; GET after: `count=8`, test wish gone |
| `DELETE` same id again | | **404** `not_found` |
| Rate limit | 6 rapid valid POSTs from one IP | `201 201 201 201 429 429` — 5/minute/IP enforced (the first successful test POST counted as #1) |
| Homepage copy | `curl localhost:3100/ \| grep` | "Seven Nights of Wishes" ×8, "Float my krathong" ×3, "เจ็ดค่ำคืนแห่งคำอธิษฐาน" present |

Cleanup: the test server was stopped after the run. The four "rate test"
wishes created by the rate-limit check existed only in that server's
in-memory store and died with it — nothing was persisted, no Redis was
configured, and the final `LOY_ADMIN_TOKEN=test-token` was only ever set
for that local run (it is not in any file; `.env.example` ships empty).

## 2026-11-06 evening — shared-store readiness

- Vercel's Upstash integration no longer offers a free plan (cheapest is
  Pay As You Go, $0.20 / 100K commands), so the site reuses the team's
  existing free Upstash store `faiq-personal` (Upstash for Redis, Free
  plan, connected to the loy-krathong project as a second project on
  2026-11-06, Production + Preview). Wishes live under the `loy:*` key
  prefix, isolated from that store's other data. That store supplies
  KV_REST_API_URL / KV_REST_API_TOKEN (KV prefix), so `lib/store.ts`
  accepts those names as well as UPSTASH_REDIS_REST_URL / TOKEN.
  `GET /api/wishes` reports `storage: "redis"` when the store is live.
- Because the free tier has a daily command budget and every visitor
  polls `GET /api/wishes`, the GET handler now caches its response for
  30s per server instance (`app/api/wishes/route.ts`); POST clears the
  cache so a new wish still appears immediately. Reaction counts are
  still read from Redis on a cache miss.

- **Upstash Redis backend**: no Upstash credentials exist yet, so the
  Redis code path (LPUSH / HINCRBY / rate-limit keys) is exercised only by
  reading the code, not by a live Redis. It fails open to the in-memory
  store on any error, so a bad key cannot take the site down — but set the
  two `UPSTASH_*` vars on Vercel and re-run `GET /api/wishes` + one POST
  to confirm the shared river before announcing it.
- **Browser rendering** (canvases, hover tooltip, keepsake PNG download,
  lantern animation): verified by code review only, not in a live browser
  in this run. The canvases degrade to a static frame under
  `prefers-reduced-motion` and the page is fully usable without them
  (the wish wall and builder are plain DOM).

## Deliberate simplifications vs the original single-file site

- **Missions, secrets, quiz, gratitude lanterns, candle chain, blessing
  lanterns, journey card, settings/admin panel, custom emoji, ambient
  sound**: dropped. The brief's core is the shared river; those systems
  were local-only game layers in the original and would have doubled the
  scope without serving it. The seven destinations survive as the
  passport strip (local stamps, no server state).
- **Daily one-krathong guard**: softened to what the brief asked — the
  builder warns via the server's 5/minute rate limit; there is no hard
  per-day block, and the "float another" path is a plain button after
  success.
- **Seeds**: merged newest-first by their staggered November dates, so
  real wishes (today's timestamp) sort above them. They are never written
  to Redis.
- **Counts**: the wall count and river count both come from the same
  `GET /api/wishes` response, so they agree by construction.
