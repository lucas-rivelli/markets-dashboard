const { searchWiki } = require("../lib/wiki-search");
const { lintWiki, formatLintReport } = require("../lib/wiki-lint");
const { ingestWikiItem, ingestAllWiki, rebuildIndex } = require("../lib/wiki-ingest");
const { syncWikiQueue, readQueueLocal } = require("../lib/wiki-queue");
const { SaveError, hasGithubToken } = require("../lib/kb-save");
const crypto = require("crypto");

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function assertAuthorized(req) {
  if (!hasGithubToken()) return;
  const secret = process.env.SAVE_SECRET;
  if (!secret) {
    throw new SaveError(500, "SAVE_SECRET required for wiki writes", "missing_save_secret");
  }
  const provided =
    req.headers["x-save-secret"] ||
    String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(provided, secret)) {
    throw new SaveError(401, "Unauthorized", "unauthorized");
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method === "GET") {
      const q = String(req.query?.q || "").trim();
      if (q) {
        const results = searchWiki(q, { limit: Number(req.query?.limit || 12) });
        res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
        return res.status(200).json({ ok: true, query: q, results });
      }
      const queue = await syncWikiQueue();
      return res.status(200).json({ ok: true, queue });
    }

    if (req.method === "POST") {
      assertAuthorized(req);
      const body =
        req.body && typeof req.body === "object"
          ? req.body
          : JSON.parse(String(req.body || "{}") || "{}");
      const action = String(body.action || "sync-queue");

      if (action === "lint") {
        const report = lintWiki();
        return res.status(200).json({ ok: true, report, markdown: formatLintReport(report) });
      }

      if (action === "sync-queue") {
        const queue = await syncWikiQueue();
        return res.status(200).json({ ok: true, queue });
      }

      if (action === "rebuild-index") {
        const index = rebuildIndex();
        return res.status(200).json({ ok: true, index });
      }

      if (action === "scaffold-all") {
        const results = await ingestAllWiki();
        return res.status(200).json({ ok: true, count: results.length, results });
      }

      const id = String(body.id || "").trim();
      if (!id) {
        return res.status(400).json({ ok: false, error: "id required for scaffold" });
      }
      const result = await ingestWikiItem(id);
      return res.status(200).json({ ok: true, result });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    const status = err instanceof SaveError ? err.status : 500;
    return res.status(status).json({ ok: false, error: err.message, code: err.code || "wiki_failed" });
  }
};
