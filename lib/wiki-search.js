const { parseFrontmatter } = require("./wiki-frontmatter");
const { listWikiMarkdown, readWikiFileLocal } = require("./wiki-persist");

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s$]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function scoreDoc(queryTokens, docTokens) {
  if (!queryTokens.length || !docTokens.length) return 0;
  const docSet = new Set(docTokens);
  let hits = 0;
  for (const token of queryTokens) {
    if (docSet.has(token)) hits += 1;
  }
  return hits / queryTokens.length;
}

function searchWiki(query, { limit = 10 } = {}) {
  const queryTokens = tokenize(query);
  const results = [];

  for (const relPath of listWikiMarkdown()) {
    const raw = readWikiFileLocal(relPath);
    if (!raw) continue;
    const { frontmatter, body } = parseFrontmatter(raw);
    const haystack = [
      relPath,
      frontmatter.title,
      frontmatter.summary,
      frontmatter.type,
      ...(frontmatter.tags || []),
      ...(frontmatter.folders || []),
      body,
    ].join(" ");
    const score = scoreDoc(queryTokens, tokenize(haystack));
    if (score <= 0) continue;
    results.push({
      path: `kb/wiki/${relPath}`,
      title: frontmatter.title || relPath,
      type: frontmatter.type || "page",
      summary: frontmatter.summary || "",
      score: Number(score.toFixed(3)),
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

module.exports = { searchWiki };
