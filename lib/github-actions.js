const { SaveError } = require("./kb-save");
const { githubConfig } = require("./github-content");

function dispatchToken() {
  return (
    process.env.GITHUB_DISPATCH_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN
  );
}

async function dispatchWorkflow(workflowFile, { ref } = {}) {
  const config = githubConfig();
  const token = dispatchToken();

  if (!token) {
    throw new SaveError(
      "GITHUB_DISPATCH_TOKEN is required to trigger bookmark sync",
      500
    );
  }

  const branch = ref || config.branch || "main";
  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "MarketsDashboard/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: branch }),
    }
  );

  if (res.status === 204) {
    return { dispatched: true, workflow: workflowFile, ref: branch };
  }

  const data = await res.json().catch(() => ({}));
  throw new SaveError(
    data.message || `GitHub dispatch failed (${res.status})`,
    res.status === 401 || res.status === 403 ? 503 : 502,
    { status: res.status, workflow: workflowFile }
  );
}

module.exports = { dispatchWorkflow, dispatchToken };
