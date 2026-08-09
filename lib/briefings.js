const fs = require("fs");
const path = require("path");
const sanitizeHtml = require("sanitize-html");
const { SaveError } = require("./kb-save");
const { hasGithubToken, readGithubJson, writeGithubJson } = require("./github-content");
const { addStableItemId } = require("./item-id");
const { loadBriefingConfig } = require("./briefing-config");

const ROOT = path.join(__dirname, "..");
const BRIEFINGS_FILE = "data/briefings.json";
const BRIEFINGS_PATH = path.join(ROOT, BRIEFINGS_FILE);
const MAX_BRIEFINGS = 120;
const MAX_TITLE = 300;
const MAX_HTML = 200000;

const SANITIZE_OPTIONS = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "h2",
    "h3",
    "h4",
    "hr",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    blockquote: ["cite"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noopener noreferrer",
    }),
  },
};

function cleanString(value, maxLength = 300) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function briefingLink(id) {
  return `https://briefing.local/${id}`;
}

function sanitizeBriefingHtml(raw) {
  const html = sanitizeHtml(String(raw || ""), SANITIZE_OPTIONS).trim();
  if (html.length > MAX_HTML) {
    throw new SaveError(413, "Briefing is too long", "body_too_large");
  }
  return html;
}

function snippetFromHtml(html) {
  const text = stripHtml(html);
  if (!text) return "";
  return text.length > 200 ? text.slice(0, 197) + "…" : text;
}

function normalizeBriefing(raw, { requireId = false } = {}) {
  const config = loadBriefingConfig();
  const id = cleanString(raw?.briefingId || raw?.id, 64).replace(/[^a-zA-Z0-9]/g, "");
  if (requireId && !id) {
    throw new SaveError(400, "Briefing id is required", "missing_id");
  }
  if (!id) {
    throw new SaveError(400, "Briefing id is required", "missing_id");
  }

  const title = cleanString(raw?.title || config.titlePrefix, MAX_TITLE) || config.titlePrefix;
  const contentHtml = sanitizeBriefingHtml(raw?.contentHtml || raw?.content_html || raw?.body || "");
  const date = raw?.date || new Date().toISOString();
  const updated = raw?.updated || date;

  const item = {
    briefingId: id,
    source: cleanString(raw?.source || config.sourceName, 160) || "Lucas Briefing",
    category: cleanString(raw?.category || config.category, 80) || "Briefing",
    title,
    link: briefingLink(id),
    date,
    updated,
    snippet: snippetFromHtml(contentHtml),
    contentHtml,
  };

  return addStableItemId(item);
}

function normalizeBriefings(raw) {
  const list = Array.isArray(raw) ? raw : raw?.items || [];
  const seen = new Set();
  return list
    .map((item) => {
      try {
        return normalizeBriefing(item, { requireId: true });
      } catch {
        return null;
      }
    })
    .filter((item) => {
      if (!item || seen.has(item.briefingId)) return false;
      seen.add(item.briefingId);
      return true;
    })
    .slice(0, MAX_BRIEFINGS);
}

function toStorageItems(items) {
  return items.map((item) => ({
    id: item.briefingId,
    title: item.title,
    date: item.date,
    updated: item.updated,
    source: item.source,
    category: item.category,
    contentHtml: item.contentHtml || "",
  }));
}

function readLocalBriefings() {
  if (!fs.existsSync(BRIEFINGS_PATH)) return [];
  try {
    return normalizeBriefings(JSON.parse(fs.readFileSync(BRIEFINGS_PATH, "utf8")));
  } catch {
    return [];
  }
}

function writeLocalBriefings(items) {
  fs.mkdirSync(path.dirname(BRIEFINGS_PATH), { recursive: true });
  const payload = { items: toStorageItems(items) };
  fs.writeFileSync(BRIEFINGS_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

async function loadBriefings() {
  if (hasGithubToken() && !process.env.BRIEFING_LOCAL_ONLY) {
    const { json } = await readGithubJson(BRIEFINGS_FILE);
    return normalizeBriefings(json);
  }
  return readLocalBriefings();
}

async function saveBriefings(items) {
  const normalized = normalizeBriefings(items);

  if (hasGithubToken() && !process.env.BRIEFING_LOCAL_ONLY) {
    const result = await writeGithubJson(
      BRIEFINGS_FILE,
      { items: toStorageItems(normalized) },
      "Update Lucas Briefing"
    );
    return { items: normalized, persistence: "github", result };
  }

  if (process.env.VERCEL) {
    throw new SaveError(
      500,
      "GITHUB_TOKEN or GH_TOKEN is required for briefings in Vercel",
      "missing_github_token"
    );
  }

  writeLocalBriefings(normalized);
  return { items: normalized, persistence: "local" };
}

async function upsertBriefing(input) {
  const current = await loadBriefings();
  const requestedId = cleanString(input?.id || input?.briefingId, 64).replace(/[^a-zA-Z0-9]/g, "");
  if (!requestedId) {
    throw new SaveError(400, "Briefing id is required", "missing_id");
  }

  const existing = current.find((item) => item.briefingId === requestedId) || null;

  const nextItem = normalizeBriefing({
    title: existing?.title,
    contentHtml: existing?.contentHtml,
    source: existing?.source,
    category: existing?.category,
    ...input,
    id: requestedId,
    date: existing?.date || input?.date || new Date().toISOString(),
    updated: new Date().toISOString(),
  });

  const without = current.filter((item) => item.briefingId !== nextItem.briefingId);
  const saved = await saveBriefings([nextItem, ...without].slice(0, MAX_BRIEFINGS));
  return { item: nextItem, ...saved };
}

module.exports = {
  BRIEFINGS_FILE,
  briefingLink,
  loadBriefings,
  normalizeBriefing,
  upsertBriefing,
  writeLocalBriefings,
};
