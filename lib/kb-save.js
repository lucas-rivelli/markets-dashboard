const fs = require("fs");
const path = require("path");
const { KB_SCHEMA_VERSION } = require("./kb-index");
const { normalizeLinkForId, stableItemId } = require("./item-id");
const { enrichKnowledgeInput } = require("./kb-enrich");

const ROOT = path.join(__dirname, "..");
const KB_INBOX_DIR = path.join(ROOT, "kb", "inbox");
const MAX_STRING_LENGTH = 2000;

class SaveError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = "SaveError";
    this.status = status;
    this.code = code;
  }
}

function cleanString(value, maxLength = MAX_STRING_LENGTH) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function typeForCategory(category) {
  switch (category) {
    case "Bookmarks":
      return "bookmark";
    case "Spotify":
      return "podcast";
    case "YouTube":
      return "video";
    default:
      return "article";
  }
}

function isKnowledgeExcludedCategory(category) {
  return String(category || "").trim() === "Spotify";
}

function normalizeStringList(value, maxLength = 80) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => cleanString(entry, maxLength))
    .filter(Boolean);
}

function normalizeHighlights(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({
      id: cleanString(entry?.id, 80),
      text: cleanString(entry?.text, MAX_STRING_LENGTH),
      created_at: entry?.created_at || null,
    }))
    .filter((entry) => entry.id && entry.text);
}

function normalizeSavedItem(input) {
  const raw = input?.item && typeof input.item === "object" ? input.item : input;
  const url = normalizeLinkForId(raw?.url || raw?.link);

  if (!url) {
    throw new SaveError(400, "Saved item requires a link", "missing_link");
  }

  const category = cleanString(raw.category || "Article", 80);
  if (isKnowledgeExcludedCategory(category)) {
    throw new SaveError(400, "Spotify items are not saved to the knowledge base yet", "spotify_excluded");
  }

  const title = cleanString(raw.title || "Untitled", 300);
  const tagNames = normalizeStringList(raw.tags || raw.tag_names);
  const themeNames = normalizeStringList(raw.themes);

  const record = {
    schema_version: KB_SCHEMA_VERSION,
    id: stableItemId(url),
    status: "saved",
    title,
    url,
    source: cleanString(raw.source || "Unknown", 160),
    category,
    date: raw.date || null,
    saved_at: new Date().toISOString(),
    themes: themeNames.length ? themeNames : tagNames,
    tickers: Array.isArray(raw.tickers) ? raw.tickers.map((t) => cleanString(t, 20)) : [],
    type: cleanString(raw.type || typeForCategory(category), 80),
    snippet: cleanString(raw.snippet || "", MAX_STRING_LENGTH),
    folders: normalizeStringList(raw.folders, 160),
    tags: tagNames,
    highlights: normalizeHighlights(raw.highlights),
    content_html: cleanString(raw.content_html || raw.contentHtml || "", 120000),
    content_kind: cleanString(raw.content_kind || "", 40) || null,
    content_text: cleanString(raw.content_text || "", 200000),
    content_meta:
      raw.content_meta && typeof raw.content_meta === "object" ? raw.content_meta : null,
  };

  if (!record.content_kind) delete record.content_kind;
  if (!record.content_text) delete record.content_text;
  if (!record.content_meta) delete record.content_meta;

  return record;
}

function githubConfig() {
  return {
    token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
    owner:
      process.env.GITHUB_OWNER ||
      process.env.VERCEL_GIT_REPO_OWNER ||
      "lucas-rivelli",
    repo:
      process.env.GITHUB_REPO ||
      process.env.VERCEL_GIT_REPO_SLUG ||
      "markets-dashboard",
    branch: process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || "main",
  };
}

function hasGithubToken() {
  return Boolean(githubConfig().token);
}

async function githubRequest(config, apiPath, options = {}) {
  const res = await fetch(`https://api.github.com${apiPath}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      "User-Agent": "MarketsDashboard/1.0",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });

  if (res.status === 404) return null;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new SaveError(
      res.status,
      data.message || `GitHub request failed with HTTP ${res.status}`,
      "github_request_failed"
    );
  }

  return data;
}

async function saveToGithub(record) {
  const config = githubConfig();
  const filePath = `kb/inbox/${record.id}.json`;
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const repoPath = `/repos/${config.owner}/${config.repo}/contents/${encodedPath}`;
  const existing = await githubRequest(
    config,
    `${repoPath}?ref=${encodeURIComponent(config.branch)}`
  );

  if (existing) {
    return {
      alreadySaved: true,
      id: record.id,
      path: filePath,
      url: existing.html_url,
    };
  }

  const content = JSON.stringify(record, null, 2) + "\n";
  const created = await githubRequest(config, repoPath, {
    method: "PUT",
    body: JSON.stringify({
      message: `Save ${record.title} to knowledge inbox`,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: config.branch,
    }),
  });

  return {
    alreadySaved: false,
    id: record.id,
    path: filePath,
    url: created?.content?.html_url,
    commit: created?.commit?.sha,
  };
}

function saveToLocalFs(record) {
  fs.mkdirSync(KB_INBOX_DIR, { recursive: true });

  const filePath = path.join(KB_INBOX_DIR, `${record.id}.json`);
  const relativePath = path.relative(ROOT, filePath);

  if (fs.existsSync(filePath)) {
    return {
      alreadySaved: true,
      id: record.id,
      path: relativePath,
    };
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2) + "\n", {
      flag: "wx",
    });
  } catch (err) {
    if (err.code === "EEXIST") {
      return {
        alreadySaved: true,
        id: record.id,
        path: relativePath,
      };
    }
    throw err;
  }

  return {
    alreadySaved: false,
    id: record.id,
    path: relativePath,
  };
}

async function saveKnowledgeItem(input) {
  const enrichedInput = await enrichKnowledgeInput(input);
  const record = normalizeSavedItem(enrichedInput);

  if (hasGithubToken()) {
    return {
      record,
      result: await saveToGithub(record),
      persistence: "github",
    };
  }

  if (process.env.VERCEL) {
    throw new SaveError(
      500,
      "GITHUB_TOKEN or GH_TOKEN is required for saves in Vercel",
      "missing_github_token"
    );
  }

  return {
    record,
    result: saveToLocalFs(record),
    persistence: "local",
  };
}

function resolveItemId(input) {
  const raw = input?.item && typeof input.item === "object" ? input.item : input;
  const url = normalizeLinkForId(raw?.url || raw?.link);
  if (url) return stableItemId(url);

  const id = String(raw?.id || "");
  if (/^[a-f0-9]{64}$/i.test(id)) return id;

  throw new SaveError(400, "Item id or link required", "missing_id");
}

async function unsaveFromGithub(id) {
  const config = githubConfig();
  const filePath = `kb/inbox/${id}.json`;
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const repoPath = `/repos/${config.owner}/${config.repo}/contents/${encodedPath}`;
  const existing = await githubRequest(
    config,
    `${repoPath}?ref=${encodeURIComponent(config.branch)}`
  );

  if (!existing) {
    return { id, path: filePath, alreadyRemoved: true };
  }

  await githubRequest(config, repoPath, {
    method: "DELETE",
    body: JSON.stringify({
      message: `Remove saved item ${id.slice(0, 8)} from knowledge inbox`,
      sha: existing.sha,
      branch: config.branch,
    }),
  });

  return { id, path: filePath, alreadyRemoved: false };
}

function unsaveFromLocalFs(id) {
  const filePath = path.join(KB_INBOX_DIR, `${id}.json`);
  const relativePath = path.relative(ROOT, filePath);

  if (!fs.existsSync(filePath)) {
    return { id, path: relativePath, alreadyRemoved: true };
  }

  fs.unlinkSync(filePath);
  return { id, path: relativePath, alreadyRemoved: false };
}

async function unsaveKnowledgeItem(input) {
  const id = resolveItemId(input);

  if (hasGithubToken()) {
    return {
      id,
      result: await unsaveFromGithub(id),
      persistence: "github",
    };
  }

  if (process.env.VERCEL) {
    throw new SaveError(
      500,
      "GITHUB_TOKEN or GH_TOKEN is required for unsave in Vercel",
      "missing_github_token"
    );
  }

  return {
    id,
    result: unsaveFromLocalFs(id),
    persistence: "local",
  };
}

module.exports = {
  SaveError,
  hasGithubToken,
  githubConfig,
  githubRequest,
  normalizeSavedItem,
  saveKnowledgeItem,
  saveToLocalFs,
  unsaveKnowledgeItem,
  isKnowledgeExcludedCategory,
};
