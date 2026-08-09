const { dispatchWorkflow } = require("../lib/github-actions");
const { SaveError } = require("../lib/kb-save");

/** Default: at most one bookmark sync per hour (external cron may still ping every 5 min). */
const DEFAULT_MIN_INTERVAL_MS = 60 * 60 * 1000;

function authorize(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const auth = req.headers.authorization || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const querySecret = req.query?.secret;
  return bearer === secret || querySecret === secret;
}

function minIntervalMs() {
  const raw = process.env.BOOKMARKS_SYNC_MIN_INTERVAL_MS;
  if (raw === undefined || raw === "") return DEFAULT_MIN_INTERVAL_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MIN_INTERVAL_MS;
  return n;
}

function syncPaused() {
  const v = (process.env.BOOKMARKS_SYNC_PAUSED || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!authorize(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.setHeader("Cache-Control", "no-store");

  if (syncPaused()) {
    return res.status(200).json({
      ok: true,
      dispatched: false,
      skipped: true,
      reason: "paused",
      workflow: "sync-bookmarks.yml",
    });
  }

  try {
    // External cron may still fire every 5 min; skip when a sync is already
    // queued/running, and enforce a min interval so failure emails / X login
    // alerts cannot pile up.
    const result = await dispatchWorkflow("sync-bookmarks.yml", {
      skipIfActive: true,
      minIntervalMs: minIntervalMs(),
    });
    if (result.skipped) {
      return res.status(200).json({ ok: true, ...result });
    }
    return res.status(202).json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SaveError) {
      return res.status(err.status || 500).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};
