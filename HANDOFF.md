# Markets Dashboard — Project Handoff

> Read this file first when opening a new chat to continue work on this project.
> Also read `sota.md` (vision/roadmap) and `Claude.md` (UI/API contracts).

## Current resume point — July 6, 2026, ~3:15 PM BRT

### Spotify cooldown

- `data/spotify-cache.json` → `cooldown_until`: **2026-07-06T18:45:45Z** (~**15:45 BRT**).
- Cache `items` is currently **empty** — when cooldown expires the next `/api/feed` fetch will call Spotify again. Episodes appear only if that fetch succeeds (no 429).
- **Do not** hammer `?fresh=1` while cooling down — Spotify escalates penalties (up to 24h). Cache TTL is **6 hours** when healthy.
- Check: `node -e "const c=require('./data/spotify-cache.json'); console.log(c.cooldown_until, c.items?.length)"`

### Vercel deploy (blocked)

- Hobby plan hit **100 deploys / 24h** on July 6. Latest code commits (`b38c0a7`, `36a2678`) show **"Deployment rate limited — retry in 24 hours"** on GitHub → Vercel check.
- **Production lags local** until a deploy succeeds. After limit clears: Vercel → Deployments → **Redeploy** latest commit (or push again).
- `scripts/vercel-ignore.sh` was fixed (bash 3.2, no `mapfile`) — workspace/cache-only commits should **skip** deploy once that code is live on Vercel.

### Cross-device sync

- Workspace writes batched: **pull + push every 5 min**; ↻ Sync or tab close pushes immediately.
- Pair new devices: open once with `?sync=<SAVE_SECRET>` (same value as Vercel env `SAVE_SECRET` and `.env.local`).
- Prompt "Enter sync secret" = paste `SAVE_SECRET` from `.env.local` / Vercel env vars.

### Shipped July 6 (in git `main`, may not be on Vercel yet)

- **Value Investors Club** — `lib/vic.js`, `VIC_SESSION` in env, `data/vic-cache.json`, Investing category pinned in feed.
- **Item rename** — `item_titles` in workspace.
- **Arrival dates** — `item_added` in workspace; list sorts/displays platform arrival, not RSS publish date (reader shows "Published …" when different).
- **All** rail view — every non-trash item.
- **Folder + tag filters** — `#filter-folder` / `#filter-tag` narrow any view (Inbox, All, Trash, folder, tag).
- **Gmail-style multi-select** — ⌘/Ctrl+click, Shift+click, bulk bar, J/K/X/E/# shortcuts (`?` for panel).
- **vercel-ignore** + batched workspace sync (above).

### Local vs production data

| Data | Local | Production |
|------|-------|------------|
| RSS, VIC API, manual-links | disk / env | runtime + GitHub |
| `bookmarks.json` | disk immediately | **bundled in deploy** — needs successful Vercel deploy after sync |
| `workspace.json` | disk + GitHub via API | GitHub via API |
| Spotify cache | `data/spotify-cache.json` | GitHub at runtime |

### Env vars (`.env.local` + Vercel)

| Variable | Purpose |
|----------|---------|
| `SAVE_SECRET` | Workspace + manual-link writes; device pairing |
| `GITHUB_TOKEN` / `GH_TOKEN` | Production writes to repo |
| `SPOTIFY_*` | Podcast episodes |
| `VIC_SESSION` (+ optional `VIC_REMEMBER`) | VIC authenticated ideas (~45d delay vs ~90d guest) |
| `AUTH_TOKEN` + `CT0` | GitHub Action bookmark sync |
| `CRON_SECRET` | `/api/cron`, `/api/trigger-bookmarks` |

### Key commands

```bash
npm run dev              # localhost:3000
npm run sync:bookmarks   # Mac → data/bookmarks.json
npm run setup:check      # diagnose env
```

### Recent commits (July 6)

```
36a2678 Add All view, cross-filters, and platform arrival dates in the list.
b38c0a7 Fix deploy skip script and add batched workspace sync with bulk list shortcuts.
3511284 Track inbox arrival dates and harden VIC cache loading.
42052ba Fix VIC inbox visibility and add item rename across the workspace.
```

### Open / next

- [ ] Redeploy Vercel when rate limit clears
- [ ] Confirm `SAVE_SECRET` + `VIC_SESSION` on Vercel production env
- [ ] Optional: `lib/bookmarks.js` read GitHub at runtime (bookmarks wouldn't need redeploy)
- [ ] Spotify: wait for cooldown; verify episodes return

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
lib/bookmarks.js    → reads data/bookmarks.json (deploy bundle in production)
lib/manual-links.js → reads/writes data/manual-links.json (GitHub at runtime in prod)
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

**To add a source:** edit `SOURCES` in `api/feed.js`, commit, push to GitHub.
**To add one article/video/podcast:** use the top-bar `Add` button in the app; it writes `data/manual-links.json` through `/api/manual-link`.

## Features built

- [x] Four-region manuscript workspace (rail · list · reader · aside)
- [x] Folders, tags, inbox/trash, highlights, cross-device workspace sync
- [x] All view + per-view folder/tag filters + Gmail-style bulk select
- [x] VIC ideas feed, item rename, arrival dates (`item_added`)
- [x] In-app Add link, Sources launchpad, tag map, Recent Read
- [x] Spotify episodes, X bookmarks, manual links

## Setup still needed (user action)

### Vercel environment variables

| Variable | Status | Purpose |
|----------|--------|---------|
| `SAVE_SECRET` | ✅ local + Vercel | Workspace/manual-link auth; device pairing |
| `GITHUB_TOKEN` | ✅ Vercel | Production repo writes |
| `CRON_SECRET` | ✅ | Secures cron/trigger endpoints |
| `SPOTIFY_*` | ✅ local + Vercel | Podcast episodes |
| `VIC_SESSION` | ✅ local; ⬜ confirm Vercel | VIC authenticated session |

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

- [ ] `lib/bookmarks.js` read GitHub at runtime (avoid redeploy for bookmark sync)
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
│   └── cron.js          ← morning cron handler
├── lib/
│   ├── aggregate.js     ← merge all feeds
│   ├── spotify.js       ← Spotify API
│   └── bookmarks.js     ← load bookmarks JSON
├── data/
│   ├── bookmarks.json   ← synced from birdclaw
│   └── manual-links.json ← links added from the app
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

*Last updated: July 6, 2026*
