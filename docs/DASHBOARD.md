# Markets Reading — What It Does

Personal learning environment for markets, macro, and ideas. Not a generic feed reader: it merges everything you follow into one firehose, lets you triage with folders and tags, and files keepers into a git-backed knowledge base.

**Live:** https://markets-dashboard-knowledgemaxxing.vercel.app  
**Repo:** https://github.com/lucas-rivelli/markets-dashboard  

This doc describes the **personal Markets Reading app** on `main` (`index.html`). It is not [Signals](SIGNALS.md) (the FMKT 256 ticker screener) and not the course submission materials.

---

## The idea

```
FIREHOSE  →  TRIAGE  →  LIBRARY
(all new     (folders     (saved items in
 content)     + tags)      kb/ — searchable)
```

- **Firehose** — one merged timeline from every source you follow.
- **Triage** — Inbox → folders/tags → Trash; browse by idea, not only by source.
- **Library** — when you file something and drop the To-read tag, it lands in `kb/inbox/` as plain JSON in git.

Knowledge lives in **files in the repo** — versioned, portable, and usable by LLM tools. No external database.

---

## Layout

Four-region manuscript workspace (parchment aesthetic, EB Garamond):

```
top bar: ☰ Menu · ❦ MARKETS READING · updated · ＋ Add · ↻ Sync · ❦ Map
┌ RAIL ────┬ MESSAGE LIST ──┬ READING PANE ─────┬ ASIDE ───────┐
│ Inbox    │ search + rows  │ article / embeds  │ Tag map      │
│ All      │ filters        │ Writing editor    │ Recent Read  │
│ Trash    │                │ Sources launchpad │              │
│ Sources  │                │                   │              │
│ Writing  │                │                   │              │
│ folders  │                │                   │              │
│ tags     │                │                   │              │
└──────────┴────────────────┴───────────────────┴──────────────┘
```

| Width | Behavior |
|-------|----------|
| >1200px | All four columns |
| ≤1200px | Aside (map) becomes a right drawer |
| ≤820px | Phone drill-down: list **or** reader; rail is a left drawer |
| ≤480px | Compact top bar |

On mobile, OS back matches in-app Back; drawers close via scrim or Escape.

---

## What shows up in the feed

One `/api/feed` response merges:

| Source | How it gets in |
|--------|----------------|
| **RSS** | Substacks, blogs, YouTube channels in `api/feed.js` |
| **Spotify** | Saved-show episodes in a forever git cache (shallow refresh + deep backfill) |
| **X bookmarks** | Synced from Mac via birdclaw → `data/bookmarks.json` |
| **Fund letters** | Config in `data/fund-letters-config.json`; daily cache, not scraped on each request |
| **Manual links** | One-off URLs you add in the UI (articles, videos, podcasts) |
| **Writings** | Pieces you author in-app |

Categories: Substack · YouTube · Blog · Macro/Official · Spotify · Bookmarks · Writing · Letters.

New items land in **Inbox** with a **To-read** tag. List dates use when the item arrived on the platform (`item_added`), not the original publish date.

---

## Organizing

### Mailbox

- **Inbox** — new and unfiled items. Opening something only marks it seen (fades); it stays in Inbox until you file or trash it.
- **All** — every non-trash item.
- **Trash** — hidden from folders, tags, and the map unless you open Trash.

### Folders

Email-style paths (`Macro/Rates`). Filing into a folder removes the item from Inbox. Nested folders work: create/rename/move updates descendants and assignments.

### Tags

Colored labels (including **To-read**). Filter any view by folder and/or tag. The right-hand **map** is an SVG of tag relationships.

### Multi-select & shortcuts (Gmail-style)

⌘/Ctrl+click, Shift+click, bulk bar; **J/K** move, **X** select, **E** → Inbox, **#**/Delete → Trash, **/** search, **?** shortcuts panel.

---

## Reading

- **Substack / Writing** — sanitized body HTML inline when available.
- **YouTube** — embedded (`youtube-nocookie`).
- **Spotify** — episode embed.
- **X/Twitter** — status embed via widgets.js.
- **PDFs** — iframe when allowed, plus **Open PDF** if the host blocks framing.
- **Everything else** — drop-cap preview + **Open original** (many publishers block iframes).

**Highlights:** select text in the reader → small toolbar → **Highlight**. Quotes sync across devices; matching text is marked; list under the article; click a mark to remove.

**Recent Read** (aside) — quick jump back to what you opened lately.

---

## Add piece & Writing

- **＋ Add** (top bar or rail) — paste a URL; YouTube / Spotify / X are detected; title/description filled when blank. Item appears in Inbox.
- **Writing** — **＋ New writing** opens an in-reader editor (title + body). Autosaves while typing (local draft immediately, server shortly after). Same Inbox / folder / tag / highlight / KB path as feed items. No “Open original.”

---

## Sources launchpad

Rail **Sources** shows every followed account/site by category — a directory to open home pages, not only the latest posts. Fund letter firms appear here too.

---

## Sync across devices

Folders, tags, mailbox state, highlights, and seen/fade markers sync through `/api/workspace` → `data/workspace.json` in git.

1. First visit: enter the **device password** (`SAVE_SECRET`), or open with `?sync=<password>`.
2. Edits journal locally, then pull → merge → push (↻ **Sync**, tab close, or periodic).
3. Same password unlocks Add piece, Writing, and KB saves.

---

## Knowledge base funnel

1. Item arrives → Inbox + **To-read**.
2. You read, highlight, file to a folder.
3. Remove **To-read** (while filed) → `POST /api/save` writes `kb/inbox/<id>.json` (folders, tags, highlights; X/YouTube enriched with full text/transcript when possible).
4. `GET /api/library` / `kb/index.json` expose a searchable index.

Spotify follows the same funnel (file + drop To-read → `kb/inbox/` as `podcast`). `npm run sync:spotify` deep-crawls show history into the forever cache; the feed then shows the recent window plus any older episodes you already filed (folder assignments reconnect via stable episode URLs). In-app “Ask the KB” is deferred; querying with Claude/Cursor over the repo is the intended path for now.

---

## Refresh & caching

- Feed edge-cached (~5 minutes); snapshot loads instantly, then background sync.
- **↻ Sync** / `?fresh=1` forces a live rebuild when allowed.
- Spotify serves a forever-accumulated cache so serverless cold starts do not hammer rate-limited APIs.
- Morning cron warms the feed; bookmarks and fund letters refresh on their own schedules.

---

## What it is not

- Not [Signals](SIGNALS.md) — no ticker Long/Short screener on this app.
- Not a social product — personal, password-gated workspace.
- Not Notion/email digest (both deferred).
- No X/Twitter *RSS* bridges — bookmarks come from birdclaw only.

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [sota.md](../sota.md) | Vision, roadmap, design language |
| [Claude.md](../Claude.md) | Agent UI/API contracts |
| [HANDOFF.md](../HANDOFF.md) | Setup, env vars, ops |
| [automation.md](automation.md) | External cron / feed refresh |
| [SIGNALS.md](SIGNALS.md) | Separate FMKT 256 Signals app |
