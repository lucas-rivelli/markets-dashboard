# Knowledge Base

This folder is the database. Keep it plain, boring, and friendly to git diffs.

## Layers

`inbox/` is raw saved input. One JSON file per saved feed item, named `<id>.json`. These files are append-only: saving an item creates the file, but enrichment should not rewrite it.

**When items land here (July 2026):** the UI auto-saves when an item is filed to a folder and no longer has the **To-read** tag. Spotify is tagged in the UI but excluded from KB writes. Saved records include folders, tags, highlights, Substack `content_html` when available, plus enriched `content_text` for X (tweet/thread/note/article) and YouTube transcripts.

`notes/` is the compiled layer (future per-item markdown notes). Not populated yet.

`index.json` is a generated read model for the app. It is built from `inbox/` and `notes/`, so it can always be regenerated.

`schema/` describes the file shapes and note template agents should follow.

## Item Identity

`id` is the SHA-256 hash of the canonical item URL. The same URL should always map to the same file names:

```text
kb/inbox/<id>.json
kb/notes/<id>.md
```

## Saved Item

Saved records use this shape (see `schema/saved-item.schema.json`):

```json
{
  "schema_version": 1,
  "id": "64-char sha256",
  "status": "saved",
  "title": "Title",
  "url": "https://example.com/item",
  "source": "Source",
  "category": "Substack",
  "date": "2026-07-04T12:00:00.000Z",
  "saved_at": "2026-07-04T18:00:00.000Z",
  "themes": [],
  "tickers": [],
  "type": "article",
  "snippet": "Short excerpt",
  "folders": ["Macro"],
  "tags": ["on-going"],
  "highlights": [{ "id": "h1", "text": "Quote", "created_at": null }],
  "content_html": "",
  "content_kind": "thread",
  "content_text": "Full tweet thread or YouTube transcript…",
  "content_meta": { "platform": "x", "thread_length": 5 }
}
```

`content_kind` values: `tweet`, `thread`, `note`, `article`, `video_transcript`, `html` (optional).

## Index item

`index.json` items add search fields and paths (see `schema/index.schema.json`):

- `folders`, `tags`, `content_kind`, `content_text`, `highlight_count`
- `inbox_path`, `note_path`, `search_text` (concatenated for grep/LLM queries)
- Facets: `themes`, `tickers`, `folders`, `tags`, `sources`, `categories`, `types`, `content_kinds`, `statuses`

## Note Frontmatter

Notes should keep the same identity fields in frontmatter:

```yaml
---
id:
title:
url:
source:
category:
date:
saved_at:
themes: []
tickers: []
type: article
summary:
---
```

## Index

Build the index with:

```bash
npm run kb:index
```

Backfill existing filed workspace items (no To-read, not Spotify):

```bash
npm run kb:backfill
```

The app can also read the live index from `GET /api/library`, which builds the same structure from files.
