# Markets Reading Wiki — Agent Schema

> Karpathy [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) pattern, instantiated for this repo.
> Read **Claude.md** for app contracts; this file governs wiki maintenance only.

## Three layers

| Layer | Path | Rule |
|-------|------|------|
| **Raw sources** | `kb/inbox/<id>.json` | Immutable saved items. **Never edit.** |
| **Wiki** | `kb/wiki/` | LLM-maintained markdown graph. You own this layer. |
| **Schema** | `kb/wiki/WIKI.md` | This file — workflows, page types, conventions. |

Item `id` = SHA-256 of canonical URL (same as inbox filename).

## Directory layout

```text
kb/wiki/
  WIKI.md           this schema
  index.md          content catalog (regenerated on ingest)
  log.md            append-only timeline
  overview.md       evolving synthesis (revise on material new sources)
  tensions.md       contradictions ledger
  sources/<id>.md   one summary page per inbox item
  concepts/<slug>.md   folder/topic pages (Macro, AI (markets), …)
  entities/<slug>.md     tickers, people, companies
  queries/<slug>.md      filed Q&A from exploration (optional)
```

Links use Obsidian wikilinks: `[[concepts/ai-markets|AI (markets)]]`.

## Page types & required frontmatter

All wiki pages need: `type`, `title`, `summary`, `updated_at`.

**source** — one per `kb/inbox/<id>.json`
- Sections: Summary, Key Claims, Evidence, Tensions, Links
- `inbox_path` must point at the raw JSON

**concept** — cross-source topic (usually mirrors workspace folders)
- `sources`: inbox ids[]
- Update in place when new sources share the theme

**entity** — named thing (ticker, person, company)
- `entity_kind`: ticker | person | company | other
- `sources`: inbox ids[]

**overview** — top-level synthesis; revise when lint flags drift

**tensions** — append contradictions; cite both sources

**query** — valuable answers filed back from chat (compounding explorations)

## Operations

### Ingest (automatic + manual)

Triggered when an item lands in `kb/inbox/` (UI save or backfill).

```bash
npm run wiki:ingest -- --id <sha256>   # one item
npm run wiki:ingest -- --all           # all inbox items
```

Pipeline per source:
1. Read `kb/inbox/<id>.json` (never mutate)
2. Write/update `sources/<id>.md`
3. Upsert `concepts/*` from folders
4. Upsert `entities/*` from tickers
5. Regenerate `index.md`
6. Append `log.md`

Optional LLM pass when `ANTHROPIC_API_KEY` is set (`lib/wiki-llm.js`).

### Query

Search the wiki before reading raw inbox:

```bash
npm run wiki:search -- "AI capex hyperscalers"
```

Read `index.md` → open top pages → synthesize with citations to `sources/<id>`.

**File good answers** into `queries/<slug>.md` and link from relevant concept pages.

### Lint (run periodically)

```bash
npm run wiki:lint
```

Checks: schema fields, missing `sources/*` for inbox items, orphan pages, overview drift, duplicate titles.
The linter reports only — it does not delete pages. Append lint results to `log.md`.

## Hard rules

- **Never edit** `kb/inbox/*.json` during wiki work.
- **Prefer update over duplicate** — new facts about an existing concept/entity merge into that page.
- **Cite sources** — claims should link to `[[sources/<id>|Title]]`.
- **Note tensions** — when sources disagree, append `tensions.md` don't silently overwrite.
- **Keep index current** — run ingest (or `wiki:ingest --all`) after bulk inbox changes.

## Markets domain hints

- Folders → concept pages (user's triage taxonomy)
- Tags/themes → frontmatter + search facets
- `content_kind` on X/YouTube items: respect thread vs article vs transcript in summaries
- Spotify is excluded from inbox — no wiki sources for Spotify

## Maintenance scripts

| Command | Purpose |
|---------|---------|
| `npm run kb:index` | Regenerate `kb/index.json` (app library API) |
| `npm run wiki:ingest` | Compile inbox → wiki pages |
| `npm run wiki:lint` | Health check |
| `npm run wiki:search` | Keyword search over wiki markdown |

Git is the database. Commit wiki changes with inbox saves.
