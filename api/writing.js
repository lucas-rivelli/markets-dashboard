const crypto = require("crypto");
const { upsertWriting, deleteWriting, loadWritings } = require("../lib/writings");
const { SaveError } = require("../lib/kb-save");

const MAX_BODY_BYTES = 512 * 1024;

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
  const secret = process.env.SAVE_SECRET;
  if (!secret) return;
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
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method === "GET") {
      const items = await loadWritings();
      return res.status(200).json({ ok: true, items, count: items.length });
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      assertAuthorized(req, body);
      const saved = await upsertWriting(body);
      return res.status(body.id ? 200 : 201).json({
        ok: true,
        item: saved.item,
        count: saved.items.length,
        persistence: saved.persistence,
      });
    }

    if (req.method === "DELETE") {
      const body = await readJsonBody(req);
      assertAuthorized(req, body);
      const id = body.id || req.query?.id;
      const saved = await deleteWriting(id);
      return res.status(200).json({
        ok: true,
        id: saved.id,
        count: saved.items.length,
        persistence: saved.persistence,
      });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    const status = err instanceof SaveError ? err.status : 400;
    return res.status(status).json({
      ok: false,
      error: err.message,
      code: err.code || "writing_failed",
    });
  }
};
