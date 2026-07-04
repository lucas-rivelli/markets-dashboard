# Markets Dashboard — Project Handoff

> Read this file first when opening a new chat to continue work on this project.

## Current resume point — July 4, 2026, 3:15 PM

- Spotify is working locally: `/api/feed?fresh=1` returned `failed: []`, `spotifyEpisodes: 65`, `total: 152`.
- Spotify now loads all saved podcast shows, limits episodes to the past 7 days, excludes `Posse de Bola`, and fetches shows in parallel to avoid Vercel timeout.
- Local dev server was restarted and is running at `http://localhost:3000`.
- Twitter/X bookmarks are working locally after Safari login and Full Disk Access: birdclaw synced 70 bookmarks and `data/bookmarks.json` was exported successfully.
- Local `/api/feed?fresh=1` verified `failed: []`, `bookmarks: 70`, `bookmarkItems: 70`, `total: 157` after Twitter export.
- Spotify hit temporary `HTTP 429` rate limits after repeated testing; code now backs off, lowers concurrency, and prevents one rate-limited show from marking the whole Spotify source unavailable. Let the rate limit cool down before re-testing Spotify repeatedly.
- To refresh bookmarks again:

```bash
npm run setup:check
npm run sync:bookmarks
```

- `scripts/sync-bookmarks.sh` now loads `.env.local` and stops on auth failure instead of overwriting bookmarks with an empty export.
- Changes are saved on disk but not committed/pushed yet. Review `git status --short` before committing.

## What this is

Personal **markets reading dashboard** — one page that merges RSS feeds (Substack, blogs, YouTube), Spotify podcast episodes, and X bookmarks into a single timeline with read/unread tracking.

- **Repo:** https://github.com/lucas-rivelli/markets-dashboard
- **Deploy:** Vercel (auto-deploy on push to `main`, team scope `knowledgemaxxing`)
- **Live URL:** check Vercel dashboard → project → Domains. Note: `markets-dashboard.vercel.app` belongs to **another project** — do not use it.
- **Local dev:** `npm run dev` → http://localhost:3000

## Architecture

```
index.html          → UI (vanilla JS, white Substack-style theme)
api/feed.js         → GET /api/feed — merges all sources into JSON
api/cron.js         → GET /api/cron — morning cron (Vercel, 7 AM ET)
lib/aggregate.js    → RSS fetch + merge Spotify + bookmarks
lib/spotify.js      → Spotify Web API (saved shows → new episodes, 7 days; excludes Posse de Bola)
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

birdclaw is a **local dev dependency** (no global install needed). Already initialized at `~/.birdclaw`.

```bash
npm install
npm run birdclaw:init    # already done if ~/.birdclaw exists
npm run setup:check      # diagnose what's left
npm run sync:bookmarks   # after X auth (see below)
```

**X auth options (pick one):**

1. **Browser cookies (easiest):** Log into [x.com](https://x.com) in Safari or Chrome, then run `npm run sync:bookmarks`. Safari may need Full Disk Access for Terminal/Cursor in System Settings → Privacy.
2. **X archive (no live API):** Request at [x.com/settings/download_your_data](https://x.com/settings/download_your_data), then `npx birdclaw import archive ~/Downloads/twitter-archive-*.zip --select bookmarks --json`
3. **Manual cookies:** Set `AUTH_TOKEN` and `CT0` in `.env.local` (from browser dev tools → Application → Cookies → x.com)


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
npm run setup:check    # diagnose Spotify + X setup
npm run dev              # local server :3000 (loads .env.local)
npm run birdclaw:init    # one-time birdclaw workspace
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
│   ├── dev.js           ← local dev server (loads .env.local)
│   ├── setup-check.js   ← diagnose Spotify + X setup
│   ├── spotify-auth.js
│   ├── sync-bookmarks.sh
│   └── export-bookmarks.js
├── vercel.json          ← cron config
└── package.json
```

---

*Last updated: July 4, 2026*
