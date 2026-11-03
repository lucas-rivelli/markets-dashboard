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

async function readGithubBlob(config, sha) {
  if (!sha) return null;
  const blob = await githubRequest(
    config,
    `/repos/${config.owner}/${config.repo}/git/blobs/${sha}`
  );
  if (!blob?.content) return null;
  const encoding = blob.encoding === "base64" ? "base64" : "utf8";
  return Buffer.from(blob.content, encoding).toString("utf8");
}

/** Contents API only inlines files ≤1MB. Larger files (workspace.json) need the blob API. */
async function readGithubFile(filePath) {
  const config = githubConfig();
  const repoPath = `/repos/${config.owner}/${config.repo}/contents/${encodeRepoPath(filePath)}`;
  const data = await githubRequest(
    config,
    `${repoPath}?ref=${encodeURIComponent(config.branch)}`
  );

  if (!data) return { text: null, sha: null };

  if (data.content) {
    return {
      text: Buffer.from(data.content, "base64").toString("utf8"),
      sha: data.sha,
    };
  }

  // size present, content omitted → file too large for Contents API (1MB cap)
  const text = await readGithubBlob(config, data.sha);
  if (text == null) {
    throw new SaveError(
      503,
      `Failed to read large GitHub file ${filePath}`,
      "github_blob_read_failed"
    );
  }
  return { text, sha: data.sha || null };
}

async function readGithubJson(filePath) {
  const { text, sha } = await readGithubFile(filePath);
  if (text == null) return { json: null, sha: null };
  return { json: JSON.parse(text), sha };
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
  return readGithubFile(filePath);
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
