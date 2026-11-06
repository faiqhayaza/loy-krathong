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

## 2026-11-06 evening — fix round: fuller fireworks, true overcast

Two findings from the live visual check of the round-2 scene
(`components/RiverCanvas.tsx` only; festival window, 5-click trigger,
25 s show length, and no UI hints all unchanged):
- **Fireworks read small, sparse and short-lived** (a pink burst right
  after the 5 clicks and at +5 s, nothing at +10 s or +20 s, and only
  pink ever seen). Fixes: rockets are now drawn visibly — a bright
  glowing head with a fading trail while rising (before: a 1.4 px line
  and a 2 px dot, nearly invisible). Bursts are roughly doubled
  (96–140 particles vs 48–72, size 1.8–3.2 vs 1.2–2.2) and live
  ~100–140 frames (~2 s) instead of 50–90, with the glow flash
  lingering ~900 ms at radius 90 (was 500 ms / 60). Preview cadence
  tightened to a rocket every ~500–800 ms (was 700–1100 ms) with a 30%
  chance of two at once, so the sky is rarely empty. Colours now cycle
  gold → pink → violet → white in order instead of random, so any few
  seconds of show always shows several colours — same cycling for the
  automatic Loy Krathong night show. Particle cap raised 380 → 500;
  rocket cap 5 → 6.
- **Overcast underplayed**: Bangkok was code 3, cloud_cover 99%, but
  the scene looked only partly cloudy with a bright moon. Fixes: a new
  `overcastAmount()` smoothsteps cloud cover 80% → 0 to 100% → 1.
  With it, clouds grow up to ~2.1× larger and denser (9 seeded clouds
  instead of 6) into a deck covering most of the sky band, a
  translucent grey-blue veil (`rgba(118,132,172)`, up to 0.22 alpha)
  washes the sky band over stars and moon, star dimming gains a
  further ×(1 − 0.85·overcast) factor, the moon disc fades to 40%
  opacity (halo fades with the same dimming), falling stars fade out
  with the overcast, and the moon reflection column dims by up to half.
  Temple windows and krathong flames are not dimmed. Rain/fog/storm
  mapping unchanged.
- Verification this round: `npm run build` passes clean (see below).
  No live-browser visual check was possible from here — the canvas
  still needs eyes on it after deploy, especially the show at +10 s /
  +20 s and the overcast sky at tonight's 99% cloud cover.
- Not pushed, not deployed; working tree left ready for review.

## 2026-11-06 evening — fix round 2: real Wat Arun, deeper moon veil, fireworks wall-clock timing

(`components/RiverCanvas.tsx` only; everything else untouched.)
- **Temple did not read as Thai.** Faiq: make it like Wat Arun, with
  smaller wats nearby just like Wat Arun. The old prang was a generic
  stepped tower (rectangular tiers, short stubby shaft). Redrawn from
  Wat Arun photos (silhouette at sunset, front view — central prang
  with broad stepped base, long concave lotus-bud shaft, trident
  finial; four satellites in the same shape): one reusable `prang()`
  now draws three receding base terraces, a long shaft whose outline
  curves inward as it rises (quadratic control point pulled toward
  the axis), a lotus-bud dome, a thin trident finial (stem + small
  three-pronged fork), and miniature spires at the top terrace
  corners. The skyline is now the central prang (still the tallest,
  same position/scale as before) plus four satellites in the same
  shape — a nearer pair on each side stepping down, and a farther,
  lower pair — with the stepped base platform and sala roofs with
  upturned eaves beneath. Windows and low blocks repositioned to
  match the new prang positions.
- **Moon still too visible at 99% cloud.** A second live check found
  the disc still clearly readable with clear-sky gaps between
  clouds. New `sheetAmount()` smoothsteps 95% → 0 to 100% → 1: at
  ≥95% cover a continuous thin cloud sheet (`rgba(24,30,62)`, up to
  0.5 alpha, plus two slow soft wisps) lies over the whole sky band
  — over the moon, the stars and the cloud tops, under the temple
  and the birds, never touching the water or krathongs — and the
  moon disc alpha drops to ~0.18 at 99% cover and ~0.15 at 100%
  (was 0.40). Below 95% the scene behaves exactly as before.
  Temple windows and krathong flames stay undimmed.
- **Fireworks show ran ~10 s, not 25 s** (precise live timing test:
  bursts at T+0 and T+10, empty sky at T+15/T+20/T+24). Diagnosis:
  the launchers were frame-count-based (`nextShowRocket -= 16`,
  assuming 60 fps) while the show length is wall-clock-based
  (`showUntil = performance.now() + 25000`), so below 60 fps the
  rocket timers advanced far slower than real time and the window
  expired with few rockets launched. Fix: `frame()` now computes a
  real delta `dt = min(50, now - lastNow)` and both fireworks
  timers decrement by `dt` — a rocket every ~0.5–0.8 s of real time
  for the full 25 s at any frame rate, same for the automatic
  festival-night rockets (1200–2600 ms). Only the fireworks
  scheduling changed; ambient timers (flocks, meteors, lightning)
  stay frame-based, and the 25 s length, colour cycling, rocket
  caps and 5-click trigger are untouched.
- Verification this round: `npm run build` passes clean (see below).
  Node-checked the sheet curve (95%→0, 97.5%→0.5, 99%→0.896,
  100%→1) and the moon disc alpha at 95/99/100% cover
  (0.49/0.18/0.15), and the dt scheduling (at 20 fps a rocket
  still launches every ~0.5–0.8 s of real time across a full
  25 s window). No live-browser visual check was possible from
  here — the canvas still needs eyes on it after deploy, especially
  the temple silhouette, the show at T+15/T+20/T+24, and the moon
  at tonight's 99% cloud cover.
- Not pushed, not deployed; working tree left ready for review.

## 2026-11-06 evening — fix round 3: show length is animation time, preview is 60 s

(`components/RiverCanvas.tsx` only; temple, moon, weather, swifts
untouched.)
- **Show still ended early.** A second precise live timing test found
  bursts at T+0 and T+15 but an empty sky at T+20/T+24 — the show ran
  ~15–18 s, not 25 s. Diagnosis: the previous fix made the rocket
  *launchers* dt-based but left the show *end* wall-clock-based
  (`showUntil = performance.now() + 25000` compared against
  `performance.now()`), so any frame pause or throttle silently ate
  the window. Fix: the end is now measured in accumulated animation
  time — `showElapsed` (ms, -1 = no show) advances by `dt` each
  frame while a show runs and the show ends at `showElapsed >= 60000`.
  A paused tab stretches the show in wall time instead of cutting it
  short; it resumes where it left off.
- **Preview show is now 60 s, not 25 s** (Faiq: "why not 60s").
  Same accumulated-animation-time approach, end at 60000 ms. The
  festival-night auto show is unchanged (plays all evening
  19:00–23:59 anyway). Rocket timers (500–800 ms cadence, 30%
  double launch), colour cycling gold → pink → violet → white,
  caps, and the 5-click trigger are untouched.
- Verification this round: `npm run build` passes clean (see below).
  Node-simulated the show logic exactly as written (dt clamped to
  50 ms, 500–800 ms cadence, 30% double launch, 6-rocket cap with
  a flight model), 20 seeds per scenario: at 60 fps the show runs
  60.0 s of animation time with ~91 launch events / ~118 rockets
  (range 108–128); at 20 fps 60.0 s with ~89 events / ~115 rockets
  (range 105–126); at 60 fps with a 5 s wall-clock pause mid-show
  (no frames at all, then resume) the show runs 60.0 s of animation
  time over 65.0 s of wall time with the same ~91 events / ~118
  rockets — the pause stretches it instead of eating it. (The
  ~115–118 rocket count is higher than the rough 65–75 estimate in
  the brief because that figure was launch events at the old
  700–1100 ms cadence; at 500–800 ms there are ~90 events and the
  30% double launches add ~30% more rockets.) No live-browser
  visual check was possible from here — the canvas still needs eyes
  on it after deploy, especially the show at T+20/T+40/T+55.
- Not pushed, not deployed; working tree left ready for review.

## 2026-11-06 evening — fix round 4: the show never triggered

(`components/RiverCanvas.tsx` + `app/page.tsx`; temple, moon, weather,
show length (60 s), colours, cadence and caps untouched.)
- **The 60 s show never fired at all.** Live timing test: no fireworks
  at T+20, T+40 or T+55 — nothing, where earlier tests always showed
  bursts right after the 5 clicks. Likely cause: the checker's clicks
  landed on the krathong, the first click opened the wish detail panel
  below the river, the layout shifted, and later clicks missed the
  canvas element — but the trigger only counted clicks landing exactly
  on the canvas. A second contributor: the 4 s window is tight when
  clicks come slowly (~1 s each from a browser agent).
- **Fix: count clicks anywhere in the river section.** The `#river`
  section in `app/page.tsx` now dispatches one `loy:river-click`
  window event per click (its `onClick`); `RiverCanvas` listens for
  it and counts. The canvas handlers no longer count anything, so one
  physical click is counted exactly once — no double-count via
  bubbling. Clicks on the wish detail panel, the river bar and the
  empty state all count. Clicks inside the builder form (`#float`)
  are excluded, so composing a wish can never set the show off by
  accident. Touch taps work the same way: the tap's synthetic click
  bubbles to the section and counts once.
- **Window widened to 6 s** (was 4 s): five clicks within 6 s trigger
  the 60 s show; four clicks never do; five clicks spread over more
  than 6 s do not.
- Verification this round: `npm run build` passes clean (see below).
  Node-simulated the trigger logic exactly as written (7 checks, all
  pass): 5 clicks across canvas + detail panel within 6 s trigger;
  4 clicks do not; 5 clicks spread over 7 s do not; 3 physical clicks
  count 3 under the new wiring (no trigger) where counting via both
  canvas and section would count 6 (false trigger); 5 clicks inside
  the builder do not trigger; 5 unhurried clicks 1.2 s apart trigger;
  5 clicks spanning exactly 6.0 s trigger. No live-browser check was
  possible from here — the trigger still needs eyes on it after
  deploy: click 5 times with the first click landing on the krathong
  and confirm the show fires.
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

## Overnight round, 2026-11-06 ~22:03–23:30 — Rules recheck + river/temple/birds/clouds

Faiq's correction (~22:07): "follow the rule on the HTML as well, recheck
it." The Rules block of the original (`~line 2566`, ported from
`lib/festival/schedule.ts`, `where.ts`, `domains/festival.ts`,
`content.ts`) and the festival sections it rests on are now the spec.
Nothing was pushed or deployed in this round — the tree is ready for
review, push and deploy. No new runtime dependencies.

### Build

`npm run build` — **pass, clean** (TypeScript strict + lint), run twice
during the round and once at the end. First Load JS for `/`: 120 kB.

### What changed, per item

**1. Privacy footer removed.** `app/page.tsx`: the `<footer>` block is
gone (it was already removed in the earlier part of this round, with the
`privacyTitle` / `privacyBody` / `footerLine` keys and the `.footer` CSS).
The worry field and its note in the builder are untouched; the worry is
still never sent or stored.

**2. Once-per-day floating** — unchanged from the earlier part of this
round (server `loy:daily:<ip>:<YYYY-MM-DD>` Redis key, expiry to next
Bangkok midnight, in-memory fallback; 429 `{error: 'daily_limit'}`; client
`loy:floated-day` + friendly already-floated state). Re-checked against
the Rules: the HTML keys the slot on a `float_slot` event for the Bangkok
day and returns `errorDailyLimit` — the rebuild's Redis key + 429 body is
the same rule on the shared server. Two Rules details NOT restored, see
the audit list below (owner-delete refunds the slot; the HTML's
`config.shared` / kiosk bypasses have no equivalent — the shared site
always enforces).

**3. Ten daily stamps + confetti** — unchanged from the earlier part of
this round (`loy:floated-day`, `loy:daily-stamps`, max 10, auto-awarded on
float, confetti only at the 10th). The HTML's stamps are per-destination
(a different system); the daily stamps remain Faiq's new design.

**Rules recheck — restored in this round (mechanical, small):**

- **Festival calendar** (`lib/festival.ts`, new): `festivalCalendar`,
  `canEarn`, `canClaim`, `isOpenDay`, `isOpen`, `defaultDestination`,
  `ARCHIVE_CLAIM_DAYS = 14`, start day 2026-11-18, mode `none`. Phases
  before / live / archive (claim until 2026-12-08) / closed, ported from
  the HTML. Verified in node: 2026-11-06 → before, 0 opened;
  2026-11-18 → live day 1, Bangkok open, Sukhothai closed; 2026-11-24 →
  live day 7; 2026-12-01 → archive, claim until 2026-12-08; 2026-12-09 →
  closed, cannot claim. `bangkokDay` rollover verified: 16:59Z → 2026-11-06,
  17:00Z → 2026-11-07.
- **Destinations corrected** (`lib/destinations.ts`, new, generated
  verbatim from the HTML): the rebuild had the wrong seven — Phitsanulok
  and Samut Songkhram in place of Amphawa and Roi Et, wrong order, and the
  `chiang-mai` slug. Now the HTML's seven with day 1–7, `STAMP_ICON`
  (🛕🪷🏮🕯️🌙✨🌕), `SPECIAL_ICON`, and the full record per destination
  (theme, story, welcome, special kind/title/detail, milestone,
  secret) so a future missions/secrets restore is a UI job, not a content
  job. Scene fields (lat/lon, palette, ambience) dropped — one river scene.
- **Passport visit/collect** (`app/page.tsx`, `app/globals.css`): the
  strip used to stamp any destination on a tap, any day — the Rules say a
  stamp needs a visit first (`collectStamp` requires a `visit_place`
  event) and the night to be open (`isOpenDay`). Now: tap once to visit,
  tap again to collect; locked nights show "Opens 18 Nov" etc. and are
  disabled. Consequence: before 18 November every destination is locked.
  Migration: `loy:stamps` entries are mapped (`chiang-mai` →
  `chiang_mai`; Phitsanulok/Samut Songkhram dropped) and surviving stamps
  count as visits, so nobody loses a keepsake; new stamps follow the Rules.
- **Blessing generator** (`lib/blessing.ts`, new): `templateBlessing` with
  the HTML's 8 THEMES, OPENINGS, CLOSINGS, GENERIC, WISH_LINE, ported
  verbatim. The success panel now shows a blessing composed in the browser
  from the worry + wish (reply in the language written in), instead of one
  of two static lines — the worry hint already promised this ("used on your
  device to write your blessing"). Verified in node: a work worry returns
  the work theme line + wish line + closing; Thai text returns Thai.
- **Crisis rail** (`lib/crisis.ts`, new): `isCrisis` with the HTML's 74
  detection terms verbatim (Latin word-boundary, Thai substring, collapsed
  ≥6 chars). Verified in node: "I want to die", "s u i c i d e",
  "s.u.i.c.i.d.e", Thai อยากตาย / ถูกข่มขืน all trigger; "I wish for
  grapes" does not (the `rape`-in-`grapes` guard works); a plain worry does
  not. The message shown is NOT the HTML's — that one was written for Meta
  employees (Lyra EAP, internal links). The public message points at
  Thailand's free mental-health hotline 1323 (24h) and emergency 1669 /
  191. The check runs client-side at float time; the text is never logged,
  sent or stored; the wish still floats.
- **Reaction toggle** (`lib/store.ts` `setReaction`, `app/api/wishes/[id]/react/route.ts`,
  `components/useReactions.ts` new, `components/WishWall.tsx`,
  `app/page.tsx`): the Rules say one reaction per wish per visitor, tapping
  it again removes it (`toggleReaction`). The rebuild let a visitor give all
  five reactions to one wish — and the pinned panel had no guard at all, so
  every click added one. Now the client sends `{reaction, previous}` and the
  server moves both counts by one (never below zero). Old `loy:reacted`
  arrays migrate to a single reaction (first entry).
- **Custom emoji flower** (`lib/data.ts` `isAllowedCustomEmoji`,
  `flowerGlyph`, `components/Builder.tsx`, `app/api/wishes/route.ts`):
  one pictographic emoji of the visitor's own can be the krathong flower
  (Rules: `isAllowedCustomEmoji`). Anything else falls back to lotus, on
  the client and the server. Verified live: 🦋 stored; `A` fell back to
  lotus. Flows through the krathong preview, the river canvas and the
  keepsake card via `flowerGlyph`.

**4. Natural river** (`components/RiverCanvas.tsx`): water gradient
reworked (dark far side, slightly lighter near water, fading into darkness
at the bottom); an irregular far bank — a low uneven shoreline with dark
reed/grass tufts at the water's edge, seeded once per resize so it never
jitters, kept clear of the temple; a living current — 16 flow lines, each
with its own length (40–170px), speed and brightness, drifting downstream
with the wind; moonlight shimmer as 18 short dashes with independent
phases that break and reform instead of a rigid column; faint rings where
krathongs sit (every ~1.4–3.6s, at a random krathong) in addition to the
rain rings. Name tags stay readable: the water is dark throughout, shimmer
alpha ≤ 0.13. Kept: krathongs, tags, hover tooltip, click-to-pin, splash +
rising lantern, sky, moon, stars, falling stars, swifts, weather,
fireworks, reduced-motion frame, resize, DPR cap 2.

**5. Temple, birds, clouds:**

- **Temple** (`components/WatArunSvg.tsx`, new; `components/RiverCanvas.tsx`
  no longer draws its own temple): a detailed inline SVG illustration —
  central prang with the concave lotus-bud profile, trident finial and
  three terraces, four satellite prangs stepping down, tiered sala roofs
  with gold eave lines, a base platform with lit niches, porcelain-mosaic
  texture (small light/dark tile pattern, not flat black), arched niches
  glowing warm gold (gently pulsing), a faint warm glow behind the spire,
  and a soft reflection in the water (flipped, squashed, fading as it
  sinks). Layered over the canvas in `.temple-overlay`, positioned so the
  base lands exactly on the canvas horizon and the centre at 30% of the
  river width — the same spot the silhouette stood, so swifts still fly to
  it and fireworks still rise above it. Self-contained, no external image.
- **Birds**: `drawSwift` rewritten — slim body, swept sickle wings, forked
  tail, a real flap cycle (wing tips rise with `sin(t/110)` and sweep
  further back as they fall), oriented by flight direction. The old "m"
  stroke is gone.
- **Clouds**: pre-rendered offscreen sprites (3 variants, 7 layered
  radial-gradient puffs each with soft edges + a faint moonlit top),
  drawn with `drawImage` — no per-frame gradient allocation. The
  ≥95% overcast sheet is now a vertical gradient (dense at the top of the
  sky band, thinning toward the horizon) with two slow sprite wisps
  instead of flat ellipses. Overcast deck behaviour unchanged (count and
  size follow real cloud cover; moon/stars veil the same way).

### Live API tests (dev server, no Redis configured → in-memory store)

Started with `PORT=3107 npx next dev -p 3107`. The dev store is the
in-memory fallback; the live Redis path is the same code behind
`getRedis()` and was verified live in earlier rounds. Test wishes lived
only in the dev server's memory and died with it — the live river was
not touched.

| Check | Result |
|---|---|
| POST wish, IP 203.0.113.10 | 201, wish stored |
| POST again, same IP, same day | **429 `{error: 'daily_limit'}`** |
| POST, different IP 203.0.113.20 | 201 |
| POST with flower 🦋 | 201, flower stored as 🦋 |
| POST with flower `A` | 201, flower fell back to `lotus` |
| POST react `{reaction:'love', previous:null}` | love 0 → 1 |
| POST react `{reaction:null, previous:'love'}` | love 1 → 0 (toggle off) |
| POST react `{reaction:'sathu', previous:null}` | sathu 0 → 1 |
| POST react `{reaction:'love', previous:'sathu'}` | sathu 1 → 0, love 0 → 1 |
| POST react `{reaction:'nope'}` | 400 `unknown_reaction` |
| GET /api/wishes | 3 wishes, storage `memory` |
| GET / (homepage) | 200; SSR HTML contains the temple SVG (`wat-prang` ×11), 7 destination cards with Night 1–7 and "Opens 18 Nov" … "Opens 24 Nov", and the daily-stamps strip |

### Node unit checks (compiled lib files, no browser)

- Crisis: 8/8 pass (positives, spaced/dotted forms, Thai terms, the
  `grapes` false-positive guard, plain worry, empty).
- Blessing: work worry → work theme line + wish line + closing, ends 🪷;
  Thai text → Thai blessing, two theme lines matched.
- Custom emoji: 🦋 allowed, `A` rejected, two emoji rejected, 🍆 blocked,
  👋🏽 (skin tone) allowed; `flowerGlyph` returns the emoji or 🪷.
- Calendar: 16/16 pass (phases, opened days, `isOpenDay`, `canEarn`,
  `canClaim`, claimUntil 2026-12-08, `bangkokDay` rollover at 17:00Z).

### Honest limits (unchanged, restated)

- Daily stamps live in the browser (`loy:daily-stamps`); clearing browser
  data loses them. The server daily limit is per IP, so people sharing one
  Wi-Fi/network address share that day's server slot — the same trade-off
  the original had.
- **No live-browser visual check was possible from here.** The build, the
  API and the pure logic are verified above; the temple illustration, the
  river, the birds and the clouds need eyes on the deployed site in the
  morning. In particular: the SVG temple's proportions at desktop vs
  mobile widths (it stretches with the overlay box, as the canvas temple
  did), and whether the passport's locked-until-the-18th state reads well.
- Reaction counts already on the live river include the extra reactions
  the old five-at-once behaviour allowed; the toggle only governs new
  reactions — old counts are not recomputed.
- The crisis rail only fires on the worry/wish the visitor types at float
  time; it does not scan wishes already on the river.

### Audit: Rules systems NOT restored (for Faiq's go/no-go in the morning)

The Rules define more than the rebuild has. Each of these was checked
against the rebuild and deliberately left out of this round — not silently
skipped, and not half-built. Restoring any of them is a discrete job; the
content (destinations, specials, secrets, milestones) is already ported in
`lib/destinations.ts`.

- **Missions (21: 3 slots × 7 nights) + claims + River Light +
  milestones.** HTML rule: per destination, a `visit` mission (5 River
  Light, needs a `visit_place` event), a `special` mission (20, needs the
  night's special evidence), a `kindness` mission (15, react to 3 distinct
  wishes that night — `KINDNESS_GOAL = 3`); states locked / available /
  in_progress / completed / claimed / missed; claims only while
  `canClaim` (until 2026-12-08); each night's milestone target is 45
  River Light (`DEFAULT_TARGET`) with stages at 25/50/75/100%.
  Rebuild now: no missions, no claims, no River Light, no milestones.
  What restoring takes: an event store (`loy:events`, one per day/kind/ref,
  deduped — the HTML's `recordEvent`), the missions view + claim buttons,
  a River Light total, and milestone stages per night. It needs the
  specials below as evidence sources, so it is the last piece, not the first.
- **Special evidence — the seven night specials.** HTML rule: each night's
  special mission is earned by one act — day 1 float, day 2 Sukhothai quiz
  (Nang Noppamas, first krathong; correct answer is option 0), day 3
  blessing (send a blessing to someone else's wish; a blessing also counts
  as `share` evidence), day 4 candle (one candle a day from night 4,
  re-lighting recolours it; the flame shown on your own wishes is today's
  candle flame), day 5 gratitude (one of 6 cards, once), day 6 share
  (downloading the keepsake card or the journey card records a `share`
  event), day 7 finale (join the celebration). Rebuild now: floating
  exists; the flame is picked per krathong at float time, not lit as a
  daily candle; no quiz, blessing, gratitude, share or finale action. What
  restoring takes: one small UI + event each (quiz dialog, bless dialog
  with the 6 template blessings, candle card from night 4, gratitude card
  picker, share on keepsake download, finale join button) — each is small,
  but all seven feed the missions above.
- **Secrets (7 riddles).** HTML rule: each destination hides a secret
  (e.g. Bangkok "The Golden Ripple", riddle "I am born when something
  touches still water…", answer "A ripple" — every secret's correct answer
  is option 0); finding one adds 5 River Light to that night's milestone
  (`SECRET_RIVER_LIGHT`), once per secret. Rebuild now: no secrets, no
  glimmer interaction, no riddle UI. What restoring takes: the riddle
  content (already in `lib/destinations.ts`), a "tap what glimmers"
  interaction on the river scene, and a claim into the night's milestone.
- **Journey card + welcome dialog.** HTML rule: a journey card summarising
  visited destinations, passport stamps, secrets found and nights on the
  river (downloadable as a PNG; saving it records a `share` event), and a
  once-a-day welcome dialog with tonight's destination story and a random
  gentle line (`WELCOME_FALLBACK`). Rebuild now: neither exists. What
  restoring takes: a summary view + the welcome dialog (content already in
  `lib/destinations.ts` and the five welcome lines would need porting).
- **Owner-delete refunds the float.** HTML rule (`deleteMyWish`): deleting
  your own wish for today gives today's float slot back (the `float_slot`
  event is removed). Rebuild now: there is no owner-delete at all — the
  only delete is the admin route, which does not refund the server daily
  slot or clear `loy:floated-day`. What restoring takes: an ownership token
  issued at float time (stored in the browser) plus a refund path in the
  delete route — a small API design change, not just UI.
- **Wish destination.** HTML rule (`floatKrathong`): a floated wish is
  tagged with the destination the visitor chose if that night is open,
  else tonight's destination, else none — feeding the per-destination
  "floated" map in the journey. Rebuild now: wishes carry no destination.
  What restoring takes: a `destination` field on the wish + the assignment
  rule in POST; visible only once the journey exists.
- **Countdown target.** HTML rule: while the festival has not opened, the
  banner counts down to the first day (18 November) — "Bangkok will open
  in X days Y hours". Rebuild now: the hero counts down to the full moon
  (24 November, 19:00 Bangkok) — "until the full moon rises". Left as is
  deliberately: counting to the 18th under the words "until the full moon
  rises" would be wrong copy, and the festival-opening countdown is a
  different beat tied to the opening phase the rebuild does not have.
  Faiq's call if he wants the 18th countdown added as well.
- **Schedule modes / admin config.** HTML rule: `mode` (`opening_night` /
  `finale_night`), `simDay` preview, per-day River Light targets, `paused`,
  `celebrateUntil` — server config the admin set. Rebuild now: none of
  these exist. What restoring takes: an admin config surface (the rebuild's
  `/admin` page currently only does export/delete) — a separate admin job.
- **Archive / closed phases in the UI.** HTML rule: after the last night
  the site shows an archive banner ("Every destination stays open to
  explore. Rewards you already earned can still be claimed for a little
  while.") until 2026-12-08, then a closed banner. Rebuild now: no phase
  banner at all (the passport gating above uses the same calendar, so the
  destinations do stay open in the archive phase). What restoring takes: a
  small banner driven by `calendar().phase`.

## Deliberate simplifications vs the original single-file site
(superseded in part by the overnight round of 2026-11-06, above)

- **Missions, secrets, quiz, gratitude lanterns, candle chain, blessing
  lanterns, journey card, settings/admin panel, ambient sound**: dropped
  in the first rebuild; the overnight round restored the festival calendar,
  the destination/passport rules, the blessing generator, the crisis rail,
  the reaction toggle and the custom emoji flower, and ported the
  destinations/missions/secrets content — the rest is listed in the audit
  above for Faiq's go/no-go.
- **Daily one-krathong guard**: restored in the overnight round — one float
  per Bangkok day per IP (server 429 `daily_limit` + client state), plus
  ten daily stamps.
- **Seeds**: removed at Faiq's request 2026-11-06 (the river starts blank);
  they survive in git history at commit `22af37c5`.
- **Counts**: the wall count and river count both come from the same
  `GET /api/wishes` response, so they agree by construction.
