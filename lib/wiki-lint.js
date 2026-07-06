const { parseFrontmatter } = require("./wiki-frontmatter");
const { readWikiFileLocal, listWikiMarkdown } = require("./wiki-persist");
const { extractWikiLinks } = require("./wiki-ingest");
const { listInboxIds } = require("./wiki-text");

const REQUIRED_FIELDS = ["type", "title", "summary", "updated_at"];

function readWikiPage(relPath) {
  const raw = readWikiFileLocal(relPath);
  if (!raw) return null;
  const { frontmatter, body } = parseFrontmatter(raw);
  return { relPath, frontmatter, body, raw };
}

function lintWiki() {
  const pages = listWikiMarkdown();
  const allPaths = new Set(pages);
  allPaths.add("overview.md");
  allPaths.add("tensions.md");

  const inbound = new Map();
  const issues = {
    schema: [],
    orphans: [],
    missingSources: [],
    duplicates: [],
    overviewDrift: false,
  };

  const titles = new Map();
  let newestSource = "";
  let overviewUpdated = "";

  for (const relPath of pages) {
    const page = readWikiPage(relPath);
    if (!page) continue;

    for (const field of REQUIRED_FIELDS) {
      if (!page.frontmatter[field]) {
        issues.schema.push({ page: relPath, missing: field });
      }
    }

    const title = String(page.frontmatter.title || "").toLowerCase();
    if (title) {
      if (!titles.has(title)) titles.set(title, []);
      titles.get(title).push(relPath);
    }

    if (page.frontmatter.type === "source") {
      const stamp = page.frontmatter.updated_at || page.frontmatter.saved_at || "";
      if (stamp > newestSource) newestSource = stamp;
    }

    for (const link of extractWikiLinks(page.raw)) {
      const target = link.endsWith(".md") ? link : `${link}.md`;
      inbound.set(target, (inbound.get(target) || 0) + 1);
    }
  }

  const overview = readWikiPage("overview.md");
  overviewUpdated = overview?.frontmatter?.updated_at || "";
  if (overview && newestSource && overviewUpdated < newestSource) {
    issues.overviewDrift = true;
  }

  for (const relPath of allPaths) {
    if (relPath === "index.md") continue;
    if ((inbound.get(relPath) || 0) === 0 && !relPath.startsWith("sources/")) {
      issues.orphans.push(relPath);
    }
  }

  const inboxIds = new Set(listInboxIds());
  for (const id of inboxIds) {
    if (!allPaths.has(`sources/${id}.md`)) {
      issues.missingSources.push(id);
    }
  }

  for (const [title, paths] of titles.entries()) {
    if (paths.length > 1) issues.duplicates.push({ title, paths });
  }

  const health =
    issues.schema.length || issues.missingSources.length
      ? "red"
      : issues.orphans.length || issues.overviewDrift
        ? "yellow"
        : "green";

  return {
    generated_at: new Date().toISOString(),
    health,
    counts: {
      pages: pages.length,
      inbox: inboxIds.size,
      missing_wiki_sources: issues.missingSources.length,
    },
    issues,
  };
}

function formatLintReport(report) {
  const icon = report.health === "green" ? "🟢" : report.health === "yellow" ? "🟡" : "🔴";
  const lines = [
    `# Lint Report — ${report.generated_at.slice(0, 10)}`,
    "",
    `## Summary`,
    `${icon} ${report.health.toUpperCase()} — ${report.counts.pages} wiki pages, ${report.counts.inbox} inbox records`,
    "",
    "## Schema Integrity",
    report.issues.schema.length
      ? report.issues.schema.map((i) => `- ${i.page}: missing \`${i.missing}\``).join("\n")
      : "_OK_",
    "",
    "## Missing Wiki Sources",
    report.issues.missingSources.length
      ? report.issues.missingSources.map((id) => `- sources/${id}.md`).join("\n")
      : "_OK_",
    "",
    "## Orphan Pages",
    report.issues.orphans.length ? report.issues.orphans.map((p) => `- ${p}`).join("\n") : "_OK_",
    "",
    "## Overview Drift",
    report.issues.overviewDrift ? "_Overview is older than newest source — consider revising._" : "_OK_",
    "",
    "## Duplicate Titles",
    report.issues.duplicates.length
      ? report.issues.duplicates
          .map((d) => `- ${d.title}: ${d.paths.join(", ")}`)
          .join("\n")
      : "_OK_",
    "",
  ];
  return lines.join("\n");
}

module.exports = { lintWiki, formatLintReport };
