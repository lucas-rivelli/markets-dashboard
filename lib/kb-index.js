const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const KB_DIR = path.join(ROOT, "kb");
const KB_INBOX_DIR = path.join(KB_DIR, "inbox");
const KB_NOTES_DIR = path.join(KB_DIR, "notes");
const KB_INDEX_FILE = path.join(KB_DIR, "index.json");
const KB_SCHEMA_VERSION = 1;

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(ext))
    .sort()
    .map((name) => path.join(dir, name));
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map(compact).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(",")
    .map(compact)
    .filter(Boolean);
}

function parseScalar(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) return "";
  if (trimmed === "[]") return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((part) => part.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }

  return trimmed.replace(/^["']|["']$/g, "");
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith("---\n")) {
    return { frontmatter: {}, body: markdown };
  }

  const end = markdown.indexOf("\n---", 4);
  if (end === -1) return { frontmatter: {}, body: markdown };

  const raw = markdown.slice(4, end).trim();
  const body = markdown.slice(end + 4).trim();
  const frontmatter = {};

  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    frontmatter[key] = parseScalar(value);
  }

  return { frontmatter, body };
}

function excerpt(text, max = 280) {
  const clean = compact(text);
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + "...";
}

function toRelative(filePath) {
  return path.relative(ROOT, filePath);
}

function savedRecord(filePath) {
  const item = readJsonFile(filePath);

  return {
    id: item.id || path.basename(filePath, ".json"),
    title: compact(item.title || "Untitled"),
    url: item.url || item.link || "",
    source: compact(item.source || "Unknown"),
    category: compact(item.category || "Article"),
    type: compact(item.type || "article"),
    date: item.date || null,
    saved_at: item.saved_at || null,
    status: item.status || "saved",
    themes: normalizeArray(item.themes),
    tickers: normalizeArray(item.tickers),
    summary: "",
    snippet: compact(item.snippet),
    inbox_path: toRelative(filePath),
    note_path: null,
  };
}

function noteRecord(filePath) {
  const markdown = fs.readFileSync(filePath, "utf8");
  const { frontmatter, body } = parseFrontmatter(markdown);

  return {
    id: frontmatter.id || path.basename(filePath, ".md"),
    title: compact(frontmatter.title || "Untitled"),
    url: frontmatter.url || "",
    source: compact(frontmatter.source || "Unknown"),
    category: compact(frontmatter.category || ""),
    type: compact(frontmatter.type || "article"),
    date: frontmatter.date || null,
    saved_at: frontmatter.saved_at || null,
    status: "enriched",
    themes: normalizeArray(frontmatter.themes),
    tickers: normalizeArray(frontmatter.tickers),
    summary: compact(frontmatter.summary) || excerpt(body),
    snippet: "",
    inbox_path: null,
    note_path: toRelative(filePath),
  };
}

function mergeRecord(base, overlay) {
  return {
    ...base,
    ...overlay,
    themes: overlay.themes?.length ? overlay.themes : base.themes || [],
    tickers: overlay.tickers?.length ? overlay.tickers : base.tickers || [],
    snippet: overlay.snippet || base.snippet || "",
    summary: overlay.summary || base.summary || "",
    inbox_path: base.inbox_path || overlay.inbox_path || null,
    note_path: overlay.note_path || base.note_path || null,
  };
}

function facetCounts(items, key) {
  const counts = new Map();

  for (const item of items) {
    const values = Array.isArray(item[key]) ? item[key] : [item[key]];
    for (const value of values.map(compact).filter(Boolean)) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function searchableText(item) {
  return [
    item.title,
    item.source,
    item.category,
    item.type,
    item.themes.join(" "),
    item.tickers.join(" "),
    item.summary,
    item.snippet,
  ]
    .map(compact)
    .filter(Boolean)
    .join(" ");
}

function sortDate(item) {
  return item.saved_at || item.date || "";
}

function buildKbIndex() {
  const records = new Map();
  const inboxFiles = listFiles(KB_INBOX_DIR, ".json");
  const noteFiles = listFiles(KB_NOTES_DIR, ".md");

  for (const filePath of inboxFiles) {
    const record = savedRecord(filePath);
    records.set(record.id, record);
  }

  for (const filePath of noteFiles) {
    const record = noteRecord(filePath);
    const existing = records.get(record.id);
    records.set(record.id, existing ? mergeRecord(existing, record) : record);
  }

  const items = Array.from(records.values())
    .map((item) => ({
      ...item,
      search_text: searchableText(item),
    }))
    .sort((a, b) => sortDate(b).localeCompare(sortDate(a)));

  return {
    schema_version: KB_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    counts: {
      inbox: inboxFiles.length,
      notes: noteFiles.length,
      items: items.length,
    },
    facets: {
      themes: facetCounts(items, "themes"),
      tickers: facetCounts(items, "tickers"),
      sources: facetCounts(items, "source"),
      types: facetCounts(items, "type"),
      statuses: facetCounts(items, "status"),
    },
    items,
  };
}

function writeKbIndex(index = buildKbIndex()) {
  fs.mkdirSync(KB_DIR, { recursive: true });
  fs.writeFileSync(KB_INDEX_FILE, JSON.stringify(index, null, 2) + "\n");
  return index;
}

module.exports = {
  KB_INDEX_FILE,
  KB_SCHEMA_VERSION,
  buildKbIndex,
  writeKbIndex,
};
