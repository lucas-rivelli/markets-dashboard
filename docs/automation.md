# Free automation (no Vercel Pro)

These workflows keep the live site fresh without a paid Vercel plan.
Copy them into `.github/workflows/` after running `gh auth refresh -s workflow`.

## feed-refresh.yml

Pings `/api/cron` every 5 minutes to warm the Vercel edge cache.

Requires GitHub repo secret: `CRON_SECRET` (same value as Vercel).

Optional repo variable: `SITE_URL` (defaults to `https://markets-dashboard.vercel.app`).

## sync-bookmarks.yml

Syncs X bookmarks every 30 minutes when `AUTH_TOKEN` and `CT0` GitHub secrets are set.
Run `npm run setup:github-x-secrets` once to copy cookies from Safari into GitHub secrets.
Commits `data/bookmarks.json` back to the repo so Vercel redeploys with fresh bookmarks.

## Alternative: cron-job.org (no GitHub Actions)

1. Create a free job at [cron-job.org](https://cron-job.org)
2. URL: `https://markets-dashboard.vercel.app/api/cron`
3. Schedule: every 5 minutes
4. Request header: `Authorization: Bearer YOUR_CRON_SECRET`

Or run locally / from any scheduler:

```bash
CRON_SECRET=your_secret ./scripts/ping-cron.sh
```
