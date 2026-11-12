# Seven Nights of Wishes · Loy Krathong

One krathong. Seven destinations. A river of wishes.

A single-page Next.js 14 site for Loy Krathong — **Tuesday 24 November 2026**
(full moon, Bangkok). Visitors build a krathong (flower, boat colour, flame
colour, nickname, wish), float it, and watch it join a river that every
visitor sees. Wishes are stored server-side, so the river is shared, not
per-device.

## What it is

- **Night-sky hero** — hand-drawn canvas: twinkling stars, full moon with
  halo, rising khom loi lanterns, shooting stars, fireflies, and a temple
  skyline. Live countdown to 24 Nov 2026, 19:00 Bangkok time.
- **Seven-night passport** — Bangkok, Sukhothai, Chiang Mai, Ayutthaya, Tak,
  Phitsanulok, Samut Songkhram. Tapping a destination stamps a local
  passport (kept on the visitor's device only).
- **The river** — an animated canvas of dark water with a moonlit shimmer.
  One floating krathong per wish, drawn in its own colours, with the
  person's name on a tag above it. Hover to read a wish, tap to react.
  New wishes from other people arrive behind a "refresh the river" pill —
  the canvas is never yanked mid-read.
- **Float my krathong** — live SVG preview, 15 flowers, 7 boat colours,
  6 flame colours. A worry can be written too: it is **never sent, never
  stored**, and is discarded the moment the krathong floats.
- **Wish wall** — searchable, newest-first, with the five reactions
  (sathu, love, hug, care, peace).
- **Keepsake card** — after floating, download a 1080×1350 PNG of your
  krathong, drawn on a client canvas. No server call.
- English / ไทย toggle, persisted locally. Respects
  `prefers-reduced-motion`. No sign-in, no tracking, no ads.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # type-checks + production build
npm start        # serve the production build
```

## Environment

| Variable | Required | What it does |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis REST URL for the shared river |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis REST token |
| `LOY_ADMIN_TOKEN` | No | Admin password for `DELETE /api/wishes/[id]` and `GET /api/admin/export` (header `x-admin-token`), plus the `/admin` export page |

Copy `.env.example` to `.env.local` and fill in what you need.

## How shared storage works

- **With Redis set** (the real deploy): wishes are `LPUSH`ed to
  `loy:wishes` as JSON (newest first, capped at 200), reactions live in
  `loy:reactions:<id>` hashes, and posting is rate-limited to 5/minute
  per IP (`loy:rl:<ip>`). Every visitor reads the same river.
- **Without Redis** (preview / local dev): an in-memory store takes over
  automatically. The site works exactly the same, but wishes only live as
  long as that one server instance does. Nothing crashes, nothing is
  silently lost — the fallback is logged.
- **Seeds:** the river starts empty — `SEED_WISHES` in `lib/seed.ts` is an
  empty list. The eight opening wishes shipped at launch and were removed
  2026-11-11 at Faiq's call; they can be restored by putting the entries
  back in `SEED_WISHES`. Seeds are merged into `GET /api/wishes` responses
  and never written to Redis.

## API

- `GET /api/wishes` — `{ wishes, count, totalReactions }`, newest first.
- `POST /api/wishes` — `{ name?, wish, flower?, boat?, flame?, lang? }`.
  Validates lengths (wish 1–280, name ≤ 40) and a small EN+TH blocklist.
  A `worry` field, if sent, is dropped — it is never read or stored.
  201 on success, 400 on bad input, 429 past 5 posts/minute/IP.
- `POST /api/wishes/[id]/react` — `{ reaction }`, one of the five ids.
  Returns the updated counts. One reaction per type per wish per browser
  is guarded client-side (localStorage).
- `DELETE /api/wishes/[id]` — admin only. Requires `LOY_ADMIN_TOKEN`
  to be set and header `x-admin-token` to match; otherwise 404/401.
- `GET /api/admin/export?format=csv` (default) or `?format=json` — admin
  only, same token header. Downloads every wish visitors actually
  floated (no seeds, no worries — worries are never stored) as a CSV
  spreadsheet or JSON. There is also a plain `/admin` page: paste the
  token, pick a format, download the file.

## Deploy (Vercel)

Framework preset: **Next.js**. No build config needed, no `vercel.json`.
Set the two Upstash variables in the project settings (create a free
Upstash Redis database and paste its REST URL + token), plus
`LOY_ADMIN_TOKEN` if you want the delete route. Fonts are Prompt +
Sarabun via `next/font/google` (see `app/layout.tsx`); Next.js downloads
and self-hosts them at build time.

## Privacy

Wishes are public, with only the nickname typed. The worry never leaves
the visitor's device — it is not included in the POST body, not logged,
not stored, and is cleared on submit. No analytics, no cookies beyond
localStorage preferences (language, passport stamps, reacted wishes).
