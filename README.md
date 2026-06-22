# Markets Dashboard

A personal RSS aggregator for markets reading. One page, two views:
- **Latest** — merged feed from all sources, sorted by date, with NEW badges and search.
- **Sources** — launchpad of all followed accounts, grouped by category.

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

### X / Twitter
X removed native RSS in 2023 and its API is now paywalled.
Set `rss: null` for X accounts — they appear as launchpad links only.
If you subscribe to a third-party RSS bridge for an X account
(e.g. via [RSS.app](https://rss.app) or [Inoreader](https://www.inoreader.com)),
paste that URL in `rss:` and it will be treated as a normal feed.

---

## Caching & automatic refresh

**Every morning (7:00 AM US Eastern)** a Vercel Cron job hits `/api/cron` and fetches all RSS feeds in the background — even if you don't open the page.

**When you open the dashboard** the first time each day, it does a live fetch (`?fresh=1`) so you see overnight posts. Later visits that day use the cached API response (fast).

**Refresh button** always does a live fetch.

### One-time Vercel setup for cron

1. In your Vercel project → **Settings** → **Environment Variables**
2. Add `CRON_SECRET` — any long random string (e.g. from `openssl rand -hex 32`)
3. Redeploy. Vercel sends this secret when calling `/api/cron`.

Cron schedule is in `vercel.json` (`0 12 * * *` UTC ≈ 7 AM EST). Edit if you want a different time.

---

## Caching (manual visits)

The API response is cached at Vercel's edge for **30 minutes**
(`s-maxage=1800, stale-while-revalidate=3600`), so the dashboard stays fast and
won't hammer feed servers. Click **↻ refresh** in the UI to get fresh data when you
want it (the request bypasses the browser cache but still serves the edge cache if
it's warm).
