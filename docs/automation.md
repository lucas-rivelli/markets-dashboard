# Free automation (no Vercel Pro)

These workflows keep the live site fresh without a paid Vercel plan.
Copy them into `.github/workflows/` after running `gh auth refresh -s workflow`.

## feed-refresh.yml

Pings `/api/feed` every 5 minutes to warm the Vercel edge cache used by the page.

**Required** repo variable: `SITE_URL` — your real production URL from the
Vercel dashboard (project → Domains). The old default
`https://markets-dashboard.vercel.app` belongs to another project and 404s.

If Vercel **Deployment Protection** is enabled, requests get a 302 to Vercel SSO.
Either disable it for Production, or create a **Protection Bypass for Automation**
secret (Vercel → Project → Settings → Deployment Protection) and add it as
GitHub secret `VERCEL_BYPASS_SECRET`.

## sync-bookmarks.yml

Syncs X bookmarks when `AUTH_TOKEN` and `CT0` GitHub secrets are set, then exports
the rolling last-year window to `data/bookmarks.json`.
Run `npm run setup:github-x-secrets` once to copy cookies from Safari into GitHub secrets.
Commits `data/bookmarks.json` back to the repo. Production reads that file via the GitHub
Contents API, and bookmark-only commits skip Vercel deploys (`scripts/vercel-ignore.sh`).

**Do not rely on GitHub's built-in `schedule` cron** — it often runs hourly (or worse),
not on a reliable cadence. Use the external cron below instead.

### External cron (recommended — hourly, no Mac)

1. Run `npm run setup:external-cron` — validates env vars and prints exact URLs.
2. **Vercel env vars** (Settings → Environment Variables):
   - `CRON_SECRET` — same secret used by `/api/cron` (`openssl rand -hex 32`)
   - `GITHUB_DISPATCH_TOKEN` — fine-grained PAT on `markets-dashboard` with **Actions: Read and write**
   - `VERCEL_BYPASS_SECRET` — only if Deployment Protection is on
3. Redeploy Vercel after adding vars.
4. Create a free job at [cron-job.org](https://cron-job.org):
   - URL: `https://YOUR-SITE-URL/api/trigger-bookmarks`
   - Schedule: **every 60 minutes** (every 5 minutes used to flood Actions → failure / X login emails)
   - Method: GET
   - Header: `Authorization: Bearer YOUR_CRON_SECRET`
   - Optional header: `x-vercel-protection-bypass: YOUR_BYPASS_SECRET`
5. Test: `npm run ping:bookmarks-cron`

The endpoint queues `workflow_dispatch` on `sync-bookmarks.yml` via the GitHub API.
If a sync is already queued/running, or one ran within the last hour, `/api/trigger-bookmarks`
returns `200` with `skipped: true` instead of stacking another run. Override interval with
`BOOKMARKS_SYNC_MIN_INTERVAL_MS`; set `BOOKMARKS_SYNC_PAUSED=true` to hard-stop dispatches.

Optional second cron-job.org job for feed cache:

- URL: `https://YOUR-SITE-URL/api/feed`
- Schedule: every 5 minutes (no auth header)
- Note: ordinary `/api/feed` warmers serve the Spotify episode cache; live Spotify
  refresh only runs on daily `/api/cron` or `?fresh=1` after the 6h TTL.

## Alternative: local ping scripts

```bash
CRON_SECRET=your_secret ./scripts/ping-bookmarks-cron.sh
CRON_SECRET=your_secret ./scripts/ping-cron.sh
```
