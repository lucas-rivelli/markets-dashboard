# Markets Dashboard

A personal RSS aggregator for markets reading. One page, two views:
- **Latest** — merged feed from all sources, sorted by date, with read/unread tracking and search.
- **Sources** — launchpad of all followed accounts, grouped by category.

**Continuing work in a new chat?** Read [`HANDOFF.md`](HANDOFF.md) first — it has full project state, setup TODOs, and architecture.

## Project structure

```
markets-dashboard/
├── index.html       # Frontend (vanilla JS, no build step)
├── api/
│   └── feed.js      # Vercel serverless function — edit SOURCES here
├── package.json
└── README.md
```

---

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Vercel auto-detects the `/api` directory. No build config needed.
4. Click **Deploy**. Done.

To redeploy after editing sources: commit & push, Vercel redeploys automatically.

---

## Run locally

```bash
npm install -g vercel   # one-time
cd markets-dashboard
npm install
vercel dev              # starts at http://localhost:3000
```

`vercel dev` runs both the static `index.html` and the `/api/feed.js` function locally,
matching the production environment exactly.

---

## Adding and removing sources

Open `api/feed.js`. The `SOURCES` array at the top is the only place you need to edit.

```js
{
  name: "Display Name",
  category: "Substack",          // Substack | YouTube | Blog | Macro/Official | X
  site: "https://example.com",   // homepage — used for the launchpad chip
  rss: "https://example.com/feed", // feed URL, or null for launchpad-only
}
```

---

## How to find feed URLs

### Substack
Append `/feed` to the publication URL:
```
https://PUBLICATION.substack.com/feed
```

### YouTube
Use the channel's XML feed — you need the **channel ID**, not the handle:
```
https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
```
To find `CHANNEL_ID`:
1. Go to the channel page (e.g. `youtube.com/@SomeChannel`).
2. Right-click → **View Page Source**, then search for `"channelId"`.
   Or use a tool like [commentpicker.com/youtube-channel-id.php](https://commentpicker.com/youtube-channel-id.php).

### Blogs
Try these in order until one works:
```
https://DOMAIN/feed
https://DOMAIN/rss
https://DOMAIN/rss.xml
https://DOMAIN/atom.xml
```
Most WordPress and Ghost sites use `/feed`.

---

## Spotify podcasts (new episodes)

Shows **new episodes from your saved Spotify podcasts** (last 7 days). Excludes *Posse de Bola*.

### One-time setup

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Add redirect URI: `http://127.0.0.1:8888/callback`
3. Run locally:

```bash
SPOTIFY_CLIENT_ID=your_id SPOTIFY_CLIENT_SECRET=your_secret node scripts/spotify-auth.js
```

4. Add to Vercel → **Environment Variables**:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_REFRESH_TOKEN`
5. Redeploy

The feed refresh workflow fetches Spotify automatically every 5 minutes — no Mac needed.

---

## X bookmarks (via birdclaw)

[birdclaw](https://birdclaw.sh/) syncs your X bookmarks locally on your Mac, then pushes them to GitHub.

### One-time setup on your Mac

```bash
npm i -g birdclaw
birdclaw init          # follow prompts; install xurl or bird for live sync
birdclaw sync bookmarks --mode auto --limit 100 --all --max-pages 100 --refresh --json
```

### Sync bookmarks to the dashboard

```bash
chmod +x scripts/sync-bookmarks.sh
./scripts/sync-bookmarks.sh
```

This runs birdclaw → writes the last year of retrievable bookmarks to `data/bookmarks.json` → pushes to GitHub → Vercel redeploys.

**Automate on Mac** (optional, every morning at 8 AM):

```bash
# crontab -e
0 8 * * * cd /path/to/markets-dashboard && ./scripts/sync-bookmarks.sh >> ~/.markets-sync.log 2>&1
```

Or use birdclaw's built-in scheduler (`birdclaw jobs install-bookmarks-launchd`) plus the sync script.

---

## Caching & automatic refresh

**Every 5 minutes** the GitHub Actions feed refresh workflow hits `/api/feed` and warms the Vercel edge cache — even if you don't open the page.

**When you open the dashboard** it shows the last browser snapshot instantly, then syncs in the background. While open, the page polls the feed every 5 minutes.

**Refresh button** always does a live fetch.

### One-time production setup

1. In your Vercel project → **Settings** → **Environment Variables**, add `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_REFRESH_TOKEN`.
2. In GitHub → **Settings** → **Secrets and variables** → **Actions**, add repo variable `SITE_URL` with the real Vercel production URL.
3. If Vercel Deployment Protection is enabled, add GitHub secret `VERCEL_BYPASS_SECRET`.
4. Redeploy or push a commit.

Vercel Hobby cron remains configured as a daily backup in `vercel.json`; the 5-minute refresh lives in `.github/workflows/feed-refresh.yml`.

---

## Caching (manual visits)

The API response is cached at Vercel's edge for **5 minutes**, so the dashboard stays
fast without hammering feed servers. Click **↻ Sync** in the UI to force a live fetch.
