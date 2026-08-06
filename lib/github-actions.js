const { SaveError } = require("./kb-save");
const { githubConfig } = require("./github-content");

function dispatchToken() {
  return (
    process.env.GITHUB_DISPATCH_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN
  );
}

async function githubActionsRequest(apiPath, options = {}) {
  const token = dispatchToken();
  if (!token) {
    throw new SaveError(
      500,
      "GITHUB_DISPATCH_TOKEN is required to trigger bookmark sync",
      "missing_dispatch_token"
    );
  }

  const res = await fetch(`https://api.github.com${apiPath}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "MarketsDashboard/1.0",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return { status: 204, data: null };

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, ok: res.ok };
}

async function listRecentWorkflowRuns(workflowFile, { perPage = 5 } = {}) {
  const config = githubConfig();
  const { status, data, ok } = await githubActionsRequest(
    `/repos/${config.owner}/${config.repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=${perPage}&branch=${encodeURIComponent(config.branch || "main")}`
  );

  if (!ok) {
    throw new SaveError(
      status === 401 || status === 403 ? 503 : 502,
      data?.message || `GitHub workflow runs lookup failed (${status})`,
      "workflow_runs_failed"
    );
  }

  return data?.workflow_runs || [];
}

async function findActiveWorkflowRun(workflowFile) {
  const runs = await listRecentWorkflowRuns(workflowFile, { perPage: 5 });
  return (
    runs.find((run) => run.status === "queued" || run.status === "in_progress" || run.status === "waiting") ||
    null
  );
}

async function dispatchWorkflow(workflowFile, { ref, skipIfActive = false } = {}) {
  const config = githubConfig();
  const token = dispatchToken();

  if (!token) {
    throw new SaveError(
      500,
      "GITHUB_DISPATCH_TOKEN is required to trigger bookmark sync",
      "missing_dispatch_token"
    );
  }

  if (skipIfActive) {
    const active = await findActiveWorkflowRun(workflowFile);
    if (active) {
      return {
        dispatched: false,
        skipped: true,
        reason: "already_running",
        workflow: workflowFile,
        run_id: active.id,
        run_status: active.status,
        html_url: active.html_url || null,
      };
    }
  }

  const branch = ref || config.branch || "main";
  const { status, data } = await githubActionsRequest(
    `/repos/${config.owner}/${config.repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`,
    {
      method: "POST",
      body: JSON.stringify({ ref: branch }),
    }
  );

  if (status === 204) {
    return { dispatched: true, skipped: false, workflow: workflowFile, ref: branch };
  }

  throw new SaveError(
    status === 401 || status === 403 ? 503 : 502,
    data?.message || `GitHub dispatch failed (${status})`,
    "workflow_dispatch_failed"
  );
}

module.exports = {
  dispatchWorkflow,
  dispatchToken,
  findActiveWorkflowRun,
  listRecentWorkflowRuns,
};
