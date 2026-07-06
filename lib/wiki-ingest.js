const { buildMarkdown, parseFrontmatter } = require("./wiki-frontmatter");
const {
  ensureWikiDirs,
  readWikiFileLocal,
  writeWikiFile,
  writeWikiFileLocal,
  listWikiMarkdown,
} = require("./wiki-persist");
const {
  KB_INBOX_DIR,
  slugify,
  WIKI_INDEX_FILE,
  WIKI_LOG_FILE,
  WIKI_OVERVIEW_FILE,
  WIKI_TENSIONS_FILE,
} = require("./wiki-paths");
const {
  excerpt,
  extractTickers,
  extractWikiLinks,
  listInboxIds,
  primaryText,
  readInboxRecord,
  splitClaims,
} = require("./wiki-text");

function wikilink(target, label) {
  return label ? `[[${target}|${label}]]` : `[[${target}]]`;
}

function sourcePath(id) {
  return `sources/${id}.md`;
}

function conceptPath(name) {
  return `concepts/${slugify(name)}.md`;
}

function entityPath(name) {
  return `entities/${slugify(name)}.md`;
}

function readPage(relPath) {
  const text = readWikiFileLocal(relPath);
  if (!text) return null;
  const { frontmatter, body } = parseFrontmatter(text);
  return { frontmatter, body, raw: text };
}

async function writePage(relPath, frontmatter, body, { dryRun = false } = {}) {
  const markdown = buildMarkdown(frontmatter, body);
  if (!dryRun) {
    await writeWikiFile(relPath, markdown, `Wiki: ${frontmatter.title || relPath}`);
  }
  return markdown;
}

function uniqueList(values) {
  return [...new Set(values.map((v) => String(v || "").trim()).filter(Boolean))];
}

function buildSourcePage(record, llm = null) {
  const text = primaryText(record);
  const claims = llm?.key_claims?.length ? llm.key_claims : splitClaims(text);
  const summary = llm?.summary || excerpt(text, 500) || excerpt(record.snippet, 500);
  const folders = uniqueList(record.folders || []);
  const tags = uniqueList(record.tags || []);
  const tickers = uniqueList([...(record.tickers || []), ...extractTickers(text)]);
  const conceptLinks = folders.map((name) => wikilink(conceptPath(name).replace(/\.md$/, ""), name));
  const entityLinks = tickers.map((ticker) =>
    wikilink(entityPath(ticker).replace(/\.md$/, ""), ticker)
  );

  const frontmatter = {
    type: "source",
    id: record.id,
    title: record.title,
    url: record.url,
    source: record.source,
    category: record.category,
    date: record.date || null,
    saved_at: record.saved_at,
    content_kind: record.content_kind || "",
    folders,
    tags,
    tickers,
    themes: uniqueList(record.themes || tags),
    summary,
    agent_status: "pending",
    inbox_path: `kb/inbox/${record.id}.json`,
    updated_at: new Date().toISOString(),
  };

  const highlights = Array.isArray(record.highlights) ? record.highlights : [];
  const evidence =
    highlights.length > 0
      ? highlights.map((h) => `- ${h.text}`).join("\n")
      : claims.slice(0, 3).map((claim) => `- ${claim}`).join("\n");

  const tensions = llm?.tensions?.length
    ? llm.tensions.map((line) => `- ${line}`).join("\n")
    : "_None flagged yet._";

  const body = [
    `# ${record.title}`,
    "",
    "## Summary",
    summary || "_No summary yet._",
    "",
    "## Key Claims",
    claims.length ? claims.map((claim) => `- ${claim}`).join("\n") : "_None extracted yet._",
    "",
    "## Evidence",
    evidence || "_None yet._",
    "",
    "## Tensions",
    tensions,
    "",
    "## Links",
    `- Raw: \`${frontmatter.inbox_path}\``,
    conceptLinks.length ? `- Concepts: ${conceptLinks.join(", ")}` : "",
    entityLinks.length ? `- Entities: ${entityLinks.join(", ")}` : "",
    `- Overview: ${wikilink("overview")}`,
    "",
  ]
    .filter(Boolean)
    .join("\n");

  return { relPath: sourcePath(record.id), frontmatter, body };
}

async function upsertConceptPage(name, sourceRecord, { dryRun = false } = {}) {
  const relPath = conceptPath(name);
  const slug = slugify(name);
  const sourceLink = wikilink(sourcePath(sourceRecord.id).replace(/\.md$/, ""), sourceRecord.title);
  const existing = readPage(relPath);
  const sources = uniqueList([
    ...(existing?.frontmatter?.sources || []),
    sourceRecord.id,
  ]);

  const frontmatter = {
    type: "concept",
    title: name,
    slug,
    sources,
    tags: uniqueList([...(existing?.frontmatter?.tags || []), ...(sourceRecord.tags || [])]),
    updated_at: new Date().toISOString(),
    summary: existing?.frontmatter?.summary || excerpt(primaryText(sourceRecord), 220),
  };

  const linkedSources = sources
    .map((id) => {
      const rec = readInboxRecord(id);
      if (!rec) return null;
      return `- ${wikilink(sourcePath(id).replace(/\.md$/, ""), rec.title)}`;
    })
    .filter(Boolean);

  const body = [
    `# ${name}`,
    "",
    "## Summary",
    frontmatter.summary || "_Concept page — synthesis grows as sources accumulate._",
    "",
    "## Sources",
    linkedSources.length ? linkedSources.join("\n") : `- ${sourceLink}`,
    "",
    "## Related",
    `- ${wikilink("overview")}`,
    `- ${wikilink("index")}`,
    "",
  ].join("\n");

  await writePage(relPath, frontmatter, body, { dryRun });
  return relPath;
}

async function upsertEntityPage(ticker, sourceRecord, { dryRun = false } = {}) {
  const relPath = entityPath(ticker);
  const existing = readPage(relPath);
  const sources = uniqueList([
    ...(existing?.frontmatter?.sources || []),
    sourceRecord.id,
  ]);

  const frontmatter = {
    type: "entity",
    entity_kind: "ticker",
    title: ticker,
    slug: slugify(ticker),
    sources,
    updated_at: new Date().toISOString(),
    summary: existing?.frontmatter?.summary || `Mentioned in saved reading.`,
  };

  const linkedSources = sources
    .map((id) => {
      const rec = readInboxRecord(id);
      if (!rec) return null;
      return `- ${wikilink(sourcePath(id).replace(/\.md$/, ""), rec.title)}`;
    })
    .filter(Boolean);

  const body = [
    `# ${ticker}`,
    "",
    "## Summary",
    frontmatter.summary,
    "",
    "## Mentions",
    linkedSources.join("\n") || "_No linked sources yet._",
    "",
  ].join("\n");

  await writePage(relPath, frontmatter, body, { dryRun });
  return relPath;
}

async function rebuildIndex({ dryRun = false } = {}) {
  const pages = listWikiMarkdown();
  const sources = [];
  const concepts = [];
  const entities = [];

  for (const relPath of pages) {
    const page = readPage(relPath);
    if (!page) continue;
    const type = page.frontmatter.type || "page";
    const title = page.frontmatter.title || relPath;
    const summary = page.frontmatter.summary || excerpt(page.body, 120);
    const entry = `- ${wikilink(relPath.replace(/\.md$/, ""), title)} — ${summary}`;
    if (type === "source") sources.push(entry);
    else if (type === "concept") concepts.push(entry);
    else if (type === "entity") entities.push(entry);
  }

  const body = [
    "# Markets Reading Wiki — Index",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Navigation",
    `- ${wikilink("overview")}`,
    `- ${wikilink("tensions")}`,
    `- ${wikilink("log")}`,
    "",
    `## Sources (${sources.length})`,
    sources.length ? sources.join("\n") : "_No sources yet._",
    "",
    `## Concepts (${concepts.length})`,
    concepts.length ? concepts.join("\n") : "_No concepts yet._",
    "",
    `## Entities (${entities.length})`,
    entities.length ? entities.join("\n") : "_No entities yet._",
    "",
  ].join("\n");

  const frontmatter = {
    type: "index",
    title: "Wiki Index",
    updated_at: new Date().toISOString(),
    source_count: sources.length,
    concept_count: concepts.length,
    entity_count: entities.length,
  };

  if (!dryRun) {
    await writeWikiFile("index.md", buildMarkdown(frontmatter, body), "Wiki: rebuild index");
  }
  return { sources: sources.length, concepts: concepts.length, entities: entities.length };
}

async function appendLog(entry, { dryRun = false } = {}) {
  const stamp = new Date().toISOString();
  const line = `## [${stamp}] ${entry.kind} | ${entry.title}\n- pages: ${(entry.pages || []).join(", ")}\n\n`;
  const header = "# Wiki Log\n\nAppend-only timeline of ingests, queries, and lint passes.\n\n";
  const existing = readWikiFileLocal("log.md");
  const next = existing ? `${existing.trimEnd()}\n\n${line}` : `${header}${line}`;
  if (!dryRun) await writeWikiFile("log.md", next, `Wiki: ${entry.kind} ${entry.title}`);
  return line;
}

async function ensureOverview({ dryRun = false } = {}) {
  if (readWikiFileLocal("overview.md")) return;
  const body = [
    "# Markets Reading — Overview",
    "",
    "Evolving synthesis across saved sources. The ingest pipeline updates concept and entity pages;",
    "this overview should be revised when new sources materially change the thesis.",
    "",
    "## Themes",
    "_Pending first synthesis pass._",
    "",
    "## Open Questions",
    "_Add via query workflow or lint._",
    "",
    "## See Also",
    `- ${wikilink("index")}`,
    `- ${wikilink("tensions")}`,
    "",
  ].join("\n");

  const frontmatter = {
    type: "overview",
    title: "Markets Reading Overview",
    summary: "Top-level synthesis across saved markets reading.",
    updated_at: new Date().toISOString(),
  };

  if (!dryRun) await writePage("overview.md", frontmatter, body);
}

async function ensureTensions({ dryRun = false } = {}) {
  if (readWikiFileLocal("tensions.md")) return;
  const body = [
    "# Contradictions & Tensions",
    "",
    "Ledger of claims that conflict across sources. The lint pass should append here;",
    "ingest may add candidate tensions per source.",
    "",
    "_No tensions logged yet._",
    "",
  ].join("\n");

  const frontmatter = {
    type: "tensions",
    title: "Tensions Ledger",
    summary: "Contradictions and open conflicts across sources.",
    updated_at: new Date().toISOString(),
  };

  if (!dryRun) await writePage("tensions.md", frontmatter, body);
}

async function ingestWikiItem(idOrRecord, { dryRun = false } = {}) {
  const record =
    typeof idOrRecord === "object" && idOrRecord?.id
      ? idOrRecord
      : readInboxRecord(String(idOrRecord || ""));
  if (!record) {
    const missing = typeof idOrRecord === "string" ? idOrRecord : idOrRecord?.id;
    throw new Error(`Inbox record not found: ${missing}`);
  }

  ensureWikiDirs();
  await ensureOverview({ dryRun });
  await ensureTensions({ dryRun });

  const source = buildSourcePage(record, null);
  await writePage(source.relPath, source.frontmatter, source.body, { dryRun });

  const touched = [source.relPath];
  for (const folder of uniqueList(record.folders || [])) {
    touched.push(await upsertConceptPage(folder, record, { dryRun }));
  }
  for (const ticker of uniqueList([
    ...(record.tickers || []),
    ...extractTickers(primaryText(record)),
  ])) {
    touched.push(await upsertEntityPage(ticker, record, { dryRun }));
  }

  const index = await rebuildIndex({ dryRun });
  if (!dryRun) {
    await appendLog({
      kind: "ingest",
      title: record.title,
      pages: touched,
    });
  }

  return {
    id: record.id,
    title: record.title,
    pages: touched,
    index,
    llm: false,
  };
}

async function ingestAllWiki({ dryRun = false } = {}) {
  const ids = listInboxIds();
  const results = [];
  for (const id of ids) {
    results.push(await ingestWikiItem(id, { dryRun }));
  }
  await rebuildIndex({ dryRun });
  return results;
}

module.exports = {
  ingestWikiItem,
  ingestAllWiki,
  rebuildIndex,
  appendLog,
  extractWikiLinks,
  readPage,
};
