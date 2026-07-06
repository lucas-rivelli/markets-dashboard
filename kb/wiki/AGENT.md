# Wiki Agent — Cursor Session Playbook

> **You are the wiki maintainer.** Karpathy pattern: raw inbox is read-only; you write `kb/wiki/`.
> **Do not** call `ANTHROPIC_API_KEY` or external LLM APIs. Author markdown yourself in this session.

## Before you start

1. Read `kb/wiki/WIKI.md` (schema + page types).
2. Read `kb/wiki/RUN.md` (today's queue and lint snapshot).
3. Search first: `npm run wiki:search -- "<topic>"`.

## Daily run (every queued item)

For each id in `kb/wiki/queue.json` → `pending[]`:

### 1. Load raw source (read-only)

```text
kb/inbox/<id>.json
```

Use `content_text`, `content_html`, `content_kind`, `highlights`, `folders`, `tags`. Never edit the JSON.

### 2. Write or rewrite `sources/<id>.md`

Required YAML frontmatter:

```yaml
type: source
id: <sha256>
title:
url:
source:
category:
date:
saved_at:
content_kind:
folders: []
tags: []
tickers: []
themes: []
summary:        # 2-4 sentences you write
agent_status: done
agent_enriched_at: <ISO timestamp>
inbox_path: kb/inbox/<id>.json
updated_at: <ISO timestamp>
```

Body sections (your prose, cited to the source):

- **Summary** — what this piece argues
- **Key Claims** — bullet list of falsifiable claims
- **Evidence** — quotes from highlights or body; note thread vs article vs transcript
- **Tensions** — conflicts with other saved sources (wikilink them)
- **Links** — `[[concepts/...]]`, `[[entities/...]]`, `[[overview]]`

### 3. Update concept pages

For each folder on the source, update `concepts/<slug>.md`:

- Merge synthesis across sources (do not duplicate pages).
- Add this source id to `sources:` frontmatter list.
- Cross-link related concepts.

### 4. Update entity pages

Tickers (`$FOO` in text), people, companies → `entities/<slug>.md`.

### 5. Log + index

After the batch:

```bash
npm run wiki:index   # if you add a script, else rebuild via ingest index only:
node -e "require('./lib/wiki-ingest').rebuildIndex()"
npm run kb:index
```

Append to `kb/wiki/log.md`:

```markdown
## [<ISO>] agent | Daily wiki run
- processed: <id1>, <id2>, ...
```

Regenerate `kb/wiki/index.md` (run `node -e "require('./lib/wiki-ingest').rebuildIndex()"`).

### 6. Overview + tensions

If new sources change the thesis, revise `overview.md`.

Append real contradictions to `tensions.md` (cite both sources).

### 7. Clear queue + verify

Remove processed ids from `kb/wiki/queue.json` `pending` array (or run `npm run wiki:daily` to resync).

```bash
npm run wiki:lint
```

Fix RED issues before committing.

### 8. Ship

```bash
git add kb/wiki kb/index.json
git commit -m "Wiki agent: enrich <N> sources"
git push origin main
```

## Query workflow (any time)

When the user asks a markets question:

1. `wiki:search` → read top pages.
2. Synthesize with citations to `[[sources/<id>|Title]]`.
3. If the answer is valuable, file `queries/<slug>.md` and link from concepts.

## Lint workflow

`npm run wiki:lint` — fix schema gaps, orphans, overview drift. You may edit frontmatter; do not delete pages without user approval.

## Hard rules

- Never edit `kb/inbox/*.json`.
- Never use Anthropic/OpenAI API keys for wiki work.
- Prefer updating existing concept/entity pages over creating duplicates.
- Note X `content_kind`: thread vs article vs note changes how you summarize.
