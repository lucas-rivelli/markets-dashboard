# SOTA — State of the Art

> Single source of truth for **where this project is and where it's going**.
> Read this to plan. For operational detail (setup, env vars, commands), see [HANDOFF.md](HANDOFF.md).
> Update this file whenever the direction changes.

*Last updated: July 4, 2026*

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
- **Library** — a Karpathy-style knowledge base: saving an item triggers enrichment (full text → structured markdown note with summary, key claims, tickers, themes) stored as **one file per item in `kb/` in this repo**. Git is the database; Claude Code / Cursor over the repo is the query engine ("what have I saved on the AI capex cycle, and where do authors disagree?").

Design principle: knowledge lives in **plain text files in git** — versioned, portable, and directly operable by LLM tools. No external database.

## 2. What exists today (working)

Vanilla JS + Vercel serverless. No build step, no framework.

```
index.html          → entire frontend (HTML + CSS + JS in one file)
api/feed.js         → GET /api/feed — SOURCES array lives here
api/cron.js         → GET /api/cron — Vercel cron, 7 AM ET daily
lib/aggregate.js    → fetches RSS feeds, merges Spotify + bookmarks
lib/spotify.js      → Spotify Web API (saved shows → episodes, last 7 days)
lib/bookmarks.js    → reads data/bookmarks.json
lib/kb-index.js     → builds the Library read model from kb files
data/bookmarks.json → X bookmarks, synced from Mac via birdclaw
data/workspace.json     → synced folders, tags, read + saved keys (cross-device)
kb/                 → repo-backed knowledge base database
scripts/            → dev server, Spotify OAuth, bookmark sync, setup check
```

**Sources:** ~9 RSS feeds (Substacks, blogs, YouTube), Spotify podcast episodes (dynamic), X bookmarks (birdclaw → git). Full list in `api/feed.js`.

**Features:** merged Latest timeline · Sources launchpad grouped by category · email-style item states (`Inbox`, `Saw`, `Read`, `Trash`) · search by title/source · morning cron + first-visit-of-day live fetch · manual refresh (`?fresh=1`) · 30-min edge cache.

**Item shape** (from `lib/aggregate.js`):

```js
{ id, source, category, title, link, date, snippet, contentHtml }
```

`id` is a stable SHA-256 hash of `link`. `contentHtml` is sanitized RSS body HTML for Substack posts when the feed provides it.

Categories: `Substack | YouTube | Blog | Macro/Official | Spotify | Bookmarks`.

## 3. Hard constraints

- Feed items still flow through the API and vanish past the feed cap (10/feed, 100 total), but every returned item now has a stable `id`.
- Item mailbox state syncs through `/api/workspace` as `item_status`; legacy `read` keys remain for compatibility.
- Feed auto-refreshes every **5 minutes** via a free external cron (see `docs/automation.md`) or GitHub Actions templates — no Vercel Pro.
  Vercel Hobby cron is daily backup only. Edge cache on `/api/feed` is 5 minutes.
- Local dev writes `data/feed-cache.json` and refreshes in the background every 5 minutes.
- Frontend shows the last feed snapshot instantly, then syncs in the background.
- Spotify rate-limits on repeated testing (HTTP 429) — code backs off, but don't hammer it.
- Keep the stack vanilla: no build step, no framework. `index.html` is self-contained.

## 4. Design language (July 2026 redesign)

Aesthetic: **old, special, sacred. Minimalist. Built for learning.** The reference is a
rubricated manuscript / private reading room — not a SaaS dashboard.

- **Paper, not panels.** One flat aged-paper background (`#f3ecdd`; rail slightly deeper `#efe6d3`, selection `#e9dcc0`). No cards, no shadows, no gradients, no glassmorphism. Regions separated by hairline rules (`#d8cbae` / `#e4dac2`).
- **One typeface.** EB Garamond everywhere (Google Fonts). UI labels in letterspaced small caps; body in warm ink (`#292018`).
- **Rubrication.** A single accent — deep vermilion `#7f2a1a` — marks what matters: active folder, inbox dot, links, graph nodes. Like red ink in a manuscript. Gold `#96762f` is reserved for flourishes (folder tags).
- **Category inks** (muted manuscript pigments, text-only — no pill backgrounds):
  Substack `#a04f1e` · YouTube `#9a2b21` · Blog `#5e4370` · Spotify `#3e6b4e` · Bookmarks `#3a5684` · Macro `#7c5a26`.
- **Ornament with restraint.** A fleuron (❦) as brand mark / empty-state; ❧ marks folders; ✦ marks the inbox. A drop-cap opens the reading pane. Double rule under the top bar. Nothing else.
- Processed items (`Saw`, `Read`, `Trash`) fade (opacity), like ink that has been absorbed.

Anti-goals: emoji in UI, rounded pill-everything, drop shadows, bright saturated colors, dark mode (parchment is the identity).

### Layout — email-style workspace (shipped)

`index.html` is now a full-viewport four-region workspace, not a reading column:

```
top bar: ☰ Tags · ❦ MARKETS READING · updated · ↻ Sync · ❦ Map (drawer on narrow)
┌ RAIL ────┬ MESSAGE LIST ──┬ READING PANE ─────┬ ASIDE ───────┐
│ Inbox    │ source·title·  │ opened item or    │ Tag map      │
│ Saved    │ snippet rows,  │ Sources launchpad;│ (SVG graph,  │
│ Sources  │ email-style,   │ embeds + articles │ clickable)   │
│ + tags   │ filtered by    │ Open · Save ·     │              │
│          │ tag+search+    │ Tag ❧             │              │
│          │ read state     │                   │              │
└──────────┴────────────────┴───────────────────┴──────────────┘
```

- **Folders + tags** sync across devices via `GET/PUT /api/workspace` → `data/workspace.json` (GitHub in production). localStorage is a fast cache. **Folder ❧** and **Tag** assign items; on **Save**, folder names + tag names go to `POST /api/save` as `themes`.
- **Mailbox states** sync across devices as `item_status`: new items start in **Inbox**; opening an Inbox item moves it to **Saw**; items can be moved to **Read**, **Trash**, or back to **Inbox** from the reader or context menu. Trash is hidden from Saved, folders, tags, and the graph except in the Trash view.
- **Reading pane** embeds YouTube (`youtube-nocookie`), Spotify, and X/Twitter status links; Substack posts render sanitized RSS body HTML inline when available. Other articles show a drop-cap preview + "Open original" (publishers often block iframing). When `GET /api/library` has an enriched note for the item, its summary renders inline ("From your notes") — the Phase 3 hook.
- **Tag map** (right column / drawer) is hand-rolled SVG: central "Inbox" node, radial spokes per tag, node size ∝ item count, click to filter. Grows as you classify.
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
- **Drawer scrim** — tap outside rail/map to dismiss; Escape closes drawers then reader.
- **History API** — OS back button matches in-app Back (`pushState` / `popstate`).
- **Safe area** — `100dvh` shell, `env(safe-area-inset-*)` on topbar and drawers.
- **Touch** — 44px min tap targets on primary controls; tag popovers anchor bottom-center on mobile.

- **localStorage keys:** `markets_item_status`, `markets_read` (legacy/read compatibility), `markets_folders`, `markets_item_folders`, `markets_tags`, `markets_item_tags`, `markets_saved`, `markets_feed_snapshot`, `markets_workspace_updated`, `markets_save_secret` (optional).

## 5. Roadmap (agreed direction)

**Phase 1 — identity + save.**
Backend is in place: stable item ID = SHA-256 hash of `link`; `POST /api/save` normalizes an item into
`kb/inbox/<id>.json`. `GET /api/library` builds the Library index from `kb/inbox/*.json` and
`kb/notes/*.md`. In production, saves commit through the GitHub Contents API. Locally, if no GitHub
token is configured, saves write to the filesystem for testing. `npm run kb:index` writes the generated
`kb/index.json` snapshot.

Production env vars for saves:
`GITHUB_TOKEN` or `GH_TOKEN` (Contents read/write), optional `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`,
and required `SAVE_SECRET` when GitHub-backed saves are enabled. Frontend should send the secret as
`X-Save-Secret` or `Authorization: Bearer ...`.

Frontend is now built: the reading pane has **Save** (POST to `/api/save`) and **Tag ❧**
(assignment → sent as `themes` on save). Save degrades gracefully to a local marker if the endpoint is
unavailable. Mobile drill-down, drawer scrim, and History API back stack shipped July 2026.

> Note: the local dev server must be **restarted** to pick up the `/api/save` and `/api/library`
> routes if it was started before they were added (`npm run dev`).

**Phase 2 — triage tagging.**
Folders + colored tags ship in the UI and sync via `/api/workspace`. LLM auto-tagging of the firehose remains deferred (`data/tags.json`).

**Phase 3 — enrichment → knowledge base (Karpathy LLM wiki).**
Deferred. Save/inbox plumbing exists but enrichment, notes, and “ask the KB” are future work.

**Deferred:** in-page "ask the KB" endpoint (Claude Code over the repo does this better) ·
Notion mirror for mobile browsing · email digest.

## 6. Database Structure

Plain files are the database:

```text
kb/
  inbox/<id>.json          raw saved item, append-only
  notes/<id>.md            enriched wiki note with YAML frontmatter
  index.json               generated Library read model
  schema/                  JSON schemas + note template
data/
  tags.json                generated/committed theme tags by item id
```

`kb/index.json` and `GET /api/library` expose:
`schema_version`, `generated_at`, `counts`, `facets`, and `items[]`.
Each index item includes `id`, `title`, `url`, `source`, `category`, `type`, `date`, `saved_at`,
`status`, `themes`, `tickers`, `summary`, `snippet`, paths to the inbox/note files, and `search_text`.

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
