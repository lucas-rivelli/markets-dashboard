const fs = require("fs");
const path = require("path");
const { KB_INBOX_DIR } = require("./wiki-paths");

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function primaryText(record) {
  return (
    String(record.content_text || "").trim() ||
    stripHtml(record.content_html) ||
    String(record.snippet || "").trim()
  );
}

function excerpt(text, max = 320) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + "…";
}

function splitClaims(text, max = 5) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const parts = clean
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 40);

  return parts.slice(0, max);
}

function extractTickers(text) {
  const matches = String(text || "").match(/\$[A-Z]{1,5}\b/g) || [];
  return [...new Set(matches.map((t) => t.slice(1).toUpperCase()))].slice(0, 20);
}

function extractWikiLinks(markdown) {
  const links = new Set();
  const pattern = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match;
  while ((match = pattern.exec(markdown))) {
    links.add(match[1].trim());
  }
  return [...links];
}

function readInboxRecord(id) {
  const filePath = path.join(KB_INBOX_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listInboxIds() {
  if (!fs.existsSync(KB_INBOX_DIR)) return [];
  return fs
    .readdirSync(KB_INBOX_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""))
    .sort();
}

module.exports = {
  stripHtml,
  primaryText,
  excerpt,
  splitClaims,
  extractTickers,
  extractWikiLinks,
  readInboxRecord,
  listInboxIds,
};
