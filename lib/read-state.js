const fs = require("fs");
const path = require("path");
const {
  SaveError,
  hasGithubToken,
  githubConfig,
  githubRequest,
} = require("./kb-save");
const { stableItemId } = require("./item-id");

const ROOT = path.join(__dirname, "..");
const READ_STATE_PATH = path.join(ROOT, "data", "read-state.json");
const READ_STATE_GITHUB_PATH = "data/read-state.json";
const MAX_READ_ENTRIES = 10000;

function emptyState() {
  return { updated: null, read: [] };
}

function normalizeReadKey(key) {
  const k = String(key || "").trim();
  if (!k) return null;
  if (/^https?:\/\//i.test(k)) return stableItemId(k);
  return k;
}

function normalizeState(raw) {
  const read = [...new Set((raw?.read || []).map(normalizeReadKey).filter(Boolean))];
  if (read.length > MAX_READ_ENTRIES) {
    read.splice(0, read.length - MAX_READ_ENTRIES);
  }
  return {
    updated: raw?.updated || null,
    read,
  };
}

function loadFromLocalFs() {
  if (!fs.existsSync(READ_STATE_PATH)) return emptyState();
  try {
    return normalizeState(JSON.parse(fs.readFileSync(READ_STATE_PATH, "utf8")));
  } catch {
    return emptyState();
  }
}

function saveToLocalFs(state) {
  const next = normalizeState({ ...state, updated: new Date().toISOString() });
  fs.mkdirSync(path.dirname(READ_STATE_PATH), { recursive: true });
  fs.writeFileSync(READ_STATE_PATH, JSON.stringify(next, null, 2) + "\n");
  return next;
}

async function loadFromGithub() {
  const config = githubConfig();
  const encodedPath = READ_STATE_GITHUB_PATH.split("/").map(encodeURIComponent).join("/");
  const repoPath = `/repos/${config.owner}/${config.repo}/contents/${encodedPath}`;
  const file = await githubRequest(
    config,
    `${repoPath}?ref=${encodeURIComponent(config.branch)}`
  );

  if (!file?.content) {
    return { state: emptyState(), sha: null };
  }

  const raw = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
  return { state: normalizeState(raw), sha: file.sha || null };
}

async function saveToGithub(state, sha) {
  const config = githubConfig();
  const encodedPath = READ_STATE_GITHUB_PATH.split("/").map(encodeURIComponent).join("/");
  const repoPath = `/repos/${config.owner}/${config.repo}/contents/${encodedPath}`;
  const next = normalizeState({ ...state, updated: new Date().toISOString() });
  const body = {
    message: "Update read state",
    content: Buffer.from(JSON.stringify(next, null, 2) + "\n", "utf8").toString("base64"),
    branch: config.branch,
  };
  if (sha) body.sha = sha;

  await githubRequest(config, repoPath, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  return next;
}

async function getReadState() {
  if (hasGithubToken()) {
    const { state, sha } = await loadFromGithub();
    return { state, sha, persistence: "github" };
  }

  if (process.env.VERCEL) {
    return { state: loadFromLocalFs(), sha: null, persistence: "vercel-static" };
  }

  return { state: loadFromLocalFs(), sha: null, persistence: "local" };
}

async function patchReadState({ read = [], unread = [] }) {
  const current = await getReadState();
  const set = new Set(current.state.read || []);

  for (const key of read) {
    const k = normalizeReadKey(key);
    if (k) set.add(k);
  }
  for (const key of unread) {
    const k = normalizeReadKey(key);
    if (k) set.delete(k);
  }

  const next = { read: [...set], updated: new Date().toISOString() };

  if (hasGithubToken()) {
    const saved = await saveToGithub(next, current.sha);
    return { state: saved, persistence: "github" };
  }

  if (process.env.VERCEL) {
    throw new SaveError(
      500,
      "GITHUB_TOKEN is required for read-state writes on Vercel",
      "missing_github_token"
    );
  }

  return { state: saveToLocalFs(next), persistence: "local" };
}

module.exports = {
  getReadState,
  patchReadState,
  normalizeReadKey,
};
