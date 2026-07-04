# Knowledge Base

This folder is the database. Keep it plain, boring, and friendly to git diffs.

## Layers

`inbox/` is raw saved input. One JSON file per saved feed item, named `<id>.json`. These files are append-only: saving an item creates the file, but enrichment should not rewrite it.

`notes/` is the compiled wiki. One markdown file per enriched item, named `<id>.md`, with YAML frontmatter followed by human-readable notes.

`index.json` is a generated read model for the app. It is built from `inbox/` and `notes/`, so it can always be regenerated.

`schema/` describes the file shapes and note template agents should follow.

## Item Identity

`id` is the SHA-256 hash of the canonical item URL. The same URL should always map to the same file names:

```text
kb/inbox/<id>.json
kb/notes/<id>.md
```

## Saved Item

Saved records use this shape:

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
  "snippet": "Short excerpt"
}
```

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

The app can also read the live index from `GET /api/library`, which builds the same structure from files.
