const fs = require("fs");
const path = require("path");

const BOOKMARKS_FILE = path.join(__dirname, "..", "data", "bookmarks.json");

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

function loadBookmarks() {
  if (!fs.existsSync(BOOKMARKS_FILE)) return [];

  try {
    const data = JSON.parse(fs.readFileSync(BOOKMARKS_FILE, "utf8"));
    const list = Array.isArray(data) ? data : data.items || [];
    return list.map(normalizeItem).filter(Boolean);
  } catch {
    return [];
  }
}

module.exports = { loadBookmarks, BOOKMARKS_FILE };
