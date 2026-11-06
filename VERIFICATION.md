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

## 2026-11-06 evening — blank river

- Faiq asked for the river to start blank. The eight seed wishes were
  removed from `lib/seed.ts` (kept in git history, commit 22af37c5, for
  restoration if he ever wants them back). Live check after redeploy:
  `GET /api/wishes` returns `count: 0`, `storage: "redis"` — no test
  data and no seeds remain; the river only shows wishes visitors float.

## 2026-11-06 evening — river scene round 2 (sky, temple, live weather, fireworks)

- Faiq called the river bland. `components/RiverCanvas.tsx` was rewritten
  (only that file changed): the top ~28% of the canvas is now night sky
  (gradient, twinkling stars, glowing full moon upper-right with the
  reflection column below it, slow clouds), a Wat Arun-inspired temple
  silhouette sits on the far bank (tiered central prang, two chedis,
  two-tier roofs with upturned eaves, twinkling gold windows), swifts
  cross in loose flocks with a two-frame wing flap, and falling stars
  streak a few times a minute. Krathong drawing, name tags, hover
  tooltip, click-to-pin, splash + rising lantern, rows, reduced-motion
  static frame, resize handling and DPR cap 2 are all unchanged.
- **Live Bangkok weather**: client-side fetch of Open-Meteo
  (`latitude=13.7563, longitude=100.5018`, `current=temperature_2m,
  weather_code,cloud_cover,wind_speed_10m,wind_direction_10m`), refetch
  every 10 min, 8 s timeout, first paint never waits for it (gentle
  clear default). Mapping: code 0 clear; 1–3 cloud cover from
  `cloud_cover` (sets cloud count 0–6 and star/moon dimming); 45/48 fog
  (mist band over the water); 51/53/55 drizzle, 61/63/65 rain, 80/81/82
  showers (streaks + ripple rings, intensity by code, capped visually);
  95 thunderstorm (heavier rain + a soft distant lightning glow, max
  alpha 0.10, no harsh flash); snow/freezing codes treated as rain.
  `wind_speed_10m` sets wind strength (cloud/krathong/lantern drift,
  flame flicker); `wind_direction_10m` sets drift direction (wind comes
  FROM that bearing). Nothing in the UI mentions the weather source.
- **Fallback**: if the fetch fails, times out, or returns unusable data,
  a gentle invented 4-minute cycle takes over — clear 70 s → cloudy
  70 s → light shower 55 s → clearing 45 s — with displayed values
  eased toward targets so changes are gradual.
- **Fireworks**: particle bursts (rockets + gravity, original palette
  gold `#ffd27a`, pink `#ff7eb6`, violet `#b8a8ff`, white) above the
  temple, capped at 380 particles. Automatic only on Loy Krathong night:
  24 Nov 2026 19:00–23:59 Asia/Bangkok
  (`Date.UTC(2026,10,24,12,0,0)` to `Date.UTC(2026,10,24,16,59,59)`),
  one rocket every ~1.2–2.6 s. During that window the swifts fly toward
  the temple spire and fade as they reach it; outside it they cross in
  varied directions. **Hidden preview, no button**: 5 clicks on the
  canvas within ~4 s (mouse or tap, including on a krathong — normal
  select still works) launches a ~25 s show.
- Verification this round: `npm run build` passes clean (TypeScript
  strict + lint, 4 static pages, `/` 18.4 kB / 106 kB first load).
  Open-Meteo was curled live and returned Bangkok code 3, cloud 99%,
  wind 4.4 km/h from 55° — the mapping was checked against that real
  payload. Festival-window logic was checked in node (false now, true
  19:30 and 23:59 on 24 Nov, false 18:59 on 24 Nov and 00:30 on 25 Nov).
  A local dev server served the homepage 200 with the river canvas and
  `GET /api/wishes` returning `count: 0` (blank river intact), then was
  stopped. No live-browser visual check was done in this round — the
  canvas animation still needs eyes on it after deploy.
- Not pushed, not deployed; working tree left ready for review.

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
