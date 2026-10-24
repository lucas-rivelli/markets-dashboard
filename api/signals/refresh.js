const { dispatchWorkflow } = require("../../lib/github-actions");

// POST /api/signals/refresh — "Refresh now" for the demo.
// Dispatches the signals-refresh GitHub Action on the signals branch.
// Rate limited to once every 5 minutes (and skipped while a run is active)
// via the same dispatchWorkflow helper as /api/trigger-bookmarks.
const MIN_INTERVAL_MS = 5 * 60 * 1000;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Cache-Control", "no-store");
  try {
    const result = await dispatchWorkflow("signals-refresh.yml", {
      ref: process.env.SIGNALS_BRANCH || "fmkt256-signals",
      skipIfActive: true,
      minIntervalMs: MIN_INTERVAL_MS,
    });
    if (result.skipped) {
      return res.status(429).json({
        ok: false,
        error: "Refresh already requested in the last 5 minutes — please wait.",
        ...result,
      });
    }
    return res.status(202).json({ ok: true, message: "Refresh dispatched — new data lands in ~2 minutes.", ...result });
  } catch (err) {
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message,
      hint: "Set GITHUB_DISPATCH_TOKEN (Actions: write) on the signals Vercel project to enable Refresh now.",
    });
  }
};
