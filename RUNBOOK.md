# Festival-night runbook — Loy Krathong (18–24 Nov 2026)

One page for the night. The site is a 7-night festival site; most
things fix themselves (fail-soft by design), but the items below need
a human. Keep this open on the night.

## Links

- Live site: https://loykrathong.web.id
- River health: `GET https://loykrathong.web.id/api/wishes` — the
  `storage` field is the health signal (`kv` = healthy, `memory` =
  fallback; see below). A watcher polls it every 5 minutes and opens a
  GitHub issue labelled `storage-alert` when it flips.
- Repo: https://github.com/faiqhayaza/loy-krathong
- Vercel project: (Faiq's dashboard — deploys run from his PC via the
  Vercel CLI; see README for the deploy steps)
- Cloudflare dashboard: Workers & Pages → KV → namespace
  `loy-krathong-wishes` (account faiqhayaza@gmail.com). The site's KV
  API token needs Account → Workers KV Storage → Edit. The old Upstash
  `faiq-personal` Redis store is RETIRED for this site (left as-is as a
  rollback — do not delete its `loy:*` keys).

## 1. River is on in-memory storage (`storage: 'memory'`)

**What it means:** Cloudflare KV is unreachable or unconfigured. The
app fails open: POSTs still return 201, but each wish lives only in
that one server instance's memory — other visitors never see it, and
it vanishes when the instance recycles. Rate limits also go
per-instance and are effectively unenforceable.

**Do first (2 minutes):**
1. Export what is in KV right now, before touching anything:
   `GET /api/admin/export?format=json` with header
   `x-admin-token: <LOY_ADMIN_TOKEN>` — save the file. (The admin
   page can also do this.)
2. Check the likely cause, in this order:
   - **Vercel env vars** — `CLOUDFLARE_ACCOUNT_ID`,
     `LOY_KV_NAMESPACE_ID`, `LOY_KV_API_TOKEN` must all be set on
     Production (and Preview). A missing or mistyped one puts the
     whole site on memory. Fix in the Vercel dashboard, then redeploy.
   - **Token** — in the Cloudflare dashboard (My Profile → API
     Tokens), is the KV token still there and unexpired? A revoked or
     expired token fails every KV call. Create a new token with
     Account → Workers KV Storage → Edit, set it in Vercel, redeploy.
   - **Daily quota** — KV free tier is 100K reads/day and 1K
     writes/day (resets midnight UTC). Festival traffic is thousands
     of reads and dozens of writes a day, so this should not bite;
     if it does, the river recovers on its own at midnight UTC and
     nothing needs changing.

**Verify after any fix:** `GET /api/wishes` shows
`storage: 'kv'` and `redisOk: true`, then float a test wish from
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
