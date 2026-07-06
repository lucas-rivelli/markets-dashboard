const fs = require("fs");
const path = require("path");
const { SaveError } = require("./kb-save");
const { hasGithubToken, readGithubJson, writeGithubJson } = require("./github-content");

const ROOT = path.join(__dirname, "..");
const MANUAL_LINKS_FILE = "data/manual-links.json";
const MANUAL_LINKS_PATH = path.join(ROOT, MANUAL_LINKS_FILE);
const MAX_LINKS = 500;

function cleanString(value, maxLength = 300) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function sourceFromUrl(url) {
  try {
    const { hostname } = new URL(url);
    const host = hostname.replace(/^www\./, "");
    const name = host.split(".")[0] || host;
    return name
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Saved Links";
  } catch {
    return "Saved Links";
  }
}

function categoryFromUrl(url, fallback) {
  if (fallback) return cleanString(fallback, 80);
  try {
    const { hostname } = new URL(url);
    if (/(^|\.)youtu\.be$|(^|\.)youtube\.com$/.test(hostname)) return "YouTube";
    if (/(^|\.)open\.spotify\.com$/.test(hostname)) return "Spotify";
    if (/(^|\.)(x|twitter)\.com$/.test(hostname)) return "Bookmarks";
  } catch {
    // fall through to generic saved-link bucket
  }
  return "Bookmarks";
}

function normalizeManualLink(raw) {
  const link = normalizeUrl(raw?.link || raw?.url);
  if (!link) {
    throw new SaveError(400, "A valid http(s) link is required", "missing_link");
  }

  const category = categoryFromUrl(link, raw?.category);
  const source = cleanString(raw?.source || sourceFromUrl(link), 160);
  const title = cleanString(raw?.title || source, 300);

  return {
    source,
    category,
    title,
    link,
    date: raw?.date || new Date().toISOString(),
    snippet: cleanString(raw?.snippet || "", 1200),
  };
}

function normalizeManualLinks(raw) {
  const list = Array.isArray(raw) ? raw : raw?.items || [];
  const seen = new Set();
  return list
    .map((item) => {
      try {
        return normalizeManualLink(item);
      } catch {
        return null;
      }
    })
    .filter((item) => {
      if (!item || seen.has(item.link)) return false;
      seen.add(item.link);
      return true;
    })
    .slice(0, MAX_LINKS);
}

function readLocalManualLinks() {
  if (!fs.existsSync(MANUAL_LINKS_PATH)) return [];
  try {
    return normalizeManualLinks(JSON.parse(fs.readFileSync(MANUAL_LINKS_PATH, "utf8")));
  } catch {
    return [];
  }
}

function writeLocalManualLinks(items) {
  fs.mkdirSync(path.dirname(MANUAL_LINKS_PATH), { recursive: true });
  fs.writeFileSync(MANUAL_LINKS_PATH, JSON.stringify({ items }, null, 2) + "\n", "utf8");
}

async function loadManualLinks() {
  if (hasGithubToken()) {
    const { json } = await readGithubJson(MANUAL_LINKS_FILE);
    return normalizeManualLinks(json);
  }

  return readLocalManualLinks();
}

async function saveManualLinks(items) {
  const normalized = normalizeManualLinks(items);

  if (hasGithubToken()) {
    const result = await writeGithubJson(
      MANUAL_LINKS_FILE,
      { items: normalized },
      "Add manual reading link"
    );
    return { items: normalized, persistence: "github", result };
  }

  if (process.env.VERCEL) {
    throw new SaveError(
      500,
      "GITHUB_TOKEN or GH_TOKEN is required for manual links in Vercel",
      "missing_github_token"
    );
  }

  writeLocalManualLinks(normalized);
  return { items: normalized, persistence: "local" };
}

async function addManualLink(input) {
  const item = normalizeManualLink(input);
  const current = await loadManualLinks();
  const withoutDuplicate = current.filter((existing) => existing.link !== item.link);
  const saved = await saveManualLinks([item, ...withoutDuplicate].slice(0, MAX_LINKS));
  return { item, ...saved };
}

module.exports = {
  MANUAL_LINKS_FILE,
  addManualLink,
  loadManualLinks,
  normalizeManualLink,
};
