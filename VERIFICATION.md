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

## Fix round — 2026-11-06 (after the three independent audits failed commit 1fa97d4b)

Single builder, fix-only round: the ten defects below, nothing else.
No push, no deploy — the tree is left ready for re-audit. The big systems
(missions, specials, secrets, journey card, event store, admin config,
sounds) were NOT built; they stay Faiq's go/no-go.

### What changed, per item

1. **River** — `components/RiverCanvas.tsx`. Water gradient now reads as
   depth: far water `#16204a` catching the sky/moon, darkening to `#03040c`
   at the bottom, plus three slow drifting sheen bands. Flow lines 16 → 30,
   length 90–280 px, alpha 0.07–0.20, speed 0.35–1.0, widths 1–2 px.
   Moonlight path: a soft gold glow column under the moon plus 30 dashes,
   14–64 px wide, alpha 0.10–0.30. Reeds: 6 clusters with gaps (not a
   uniform comb), blades 11–30 px with individual height/lean/thickness,
   ~a third with cattail seed heads; bank slightly lighter with a faint
   waterline highlight.
2. **Temple desktop** — `components/WatArunSvg.tsx`, `app/globals.css`.
   Stone `#1c2447` → `#2b3568`, mosaic tiles lighter with pale tiles at
   opacity 0.32–0.38 (was 0.16–0.22), gold rim light opacity 0.3 → 0.6
   and width 1 → 1.5, glow 0.14 → 0.24, sala roofs lighter with gold
   edge 0.55. The overlay now keeps the SVG's own aspect ratio
   (`preserveAspectRatio="xMidYMid meet"`, `.temple-overlay` sized by
   `aspect-ratio: 600/380`) instead of stretching it; on desktop it is
   82% wide, top −5%, so the prang is ~160 px tall (was ~96 px) with its
   base still on the horizon and centre at 30% of the river width.
3. **Clouds** — `components/RiverCanvas.tsx`. Root cause: the sprites were
   dark navy on a dark navy sky. Puffs are now moonlit pale
   (`rgba(148,162,214,0.6)` core, `rgba(205,214,248,0.4)` tops). Added a
   DEV-ONLY query flag `?cloud=NN` that forces cloud cover 0–100 for
   visual checks (the live fetch never overrides it while set); it affects
   only this browser's view and has no UI.
4. **Lanterns** — `components/SkyCanvas.tsx`. They now rise only in two
   safe lanes with per-lane ceilings: a clear-sky lane on the right
   (x 0.62–0.97w, ceiling 0.58h) and a low lane on the left
   (x 0.03–0.53w, ceiling 0.82h, veiled by the copy gradient). A lantern
   recycles at its lane's ceiling, never higher — so none crosses the
   headline (ends ~0.55h) or the moon (0.24h).
5. **Footer** — `app/page.tsx`, `app/globals.css`. `<footer
   class="site-footer">` after the wish wall: "🪷 Seven Nights of Wishes"
   + "Loy Krathong · Tuesday 24 November 2026 · Bangkok". No privacy
   text — that block stays removed.
6. **Denylist** — `lib/data.ts`, `lib/crisis.ts`. Faithful port of the
   HTML's DenyList (~line 2109): 66 terms (34 English + `kuay`/`kuy` +
   30 Thai) with the layered matcher — `normalise`, word-boundary regexes
   for Latin, Thai substring matching with `THAI_BENIGN` stripping
   (`หีบ`), collapsed-form matching with `NOT_COLLAPSE_SAFE`,
   lookalike unmasking (`LOOKALIKES`). "kill yourself" / "kys" /
   "damn you" are NOT in the list (the HTML never had them): a suicidal
   wish now floats instead of being rejected. To keep the crisis rail
   working, `"kill yourself"` was added to `CRISIS_TERMS` in
   `lib/crisis.ts` (the HTML's list has only first-person forms, so
   without this the phrase would float with no crisis response).
7. **Countdown / phase banners** — `app/page.tsx`, `lib/i18n.ts`. A phase
   banner sits between the topbar and the hero, driven by
   `cal.phase`: before → "🌙 The festival begins soon — Bangkok opens in
   11 days and 0 hours" (EN/TH verbatim from the HTML's `renderBanner`,
   counting to 18 Nov 00:00 Bangkok via a new `useOpeningCountdown`
   hook); opening / archive / closed → their HTML strings. The hero's
   full-moon countdown is unchanged.
8. **Flames** — `lib/data.ts`. Seven flames per the HTML's list, ruby red
   `#ff5a4a` restored as the 6th (HTML order). Per-krathong pick only;
   the daily-candle model was NOT rebuilt.
9. **Krathong choice** — `components/Builder.tsx`. Flower, boat and flame
   are saved to localStorage under `loy:krathong` on every change and
   restored on load (validated: unknown ids fall back to defaults).
10. **Reaction 404** — `lib/store.ts`,
    `app/api/wishes/[id]/react/route.ts`. New `wishExists(id)` (stored
    wishes + seeds); the react route returns 404 `not_found` when the
    wish does not exist, instead of inventing a reaction row for it.

### How it was verified

- **Node tests** (`/tmp/lk-fix/test-denylist.ts`, run against the real
  lib files): 55/55 pass. Blocked: `fuck`, `shit`, `nigger`, `bitch`,
  `whore`, `cunt`, `rape`, `dickhead`, `phuck`, Thai `ควย`/`เหี้ย`/`มึง`/
  `กะหรี่`/`ไอ้สัส`/`ชิบหาย`; evasions `f u c k`, `f.u.c.k`, `f*ck`,
  `sh1t`, `$h!t`, `fvck`, `s h i t`. Allowed: "kill yourself", "kys",
  "damn you", "grapes", "Dickson", "Fukuoka", "Mississippi", "cockpit",
  "glass hole", `หีบ` / `หีบสมบัติของย่า`, `กูเกิล`, `ตายห่า`. Crisis:
  "kill yourself", "kill myself", "I want to die", spaced "s u i c i d e",
  Thai `อยากตาย` trigger; "grapes", "kill your darlings", plain worry do
  not. Flames: 7, ruby `#ff5a4a` present, ids unique. Calendar: before /
  live day 1 / live day 7 / archive / closed all correct.
- **Dev API tests** (`next dev` on :3100, stopped before building):
  blocked wish → 400 `blocked_content`; wish containing "kill yourself"
  → 201 and floats (flame `ruby` persisted); react on a nonexistent id
  → 404 `not_found`; react on the floated wish → 200 (`love: 1`). The
  crisis message triggers client-side: `Builder.tsx` calls
  `isCrisis(worryText, text)` before the POST and shows the crisis card
  (hotline 1323) instead of the blessing; `isCrisis("kill yourself")`
  is true in the node test above, and the worry itself is never sent to
  the server (the route drops it).
- **Clean-copy build** (source without `.next` copied to
  `/tmp/lk-fix/build-copy`, built there): passes; `/` First Load JS
  122 kB. Served with `next start` on :3200 and screenshotted with
  headless Chrome.
- **Screenshots** (`/tmp/lk-fix/`): `f1-hero.png` — phase banner
  "Bangkok opens in 11 days and 0 hours", moon clear, lanterns in the
  lower right only, none through the headline or moon. `f2-river.png` /
  `r2-river.png` / `r3-river-wide.png` — river with visible current
  (long bright flow lines), broad broken moonlight path under the moon,
  depth gradient (lighter far water → dark near water), reed clusters at
  the water's edge, temple large with readable porcelain mosaic, gold
  windows and gold rim light; one soft cloud top-left (fallback cycle).
  `f4-overcast.png` / `o2-river.png` (`?cloud=97`) — forced overcast:
  big soft pale cloud masses across the sky, moon veiled to a pale disc,
  moonlight path fainter as designed. `f3-footer.png` — footer present
  with site name + date, and the flame picker shows 7 flames.
  `f6-mobile-hero.png` / `f7-mobile-river.png` / `f6-hero-crop.png` —
  mobile hero: phase banner wraps to two lines, lanterns below the
  headline and away from the moon. Raw hero-canvas frames
  (`canvas-0/1/2.png` via `toDataURL`) plus a pixel analysis: every
  detected lantern sits inside its lane (sky lane x 0.64–0.72w,
  y 0.65–0.86h), none above 0.58h, none near the moon (0.78w, 0.24h).
- **Krathong persistence, live in the browser**: clicked Ruby red →
  localStorage `loy:krathong` = `{"flower":"lotus","boat":"leaf",
  "flame":"ruby"}`; after reload the value is unchanged and Ruby red is
  still selected. Then Rose + "Lotus pink" boat → stored
  `{"flower":"rosette","boat":"lotus_pink","flame":"ruby"}`; after
  reload all three still selected. Thai banner checked live:
  "🌙 เทศกาลใกล้เริ่มแล้ว กรุงเทพฯ จะเปิดในอีก 11 วัน 0 ชั่วโมง".
- **Delivered-tree build**: `rm -rf .next && npm run build` in
  `~/workspace/loy-krathong` passes clean; `/` First Load JS 122 kB
  (was 120 kB before this round). `next dev` and `npm run build` were
  never run concurrently.

### What could not be verified

- The live site still runs the previous version (commit `29ae69b`); this
  round was not deployed, so none of this has been seen on
  loykrathong.web.id. The clean-copy server had no Redis, so its river
  started empty ("The river is quiet") — the real river's wishes (incl.
  Faiq's "Test A") live in production Redis and were not touched.
- The opening/archive/closed banners were verified only in the before
  phase (today is before the festival); the other phases render from the
  same code and strings but their live appearance was not screenshot.
- The forced-cloud flag is dev-only and was verified only in this
  sandbox's headless Chrome; live Open-Meteo weather still cannot be
  reached from here, so the live-weather path was not exercised.
- Krathong persistence was verified in headless Chrome's localStorage;
  real-browser behaviour (e.g. private mode) falls back to defaults by
  design and was not tested.

## Fix round 2, 2026-11-06 ~23:50 — river texture in a still + temple desktop contrast

Scope: ONLY the two remaining visual failures from the independent visual
re-audit (23:50). Everything else already passed. Not pushed, not deployed.

The re-audit's key insight: the auditor judges STILL screenshots, so motion
alone fixes nothing — the water and the temple must read correctly in a
single frozen frame. Both fixes were therefore judged on stills, not on
animation, and measured with numbers, not just by eye.

### 1. River — ripple texture, broad moon path, visible depth bands

(`components/RiverCanvas.tsx` only; reeds, krathongs/tags, temple
reflection, weather, fireworks, swifts, reduced-motion frame untouched.)

- **Ripple arcs (new):** 78 seeded arcs — shallow upward curves, a pale
  highlight with a dark shadow twin below (half carry one) — spread across
  the whole water surface, 38% denser inside the moon path. They pulse
  gently (alpha floor 60% of base) but never fade out, so a frozen frame
  still shows wave texture. Drawn after the flow lines, before the rings.
- **Moon path, now a broad band:** the soft glow widened from ±70px to
  ±130px at alpha 0.08, plus a second wash to ±240px at 0.03; shimmer
  dashes 30 → 46, wider (20–110px vs 14–50px), line width 2–3 by dash
  width, with a sideways wobble. It reads as a wide shimmering band, not
  a column of dashes.
- **Depth bands the eye can see:** the gradient now has distinct stops —
  far water `#2b3563` (was `#16204a`), mid `#1a2348`/`#141c3e`, near
  `#0e1432` → `#03040c` — with a soft line of caught light at each shelf
  edge (16% and 50% of the water depth). The sheen bands were
  strengthened (alpha 0.08–0.11 vs 0.05–0.07).
- **Flow lines quietened:** alpha 0.07–0.20 → 0.05–0.12 — they are the
  motion under the texture now, not the texture itself. The old ones read
  as scratches on a flat field.

### 2. Temple desktop — genuinely lighter stone, defining gold rim

(`components/WatArunSvg.tsx` only; glow, windows, satellites, reflection,
base on the horizon untouched.)

- **Stone genuinely lightened:** mosaic base `#2e3a6e` → `#8b93bd`,
  tiles `#36427f`/`#232c56` → `#9aa1cc`/`#767eae`, pale tile opacities
  0.32/0.38 → 0.55, prang base fill `#2b3568` → `#7d86b3`, mosaic
  overlay opacity 0.65 → 0.85. Sala roofs `#232a52` → `#3a4376`,
  base platform `#1a2142` → `#2e3766`.
- **Defining gold rim:** the old single 1.5px line at 0.6 opacity on one
  shaft edge is now a 6px soft halo (0.22) plus a 3px bright edge
  (`#ffdf8a`, 0.95) on BOTH shaft edges, plus 1.8px gold strokes down both
  sides of the stepped base. Roofline strokes 0.8px/0.55 → 1.4px/0.85,
  platform gold line 0.45 → 0.8.

### 3. Language one-off — no defect

One load rendered in Thai with no stored preference and navigator
en-US. Checked `lib/i18n.ts` and `app/page.tsx`: there is NO
`navigator.language` detection anywhere in the app (grep: zero matches).
The only source of Thai is a stored `loy:lang: "th"` in localStorage
(`useState` initializer, default `'en'`; SSR always `'en'`). The Thai
load must have reused a Chrome profile whose localStorage already held
the preference — the auditors reused profiles across runs, and an
earlier run had exercised the TH toggle. No code change made.

### Verification

- `npm run build` — **pass, clean** (fresh `.next`, TypeScript strict +
  lint), `/` 123 kB First Load JS.
- Served a clean-copy `next start` (port 3200) and screenshotted with
  headless Chrome (Chromium 158 via CDP) at 1440x900 and 390x844, two
  desktop river shots 8s apart so the still is judged as a still.
  Screenshots in `/tmp/lk-fix2/`:
  - `d2-river.png` — desktop river at 1440x900: pale lavender temple
    with gold rim and visible mosaic, broad gold moon band, ripple arcs
    across the water, far water clearly lighter than the near water.
  - `d2-river-later.png` — same view 8s later: same texture, moon
    dashes in different phases — the texture is consistent, not a
    lucky frame.
  - `d2-temple-crop2.png` — temple band at 2x: pale stone, checker
    mosaic, thick gold rim on both shaft edges, gold windows and eave
    lines; reads at normal viewing distance, not only in the crop.
  - `d2-water-crop2.png` — water at full size: dozens of ripple arcs,
    broad moon band on the right, far band lighter, temple reflection
    at top-left, text still readable.
  - `m2-river.png` — mobile 390x844: temple and water both read well;
    the water texture is clearest here.
  - `m2-water-crop2.png` — mobile water at full size: arcs everywhere,
    broad moon band, depth fading to dark at the bottom.
- Measured, same coordinates, old vs new desktop stills (luminance maps):
  - Water: mean luminance 23 → 35, stdev 10 → 17, max 54 → 89 — the
    surface has real variation instead of near-uniform darkness.
  - Temple band: old prangs reached luminance ~22–65 against a dark sky;
    new prangs reach ~65–150 across their whole mass, sky unchanged —
    the stone roughly doubled in rendered brightness.
- The CDP `clip` screenshots came back blank (clip coordinates in this
  Chrome build), so the crops above were cut from the full shots with
  PIL instead; the blank clip files were deleted.
- Not verified: live-browser behaviour on a real device, and live
  Open-Meteo weather end-to-end (headless Chrome here reaches no
  external host; the fallback cycle rendered the clear-sky scene in
  these shots, as in earlier rounds).

## Fix round 3, 2026-11-07 ~00:00–01:00 — the river is a real photograph

### Why a different approach
Two rounds of hand-drawn water hit a ceiling: the round-2 visual
re-audit (temple PASS, river still FAIL) said the river was better but
still did not read as natural water in a still frame — drawn texture on
a flat dark field. This round stops drawing the water and bases it on a
real photograph instead.

### The photo
- Source: "Night reflections of houses, bridge and the moon on the
  water of Emajõgi river in Tartu, Tartumaa, Estonia, November 2020",
  by Sergei Gussev, via Wikimedia Commons
  (https://commons.wikimedia.org/w/index.php?curid=179288630).
- Licence: **CC BY 4.0** — free to use with attribution. Attribution is
  a small muted credit line inside the river panel, bottom right
  ("River photo: Sergei Gussev, CC BY 4.0", linked to the file page),
  plus this note. The credit never intercepts clicks
  (`pointer-events: none` on the wrapper).
- Candidates rejected after looking at them: Lake Bohinj (glassy
  mirror lake + mountains + pier — water too smooth, wrong subject),
  Francavilla moonlit sea (rock breakwater across the frame AND a
  photographer's watermark bottom-right), Shingle Street lagoon
  (daytime, blue sky, shingle beach — not night).
- Processing (PIL, script in /tmp/lk-fix3 — the crop/grade steps are
  recorded here so the image can be rebuilt): cropped to water only
  (y 1800–2957 of 3947×2957, dropping the bank, road and red bridge
  arch), flipped horizontally so the warm reflection band and moon
  glint sit on the right, under the canvas moon (x 0.78w); navy grade
  (R×0.86, G×0.94, B×1.10, 18% blend toward #0a1030); bright streaks
  warmed back toward gold; red neon arch reflection shifted to gold;
  depth gradient (top 1.0 → bottom 0.82); the stray white moon glint
  painted out (it read as a random white blob); contrast 1.07;
  resized to 2200×644, JPEG q82, **70 KB**.
- Shipped locally at `public/river-night.jpg` — no hotlink, no
  external dependency. No EXIF.

### What changed in code
- `components/RiverCanvas.tsx` only (plus the credit in
  `app/page.tsx` / `app/globals.css`):
  - The water base is now the photo, cover-fit into the water rect
    (`drawImage` with `Math.max(w/iw, waterH/ih)` scale). Until it
    loads, the old gradient stands in so the first paint is never
    blank; the animation loop picks the photo up on load, and a
    reduced-motion frame redraws once on load.
  - A faint navy wash seats the photo with the drawn sky (0.08 top →
    0.16 bottom); under a heavy overcast a veil dims the water
    (overcast × 0.22), like the sky.
  - REMOVED: the flow lines and the ripple arcs (seed, update and
    draw — `FlowLine`/`Ripple` interfaces gone). The photo carries
    the texture now; drawn marks on top of it reintroduced exactly
    the fake look this round removes.
  - Moon shimmer kept but quieted twice: first to 30 dashes at
    alpha 0.06–0.20 — still read as a ladder of gold bars on the
    photo — then to **14 dashes, 12–46px wide, alpha 0.03–0.09,
    1.5px, clustered in the top 55% of the water** (where a real
    moon path is brightest), glow band 0.08 → 0.03, wash 0.03 → 0.01.
  - Untouched: sky, stars, moon, clouds, swifts, meteors, fireworks,
    rain, mist, far bank + reeds, temple reflection lines,
    krathongs/tags, reduced-motion frame, daily limit, stamps.
- `app/page.tsx`: the `.river-credit` div inside `.river-wrap`.
- `app/globals.css`: `.river-credit` (10.5px, 45% cream, bottom
  right, pointer-events none except the link).

### Verification
- `npm run build` — **pass, clean** (fresh `.next`, TypeScript strict +
  lint), `/` 122 kB First Load JS. Built twice (once before, once
  after the shimmer quietening); both clean.
- Served a clean copy (`next start`, port 3200) and screenshotted
  with headless Chrome 158 via CDP (real waits + scroll; the plain
  `--screenshot` flag caught a blank pre-hydration page, and
  `--virtual-time-budget` did not fix it — CDP with real time is the
  way). Screenshots in `/tmp/lk-fix3/`:
  - `f3-river-desktop.png` / `f3-river-mobile.png` — 1440×900 and
    390×844: pale temple with gold rim, moon, swifts, the photo's
    real reflection band with warm lamps across the top of the
    water, dark near water with only photographic tonal variation,
    empty-state text readable, credit line subtle bottom-right.
  - `f3-river-overcast.png` — `?cloud=97`: cloud deck over the sky,
    moon veiled to a faint disc, water dimmed by the veil.
  - `f3-river-krathongs-fresh.png` / `v2-desktop-krathongs-clicked.png`
    — two test wishes posted to the LOCAL test server only (in-memory
    store on port 3200, never the live site): after clicking the
    "refresh the river" pill, a gold boat with a ruby flame floats
    over the photo and reads clearly. (The pill itself is intended
    behaviour: new wishes wait behind it instead of yanking the
    river.)
  - Pixel-measured, not eyeballed: in the desktop still, gold pixels
    in the water exist only in the top band (y 260–340, the photo's
    reflection band + shimmer zone); below y≈385 the water is
    R 20–40 with isolated 1px photographic streaks (R ≤ 95) — the
    loud full-depth dash column of round 2 is gone. The new shimmer
    code was confirmed in the served chunk (`.03+.06` alpha,
    `i<14` loop; the `i<46` in the chunk is the hover hit-test
    `46*l.scale+10`, not the shimmer).
- Judged as stills against the round-2 re-audit shots (which are gone
  from /tmp now — tmpfs was cleared — so judged against the re-audit's
  written verdict: "flat dark panel with scratches"): the water now
  reads as a photograph of a river at night, not a drawn panel.
- Not verified: live-browser behaviour on a real device, and live
  Open-Meteo weather end-to-end (headless Chrome here reaches no
  external host; the fallback cycle rendered the scenes in these
  shots, as in earlier rounds). Independent visual re-audit of this
  round still outstanding — nothing is pushed or deployed.

## Fix round 4, 2026-11-07 ~00:35–01:10 — a better photo + the texture restored

### What the round-3 re-audit prescribed (followed exactly)
The Chagres photo's reflection band was genuinely photographic, but
the lower two-thirds were a black void (mid mean 14.7/stdev 6.8,
lower 9.6/6.7) because that photo's own water is near-black below
its reflection band; the band ended in a hard edge; the moon had no
reflection (14 dashes at alpha 0.03–0.09, invisible); the drawn
temple-reflection fans clashed with the photo's building reflections;
a test boat spawned half-clipped at the panel edge with its tag cut
off ("Au…").

### 1. A better photo (tried first, as prescribed)
Candidates measured with PIL (luminance bands) and looked at:
- Emajõgi (current, round 3): mid 13.9/5.1, lower 6.8/2.5 — near-black.
- Lake Bohinj / Pixabay "Moonlight on water" (jetty photo): water
  only a middle band, glassy-smooth, jetty + bank fill the bottom
  half — wrong subject.
- Helford by Moonlight: good water texture on the right, but rocks
  fill the left half and it is only 1280px wide.
- Openverse/Flickr keyword hits: mostly mislabelled (a daytime
  canyon, a Hubble galaxy image, Newcastle's Tyne Bridge, a pebble
  beach) — keyword search is too noisy for this.
- **Chosen: "Moonlight over the Chagres river", Brian Gratwicke,
  Panama, 2015, via Wikimedia Commons** (5184×3456, CC BY 2.0):
  a real moon glitter path runs the full depth of the water, top to
  bottom. Measured on the water band: path column mean 57–67,
  stdev 69–75, p95 213–222; water away from the path is dark
  (mean 2–6, stdev 4–6) — the photo alone does not carry the lower
  water, which is why the drawn layer is restored too (step 2).
- Processing (PIL; the crop/grade steps are recorded here so the
  image can be rebuilt): cropped to water only (x 0.05–0.72,
  y 0.605–1.00 of 5184×3456, dropping the sky, moon, trees and far
  bank); the overhanging tree silhouette in the top-right corner was
  painted out with a mirrored patch of open dark water from the
  left side (feathered), three small leaf tips painted out with
  sampled dark water + noise, the patch re-toned per-row (target
  mean 5 at the top → 14 at its bottom edge, so no step shows) and
  desaturated 65% toward dark navy (the first re-tone had amplified
  the mirrored patch's blue noise into a smudge); navy grade
  (shadow gamma 0.92, R×0.86, G×0.94, B×1.10, 18% blend toward
  #0a1030, bright path warmed toward gold, depth gradient 1.0 →
  0.90, contrast 1.06, brightness 1.04); resized to 2200×865,
  JPEG q82, **196 KB**. The moon path's centre in the graded asset
  was measured (brightest 100px column band, centre x 1375 of 2200)
  → `PATH_FRAC = 0.625`, recorded in the code.
- Shipped locally at `public/river-night.jpg` (replaces the Emajõgi
  file) — no hotlink, no external dependency. Credit line updated in
  `app/page.tsx` to Brian Gratwicke, CC BY 2.0, linked to the Commons
  file page.

### 2. Ripple / moon-path layer restored over the lower water
- The photo is no longer drawn centred: the draw is shifted
  horizontally so the photo's moon path lands under the canvas moon
  (0.78w) at any viewport (`dx = 0.78w − PATH_FRAC·dw`, clamped so
  the photo still covers the rect). Without the shift the path and
  the moon disagree by up to a quarter of the panel; with it they
  coincide on desktop and mobile (verified in screenshots).
- Moon column, real now: glow band alpha 0.03 → 0.10, wash 0.01 →
  0.03, shimmer dashes 14 → 40, 20–110px wide, alpha 0.08–0.28,
  spread over the FULL water depth (not just the top 55%).
- Ripple arcs (90, seeded in `seedSky`, drawn after the photo):
  shallow upward curves, pale highlight with a dark shadow twin on
  half, 38% clustered inside the moon column (gold-tinted there),
  base alpha 0.10–0.26, pulsing but never below 60% of base, so a
  frozen frame still shows wave texture; they run the whole depth
  including across the top, so there is no horizontal seam where any
  reflection band ends.
- Temple reflection: the 8 gold fan lines are GONE, replaced by one
  soft vertical glow column (gold 0.05 → 0 over 110px, no strokes).

### 3. Boat spawn clipping fixed
- Non-fresh boats now spawn at `w·(0.09 + rand·0.82)` — never at
  the panel edges.
- Name tags are clamped inside the canvas (tag centre clamped to
  `[tagW/2+6, w−tagW/2−6]`), so a boat drifting in from an edge
  never has its tag cut off.

### 4. Reduced-motion boats (found while verifying this round)
Pre-existing since the photo round, not in the re-audit: in
reduced-motion mode the scene is one static frame, but the wishes
arrive after the first paint and nothing redrew the frame — so
reduced-motion users saw an empty river while the header counted
the krathongs. Fixed with a second effect that redraws the frozen
frame whenever `wishes` change (via a `redrawRef` the main effect
assigns). Verified live in headless Chrome with emulated
`prefers-reduced-motion: reduce`: the static frame shows all 6
test boats with tags, the moon path, arcs and three fixed swifts.
(Caught a verification trap on the way: navigating to the same URL
with only a hash change does NOT reload the document — the first
two reduced-motion shots ran the OLD code from bfcache. The
confirming shot used a cache-busting `?v=99` URL.)

### Verification
- `npm run build` — **pass, clean** (fresh `.next`, TypeScript
  strict + lint), `/` 123 kB First Load JS. Built three times in
  the delivered tree during this round (twice before, once after
  the reduced-motion fix); the final build is the one shipping.
- Served a clean copy (`next start`, port 3201) and screenshotted
  with headless Chrome 158 via CDP. **Note: /tmp was cleared
  mid-round (whole tmpfs emptied, including the round-3 re-audit
  shots and this round's first screenshots + work copy), so the
  evidence below was re-shot from a work copy kept under
  `~/workspace/lk-fix4/` (screenshots, CDP scripts, server log).
  The numbers below are from the re-shot set.**
- Screenshots in `~/workspace/lk-fix4/`
  (`f4-river-desktop.png`, `f4-river-desktop-later.png`,
  `f4-river-mobile.png`, `f4-river-overcast.png`,
  `f4-river-reduced-motion.png`, `f4-water-crop.png`):
  - Desktop 1440×900, empty river and with 6 test boats (posted
    to the isolated dev server's in-memory store only — the live
    river is untouched): the moon glitter path runs the full depth
    under the canvas moon; ripple arcs read across the lower water;
    the water is a river, not a void; no boat or tag is clipped at
    the panel edges; credit "River photo: Brian Gratwicke, CC BY
    2.0" bottom-right.
  - Mobile 390×844: path aligned under the moon, texture visible,
    tags inside the panel.
  - `?cloud=97`: cloud deck, moon veiled to a faint disc, water
    dimmed, path + arcs still faintly visible — the overcast
    behaviour holds with the new water.
  - Reduced motion: static frame with all 6 boats (see §4).
- Pixel-measured (PIL, desktop still, same boxes as the round-3
  re-audit's lower-water measure):
  - Lower water, full width: **mean 37.3, stdev 49.2** (round 3:
    9.6/6.7; round-2 target: 35/17) — clearly above the photo's
    numbers, comparable to round 2 on mean and far above on stdev.
    A later frame measures 33.9/44.1 — the texture persists, not
    a lucky frame.
  - Lower water left of the moon path (the darkest water, no path
    help): **mean 12.3, stdev 15.1** (round 3: 9.6/6.7) — above on
    both, stdev more than doubled.
  - Mid water: 41.8/50.2; top band: 55.5/51.1.
- Judged as stills against the round-3 re-audit shots (gone from
  /tmp with the tmpfs clear — judged against its written verdict
  and measurements instead): the river now has a real moon path
  down the whole depth and visible ripple texture across the lower
  water; the hard reflection-band edge is gone (there is no band
  any more — the path runs continuously).
- Observations, not verdict items: far-row name tags can overlap
  each other when two boats share a row near the temple (long
  test names, e.g. "Tester 2" / "Tester 6" in the reduced-motion
  shot) — pre-existing crowding, not edge clipping; the river
  poll's "new wishes" pill counted 12 then 18 across my three
  dev-server restarts + re-posts (localStorage last-seen + poll
  merging in `page.tsx`, dev-test artefact, live river
  unaffected). Neither was changed in this round.
- Not verified: live-browser behaviour on a real device, and live
  Open-Meteo weather end-to-end (headless Chrome here reaches no
  external host; the fallback cycle rendered the scenes in these
  shots, as in earlier rounds). Independent visual re-audit of this
  round still outstanding — nothing is pushed or deployed.

## Ambient audio, 2026-11-07 ~01:15–01:40 — kalimba music + firework sounds

Faiq (08:12): calming Thai kalimba background music that always plays,
plus firework sounds during the firework shows.

### 1. The music — a real kalimba recording (not generative)
- Shipped locally at `public/audio/kalimba-calm.mp3` (846 KB, 52.8 s,
  128 kbps): "Kalimba Atmosphere" by soramoosic, **CC0 via Freesound**
  (https://freesound.org/s/271291/) — free for any use, no attribution
  required. Chosen from Openverse results after measuring the candidates
  with ffmpeg: continuous playing for the whole 53 s (zero silent gaps
  ≥1 s below −45 dB), even level (mean −23.5 dB, max −7.7 dB), quiet at
  both ends (first 1 s −42.4 dB, last 1 s −52.1 dB), so the loop seam is
  gentle.
- **The Thai gap, stated plainly:** no freely-licensed track exists
  that is both kalimba AND Thai. The one genuine Thai instrument
  recording found — "Khim (Thai Stringed Instrument)" by stomachache,
  CC BY, 61 s, Freesound — was measured and rejected as a loop: a 10 s
  near-silent intro (−40.6/−41.7 dB for the first two 5 s segments),
  uneven dynamics (−25 to −34 dB across segments, max −3.6 dB peak),
  i.e. a demo/field recording, not a flowing piece. The generative
  route (Web Audio kalimba in a Thai pentatonic scale) was therefore
  the alternative, but a real kalimba recording sounds warmer than a
  synthesised pluck, so the real CC0 kalimba shipped and the Thai
  character is the stated limitation. If Faiq wants a Thai melody, it
  needs a recording commissioned or a Thai track licensed, not a swap
  from the free libraries.
- Playback (`lib/audio.ts`): browsers block sound before the visitor
  interacts, so the music starts on the first pointerdown/keydown
  anywhere on the page, fades in over ~2 s to volume 0.25, and loops
  forever. Pauses while the tab is hidden, resumes when visible (only
  if sound is on).

### 2. The firework sound — one boom per burst
- Shipped locally at `public/audio/firework.mp3` (89 KB, 5.5 s, 128
  kbps): "fireworks exploding 1" by soundmary, **CC0 via Freesound**
  (https://freesound.org/s/117616/) — one explosion, loud at once
  (mean −13.1 dB, max 0.0 dB), then crackle decay, which maps
  one-to-one onto a burst. (The 3-bursts-in-one-file alternative was
  CC BY and doesn't map to per-burst playback.)
- Hook: `audio.playFirework()` is called at the top of `burst()` in
  `components/RiverCanvas.tsx`, so it fires for the automatic
  24 Nov 19:00–23:59 show and the hidden 5-click preview alike.
  Throttled inside lib/audio (max ~1 per 0.8 s), volume 0.4, gated on
  the sound preference; a 3-element pool round-robins so a new boom
  never cuts off the previous one's tail.

### 3. The toggle + preference
- `components/SoundToggle.tsx` in the topbar, next to EN/ไทย: 🔊/🔇
  with a label in the visitor's language (`soundOn`/`soundOff` in
  lib/i18n.ts — EN "Sound on"/"Sound off", TH "เปิดเสียง"/"ปิดเสียง").
  Mutes/unmutes everything. Preference persists in localStorage
  (`loy:sound`, default ON). The component initialises to ON and syncs
  from storage in an effect, so the server render and first client
  render always agree (no hydration mismatch for a previously-muted
  visitor). On narrow screens (≤560 px) the text label hides, icon only.
- Files changed: `lib/audio.ts` (new), `components/SoundToggle.tsx`
  (new), `public/audio/kalimba-calm.mp3` + `public/audio/firework.mp3`
  (new), `app/page.tsx` (toggle + first-interaction effect),
  `components/RiverCanvas.tsx` (one call in `burst()`),
  `lib/i18n.ts` (two strings × two languages), `app/globals.css`
  (`.sound-toggle`).

### Verification (headless Chrome 158 via CDP, clean-copy `next start`)
- `npm run build` — **pass, clean**, `/` 124 kB First Load JS (was
  123 kB — the audio code adds ~1 kB).
- 12/13 checks PASS in `/tmp/lk-audio/cdp_verify.py` (screenshot
  `/tmp/lk-audio/audio-topbar.png` — the toggle sits cleanly next to
  EN/ไทย): both audio files serve 200; toggle exists, default ON;
  no audio elements before interaction; after a REAL click the kalimba
  element plays (`paused === false`, currentTime 3.11 → 4.33, volume
  0.25 after the fade); toggle OFF persists `loy:sound=off` and pauses;
  after reload the toggle shows muted and a real click does NOT start
  music; toggling back ON (real click = gesture) restarts it; five
  real clicks in the river trigger the preview show and the firework
  element plays on a burst (currentTime 0.46 → 1.50); Thai label
  verified live ("🔊เปิดเสียง", aria-label "เปิดเสียง").
- The 13th check (no console errors) FAILED with 12 uncaught
  exceptions — **proven pre-existing, not from this work**: a baseline
  copy with every audio change reverted, built and served on port
  3203, throws the SAME 12 exceptions (React minified #425/#418/#423
  — hydration mismatches, most likely the countdown seconds ticking
  between SSR and hydration). The audio work adds zero new console
  errors.
- Not verified: how it actually sounds to a human ear (headless
  Chrome verifies playback state, not sound); live-browser behaviour
  on a real device. Nothing is pushed or deployed.

## Fix round 5 — name tags above the temple + mobile topbar wrap (2026-11-07 ~08:47)

Two honest observations from the round-4 visual re-audit, not verdict
items. The visual round was DONE; these are the only two things touched.

### 1. Far-row name tags hidden behind the temple prangs
- Cause: the temple is an SVG overlay div layered OVER the main canvas,
  so any tag painted on the main canvas was cut by a prang. Keeping
  far-row boats out of the temple's x-range was rejected — boats drift
  in x (`s.x += s.speed * drift`, wrapping and re-randomising row), so
  a spawn-time exclusion would only hold until a boat drifted in.
- Fix: a second canvas (`components/RiverCanvas.tsx`, `tagRef`) layered
  above the temple overlay (DOM order: main canvas, `.temple-overlay`,
  `canvas.river-tags`; CSS `.river-scene canvas.river-tags` absolute,
  full box, `pointer-events: none`). The tag drawing was extracted from
  `drawKrathong` into `drawNameTag(g, wish, s, y, sc)` and is now painted
  in one pass at the end of `draw()`, after all boats, on the tag canvas
  (cleared each frame; the main canvas is fully repainted by sky/water).
  Tags are also above nearer boats now, not just above the temple. If
  the tag canvas is ever absent, tags fall back to the main canvas (old
  behaviour) rather than disappearing. The temple did not move; no other
  layer changed. The tag canvas shares the main canvas's backing store
  exactly (same w/h/dpr, set in `resize()`).
- `app/page.tsx` / `app/globals.css`: the EN/ไทย toggle and the sound
  toggle are wrapped in one `.top-controls` flex span (`flex-wrap:
  nowrap`), so the sound toggle can never wrap onto its own row as a
  lone icon; under 560px the topnav controls compact slightly
  (links 13px, padding 7px 9px) so the pair usually fits beside the
  links. Desktop is untouched (same row, same spacing).

### Verification (headless Chrome 158 via CDP, clean-copy `next start` on port 3205)
- `npm run build` — **pass, clean**, in the delivered tree and in the
  clean copy, `/` 124 kB First Load JS (unchanged).
- 12 test boats posted to the isolated dev server's in-memory store
  only (distinct `X-Forwarded-For` IPs; live river untouched). Far row
  is Boat-12, Boat-08, Boat-04 (row = index % 4, newest first).
- Screenshots in `~/workspace/lk-fix5/` (`f5-river-desktop.png`,
  `f5-river-desktop-late.png`, `f5-river-desktop-later.png`,
  `f5-river-mobile.png`, `f5-temple-crop.png`): in every shot, every
  far-row tag crossing the temple is fully readable, drawn over the
  prangs — the re-audit's exact case (a tag cut by the central prang)
  now reads "Boat-10" / "Boat-11" on the central prang's shaft, dark
  pill with gold border, in `f5-temple-crop.png` (2x crop of the late
  shot). Mobile: Boat-10's tag over the temple edge is fully readable.
- Clicks still reach the main canvas through the tag layer: probe
  (`cdp_probe.py`) shows tag canvas 674x560 = main canvas 674x560,
  `pointer-events: none`, `elementFromPoint` over the temple returns
  the main canvas, and a real click on a boat opened its wish panel
  ("Test wish number 7…" — Boat-07) in `f5-click-test.png`.
- Reduced-motion static frame (`f5-river-reduced-motion.png`,
  `--force-prefers-reduced-motion`): boats AND tags present, Boat-04 /
  Boat-12 tags readable over the prangs — the tag pass runs in the
  same shared `draw()` the static frame uses.
- Mobile topbar (`f5-topbar-mobile.png`, 390px): nav links on row 1,
  EN/ไทย + the sound toggle (icon only, label hidden as before)
  together on row 2 — the toggle is on the same row as EN/ไทย, no
  longer alone. Desktop topbar (`f5-topbar-desktop.png`) is exactly
  as before: all controls on one row.
- Observed, pre-existing, NOT fixed (out of scope, same behaviour
  before this round): when two boats drift close together their tags
  can overlap each other (e.g. Boat-10/Boat-11, Boat-01/Boat-12 in
  the shots) — tag-on-tag, not temple occlusion.
- Not verified: live-browser behaviour on a real device. Nothing is
  pushed or deployed.

## D1 — Event store + nickname/recovery-ID gate (2026-11-07)

Restoration chunk D1. Full evidence note + screenshots + the CDP script:
`~/workspace/lk-restore-d1/EVIDENCE.md` (and `verify_d1.py`,
`d1-gate.png`, `d1-gate-key.png`, `d1-gate-restore.png`, `d1-visit.png`,
`d1-react.png`). Nothing pushed, nothing deployed; no test wishes posted
to the live river (the test wishes lived in the isolated :3201 servers'
in-memory stores and died with them; a second run followed the gate
correction).

### What changed

- `lib/events.ts` (new) — client event store, localStorage `loy:events`,
  `recordEvent` / `hasEvent` / `removeEvent` / `eventsFor`, all 12 kinds
  (`visit_place`, `react`, `float`, `float_slot`, `quiz`, `blessing`,
  `candle`, `gratitude`, `share`, `finale`, `flight_done`, `flight_skip`),
  deduped by day+kind+ref, SSR-safe, day from `bangkokDay()`. Each record
  is mirrored fire-and-forget to `POST /api/event` with the `x-visitor-id`
  header (skipped when no identity exists yet). Semantics ported from the
  HTML's `recordEvent`/`hasEvent`.
- `lib/identity.ts` (new) — nickname + 10-digit recovery ID
  (crypto.getRandomValues, first digit 1–9; `createIdentity`,
  `restoreIdentity`, `getIdentity`/`getVisitorId`), stored as JSON under
  `loy:identity`. No eID, no email, no password, nothing personal.
- `components/IdentityDialog.tsx` (new) — the sign-up / sign-in **gate,
  the whole first page**: while it is up the site is not rendered at all
  (no hero, no passport, no river, no wall — not even in the DOM or the
  SSR HTML). Sign-up: nickname → ID shown big with a copy button + "only
  way back" message → Enter. Sign-in: nickname + 10-digit ID; malformed
  IDs rejected with a friendly error. EN/TH strings inline in the
  component; `lib/i18n.ts` untouched. The /admin page keeps its own
  password and is out of scope.
- `app/api/event/route.ts` (new) — POST `{kind, ref}` (optional
  `remove: true`), kind validated against the 12 kinds, ref string/number,
  requires `x-visitor-id` (10 digits), rate-limited 5/min/IP in its own
  bucket (scope `event`), server log in Redis `loy:events:<recovery-id>`
  (in-memory fallback), deduped server-side too.
- `lib/store.ts` — `recordServerEvent` / `removeServerEvent`; `checkRateLimit`
  gained an optional `scope` (default `''` = the existing float bucket,
  unchanged).
- Wiring: `app/page.tsx` `visit()` records `visit_place` (ref = day number,
  only while the night is open, mirroring the HTML's `recordVisit`);
  `components/useReactions.ts` records `react` on add, removes it on
  toggle-off. The gate is the page's first render: `app/page.tsx` returns
  only the gate while it is up or undecided (tri-state `boolean | null`,
  so SSR and first paint agree and the site never flashes, not even for
  a frame). (First version rendered the gate as an overlay over the site;
  corrected 2026-11-07 ~09:55 to the full first-page gate per Faiq's
  confirmed shape — see the correction note in
  `~/workspace/lk-restore-d1/EVIDENCE.md`.)
- `app/globals.css` — `.id-gate` / `.id-card` / `.id-key` styles.

### Verification

- **Build**: delivered tree `rm -rf .next && npm run build` — **pass,
  clean** (TypeScript strict + lint), `/` 39.2 kB / 126 kB First Load JS
  (was 123 kB), `/api/event` listed as a dynamic route. Clean-copy build
  in `~/workspace/lk-restore-d1/build-copy/` also passes.
- **Browser (headless Chromium, CDP, `verify_d1.py`) — 21/21 pass**: gate
  shows on a fresh profile with no dismiss path, and the site content is
  NOT reachable behind it (no `.page`/`.hero`/`.dest`/`.wish-card` in the
  DOM); sign-up generates a 10-digit ID (`6222109252` on the final run)
  and enters the site (`.page` renders); reload keeps the same identity
  with no gate and the site renders; clearing storage brings the gate
  back and hides the site again; restore rejects `123` with "That key
  does not look right — it must be exactly 10 digits." and accepts
  `1234567890`; with the page time-travelled to 2026-11-18, clicking
  Bangkok writes `[{day:"2026-11-18",kind:"visit_place",ref:1}]` to
  `loy:events` and a second click leaves exactly one entry; reacting to
  the floated test wish writes a `react` event with the wish id, and
  toggling the reaction off removes it. **SSR check by curl**: the
  server-rendered HTML contains only the gate (nickname input,
  `id-gate-title`) and no `.page`, hero, destination strip or wish wall —
  even with JS disabled, only the gate is served.
- **API (curl, same :3201 server)**: valid kind → 200 `recorded:true`;
  repeat → 200 `recorded:false` (server dedupe); the browser-synced
  `visit_place` for visitor `1234567890` → `recorded:false`, proving the
  browser's fire-and-forget sync reached the server log; invalid kind →
  400 `unknown_kind`; missing header → 401 `missing_visitor`; malformed
  id → 400 `invalid_visitor`; bad ref type → 400 `invalid_ref`;
  `{remove:true}` → `removed:true` then `removed:false`; rate limit →
  `200 200 200 200 200 429`.

### Decisions the plan did not specify

- **Separate rate-limit bucket** for events (`checkRateLimit` scope
  `event`): event traffic can never eat the float budget and block someone
  from floating. The 5/min/IP trip still holds for the event endpoint.
- **Server dedupe + `remove` support** in the route, mirroring the client
  semantics so the future `me.events` stays truthful.
- **Gate strings inline** in the dialog (D1 adds no `lib/i18n.ts` keys).
- **No "view my key later" affordance yet**: after entering, there is no
  in-site way to re-view the recovery ID — a follow-up for a later chunk
  (e.g. in the My Krathong panel).
- **Events before sign-up are local-only**: the sync is skipped silently
  when no identity is stored (in practice the gate precedes any event).

### What could not be verified

- **Copy button, clipboard path**: in headless Chromium
  `navigator.clipboard.writeText` did not complete and the legacy
  `execCommand('copy')` did not report success — but the fallback
  selection held the full ID, so the key is one Ctrl/Cmd+C away. The
  clipboard-write success path (button flipping to "Copied ✓") needs one
  check in a real browser with clipboard permission.
- **Redis path**: no Redis credentials on this box, so the server event log
  was exercised only through the in-memory fallback. Re-run one
  `POST /api/event` with the Upstash vars set to confirm
  `loy:events:<id>` lands in Redis.
- **Visit in real time**: today is 2026-11-07 (phase `before`), so the
  visit click was verified with a Date override freezing the page at
  2026-11-18 noon Bangkok; the real-night click is the same code path.
- **Restore pulling progress**: by design D1 restore only stores the ID
  locally — cross-device progress restore is E1, and the sign-in copy
  says so plainly.
- **Grandfathered visits** carry no `visit_place` event (events are stamped
  with the day recorded; the HTML's missions only count events on the
  night's own date), so those visitors re-visit on the night for the
  visit mission — the HTML behaves the same in its archive phase.

## Kalimba swap — Thai cover, seamless loop, 2026-11-07 ~12:25–13:05

Replaces the CC0 "Kalimba Atmosphere" track with Faiq's own Thai kalimba
cover. Faiq's requirement (voice, 2026-11-07 ~12:25, supersedes the
"trim only if needed" brief): the loop must be SEAMLESS and INFINITE —
never ends, no audible seam at the loop point. A plain `loop=true` on the
raw file would click every 99 s, so the seam is baked into the shipped
file with ffmpeg. Nothing river-related was touched; nothing pushed or
deployed.

### 1. Source and measurements

- New track: Thai kalimba cover by artist "nid", supplied by Faiq.
  Original: `workspace/user/files/kalimba-cover-by-nid-ndtdf-1.mp3`,
  99.0 s, 48 kHz stereo MP3, 1.78 MB, 143 kb/s. The original was NOT
  modified (md5 `936e339d5c89d06a112c9e3aedd52e58`, checked before and
  after; the shipped file is a processed copy).
- Measured (Faiq's numbers, confirmed independently): first 1 s mean
  −15.6 dB / max −7.5 dB, BUT the first 0.56 s is silence below −50 dB
  (silence 0 → 0.564 s); last 1 s mean −17.6 dB / max −4.8 dB — the
  music is still playing loud at the very end, a hard cut, no fade-out
  in the last 3 s. Independent re-measurement agreed on the decisive
  facts: 0.564 s leading silence (first sample above −50 dB at
  0.5643 s), continuous playing for the whole 99 s (no silent gaps),
  overall RMS −12.47 dB, peak −1.17 dB, loudnorm −9.93 LUFS — 11 dB
  louder than the previous track (−21.01 LUFS) — and a tail that decays
  to −25.6 dB in the final 100 ms but is cut mid-decay.
- Old track kept in place for now: `public/audio/kalimba-calm.mp3`
  (846 KB, 52.8 s) is untouched; `public/audio/firework.mp3` is
  untouched.

### 2. Processing (ffmpeg, one filter graph)

An earlier draft used a 1.5 s fade-out instead of a crossfade; that was
superseded by the seamless-loop requirement and the file was replaced,
never shipped. The shipped file is built as:

```
atrim=0.5643 (trim leading silence), volume=-11.08dB (level-match),
asplit=3 -> body X[2.5:95.9357], tail X[95.9357:98.4357], head X[0:2.5]
acrossfade(tail, head, d=2.5, c1=qsin, c2=qsin) -> blend
concat(body, blend) -> 95.9357 s, libmp3lame -q:a 3, 48 kHz stereo
```

Why this construction: the blend ends with the head faded in to full
(X[2.5]) and the file restarts at X[2.5], so the loop point is
continuous by construction and every part of the trimmed track appears
exactly once per period. The crossfade is equal-power (qsin), not
triangular, so there is no level dip in the middle of the blend. No
crossfade was considered against the opening attack — the attack is
preserved, it is the tail that fades under it.

- Shipped file: `public/audio/kalimba-thai-cover.mp3`, 820,581 bytes,
  md5 `a6b5137962b35c0bb0cd8bfb2a562142`, duration 95.94 s.
- Level check on the shipped file: RMS −23.50 dB, loudnorm −20.94 LUFS
  (old track −21.01 — 0.07 LUFS apart), peak −11.75 dBTP, LRA 1.50 LU.
  The two channels are near-identical (max |ch0−ch1| 0.0068) — the
  cover is effectively mono.
- The filter did what was designed: expected-vs-actual blend
  correlation 0.9983, body 1.0000 (the 0.0017 is MP3 re-encode noise).
  The one dip in the blend region is the music's own phrasing (a
  −31.8 dB breath between phrases at X≈96.1 s), reproduced exactly.
- `lib/audio.ts`: only `MUSIC_URL` changed to
  `/audio/kalimba-thai-cover.mp3` plus the header comment. ALL playback
  behaviour is unchanged: fade-in ~2 s, volume 0.25, `loop=true`, starts
  on the visitor's first pointerdown/keydown, sound toggle
  (`components/SoundToggle.tsx`), preference in localStorage
  (`loy:sound`), pauses when the tab is hidden. Firework SFX untouched.

### 3. File-level seam verification (Python, decoded WAV)

Looped signal = file ++ file, analysed sample by sample:

- Max sample-to-sample step at the exact seam: 0.0191 (48 kHz mono)
  vs global max step 0.0441 and p99.9 0.0197 — the seam step is
  ordinary, not an outlier.
- At 44.1 kHz stereo × 0.25 volume (exactly what a browser tap sees):
  exact seam step 0.00719; seam ±50 ms max step 0.00875 (0.24× the
  local peak — a normal musical step); elsewhere p99 0.00423, max
  0.01006 — the seam step sits inside the normal range.
- RMS in 50 ms windows across the loop boundary: −21.8, −23.7, −23.9,
  −23.7, −25.7 dB — continuous, no silence hole, no spike.
- Verdict at file level: PASS — the shipped file loops seamlessly.

### 4. Browser verification (headless Chrome 158, clean-copy `next start`)

Served a clean copy (`/tmp/lk-kalimba-verify`, `next start -p 3202`)
and drove Chrome via CDP. Note: the D1 identity gate is in this tree,
so verification signed up with a test nickname ("KalimbaTest…") and
entered the site; the gate itself was not under test.

- Before any click: 0 `<audio>` elements.
- After a REAL CDP mouse click: audio `kalimba-thai-cover.mp3`,
  `paused === false`, `currentTime` advancing (0.68 → 1.69 s), volume
  ramping through the fade-in to 0.25, `loop === true`,
  duration 95.94 s.
- Toggle OFF (real click on the sound toggle): `paused === true`,
  `localStorage loy:sound === 'off'`. Reload: gate skipped (identity
  persisted), no audio element, toggle reads "Sound off", pref still
  'off'. Toggle ON (real click): `paused === false`, `currentTime`
  advancing (1.15 → 1.93 s), volume ramping back to 0.25.
- Loop crossing: seek to `duration − 1.2`, `currentTime` wraps
  (96.17 → 0.02), playback continues, exactly one wrap event, no
  errors. `npm run build` clean in the delivered tree (final state).

### 5. The tap dropout — what it is and what it is not (read this)

Playing through the loop point was also recorded through a Web Audio
tap (`MediaElementSource` → `ScriptProcessor`, then repeated with an
`AudioWorklet` tap, which runs on the audio thread). Both taps record
the SAME thing at the loop point: a ~35–66 ms near-silence dropout
(1–1.5 AudioContext buffers) straddling the wrap, with a resumption
step of ~0.020–0.026. Control runs: ZERO dropouts in 134 callbacks of
normal playback and a clean mid-file seek — the dropout appears ONLY
at the loop, in 3/3 runs. The resumption step is smaller than the
piece's own pluck transients (max 0.054 in normal playback), so the
step is not the issue; the brief silence is.

The dropout is in the TAP, not in the shipped playback path:

- `chrome://media-internals` for the native (untapped) player
  (player_id 4, this run) shows the native loop seek taking ~5 ms
  (`kEnded` 03.355 → `seek_target 0` 03.360 → `kPlaying` 03.361),
  NO underflow events, NO errors, `BUFFERING_HAVE_ENOUGH` throughout.
  The element resumes in 5 ms; the tap's ~35–66 ms is one AudioContext
  buffer flushed at the seek — the tap's buffering, not the element's
  output.
- The old file's loop was tested the same way: its seam is quiet by
  design (RMS −65 dB around the loop), so it shows no resumption step;
  it cannot distinguish the mechanism, only that a quiet seam hides
  any tap artefact.
- One more artefact of the headless environment, not of the file: the
  demuxer's end-of-file duration reads 96.16946 s vs the metadata
  duration 95.935708 s (0.234 s of trailing MP3 padding in the
  demuxer's accounting). The rendered audio contains no 0.23 s of extra
  silence — a tap would have shown a 5-buffer dropout; it shows ~1–1.5
  buffers — so this is timestamp accounting, not played audio.
- Minor observation, no user impact: one partial dropout buffer also
  appears immediately after a seek to `duration − 1.2` (seek flush);
  the site never seeks in normal use.

### 6. What could NOT be verified — stated plainly

- Audible seamlessness to a human ear: headless Chrome has no audio
  output. State and waveform were verified, not sound. The file is
  proven seamless at sample level and the native loop is proven fast
  and clean at the pipeline level, but a final listen on a real machine
  (Faiq's PC, his Bangkok connection) is the only complete check.
- The native (untapped) path's waveform cannot be verified headlessly:
  any waveform tap goes through the same `MediaElementSource` handoff
  that produces the ~35–66 ms dropout, so the tap cannot prove or
  disprove a gap in the path the visitor actually hears. What the
  evidence supports: the file is seamless, and Chrome's native loop of
  this gapless-tagged MP3 seeks in ~5 ms with no underflow.
