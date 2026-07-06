# Claude.md — Agent session guide

> Companion to [sota.md](sota.md). Read **sota.md** for vision/roadmap; read **HANDOFF.md** for setup/env.
> Update **both this file and sota.md** when UI behavior or direction changes.

*Last updated: July 4, 2026*

---

## Before you edit

1. Read `sota.md` §4 (design language) and §8 (conventions).
2. Run locally with `npm run dev` (port 3000) — not `vercel dev`.
3. Push to `main` after changes — Vercel auto-deploys.

## Stack (do not change without explicit ask)

- **Frontend:** single file `index.html` — HTML + CSS + vanilla JS. **No build step, no framework.**
- **Backend:** Vercel serverless in `api/`, merge logic in `lib/`.
- **Sources:** `api/feed.js` → `SOURCES` array.

## UI architecture

Four-region manuscript workspace (not a feed column):

```
top bar: ☰ Tags · ❦ MARKETS READING · updated · ＋ Add · ↻ Sync · ❦ Map
┌ RAIL ────┬ MESSAGE LIST ──┬ READING PANE ─────┬ ASIDE ───────┐
│ Inbox    │ search + rows  │ item / Sources    │ Map + Recent │
│ Trash    │                │                   │ Read         │
│ Sources  │                │                   │              │
│ + folders│                │                   │              │
│ + tags   │                │                   │              │
└──────────┴────────────────┴───────────────────┴──────────────┘
```

**Cross-device sync:** folders, tags, item assignments, mailbox state, highlights, and seen/fade links merge server-side on every `PUT /api/workspace`. Production writes need `GITHUB_TOKEN`; optional `SAVE_SECRET` + `localStorage.markets_save_secret` on each device.
On a new phone/computer, open the site once with `?sync=<SAVE_SECRET>` (or `#sync=<SAVE_SECRET>`) to store the secret locally; the URL is cleaned after capture. If a write gets `401`, the UI prompts for the secret and retries once.

**Add piece:** `#btn-add-link`, rail **Add piece**, and Sources **Add piece** open the same popover for one-off article/video/podcast URLs. It posts to `POST /api/manual-link` with `X-Save-Secret` from `localStorage.markets_save_secret`, writes `data/manual-links.json` in production via GitHub Contents, refreshes `/api/feed?fresh=1`, and opens the new item in Inbox. The backend detects YouTube, Spotify, and X/Twitter categories and tries to read title/description when blank.

**Reading menu:** `#rail-toggle` (☰ Menu) and **⌘/Ctrl+S** toggle `data-folders=hidden|visible`, hiding `.rail-folders-block` (folder list + New folder). On mobile (≤820px), opening the menu also opens the rail drawer (`data-rail=open`).

**Mailbox states:** `item_status` syncs through `/api/workspace` and localStorage key `markets_item_status`. Valid values are `inbox` and `trash`. New items default to `inbox`; opening an item only marks it seen/faded via `markets_read` and does not move categories. Reader/context-menu actions can move an item to Trash or back to Inbox. Assigning any folder removes the item from Inbox so it rests only in that folder; filing an item from Trash restores it into the folder. Trash is hidden from folders, tags, and graph data except in the Trash view. To-read is a normal tag, not a mailbox state; old `saw`, `to-read`, and `read` statuses should normalize back to `inbox`.

**Folders:** Folders are hierarchical paths stored as strings in `markets_folders` / workspace `folders`, e.g. `Macro/Rates`. Item assignments in `markets_item_folders` use the same full path. Creating `Parent/Child` auto-creates ancestors. Rename, move, and exclude actions must update descendant folder paths and all item assignments, so editing a mistaken parent folder behaves like email folders/subfolders. The folder manager can move a folder to top level or under another non-descendant folder. The item folder picker is also a move action: choosing a folder replaces the item's current folder location; `Move to Inbox` clears folder assignment.

**Reader embeds:** `renderReader()` embeds YouTube via `youtube-nocookie`, Spotify via `open.spotify.com/embed`, and X/Twitter status URLs via `platform.twitter.com/widgets.js`. Substack feed items may include sanitized `contentHtml` from `lib/aggregate.js`; render that inline instead of falling back to preview text. Keep folder/tag rail free of instructional hint copy.

**Highlights:** Highlighting is contextual, not a fixed reader action button. Select text inside `.reader-body` and show a small `.reader-selection-toolbar` above the selection with `Highlight`; clicking an existing `.reader-highlight-mark` shows `Remove highlight`. Save quotes into `markets_item_highlights` / workspace `item_highlights`. Saved highlights render under the article and matching text is marked when possible. Highlight entries are `{ id, text, created_at }` by item key.

**Aside:** the right column stacks `#graph-wrap` on top and `#recent-read-list` below. Recent Read is derived from `markets_read`; opening an item moves its keys to the end of that array so the panel can render most-recent-first quick links. Fullscreen map hides the recent section.

## Mobile interaction (shipped July 2026)

Breakpoints and body `dataset` contracts — **do not rename without updating CSS + JS together**:

| Width | Layout |
|-------|--------|
| >1200px | 4 columns |
| ≤1200px | 3 columns; `.aside` = fixed right drawer (`data-aside=open\|closed`) |
| ≤820px | Single column drill-down (`data-mobile=list\|reader`); `.rail` = left drawer (`data-rail=open\|closed`) |

**Mobile behaviors:**

- **List ↔ reader:** `openItem()` → `data-mobile=reader`; **‹ Back** or OS back → list.
- **Sources on mobile:** `selectView("sources")` opens reader pane automatically (launchpad visible).
- **Drawers:** scrim `#drawer-scrim` closes rail/aside on tap; Escape closes drawers then reader.
- **History API:** `pushState({ mobile, view, id })` on reader open; `popstate` restores pane/item/sources.
- **Safe area:** `100dvh`, `env(safe-area-inset-*)` on topbar and drawers.
- **Touch:** 44px min targets on primary controls; popovers anchor bottom-center on ≤820px.
- **Narrow top bar (≤480px):** hide “Updated …” except while syncing; Sync shows ↻ only.

Helper functions in `index.html`: `isMobileLayout()`, `setMobilePane()`, `closeDrawers()`, `toggleDrawer()`, `showReaderPane()`, `wireReaderBack()`.

## DOM / class contracts

Do not rename without updating CSS selectors and JS together:

**Regions:** `.app`, `.topbar`, `.workspace`, `.rail`, `.list-col`, `.reader-col`, `.aside`, `.drawer-scrim`

**List:** `.msg-list`, `.msg`, `#search`, `#list-container`, `#list-title`, `#list-count`

**Reader:** `.reader-inner`, `.reader-title`, `.action-btn`, `#btn-folder`, `#btn-tag`, `#reader-back`, `.reader-selection-toolbar`, `.reader-highlight-mark`

**Rail / tags:** `.rail-item`, `#rail-fixed`, `#rail-tags`, `#rail-add`, `#rail-toggle`

**Aside:** `#graph-wrap`, `#recent-read-list`, `#aside-toggle`, `#aside-close`

**Top bar:** `#updated-line`, `#failed-line`, `#btn-add-link`, `#btn-refresh`

**Body datasets:** `data-mobile`, `data-rail`, `data-aside`, `data-folders`

## Design language (summary)

Parchment manuscript — EB Garamond, flat paper (`#f3ecdd`), hairline rules, vermilion rubrication (`#7f2a1a`). No cards, shadows, dark mode, or emoji UI chrome. Category colors are text-only inks. See sota.md §4 for full palette.

## localStorage keys

| Key | Purpose |
|-----|---------|
| `markets_item_status` | Item → `inbox/trash` map |
| `markets_folders` | Folder path[]; subfolders use `Parent/Child` |
| `markets_item_folders` | Item → folder path[] map |
| `markets_read` | Seen/faded item links; does not determine mailbox category |
| `markets_item_highlights` | Item → saved quote highlights |
| `markets_tags` | Tag definitions `{ id, name, color }` |
| `markets_item_tags` | Item → tag id[] map |
| `markets_feed_snapshot` | Last feed JSON for instant load |
| `markets_tags_migrated` | One-time folders→tags migration flag |

## API surface (frontend uses)

- `GET /api/feed` — merged timeline (+ `?fresh=1` force)
  - Substack items can include sanitized `contentHtml` for inline reading.
- `POST /api/manual-link` — add one-off links to `data/manual-links.json`, then merged into `/api/feed`
- `GET /api/workspace` — folders, tags, item assignments, `item_status`, highlights, seen/fade links
- `PUT /api/workspace` — persist current workspace, including deletions/restores for folders, tags, `item_status`, and highlights
- `POST /api/save` — backend KB plumbing only; no Save button in the current UI
- `GET /api/library` — KB index (Phase 3 hook)

## What not to do

- Add a JS framework or build step.
- Rename body `dataset` keys or break the mobile history stack.
- Add X/Twitter RSS bridges (bookmarks via birdclaw → `data/bookmarks.json`).
- Drift from manuscript aesthetic (panels, pills, shadows, dark mode).
- Call the Spotify API outside `lib/spotify.js`, or bypass its persisted cache/cooldown (`data/spotify-cache.json`) — dev-mode 429 penalties last hours and escalate.
- Break `scripts/vercel-ignore.sh`: commits touching only `data/workspace.json` / `data/spotify-cache.json` must NOT trigger Vercel deploys (free tier caps ~100/day).

## When you ship UI work

1. Update **sota.md** §4 (layout/mobile) if behavior changed.
2. Update **this file** if agent contracts or mobile rules changed.
3. Commit + push to `main`.
