const fs = require("fs");
const path = require("path");
const { SaveError } = require("./kb-save");
const { hasGithubToken, readGithubJson, writeGithubJson } = require("./github-content");

const ROOT = path.join(__dirname, "..");
const WORKSPACE_FILE = "data/workspace.json";
const WORKSPACE_PATH = path.join(ROOT, WORKSPACE_FILE);
const SCHEMA_VERSION = 1;

function emptyWorkspace() {
  return {
    schema_version: SCHEMA_VERSION,
    updated_at: null,
    folders: [],
    item_folders: {},
    tags: [],
    item_tags: {},
    item_status: {},
    read: [],
    saved: [],
  };
}

function cleanTag(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim();
  const name = String(raw.name || "").trim();
  if (!id || !name) return null;
  return {
    id: id.slice(0, 80),
    name: name.slice(0, 80),
    color: String(raw.color || "#7f2a1a").slice(0, 32),
  };
}

function normalizeStringList(list, maxLen = 80) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map((v) => String(v).trim().slice(0, maxLen)).filter(Boolean))];
}

function normalizeStringMap(raw, maxKey = 512, maxVal = 80) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) continue;
    out[String(key).slice(0, maxKey)] = [...new Set(value.map((v) => String(v).slice(0, maxVal)))];
  }
  return out;
}

function normalizeStatusMap(raw, maxKey = 512) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  const allowed = new Set(["inbox", "to-read", "trash"]);
  for (const [key, value] of Object.entries(raw)) {
    const status = String(value || "").trim().toLowerCase();
    if (status === "saw") {
      out[String(key).slice(0, maxKey)] = "to-read";
      continue;
    }
    if (status === "read") {
      out[String(key).slice(0, maxKey)] = "inbox";
      continue;
    }
    if (allowed.has(status)) out[String(key).slice(0, maxKey)] = status;
  }
  return out;
}

function normalizeWorkspace(raw) {
  const base = emptyWorkspace();
  if (!raw || typeof raw !== "object") return base;

  const tags = Array.isArray(raw.tags)
    ? raw.tags.map(cleanTag).filter(Boolean)
    : [];

  return {
    schema_version: SCHEMA_VERSION,
    updated_at: raw.updated_at || null,
    folders: normalizeStringList(raw.folders, 80),
    item_folders: normalizeStringMap(raw.item_folders),
    tags,
    item_tags: normalizeStringMap(raw.item_tags),
    item_status: normalizeStatusMap(raw.item_status),
    read: normalizeStringList(raw.read, 2048),
    saved: normalizeStringList(raw.saved, 512),
  };
}

function mergeWorkspace(base, incoming) {
  const left = normalizeWorkspace(base);
  const right = normalizeWorkspace(incoming);
  const rawIncoming = incoming && typeof incoming === "object" ? incoming : {};
  const hasIncoming = (key) => Object.prototype.hasOwnProperty.call(rawIncoming, key);

  const tagMap = new Map();
  for (const tag of [...left.tags, ...right.tags]) tagMap.set(tag.id, tag);

  const folderSet = new Set([...left.folders, ...right.folders]);

  const itemFolders = { ...left.item_folders };
  for (const [key, names] of Object.entries(right.item_folders)) {
    itemFolders[key] = [...new Set([...(itemFolders[key] || []), ...names])];
  }

  const itemTags = { ...left.item_tags };
  for (const [key, ids] of Object.entries(right.item_tags)) {
    itemTags[key] = [...new Set([...(itemTags[key] || []), ...ids])];
  }

  const itemStatus = { ...left.item_status, ...right.item_status };

  return {
    schema_version: SCHEMA_VERSION,
    updated_at: new Date().toISOString(),
    folders: hasIncoming("folders") ? right.folders : [...folderSet],
    item_folders: hasIncoming("item_folders") ? right.item_folders : itemFolders,
    tags: hasIncoming("tags") ? right.tags : [...tagMap.values()],
    item_tags: hasIncoming("item_tags") ? right.item_tags : itemTags,
    item_status: hasIncoming("item_status") ? right.item_status : itemStatus,
    read: hasIncoming("read") ? right.read : [...new Set([...left.read, ...right.read])],
    saved: hasIncoming("saved") ? right.saved : [...new Set([...left.saved, ...right.saved])],
  };
}

function readLocalWorkspace() {
  if (!fs.existsSync(WORKSPACE_PATH)) return emptyWorkspace();
  try {
    return normalizeWorkspace(JSON.parse(fs.readFileSync(WORKSPACE_PATH, "utf8")));
  } catch {
    return emptyWorkspace();
  }
}

function writeLocalWorkspace(state) {
  fs.mkdirSync(path.dirname(WORKSPACE_PATH), { recursive: true });
  fs.writeFileSync(WORKSPACE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
}

async function loadWorkspaceState() {
  if (hasGithubToken()) {
    const { json } = await readGithubJson(WORKSPACE_FILE);
    return normalizeWorkspace(json);
  }

  return readLocalWorkspace();
}

async function saveWorkspaceState(nextState, { merge = true } = {}) {
  let state = normalizeWorkspace(nextState);

  if (merge) {
    const current = await loadWorkspaceState();
    const hasCurrent =
      current.folders.length ||
      current.tags.length ||
      Object.keys(current.item_folders).length ||
      Object.keys(current.item_tags).length ||
      Object.keys(current.item_status).length ||
      current.read.length ||
      current.saved.length;
    if (hasCurrent) state = mergeWorkspace(current, state);
  }

  if (!state.updated_at) state.updated_at = new Date().toISOString();

  if (hasGithubToken()) {
    await writeGithubJson(WORKSPACE_FILE, state, "Sync workspace state");
    return { state, persistence: "github" };
  }

  if (process.env.VERCEL) {
    throw new SaveError(
      500,
      "GITHUB_TOKEN or GH_TOKEN is required for workspace sync in Vercel",
      "missing_github_token"
    );
  }

  writeLocalWorkspace(state);
  return { state, persistence: "local" };
}

module.exports = {
  WORKSPACE_FILE,
  emptyWorkspace,
  normalizeWorkspace,
  mergeWorkspace,
  loadWorkspaceState,
  saveWorkspaceState,
};
