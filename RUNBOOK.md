# Festival-night runbook — Loy Krathong (18–24 Nov 2026)

One page for the night. The site is a 7-night festival site; most
things fix themselves (fail-soft by design), but the items below need
a human. Keep this open on the night.

## Links

- Live site: https://loykrathong.web.id
- River health: `GET https://loykrathong.web.id/api/wishes` — the
  `storage` field is the health signal (`redis` = healthy, `memory` =
  fallback; see below). A watcher polls it every 5 minutes and opens a
  GitHub issue labelled `storage-alert` when it flips.
- Repo: https://github.com/faiqhayaza/loy-krathong
- Vercel project: (Faiq's dashboard — deploys run from his PC via the
  Vercel CLI; see README for the deploy steps)
- Upstash console: the `faiq-personal` Redis store (shared with other
  projects — do not delete keys outside `loy:*`)

## 1. River is on in-memory storage (`storage: 'memory'`)

**What it means:** Upstash is over its free command quota (~796K used
vs 500K free, over since 2026-11-11) or down. The app fails open: POSTs
still return 201, but each wish lives only in that one server
instance's memory — other visitors never see it, and it vanishes when
the instance recycles. Rate limits also go per-instance and are
effectively unenforceable.

**Do first (2 minutes):**
1. Export what is in Redis right now, before touching anything:
   `GET /api/admin/export?format=json` with header
   `x-admin-token: <LOY_ADMIN_TOKEN>` — save the file. (The admin
   page can also do this.)
2. Check the Upstash console: is the store over quota, or actually
   down? The quota resets **1 December**.

**Then pick one (in this order):**
- **A. Wait it out (no action)** — acceptable only if the festival
  still has days to run and the river is quiet: wishes posted during
  the outage are lost, but nothing else breaks. Not recommended on
  opening night or 24 Nov.
- **B. Enable PAYG on the Upstash store** — the store keeps working
  with the same keys and the same river; cost is per-command past the
  free quota (check the Upstash pricing page before enabling; the
  site's traffic is small — a few thousand commands a night at most).
  No code or env change needed; verify with `GET /api/wishes` until
  `storage` reads `redis` again.
- **C. Point the site at a fresh free Upstash store** — create a new
  database, set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
  in Vercel, redeploy. **Warning: the new store starts EMPTY.** There
  is no import/restore endpoint (backup is export-only), so wishes
  floated on the old store do not carry over. Only do this if the old
  store is unusable and an empty river is acceptable — export first
  (step 1) so nothing is lost without a record.

**Verify after any fix:** `GET /api/wishes` shows
`storage: 'redis'` and `redisOk: true`, then float a test wish from
your phone and check it appears on a second device. Close the
`storage-alert` issue once it does.

## 2. River looks wrong (wishes missing, counts off)

1. Check `storage` first (section 1) — a `memory` river explains
   missing wishes.
2. `GET /api/wishes` is server-cached for 30 s per instance; wait 30 s
   and re-check before concluding anything is lost.
3. Compare with the admin export (`/api/admin/export?format=json`) —
   that reads the store directly and is the ground truth.
4. If wishes are in the export but not on the river, they may be
   `reported`/`hidden` (moderation) — check `/admin`.

## 3. Export / backup (do this before any reset or store change)

- `GET /api/admin/backup` with `x-admin-token` — full JSON snapshot
  (config, wishes, per-visitor state keyed by hashed recovery ID,
  audit log). Save the file with the date in the name.
- `GET /api/admin/export?format=csv` — the wish list as CSV.
- Visitor state in a backup is keyed by a SHA-256 hash of the recovery
  ID, never the raw ID — a backup file must never carry a bearer token.

## 4. Reset (delete everything) — only if Faiq says so

`POST /api/admin/reset` with `x-admin-token` and body
`{"confirm": "RESET"}`. This deletes EVERYTHING (wishes, state,
counters) and cannot be undone. **Export first (section 3).**
The `/admin` page has the same action behind a confirmation.

## 5. Rollback a bad deploy

- Vercel dashboard → Deployments → the previous good deployment →
  **Promote to Production**. No code change needed.
- Or from Faiq's PC: `git revert <bad commit>` + redeploy via the
  Vercel CLI (see README). The repo has no tags; use the commit hash
  from the Vercel deployment's commit message.
- CI runs `tsc`, `next lint`, `next build` and the smoke tests on
  every push to `main`, so a commit that breaks the build should never
  reach production — but a bad deploy can still be a content/config
  mistake, so keep this section handy.

## 6. Admin token

- Single shared bearer token (`LOY_ADMIN_TOKEN`, sent as the
  `x-admin-token` header). It guards both read-only export and the
  destructive reset — there is no separate read-only token.
- If the token leaks: rotate it in Vercel env vars, redeploy, and tell
  anyone who needs `/admin` the new value. When `LOY_ADMIN_TOKEN` is
  unset, admin routes return 404.
- Do NOT paste the real token into chat, issues, or this runbook.

## 7. What NOT to do on festival night

- Do not delete wishes from the store without an export first.
- Do not run the Next.js 15 upgrade or any refactor during the
  festival — those are post-festival work (see PLAN.md in the audit
  fixes). The live site runs Next.js 14.2.35, which is fine for the
  7 nights.
- Do not "fix" the four cosmetic residuals (faint seam in the water,
  no boat reflection, small boats on desktop, spire under the sticky
  header) mid-festival — they are known, explained in the audit, and
  cosmetic only.
- Do not re-add the 8 seed wishes — Faiq removed them; the river
  starts empty by design.
