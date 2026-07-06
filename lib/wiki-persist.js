const fs = require("fs");
const path = require("path");
const { hasGithubToken, readGithubText, writeGithubText } = require("./github-content");
const { ROOT, KB_WIKI_DIR } = require("./wiki-paths");

function absPath(relPath) {
  const normalized = String(relPath || "").replace(/^kb\/wiki\//, "");
  return path.join(KB_WIKI_DIR, normalized);
}

function ensureWikiDirs() {
  for (const dir of [
    KB_WIKI_DIR,
    path.join(KB_WIKI_DIR, "sources"),
    path.join(KB_WIKI_DIR, "concepts"),
    path.join(KB_WIKI_DIR, "entities"),
    path.join(KB_WIKI_DIR, "queries"),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readWikiFileLocal(relPath) {
  const filePath = absPath(relPath);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

function writeWikiFileLocal(relPath, content) {
  ensureWikiDirs();
  const filePath = absPath(relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  return path.relative(ROOT, filePath);
}

async function readWikiFile(relPath) {
  const githubPath = relPath.startsWith("kb/") ? relPath : `kb/wiki/${relPath}`;
  if (hasGithubToken() && process.env.VERCEL) {
    const remote = await readGithubText(githubPath);
    return remote.text;
  }
  return readWikiFileLocal(relPath);
}

async function writeWikiFile(relPath, content, message) {
  const githubPath = relPath.startsWith("kb/") ? relPath : `kb/wiki/${relPath}`;
  if (hasGithubToken() && process.env.VERCEL) {
    await writeGithubText(githubPath, content, message);
    return githubPath;
  }
  return writeWikiFileLocal(relPath, content);
}

function listWikiMarkdown(subdir = "") {
  ensureWikiDirs();
  const dir = absPath(subdir);
  if (!fs.existsSync(dir)) return [];

  const results = [];
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.name.endsWith(".md")) continue;
      if (entry.name === "index.md" || entry.name === "log.md" || entry.name === "WIKI.md") {
        continue;
      }
      if (["AGENT.md", "CURSOR-AUTOMATION.md", "RUN.md"].includes(entry.name)) continue;
      results.push(path.relative(KB_WIKI_DIR, full).replace(/\\/g, "/"));
    }
  }

  return results.sort();
}

module.exports = {
  ensureWikiDirs,
  readWikiFile,
  writeWikiFile,
  readWikiFileLocal,
  writeWikiFileLocal,
  listWikiMarkdown,
};
