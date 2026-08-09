# SOTA — State of the Art

> Single source of truth for **where this project is and where it's going**.
> Read this to plan. For operational detail (setup, env vars, commands), see [HANDOFF.md](HANDOFF.md).
> Update this file whenever the direction changes.

*Last updated: August 6, 2026*

---

## 1. Vision

A personal **learning environment** for markets, macro, and ideas — not just a feed reader.
The end state is a funnel:

```
FIREHOSE  →  TRIAGE  →  LIBRARY
(all new     (theme      (saved items, enriched into a
 content)     tagging)    queryable knowledge base)
```

- **Firehose** — merged timeline of everything published by followed sources. Job: coverage.
- **Triage** — LLM auto-tags items by *theme* (not just source), so browsing is by idea: `semis`, `macro-rates`, `AI-capex`, `crypto`…
- **Library** — saved items enriched into `kb/inbox/<id>.json` (full text, folders, tags, highlights). `kb/index.json` + `GET /api/library` for search. Git is the database; Claude Code / Cursor over the repo is the query engine.

Design principle: knowledge lives in **plain text files in git** — versioned, portable, and directly operable by LLM tools. No external database.

## 2. What exists today (working)

Vanilla JS + Vercel serverless. No build step, no framework.

```
index.html          → entire frontend (HTML + CSS + JS in one file)
api/feed.js         → GET /api/feed — SOURCES array lives here
api/manual-link.js  → POST /api/manual-link — add one-off links from the UI
api/writing.js      → GET/POST/DELETE /api/writing — create and edit personal writings
api/cron.js         → GET /api/cron — Vercel cron, 7 AM ET daily
lib/aggregate.js    → fetches RSS feeds, merges Spotify + bookmarks + saved links + writings
lib/spotify.js      → Spotify Web API (saved shows → episodes, last 7 days)
lib/bookmarks.js    → reads data/bookmarks.json (GitHub at runtime in prod)
lib/kb-index.js     → builds the Library read model from kb files
lib/writings.js     → reads/writes data/writings.json (GitHub at runtime in prod)
data/bookmarks.json → X bookmarks, synced from Mac via birdclaw
data/manual-links.json  → user-added article/video/podcast links
data/writings.json      → personal articles written in-app
data/workspace.json     → synced folders, tags, mailbox state (cross-device)
kb/                 → repo-backed knowledge base database
scripts/            → dev server, Spotify OAuth, bookmark sync, setup check
```

**Sources:** ~9 RSS feeds (Substacks, blogs, YouTube), Spotify podcast episodes (dynamic), X bookmarks (birdclaw → git), manual saved links from `data/manual-links.json`, personal writings from `data/writings.json`, and **Lucas Briefing** from `data/briefings.json`. Full list in `api/feed.js`.

**Features:** merged Latest timeline · in-app Add link for one-off articles/videos/podcasts · **Writing** rail for authoring pieces that join the same Inbox/folder/tag flow · daily **Lucas Briefing** (~10 min morning digest) · Sources launchpad grouped by category · email-style item states (`Inbox`, `Trash`) plus folders/tags · search by title/source · morning cron + first-visit-of-day live fetch · manual refresh (`?fresh=1`) · 30-min edge cache.

**Item shape** (from `lib/aggregate.js`):

```js
{ id, source, category, title, link, date, snippet, contentHtml, writingId?, briefingId? }
```

`id` is a stable SHA-256 hash of `link`. `contentHtml` is sanitized body HTML for Substack posts (from the feed), personal writings, and Lucas Briefing digests. Writings also carry `writingId` (the record key in `data/writings.json`). Briefings carry `briefingId` (key in `data/briefings.json`).

Categories: `Substack | YouTube | Blog | Macro/Official | Spotify | Bookmarks | Investing | Writing | Briefing`.

## 3. Hard constraints

- Feed items still flow through the API and vanish past the feed cap (10/feed, 100 total), but every returned item now has a stable `id`.
- Item mailbox state syncs through `/api/workspace` as `item_status`; `read` keys are now only seen/fade markers, not category state.
- Cross-device writes persist workspace state, including deletions/restores. New devices pair via `?sync=<SAVE_SECRET>` or `#sync=<SAVE_SECRET>`. Workspace **pulls + pushes every 5 minutes**; manual ↻ Sync pushes immediately. `scripts/vercel-ignore.sh` skips Vercel deploys for workspace/cache-only commits.
- Feed auto-refreshes every **5 minutes** via a free external cron (see `docs/automation.md`) or GitHub Actions templates — no Vercel Pro.
  Vercel Hobby cron is daily backup only. Edge cache on `/api/feed` is 5 minutes.
- Local dev writes `data/feed-cache.json` and refreshes in the background every 5 minutes.
- Frontend shows the last feed snapshot instantly, then syncs in the background.
- Spotify rate-limits hard in dev mode (HTTP 429 with multi-hour penalties). `lib/spotify.js` persists its episode cache **and** the rate-limit cooldown to `data/spotify-cache.json` (via the GitHub Contents API in production) so cold serverless instances never re-burst the API. Ordinary `/api/feed` builds always serve the persisted cache; live Spotify refresh only runs on daily cron / `?fresh=1` once the 6h TTL has elapsed. Cache-only commits skip Vercel deploys (`scripts/vercel-ignore.sh`).
- X bookmarks sync via external cron → `/api/trigger-bookmarks` → GitHub Actions. Production reads `data/bookmarks.json` from GitHub at runtime; bookmark-only commits skip Vercel deploys. The trigger endpoint skips dispatch when a sync is already running (prevents failure/email pile-ups when a job hangs). Hourly cron is optional hygiene; a healthy 5-minute cadence is fine.
- Keep the stack vanilla: no build step, no framework. `index.html` is self-contained.

## 4. Design language (July 2026 redesign)

Aesthetic: **old, special, sacred. Minimalist. Built for learning.** The reference is a
rubricated manuscript / private reading room — not a SaaS dashboard.

- **Paper, not panels.** One flat aged-paper background (`#f3ecdd`; rail slightly deeper `#efe6d3`, selection `#e9dcc0`). No cards, no shadows, no gradients, no glassmorphism. Regions separated by hairline rules (`#d8cbae` / `#e4dac2`).
- **One typeface.** EB Garamond everywhere (Google Fonts). UI labels in letterspaced small caps; body in warm ink (`#292018`).
- **Rubrication.** A single accent — deep vermilion `#7f2a1a` — marks what matters: active folder, inbox dot, links, graph nodes. Like red ink in a manuscript. Gold `#96762f` is reserved for flourishes (folder tags).
- **Category inks** (muted manuscript pigments, text-only — no pill backgrounds):
  Substack `#a04f1e` · YouTube `#9a2b21` · Blog `#5e4370` · Spotify `#3e6b4e` · Bookmarks `#3a5684` · Macro `#7c5a26` · Writing `#6b3f2a` · Briefing `#3d4f5f`.
- **Ornament with restraint.** A fleuron (❦) as brand mark / empty-state; ❧ marks folders; ✦ marks the inbox. A drop-cap opens the reading pane. Double rule under the top bar. Nothing else.
- Seen or processed items fade (opacity), like ink that has been absorbed.

Anti-goals: emoji in UI, rounded pill-everything, drop shadows, bright saturated colors, dark mode (parchment is the identity).

### Layout — email-style workspace (shipped)

`index.html` is now a full-viewport four-region workspace, not a reading column:

```
top bar: ☰ Tags · ❦ MARKETS READING · updated · ＋ Add · ↻ Sync · ❦ Map (drawer on narrow)
┌ RAIL ────┬ MESSAGE LIST ──┬ READING PANE ─────┬ ASIDE ───────┐
│ Learning │ source·title·  │ opened item or    │ Tag map      │
│ Room     │ snippet rows,  │ Sources / Writing │ above recent │
│ Inbox    │ email-style,   │ editor; embeds +  │ read links   │
│ All      │ filtered by    │ articles          │              │
│ Trash    │ tag+search+    │ Open · states ·   │              │
│ Sources  │ folder state   │ Tag ❧             │              │
│ Writing  │                │                   │              │
│ + tags   │                │                   │              │
└──────────┴────────────────┴───────────────────┴──────────────┘
```

- **Add link** in the top bar posts to `/api/manual-link` using the same `SAVE_SECRET` header as workspace sync. Links are stored in `data/manual-links.json` (GitHub in production), merged by `/api/feed`, and appear in Inbox like normal feed items. The server auto-detects YouTube, Spotify, and X/Twitter links and tries to read page title/description when the user leaves them blank.
- **Writing** (`activeView=writing`) lists personal pieces from `data/writings.json`. **＋ New writing** creates via `POST /api/writing` (same `SAVE_SECRET` / GitHub persistence as manual links), lands in Inbox with category `Writing`, and opens an in-reader editor (title + contenteditable body styled like Substack `article-body`). Saved bodies render inline like Substack posts; Edit/Save/Done stay in the reader. Writings use the same folders, tags, Inbox/Trash, highlights, and KB save funnel as any other item. Synthetic links are `https://writing.local/<writingId>`; stable feed `id` remains the SHA-256 of that link. Commits that only touch `data/writings.json` skip Vercel deploys via `scripts/vercel-ignore.sh`.
- **Lucas Briefing** is a normal feed source (`category: Briefing`, source name `Lucas Briefing`) stored in `data/briefings.json`. A morning GitHub Action (`briefing:daily`) gathers Google News RSS packets (global, Brazil, watched companies, special topic from `data/briefing-config.json`), synthesizes HTML via OpenRouter, and upserts today’s piece (`briefingYYYYMMDD`). Bodies render inline like Substack; Inbox/folders/tags/highlights apply as usual. No personal Writing editor. Commits that only touch `data/briefings.json` skip Vercel deploys.
- **Folders + tags** sync across devices via `GET/PUT /api/workspace` → `data/workspace.json` (GitHub in production). localStorage is a fast cache; the remote workspace is the cross-device source of truth. **Multi-select** in the list: ⌘/Ctrl+click, Shift+click, bulk bar, and Gmail-style keys (J/K, X, E, #, /, ?). **Folder ❧** and **Tag** assign items (bulk-aware). Folders are email-style hierarchical paths (`Parent/Child`); creating a subfolder auto-creates ancestors, and renaming/moving/excluding a parent updates descendant paths plus item assignments. Moving an item to a folder replaces its current folder location; moving it to Inbox clears folder assignment.
- **Mailbox states** sync across devices as `item_status`: new items start in **Inbox**; opening an Inbox item only fades it as seen and does not move it. Items move to **Trash** or back to **Inbox** only when chosen from the reader or context menu. Assigning any folder removes the item from Inbox so it rests only in that folder; filing from Trash restores the item into the folder. Trash is hidden from folders, tags, and the graph except in the Trash view. **To-read is now a normal tag**, not a mailbox state.
- **Reading pane** embeds YouTube (`youtube-nocookie`), Spotify, and X/Twitter status links; Substack posts and Lucas Briefings render sanitized body HTML inline when available. Other articles show a drop-cap preview + "Open original" (publishers often block iframing). Select text inside the reader and a small **Highlight** toolbar appears above the selection to save a synced quote under `item_highlights`; clicking a marked passage opens **Remove highlight**. Saved quotes render below the article and matching text is marked when possible. When `GET /api/library` has an enriched note for the item, its summary renders inline ("From your notes") — the Phase 3 hook.
- **Right column** stacks the hand-rolled SVG tag map on top and **Recent Read** below. The recent list uses the existing seen/read history, updates when an item is opened, and lets you jump back to recently visited articles.
- **Ask the KB** markup exists but is hidden (`display: none`); retrieval/LLM is deferred (Phase 3).

### Responsive (shipped)

| Breakpoint | Behavior |
|------------|----------|
| **>1200px** | Four columns visible |
| **≤1200px** | Hide aside column; **❦ Map** opens fixed right drawer (`data-aside`) |
| **≤820px** | Single-column drill-down: list **or** reader (`data-mobile`); **☰ Tags** opens left rail drawer (`data-rail`); **‹ Back** returns to list |
| **≤480px** | Compact top bar: hide idle "Updated …" line; Sync shows ↻ only |

**Mobile UX details (July 2026):**

- **Sources** auto-opens the reader pane on narrow screens (fixes empty launchpad).
- **Rail navigation while reading** — picking Inbox/All/Trash/folder/tag from the rail drawer returns to the list pane, even with an article open.
- **Drawer scrim** — tap outside rail/map to dismiss; Escape closes drawers then reader.
- **History API** — OS back button matches in-app Back (`pushState` / `popstate`).
- **Safe area** — `100dvh` shell, `env(safe-area-inset-*)` on topbar and drawers.
- **Touch** — 44px min tap targets on primary controls; tag popovers anchor bottom-center on mobile.

- **localStorage keys:** `markets_item_status`, `markets_item_added`, `markets_item_highlights`, `markets_read` (seen/fade marker), `markets_folders`, `markets_item_folders`, `markets_item_titles`, `markets_tags`, `markets_item_tags`, `markets_feed_snapshot`, `markets_workspace_updated`, `markets_save_secret`, `markets_list_filter_folder`, `markets_list_filter_tag`.

## 5. Roadmap (agreed direction)

**Phase 1 — identity + save (in progress).**
Backend: stable item ID = SHA-256 hash of `link`; `POST /api/save` writes `kb/inbox/<id>.json`.
`GET /api/library` builds the Library index from `kb/inbox/*.json` and `kb/notes/*.md`.
Production saves commit through the GitHub Contents API; locally, saves write to the filesystem when no GitHub token is set.
`npm run kb:index` writes `kb/index.json`.

**Triage → Library funnel (July 2026):**
- New inbox items auto-receive the **To-read** tag (including Spotify; Spotify is still excluded from `kb/` saves).
- When an item is **filed to a folder** and no longer carries **To-read**, it is saved to `kb/inbox/<id>.json` with folders, tags, highlights, and fetched body text when available.
- **X/Twitter** saves pull full tweet/thread text via FxTwitter (`content_kind`: `tweet`, `thread`, `note`, or `article`).
- **YouTube** saves pull captions/transcript via `youtube-transcript` (`content_kind`: `video_transcript`).
- Enrichment into `kb/notes/*.md` and in-app “ask the KB” remain deferred.

Production env vars for saves and manual link writes:
`GITHUB_TOKEN` or `GH_TOKEN` (Contents read/write), optional `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`,
and required `SAVE_SECRET` when GitHub-backed saves are enabled. Frontend should send the secret as
`X-Save-Secret` or `Authorization: Bearer ...`.

Frontend mailbox state is now built: **Inbox** and **Trash** replace the old Save/Read/To-read actions. **Folder ❧** and **Tag** remain for classification, including a user-created To-read tag. Mobile drill-down, drawer scrim, and History API back stack shipped July 2026.

> Note: the local dev server must be **restarted** to pick up the `/api/save` and `/api/library`
> routes if it was started before they were added (`npm run dev`).

**Phase 2 — triage tagging.**
Folders + colored tags ship in the UI and sync via `/api/workspace`. LLM auto-tagging of the firehose remains deferred (`data/tags.json`).

**Phase 3 — knowledge base (July 2026).**
`kb/inbox/<id>.json` on save when filed without To-read; enrichment for X/YouTube via `lib/kb-enrich.js`. `kb/index.json` + `GET /api/library` for search. Deferred: compiled notes layer, in-app “ask the KB” UI.

**Deferred:** in-page "ask the KB" endpoint (Claude Code over the repo does this better) ·
Notion mirror for mobile browsing · email digest.

## 6. Database Structure

Plain files are the database:

```text
kb/
  inbox/<id>.json          raw saved item, append-only
  notes/<id>.md            future compiled notes (not populated yet)
  index.json               generated Library read model
  schema/                  JSON schemas + note template
data/
  tags.json                generated/committed theme tags by item id
```

`kb/index.json` and `GET /api/library` expose:
`schema_version`, `generated_at`, `counts`, `facets`, and `items[]`.
Facets: `themes`, `tickers`, `folders`, `tags`, `sources`, `categories`, `types`, `content_kinds`, `statuses`.
Each index item includes `id`, `title`, `url`, `source`, `category`, `type`, `date`, `saved_at`,
`status`, `themes`, `tickers`, `folders`, `tags`, `content_kind`, `content_text`, `highlight_count`,
`summary`, `snippet`, paths to the inbox/note files, and `search_text`.

## 7. Open decisions

- Tag **everything** in the firehose (better browsing) vs **saved-only** (cheaper, simpler)?
- Enrichment runner: GitHub Action on push to `kb/inbox/` vs local script on the Mac?

## 8. Working conventions (for Cursor / Claude sessions)

- Read [Claude.md](Claude.md) for agent-facing UI contracts (mobile datasets, DOM ids, localStorage).
- Push to GitHub after every change — Vercel auto-deploys `main`.
- `npm run dev` for local (not `vercel dev`); loads `.env.local`.
- The JS in `index.html` depends on these contracts — don't rename without updating CSS + JS:
  body datasets `data-mobile`, `data-rail`, `data-aside`;
  regions `.rail .list-col .reader-col .aside .drawer-scrim`;
  controls `.rail-item .msg .filter-btn .action-btn`, `#search`, `#list-container`, `#reader-back`,
  `#rail-toggle`, `#aside-toggle`, `#drawer-scrim`, `#updated-line`, `#failed-line`, `#btn-refresh`.
- Respect the design language in §4 for any UI work.
- Update **this file** (§4/§5 especially) and **Claude.md** when UI behavior or direction changes.
