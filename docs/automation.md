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

Syncs all retrievable X bookmark pages every 5 minutes when `AUTH_TOKEN` and `CT0` GitHub secrets are set, then exports the rolling last-year window to `data/bookmarks.json`.
Run `npm run setup:github-x-secrets` once to copy cookies from Safari into GitHub secrets.
Commits `data/bookmarks.json` back to the repo so Vercel redeploys with fresh bookmarks.

## Alternative: cron-job.org (no GitHub Actions)

1. Create a free job at [cron-job.org](https://cron-job.org)
2. URL: `https://YOUR-SITE-URL/api/feed` (check Vercel dashboard → Domains)
3. Schedule: every 5 minutes
4. If Deployment Protection is on, add header `x-vercel-protection-bypass: YOUR_BYPASS_SECRET`

Or run locally / from any scheduler:

```bash
CRON_SECRET=your_secret ./scripts/ping-cron.sh
```
