# Markets Reading — what this is

> This file explains the project from the **user's** point of view.
> For technical detail see [sota.md](sota.md) (vision/roadmap), [Claude.md](Claude.md) (agent contracts), and [HANDOFF.md](HANDOFF.md) (setup).

## The one-sentence version

A private reading room that gathers everything you follow about markets, macro, and ideas — newsletters, blogs, YouTube channels, podcast episodes, and your X bookmarks — into a single page that updates itself every 5 minutes.

## The problem it solves

Following a dozen good sources means checking a dozen places: Substack inboxes, YouTube subscriptions, blog feeds, Spotify releases, and bookmarks scattered across X. This dashboard replaces all of that with one timeline. You open one page and see everything new, in order, with nothing missed and nothing repeated.

## What arrives automatically

- **Substack newsletters** — Jordi Visser, Citrini Research, Ray Dalio, ARK Next Gen Internet, Rebound Capital
- **Blogs** — Paul Graham, Kyle Samani, Gregory Blotnick
- **YouTube** — new videos from followed channels
- **Spotify** — new episodes (last 7 days) from every podcast you've saved on Spotify
- **X bookmarks** — anything you bookmark on X shows up here within minutes

Everything refreshes every 5 minutes, around the clock, whether or not the page is open. Bookmark a tweet on your phone; it appears on the dashboard shortly after, no action needed.

## What the page looks like

The design is a quiet, parchment-toned reading room — one typeface, no cards or badges, a single red accent for what's unread. It's built for reading, not dashboarding.

Four regions, left to right:

1. **Rail** — Inbox (everything new), Saved, Sources, plus your folders and tags.
2. **List** — the merged timeline: source, title, snippet. Unread items carry a red mark; read items fade like absorbed ink.
3. **Reading pane** — the opened item. YouTube videos and Spotify episodes play right here; articles show a preview with a link to the original.
4. **Tag map** — a small graph of your tags that grows as you classify things; click a node to filter.

On a phone it collapses to a single column: list first, tap to read, back button returns — like a mail app.

## What you can do with an item

- **Read it** — it's marked read automatically and fades. Read state syncs across your devices.
- **Search** — by title or source, instantly.
- **Filter** — unread only, by tag, by folder, or by source.
- **Tag it** (❧) — assign your own themes (`semis`, `macro-rates`, `AI-capex`…) so you can browse by idea instead of by publication.
- **Save it** — sends it to your permanent library. Saved items are the seed of a personal knowledge base: each one is stored as a plain file in the repo, ready to be enriched with summaries and notes later.

Folders, tags, read status, and saves all sync across devices — classify on your laptop, see it on your phone.

## Where it's going

The long-term shape is a funnel:

```
FIREHOSE  →  TRIAGE  →  LIBRARY
(all new      (tag by      (saved items enriched into
 content)      theme)       a queryable knowledge base)
```

Today the firehose and manual triage are fully working. The library exists as save-plumbing; automatic enrichment (summaries, key claims, tickers per saved item) is the next phase.

## Day-to-day usage

There is nothing to maintain. Open the page, read, tag what matters, save the keepers. The only occasional chore: if X bookmarks stop updating (login cookies expire every few months), run `npm run setup:github-x-secrets` on the Mac and they resume.
