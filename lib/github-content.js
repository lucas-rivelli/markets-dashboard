const { SaveError } = require("./kb-save");

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

function encodeRepoPath(filePath) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

async function readGithubJson(filePath) {
  const config = githubConfig();
  const repoPath = `/repos/${config.owner}/${config.repo}/contents/${encodeRepoPath(filePath)}`;
  const data = await githubRequest(
    config,
    `${repoPath}?ref=${encodeURIComponent(config.branch)}`
  );

  if (!data?.content) return { json: null, sha: null };

  const raw = Buffer.from(data.content, "base64").toString("utf8");
  return { json: JSON.parse(raw), sha: data.sha };
}

async function writeGithubJson(filePath, json, message) {
  const config = githubConfig();
  const repoPath = `/repos/${config.owner}/${config.repo}/contents/${encodeRepoPath(filePath)}`;
  const existing = await githubRequest(
    config,
    `${repoPath}?ref=${encodeURIComponent(config.branch)}`
  );

  const body = {
    message,
    content: Buffer.from(JSON.stringify(json, null, 2) + "\n", "utf8").toString("base64"),
    branch: config.branch,
  };

  if (existing?.sha) body.sha = existing.sha;

  const created = await githubRequest(config, repoPath, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  return {
    sha: created?.content?.sha,
    commit: created?.commit?.sha,
  };
}

async function readGithubText(filePath) {
  const config = githubConfig();
  const repoPath = `/repos/${config.owner}/${config.repo}/contents/${encodeRepoPath(filePath)}`;
  const data = await githubRequest(
    config,
    `${repoPath}?ref=${encodeURIComponent(config.branch)}`
  );

  if (!data?.content) return { text: null, sha: null };

  return {
    text: Buffer.from(data.content, "base64").toString("utf8"),
    sha: data.sha,
  };
}

async function writeGithubText(filePath, text, message) {
  const config = githubConfig();
  const repoPath = `/repos/${config.owner}/${config.repo}/contents/${encodeRepoPath(filePath)}`;
  const existing = await githubRequest(
    config,
    `${repoPath}?ref=${encodeURIComponent(config.branch)}`
  );

  const body = {
    message,
    content: Buffer.from(String(text || ""), "utf8").toString("base64"),
    branch: config.branch,
  };

  if (existing?.sha) body.sha = existing.sha;

  const created = await githubRequest(config, repoPath, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  return {
    sha: created?.content?.sha,
    commit: created?.commit?.sha,
  };
}

module.exports = {
  githubConfig,
  hasGithubToken,
  githubRequest,
  readGithubJson,
  writeGithubJson,
  readGithubText,
  writeGithubText,
};
