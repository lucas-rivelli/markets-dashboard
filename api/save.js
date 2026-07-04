const crypto = require("crypto");
const {
  SaveError,
  hasGithubToken,
  saveKnowledgeItem,
  unsaveKnowledgeItem,
} = require("../lib/kb-save");

const MAX_BODY_BYTES = 1024 * 1024;

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function bearerToken(authHeader) {
  const match = String(authHeader || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function requestSecret(req, body) {
  return (
    req.headers["x-save-secret"] ||
    bearerToken(req.headers.authorization) ||
    body?.saveSecret ||
    body?.secret ||
    ""
  );
}

function assertAuthorized(req, body) {
  if (!hasGithubToken()) return;

  const secret = process.env.SAVE_SECRET;
  if (!secret) {
    throw new SaveError(
      500,
      "SAVE_SECRET is required when GitHub-backed saves are enabled",
      "missing_save_secret"
    );
  }

  if (!safeEqual(requestSecret(req, body), secret)) {
    throw new SaveError(401, "Unauthorized", "unauthorized");
  }
}

async function readJsonBody(req) {
  if (Buffer.isBuffer(req.body)) {
    return JSON.parse(req.body.toString("utf8") || "{}");
  }
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new SaveError(413, "Request body is too large", "body_too_large");
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    res.setHeader("Allow", "POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    assertAuthorized(req, body);

    if (req.method === "DELETE") {
      const removed = await unsaveKnowledgeItem(body);

      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "application/json");

      return res.status(200).json({
        ok: true,
        id: removed.id,
        path: removed.result.path,
        persistence: removed.persistence,
        alreadyRemoved: removed.result.alreadyRemoved,
      });
    }

    const saved = await saveKnowledgeItem(body);

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");

    return res.status(saved.result.alreadySaved ? 200 : 201).json({
      ok: true,
      id: saved.record.id,
      path: saved.result.path,
      persistence: saved.persistence,
      alreadySaved: saved.result.alreadySaved,
      item: saved.record,
    });
  } catch (err) {
    const status = err instanceof SaveError ? err.status : 400;

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");

    return res.status(status).json({
      ok: false,
      error: err.message,
      code: err.code || "save_failed",
    });
  }
};
