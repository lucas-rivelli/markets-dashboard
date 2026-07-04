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
top bar: ☰ Tags · ❦ MARKETS READING · updated · ↻ Sync · ❦ Map
┌ RAIL ────┬ MESSAGE LIST ──┬ READING PANE ─────┬ ASIDE ───────┐
│ Inbox    │ search + rows  │ item / Sources    │ Tag Map SVG  │
│ Saved    │                │ Save · Tag ❧      │ (chat hidden)│
│ Sources  │                │                   │              │
│ + folders│                │                   │              │
│ + tags   │                │                   │              │
└──────────┴────────────────┴───────────────────┴──────────────┘
```

**Cross-device sync:** folders, tags, item assignments, read links, and saved keys merge server-side on every `PUT /api/workspace`. Production writes need `GITHUB_TOKEN`; optional `SAVE_SECRET` + `localStorage.markets_save_secret` on each device.

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

**List:** `.msg-list`, `.msg`, `.filter-btn`, `#search`, `#list-container`, `#list-title`, `#list-count`

**Reader:** `.reader-inner`, `.reader-title`, `.action-btn`, `#btn-save`, `#btn-classify`, `#reader-back`

**Rail / tags:** `.rail-item`, `#rail-fixed`, `#rail-tags`, `#rail-add`, `#rail-toggle`

**Aside:** `#graph-wrap`, `#aside-toggle`, `#aside-close`

**Top bar:** `#updated-line`, `#failed-line`, `#btn-refresh`

**Body datasets:** `data-mobile`, `data-rail`, `data-aside`

## Design language (summary)

Parchment manuscript — EB Garamond, flat paper (`#f3ecdd`), hairline rules, vermilion rubrication (`#7f2a1a`). No cards, shadows, dark mode, or emoji UI chrome. Category colors are text-only inks. See sota.md §4 for full palette.

## localStorage keys

| Key | Purpose |
|-----|---------|
| `markets_read` | Read links (link-keyed, legacy) |
| `markets_tags` | Tag definitions `{ id, name, color }` |
| `markets_item_tags` | Item → tag id[] map |
| `markets_saved` | Saved item keys |
| `markets_feed_snapshot` | Last feed JSON for instant load |
| `markets_tags_migrated` | One-time folders→tags migration flag |

## API surface (frontend uses)

- `GET /api/feed` — merged timeline (+ `?fresh=1` force)
- `GET /api/workspace` — folders, tags, item assignments, read, saved
- `PUT /api/workspace` — merge + persist workspace (debounced from UI)
- `POST /api/save` — persist to `kb/inbox/`
- `GET /api/library` — KB index (Phase 3 hook)

## What not to do

- Add a JS framework or build step.
- Rename body `dataset` keys or break the mobile history stack.
- Add X/Twitter RSS bridges (bookmarks via birdclaw → `data/bookmarks.json`).
- Drift from manuscript aesthetic (panels, pills, shadows, dark mode).

## When you ship UI work

1. Update **sota.md** §4 (layout/mobile) if behavior changed.
2. Update **this file** if agent contracts or mobile rules changed.
3. Commit + push to `main`.
