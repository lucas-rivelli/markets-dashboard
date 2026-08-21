const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const sanitizeHtml = require("sanitize-html");
const { SaveError } = require("./kb-save");
const { hasGithubToken, readGithubJson, writeGithubJson } = require("./github-content");
const { addStableItemId } = require("./item-id");

const ROOT = path.join(__dirname, "..");
const WRITINGS_FILE = "data/writings.json";
const WRITINGS_PATH = path.join(ROOT, WRITINGS_FILE);
const MAX_WRITINGS = 500;
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
    // contenteditable (Chrome/Safari) wraps each line in <div>; stripping
    // those tags concatenates adjacent lines. Keep them as paragraphs.
    div: (tagName, attribs) => ({ tagName: "p", attribs: {} }),
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

function writingLink(id) {
  return `https://writing.local/${id}`;
}

function sanitizeWritingHtml(raw) {
  const structured = structureWritingHtml(String(raw || ""));
  const html = sanitizeHtml(structured, SANITIZE_OPTIONS).trim();
  if (html.length > MAX_HTML) {
    throw new SaveError(413, "Writing is too long", "body_too_large");
  }
  // Second pass after sanitize so repaired text still becomes real <p> blocks.
  return structureWritingHtml(html);
}

/**
 * Contenteditable often leaves bare text or glued lines ("vegetablesWant").
 * Normalize into paragraph blocks and restore missing breaks/spaces.
 */
function structureWritingHtml(raw) {
  let html = String(raw || "")
    .replace(/\u00a0/g, " ")
    .replace(/<\/div>/gi, "</p>")
    .replace(/<div\b[^>]*>/gi, "<p>")
    .trim();
  if (!html) return "<p></p>";

  // Soft line breaks between sentences → paragraph breaks.
  html = html.replace(/<br\s*\/?>\s*/gi, "\n");

  // Merge bold label + trailing punctuation bold: <b>Repetition</b><b>?</b> → <b>Repetition?</b>
  html = html.replace(
    /<(b|strong)\b[^>]*>([\s\S]*?)<\/\1>\s*<(b|strong)\b[^>]*>\s*([?!:.,;…]+)\s*<\/\3>/gi,
    "<$1>$2$4</$1>"
  );

  // Glued sentence starts: "vegetablesWant" / "booksThere"
  html = html.replace(/([a-z0-9.,;:!?…'"”’])([A-Z])/g, "$1\n$2");

  // Glued bold label (no space): "searching<b>Repetition"
  html = html.replace(/([a-z0-9])(<(?:b|strong)\b[^>]*>\s*[A-Za-z])/gi, "$1\n$2");

  // Sentence end then bold label: "motivation?<b>Specification" / "motivation? <b>Specification"
  html = html.replace(/([.!?…])\s*(<(?:b|strong)\b[^>]*>\s*[A-Za-z])/gi, "$1\n$2");

  // Adjacent bold labels when the next one starts a word: "</b><b>Field"
  html = html.replace(/<\/(b|strong)>\s*<(b|strong)\b([^>]*)>(\s*[A-Za-z])/gi, "</$1>\n<$2$3>$4");

  // Space after closing bold before a word: "</b>Going"
  html = html.replace(/<\/(b|strong)>([A-Za-z])/gi, "</$1> $2");

  // Existing paragraph tags become break markers.
  html = html.replace(/<\/p\s*>/gi, "\n").replace(/<p\b[^>]*>/gi, "\n");

  // Protect headings from paragraph wrapping.
  const headingStore = [];
  html = html.replace(/<(h[2-4])\b[^>]*>[\s\S]*?<\/\1>/gi, (block) => {
    const key = `\n%%HEADING${headingStore.length}%%\n`;
    headingStore.push(block.replace(/<\/?p\b[^>]*>/gi, "").trim());
    return key;
  });

  html = html
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (/^%%HEADING\d+%%$/.test(line)) return line;
      return `<p>${line}</p>`;
    })
    .join("");

  headingStore.forEach((block, i) => {
    html = html.replace(`%%HEADING${i}%%`, block);
  });

  return html || "<p></p>";
}

function snippetFromHtml(html) {
  const text = stripHtml(html);
  if (!text) return "";
  return text.length > 200 ? text.slice(0, 197) + "…" : text;
}

function newWritingId() {
  return crypto.randomUUID().replace(/-/g, "");
}

function normalizeWriting(raw, { requireId = false } = {}) {
  const id = cleanString(raw?.writingId || raw?.id, 64).replace(/[^a-zA-Z0-9]/g, "");
  if (requireId && !id) {
    throw new SaveError(400, "Writing id is required", "missing_id");
  }

  const writingId = id || newWritingId();
  const title = cleanString(raw?.title || "Untitled", MAX_TITLE) || "Untitled";
  const contentHtml = sanitizeWritingHtml(raw?.contentHtml || raw?.content_html || raw?.body || "");
  const date = raw?.date || new Date().toISOString();
  const updated = raw?.updated || date;

  // writingId is the editable record key; feed `id` is the stable hash of `link`.
  const item = {
    writingId,
    source: "Writing",
    category: "Writing",
    title,
    link: writingLink(writingId),
    date,
    updated,
    snippet: snippetFromHtml(contentHtml),
    contentHtml,
  };

  return addStableItemId(item);
}

function normalizeWritings(raw) {
  const list = Array.isArray(raw) ? raw : raw?.items || [];
  const seen = new Set();
  return list
    .map((item) => {
      try {
        return normalizeWriting(item, { requireId: true });
      } catch {
        return null;
      }
    })
    .filter((item) => {
      if (!item || seen.has(item.writingId)) return false;
      seen.add(item.writingId);
      return true;
    })
    .slice(0, MAX_WRITINGS);
}

function readLocalWritings() {
  if (!fs.existsSync(WRITINGS_PATH)) return [];
  try {
    return normalizeWritings(JSON.parse(fs.readFileSync(WRITINGS_PATH, "utf8")));
  } catch {
    return [];
  }
}

function writeLocalWritings(items) {
  fs.mkdirSync(path.dirname(WRITINGS_PATH), { recursive: true });
  const payload = {
    items: items.map((item) => ({
      id: item.writingId,
      title: item.title,
      date: item.date,
      updated: item.updated,
      contentHtml: item.contentHtml || "",
    })),
  };
  fs.writeFileSync(WRITINGS_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

async function loadWritings() {
  if (hasGithubToken()) {
    const { json } = await readGithubJson(WRITINGS_FILE);
    return normalizeWritings(json);
  }
  return readLocalWritings();
}

async function saveWritings(items) {
  const normalized = normalizeWritings(items);

  if (hasGithubToken()) {
    const result = await writeGithubJson(
      WRITINGS_FILE,
      {
        items: normalized.map((item) => ({
          id: item.writingId,
          title: item.title,
          date: item.date,
          updated: item.updated,
          contentHtml: item.contentHtml || "",
        })),
      },
      "Update writings"
    );
    return { items: normalized, persistence: "github", result };
  }

  if (process.env.VERCEL) {
    throw new SaveError(
      500,
      "GITHUB_TOKEN or GH_TOKEN is required for writings in Vercel",
      "missing_github_token"
    );
  }

  writeLocalWritings(normalized);
  return { items: normalized, persistence: "local" };
}

async function upsertWriting(input) {
  const current = await loadWritings();
  const requestedId = cleanString(input?.id || input?.writingId, 64).replace(/[^a-zA-Z0-9]/g, "");
  const existing = requestedId
    ? current.find((item) => item.writingId === requestedId)
    : null;

  const nextItem = normalizeWriting({
    title: existing?.title,
    contentHtml: existing?.contentHtml,
    ...input,
    id: existing?.writingId || requestedId,
    date: existing?.date || input?.date || new Date().toISOString(),
    updated: new Date().toISOString(),
  });

  const without = current.filter((item) => item.writingId !== nextItem.writingId);
  const saved = await saveWritings([nextItem, ...without].slice(0, MAX_WRITINGS));
  return { item: nextItem, ...saved };
}

async function deleteWriting(id) {
  const writingId = cleanString(id, 64).replace(/[^a-zA-Z0-9]/g, "");
  if (!writingId) {
    throw new SaveError(400, "Writing id is required", "missing_id");
  }

  const current = await loadWritings();
  const remaining = current.filter((item) => item.writingId !== writingId);
  if (remaining.length === current.length) {
    throw new SaveError(404, "Writing not found", "not_found");
  }

  const saved = await saveWritings(remaining);
  return { id: writingId, ...saved };
}

module.exports = {
  WRITINGS_FILE,
  deleteWriting,
  loadWritings,
  normalizeWriting,
  sanitizeWritingHtml,
  structureWritingHtml,
  upsertWriting,
  writingLink,
};
