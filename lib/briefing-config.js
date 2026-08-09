const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONFIG_FILE = "data/briefing-config.json";
const CONFIG_PATH = path.join(ROOT, CONFIG_FILE);

function loadBriefingConfig() {
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  if (!raw?.sections?.global || !raw?.sections?.brazil) {
    throw new Error("briefing-config.json is missing required sections");
  }
  return {
    titlePrefix: raw.titlePrefix || "Lucas Briefing",
    sourceName: raw.sourceName || "Lucas Briefing",
    category: raw.category || "Briefing",
    timezone: raw.timezone || "America/Sao_Paulo",
    model: raw.model || process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4",
    sections: raw.sections,
  };
}

function briefingDateKey(timezone, when = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA → YYYY-MM-DD
  return fmt.format(when);
}

function briefingIdForDate(dateKey) {
  return `briefing${String(dateKey).replace(/-/g, "")}`;
}

function briefingTitle(titlePrefix, dateKey) {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const label = dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${titlePrefix} — ${label}`;
}

function googleNewsSearchUrl(query, { hl = "en-US", gl = "US", ceid = "US:en" } = {}) {
  const params = new URLSearchParams({
    q: query,
    hl,
    gl,
    ceid,
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

module.exports = {
  CONFIG_FILE,
  briefingDateKey,
  briefingIdForDate,
  briefingTitle,
  googleNewsSearchUrl,
  loadBriefingConfig,
};
