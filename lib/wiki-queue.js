const fs = require("fs");
const path = require("path");
const { hasGithubToken, readGithubText, writeGithubText } = require("./github-content");
const { KB_INBOX_DIR, KB_WIKI_DIR } = require("./wiki-paths");
const { parseFrontmatter } = require("./wiki-frontmatter");

const QUEUE_FILE = path.join(KB_WIKI_DIR, "queue.json");
const QUEUE_REPO_PATH = "kb/wiki/queue.json";

function defaultQueue() {
  return { schema_version: 1, updated_at: null, pending: [] };
}

function readQueueLocal() {
  if (!fs.existsSync(QUEUE_FILE)) return defaultQueue();
  try {
    return { ...defaultQueue(), ...JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8")) };
  } catch {
    return defaultQueue();
  }
}

async function readQueue() {
  if (hasGithubToken() && process.env.VERCEL) {
    const remote = await readGithubText(QUEUE_REPO_PATH);
    if (!remote.text) return defaultQueue();
    try {
      return { ...defaultQueue(), ...JSON.parse(remote.text) };
    } catch {
      return defaultQueue();
    }
  }
  return readQueueLocal();
}

function writeQueueLocal(queue) {
  fs.mkdirSync(KB_WIKI_DIR, { recursive: true });
  const payload = { ...queue, updated_at: new Date().toISOString() };
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return payload;
}

async function writeQueue(queue) {
  const payload = { ...queue, updated_at: new Date().toISOString() };
  const text = JSON.stringify(payload, null, 2) + "\n";
  if (hasGithubToken() && process.env.VERCEL) {
    await writeGithubText(QUEUE_REPO_PATH, text, "Update wiki agent queue");
    return payload;
  }
  return writeQueueLocal(payload);
}

function sourceAgentStatus(id) {
  const filePath = path.join(KB_WIKI_DIR, "sources", `${id}.md`);
  if (!fs.existsSync(filePath)) return "missing";
  const { frontmatter } = parseFrontmatter(fs.readFileSync(filePath, "utf8"));
  return frontmatter.agent_status || "pending";
}

function listInboxRecords() {
  if (!fs.existsSync(KB_INBOX_DIR)) return [];
  return fs
    .readdirSync(KB_INBOX_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const filePath = path.join(KB_INBOX_DIR, name);
      const record = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return { ...record, id: record.id || name.replace(/\.json$/, "") };
    });
}

function needsAgent(record) {
  const status = sourceAgentStatus(record.id);
  return status === "missing" || status === "pending";
}

function mergePending(queue, records) {
  const map = new Map((queue.pending || []).map((entry) => [entry.id, entry]));

  for (const record of records) {
    if (!needsAgent(record)) {
      map.delete(record.id);
      continue;
    }
    map.set(record.id, {
      id: record.id,
      title: record.title,
      url: record.url,
      category: record.category,
      folders: record.folders || [],
      queued_at: map.get(record.id)?.queued_at || new Date().toISOString(),
      reason: sourceAgentStatus(record.id) === "missing" ? "missing_wiki_source" : "pending_agent",
    });
  }

  return { ...queue, pending: [...map.values()] };
}

async function enqueueWikiItem(record) {
  if (!record?.id) return null;
  const queue = await readQueue();
  const pending = new Map((queue.pending || []).map((entry) => [entry.id, entry]));
  pending.set(record.id, {
    id: record.id,
    title: record.title,
    url: record.url,
    category: record.category,
    folders: record.folders || [],
    queued_at: new Date().toISOString(),
    reason: "new_save",
  });
  return writeQueue({ ...queue, pending: [...pending.values()] });
}

async function syncWikiQueue() {
  const queue = await readQueue();
  const records = listInboxRecords();
  return writeQueue(mergePending(queue, records));
}

function markAgentDone(id) {
  const queue = readQueueLocal();
  const pending = (queue.pending || []).filter((entry) => entry.id !== id);
  return writeQueueLocal({ ...queue, pending });
}

module.exports = {
  readQueue,
  readQueueLocal,
  writeQueue,
  writeQueueLocal,
  enqueueWikiItem,
  syncWikiQueue,
  markAgentDone,
  needsAgent,
  listInboxRecords,
  sourceAgentStatus,
};
