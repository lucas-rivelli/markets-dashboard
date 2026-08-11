# Markets Dashboard — Project Handoff

> Read this file first when opening a new chat to continue work on this project.
> Also read `sota.md` (vision/roadmap) and `Claude.md` (UI/API contracts).

## Current resume point — August 6, 2026

### Diagnosed (Aug 9)

- **Bookmark / “Twitter” emails every ~5 min:** cron-job.org still hits `/api/trigger-bookmarks` every 5 minutes. Starting ~21:20 UTC Aug 9, `sync-bookmarks.yml` began failing on `npm ci` (stale lockfile) → GitHub failure emails every tick. Fix: workflow uses `npm install` + soft-fails bird errors; trigger enforces **1h min interval** (and `BOOKMARKS_SYNC_PAUSED=true` hard-stops). Prefer cron-job.org at **hourly**.

### Diagnosed (Aug 6)

- **Bookmark emails:** Not a new cron. `/api/trigger-bookmarks` has fired every **5 minutes for a long time** (thousands of successful runs; Aug 5 was clean). Starting ~12:10 UTC Aug 6, Actions began failing/cancelling (`job was not acquired by runner`) — **those failures** email you. Fix (on `main`): skip dispatch when a sync is already running + 1h min interval.
- **Spotify “not appearing” in Inbox:** API still returns ~71 cached episodes, but workspace has them filed (**0 inbox / ~66 trash / ~7 folders**). Live Spotify refresh was stuck in cooldown (`cooldown_until` ~2026-08-06T22:23Z) after feed warmers re-burst the API. Ordinary `/api/feed` now always serves the cache; live refresh only on daily cron / `?fresh=1` after the 6h TTL. After cooldown ends, hit ↻ Sync once — new episodes land in Inbox.
- **VIC:** member cache refreshed Aug 9 (newest ideas ~Jun 25, ~45d delay). GitHub Actions secrets `VIC_SESSION` + `VIC_REMEMBER` are set; daily `sync-vic.yml` may still hit VIC bot/HTML blocks from Actions IPs — if so, run `npm run sync:vic` locally and push `data/vic-cache.json`. Also set both cookies on Vercel for runtime refresh.

### Local vs production data

| Data | Local | Production |
|------|-------|------------|
| RSS, VIC API, manual-links | disk / env | runtime + GitHub |
| `bookmarks.json` | disk immediately | GitHub at runtime (bookmark-only commits skip deploy) |
| `workspace.json` | disk + GitHub via API | GitHub via API |
| Spotify cache | `data/spotify-cache.json` | GitHub at runtime |

### Env vars (`.env.local` + Vercel)

| Variable | Purpose |
|----------|---------|
| `SAVE_SECRET` | Workspace + manual-link + writing writes; device unlock password + pairing |
| `GITHUB_TOKEN` / `GH_TOKEN` | Production repo writes |
| `SPOTIFY_*` | Podcast episodes |
| `VIC_SESSION` (+ `VIC_REMEMBER`) | VIC authenticated ideas (~45d delay vs ~90d guest). `vic_session` alone expires ~2h — copy remember cookie too. Set on **Vercel and GitHub Actions secrets**. |
| `AUTH_TOKEN` + `CT0` | GitHub Action bookmark sync |
| `CRON_SECRET` | `/api/cron`, `/api/trigger-bookmarks` |
| `GITHUB_DISPATCH_TOKEN` | `/api/trigger-bookmarks` → Actions dispatch |
| `BOOKMARKS_SYNC_MIN_INTERVAL_MS` | Optional; default `3600000` (1h). `0` = no interval skip |
| `BOOKMARKS_SYNC_PAUSED` | Optional; `true`/`1` skips all bookmark dispatches |

### Key commands

```bash
npm run dev              # localhost:3000
npm run sync:bookmarks   # Mac → data/bookmarks.json
npm run sync:vic         # refresh Value Investors Club cache
npm run setup:check      # diagnose env
npm run setup:external-cron  # print hourly cron-job.org instructions
```

### Open / next

- [x] Merged + deployed skip-if-active + Spotify cache serve (`4f88d74`+)
- [ ] After Spotify cooldown ends, ↻ Sync once and confirm new episodes in Inbox
- [ ] Refresh `VIC_SESSION` + `VIC_REMEMBER` (Arc login + Remember me), then `npm run sync:vic` and set GitHub secrets
- [ ] In cron-job.org: set bookmark job to **hourly** (API now rate-limits anyway)
- [ ] If emails continue before Vercel redeploys: set Vercel env `BOOKMARKS_SYNC_PAUSED=true` briefly

---

## What this is

Personal **markets reading dashboard** — one page that merges RSS feeds (Substack, blogs, YouTube), Spotify podcast episodes, and X bookmarks into a single timeline with read/unread tracking.

- **Repo:** https://github.com/lucas-rivelli/markets-dashboard
- **Deploy:** Vercel (auto-deploy on push to `main`, team scope `knowledgemaxxing`)
- **Live URL:** `https://markets-dashboard-knowledgemaxxing.vercel.app` (team `knowledgemaxxing`). Do not use `markets-dashboard.vercel.app` — different project.
- **Local dev:** `npm run dev` → http://localhost:3000

## Architecture

```
index.html          → UI (vanilla JS, white Substack-style theme)
api/feed.js         → GET /api/feed — merges all sources into JSON
api/cron.js         → GET /api/cron — morning cron (Vercel, 7 AM ET)
lib/aggregate.js    → RSS + Spotify + VIC + bookmarks + manual links
lib/vic.js          → Value Investors Club API (session cookie)
lib/spotify.js      → Spotify Web API (saved shows → new episodes, 7 days; excludes Posse de Bola)
lib/bookmarks.js    → reads data/bookmarks.json (GitHub at runtime in prod)
lib/manual-links.js → reads/writes data/manual-links.json (GitHub at runtime in prod)
lib/writings.js → reads/writes data/writings.json (GitHub at runtime in prod)
lib/workspace-state.js → workspace merge logic
data/workspace.json → synced folders, tags, mailbox, highlights, item_added, item_titles
data/vic-cache.json → VIC ideas cache
data/spotify-cache.json → Spotify episodes + rate-limit cooldown
scripts/vercel-ignore.sh → skip deploy for workspace/cache-only commits
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
| Value Investors Club | Investing | dynamic — `lib/vic.js` + `data/vic-cache.json` |
| Spotify Podcasts | Spotify | dynamic — Spotify Web API |
| X Bookmarks | Bookmarks | dynamic — data/bookmarks.json |
| Saved Links | Bookmarks/auto | dynamic — in-app Add link → data/manual-links.json |
| Writing | Writing | dynamic — in-app Writing rail → data/writings.json |

**To add a source:** edit `SOURCES` in `api/feed.js`, commit, push to GitHub.
**To add one article/video/podcast:** use the top-bar `Add` button in the app; it writes `data/manual-links.json` through `/api/manual-link`.
**To write a piece:** open **Writing** in the rail → **＋ New writing**; it writes `data/writings.json` through `/api/writing`.

## Features built

- [x] Four-region manuscript workspace (rail · list · reader · aside)
- [x] Folders, tags, inbox/trash, highlights, cross-device workspace sync
- [x] All view + per-view folder/tag filters + Gmail-style bulk select
- [x] VIC ideas feed, item rename, arrival dates (`item_added`)
- [x] In-app Add link, Sources launchpad, tag map, Recent Read
- [x] Spotify episodes, X bookmarks, manual links
- [x] In-app Writing (personal articles in the same mailbox/folder/tag flow)

## Setup still needed (user action)

### Vercel environment variables

| Variable | Status | Purpose |
|----------|--------|---------|
| `SAVE_SECRET` | ✅ local + Vercel | Workspace/manual-link/writing auth; device unlock password + pairing |
| `GITHUB_TOKEN` | ✅ Vercel | Production repo writes |
| `CRON_SECRET` | ✅ | Secures cron/trigger endpoints |
| `SPOTIFY_*` | ✅ local + Vercel | Podcast episodes |
| `VIC_SESSION` + `VIC_REMEMBER` | ✅ local session (refresh if rejected); ⬜ Vercel + GitHub Actions secrets | Daily VIC cache via sync-vic.yml |

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
- **Recent Read:** right-column quick links are derived from `markets_read`, newest opens first
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

- [ ] Morgan Stanley scraper or RSS for Consilient Observer
- [ ] Email digest of unread items

## File map

```
markets-dashboard/
├── HANDOFF.md           ← this file
├── README.md            ← user-facing docs
├── index.html           ← frontend
├── api/
│   ├── feed.js          ← SOURCES array + /api/feed handler
│   ├── manual-link.js   ← /api/manual-link in-app saved links
│   ├── writing.js       ← /api/writing personal articles
│   ├── save.js          ← /api/save knowledge-base writes
│   └── cron.js          ← morning cron handler
├── lib/
│   ├── aggregate.js     ← merge all feeds
│   ├── spotify.js       ← Spotify API
│   └── bookmarks.js     ← load bookmarks JSON
├── data/
│   ├── bookmarks.json   ← synced from birdclaw
│   ├── manual-links.json ← links added from the app
│   └── writings.json    ← personal articles from Writing rail
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

*Last updated: August 6, 2026*
