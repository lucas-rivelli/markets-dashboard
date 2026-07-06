const path = require("path");

const ROOT = path.join(__dirname, "..");
const KB_DIR = path.join(ROOT, "kb");
const KB_INBOX_DIR = path.join(KB_DIR, "inbox");
const KB_WIKI_DIR = path.join(KB_DIR, "wiki");
const WIKI_SOURCES_DIR = path.join(KB_WIKI_DIR, "sources");
const WIKI_CONCEPTS_DIR = path.join(KB_WIKI_DIR, "concepts");
const WIKI_ENTITIES_DIR = path.join(KB_WIKI_DIR, "entities");
const WIKI_QUERIES_DIR = path.join(KB_WIKI_DIR, "queries");

const WIKI_INDEX_FILE = path.join(KB_WIKI_DIR, "index.md");
const WIKI_LOG_FILE = path.join(KB_WIKI_DIR, "log.md");
const WIKI_OVERVIEW_FILE = path.join(KB_WIKI_DIR, "overview.md");
const WIKI_TENSIONS_FILE = path.join(KB_WIKI_DIR, "tensions.md");
const WIKI_SCHEMA_FILE = path.join(KB_WIKI_DIR, "WIKI.md");

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function wikiRelPath(...parts) {
  return path.join("kb", "wiki", ...parts).replace(/\\/g, "/");
}

module.exports = {
  ROOT,
  KB_DIR,
  KB_INBOX_DIR,
  KB_WIKI_DIR,
  WIKI_SOURCES_DIR,
  WIKI_CONCEPTS_DIR,
  WIKI_ENTITIES_DIR,
  WIKI_QUERIES_DIR,
  WIKI_INDEX_FILE,
  WIKI_LOG_FILE,
  WIKI_OVERVIEW_FILE,
  WIKI_TENSIONS_FILE,
  WIKI_SCHEMA_FILE,
  slugify,
  wikiRelPath,
};
