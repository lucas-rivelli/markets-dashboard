const { dispatchWorkflow } = require("../lib/github-actions");
const { SaveError } = require("../lib/kb-save");

function authorize(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const auth = req.headers.authorization || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const querySecret = req.query?.secret;
  return bearer === secret || querySecret === secret;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!authorize(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.setHeader("Cache-Control", "no-store");

  try {
    const result = await dispatchWorkflow("sync-bookmarks.yml");
    return res.status(202).json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SaveError) {
      return res.status(err.statusCode || 500).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};
