# Markets Dashboard — Project Handoff

> Read this file first when opening a new chat to continue work on this project.

## What this is

Personal **markets reading dashboard** — one page that merges RSS feeds (Substack, blogs, YouTube), Spotify podcast episodes, and X bookmarks into a single timeline with read/unread tracking.

- **Repo:** https://github.com/lucas-rivelli/markets-dashboard
- **Deploy:** Vercel (auto-deploy on push to `main`)
- **Live URL:** `https://markets-dashboard.vercel.app` (or check Vercel dashboard)
- **Local dev:** `npm run dev` → http://localhost:3000

## Architecture

```
index.html          → UI (vanilla JS, white Substack-style theme)
api/feed.js         → GET /api/feed — merges all sources into JSON
api/cron.js         → GET /api/cron — morning cron (Vercel, 7 AM ET)
lib/aggregate.js    → RSS fetch + merge Spotify + bookmarks
lib/spotify.js      → Spotify Web API (saved shows → new episodes, 14 days)
lib/bookmarks.js    → reads data/bookmarks.json
data/bookmarks.json → X bookmarks synced from Mac via birdclaw
scripts/dev.js      → local server (no Vercel login needed)
scripts/sync-bookmarks.sh  → birdclaw → JSON → git push
scripts/spotify-auth.js    → one-time OAuth to get refresh token
scripts/export-bookmarks.js → transforms birdclaw JSON → bookmarks.json
vercel.json         → cron schedule: 0 12 * * * UTC (7 AM ET)
```

## Current sources (`api/feed.js`)

| Name | Category | Feed |
|------|----------|------|
| Jordi Visser | Substack | visserlabs.substack.com/feed |
| Jordi Visser Labs | YouTube | channel UCSLOw8JrFTBb3qF-p4v0v_w |
| ARK Next Gen Internet | Substack | arknextgeninternetteam.substack.com/feed |
| Rebound Capital | Substack | reboundcapital.substack.com/feed |
| Citrini Research | Substack | citrini.substack.com/feed |
| Ray Dalio | Substack | raydalio.substack.com/feed |
| Gregory Blotnick | Blog | gregoryblotnick.com/posts/feed |
| Kyle Samani | Blog | kylesamani.com/rss.xml |
| Paul Graham | Blog | olshansk/pgessays-rss community feed |
| Consilient Observer | Macro/Official | launchpad only (no RSS) |
| Spotify Podcasts | Spotify | dynamic — Spotify Web API |
| X Bookmarks | Bookmarks | dynamic — data/bookmarks.json |

**To add a source:** edit `SOURCES` in `api/feed.js`, commit, push to GitHub.

## Features built

- [x] Merged RSS feed (Latest tab)
- [x] Sources launchpad grouped by category
- [x] White Substack-style UI with article cards + snippets
- [x] Read / unread tracking (localStorage, filter pills)
- [x] Search by title or source
- [x] Morning auto-refresh (Vercel cron + first visit each day live fetch)
- [x] Refresh button bypasses cache (`?fresh=1`)
- [x] Spotify new podcast episodes (needs env vars — see below)
- [x] X bookmarks via birdclaw → GitHub sync (needs Mac setup — see below)

## Setup still needed (user action)

### Vercel environment variables

| Variable | Status | Purpose |
|----------|--------|---------|
| `CRON_SECRET` | ⬜ user must add | Secures `/api/cron` morning job |
| `SPOTIFY_CLIENT_ID` | ⬜ user must add | Spotify app credentials |
| `SPOTIFY_CLIENT_SECRET` | ⬜ user must add | Spotify app credentials |
| `SPOTIFY_REFRESH_TOKEN` | ⬜ user must add | From `npm run spotify:auth` |

**Spotify app settings:**
- Website: `https://markets-dashboard.vercel.app` (or GitHub repo URL)
- Redirect URI: `http://127.0.0.1:8888/callback`
- API: **Web API** only

**After adding env vars:** redeploy on Vercel.

### birdclaw (X bookmarks) on Mac

```bash
npm i -g birdclaw
birdclaw init
npm run sync:bookmarks   # from project folder
```

Optional cron (8 AM daily):
```
0 8 * * * cd /path/to/markets-dashboard && ./scripts/sync-bookmarks.sh >> ~/.markets-sync.log 2>&1
```

## Conventions

- **Push to GitHub after every change** — user wants Vercel to auto-update
- **Do not use X/Twitter RSS bridges** — deferred; bookmarks use birdclaw instead
- **Local dev:** use `npm run dev`, not `vercel dev` (avoids login)
- **Paul Graham:** no official RSS; uses community feed (olshansk/pgessays-rss)
- **Morgan Stanley Consilient Observer:** no RSS; launchpad link only

## Key commands

```bash
npm install
npm run dev              # local server :3000
npm run spotify:auth     # one-time Spotify OAuth
npm run sync:bookmarks   # birdclaw → git push
git add . && git commit && git push origin main
```

## UI behavior

- **First visit each day:** live fetch from all sources
- **Same day revisits:** cached API (30 min edge cache)
- **Refresh button:** always live fetch
- **Read state:** stored in browser `localStorage` key `markets_read`
- **Categories / pill colors:** Substack (orange), YouTube (red), Blog (purple), Spotify (green), Bookmarks (blue), Macro (amber)

## Git history (recent)

```
b6424fc Add Spotify podcast episodes and birdclaw X bookmarks integration
d65c184 Add daily cron refresh and morning auto-fetch on first visit
40eab51 Drop X profile sources; add Ray Dalio Substack, reclassify Blotnick as Blog
48a788f Add Paul Graham essays via community RSS feed
46ea3c7 Add Kyle Samani blog RSS feed
```

## Backlog / ideas (not built)

- [ ] Filter tabs: All · Articles · Podcasts · Bookmarks
- [ ] X account feeds (RSS.app) — user said defer
- [ ] Morgan Stanley scraper or RSS bridge for Consilient Observer
- [ ] Email digest of unread items
- [ ] `saved.json` for manual article saves (non-RSS links)

## File map

```
markets-dashboard/
├── HANDOFF.md           ← this file
├── README.md            ← user-facing docs
├── index.html           ← frontend
├── api/
│   ├── feed.js          ← SOURCES array + /api/feed handler
│   └── cron.js          ← morning cron handler
├── lib/
│   ├── aggregate.js     ← merge all feeds
│   ├── spotify.js       ← Spotify API
│   └── bookmarks.js     ← load bookmarks JSON
├── data/
│   └── bookmarks.json   ← synced from birdclaw
├── scripts/
│   ├── dev.js           ← local dev server
│   ├── spotify-auth.js
│   ├── sync-bookmarks.sh
│   └── export-bookmarks.js
├── vercel.json          ← cron config
└── package.json
```

---

*Last updated: July 4, 2026*
