const fs = require("fs");
const path = require("path");
const { hasGithubToken, readGithubJson } = require("./github-content");

const BOOKMARKS_FILE = "data/bookmarks.json";
const BOOKMARKS_PATH = path.join(__dirname, "..", BOOKMARKS_FILE);

function normalizeItem(raw) {
  if (!raw || !raw.link) return null;

  return {
    source: raw.source || "X Bookmarks",
    category: "Bookmarks",
    title: (raw.title || "Bookmarked post").trim(),
    link: raw.link,
    date: raw.date || null,
    snippet: raw.snippet || "",
  };
}

function normalizeBookmarks(data) {
  const list = Array.isArray(data) ? data : data?.items || [];
  return list.map(normalizeItem).filter(Boolean);
}

function readLocalBookmarks() {
  if (!fs.existsSync(BOOKMARKS_PATH)) return [];

  try {
    return normalizeBookmarks(JSON.parse(fs.readFileSync(BOOKMARKS_PATH, "utf8")));
  } catch {
    return [];
  }
}

async function loadBookmarks() {
  // Prefer the live repo file so bookmark-only commits can skip Vercel deploys.
  try {
    if (hasGithubToken()) {
      const { json } = await readGithubJson(BOOKMARKS_FILE);
      if (json) return normalizeBookmarks(json);
    }
  } catch {
    // fall through to the bundled/local file
  }

  return readLocalBookmarks();
}

module.exports = { loadBookmarks, BOOKMARKS_FILE, BOOKMARKS_PATH };
