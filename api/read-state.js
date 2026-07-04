const crypto = require("crypto");
const { SaveError, hasGithubToken } = require("../lib/kb-save");
const { getReadState, patchReadState } = require("../lib/read-state");

const MAX_BODY_BYTES = 64 * 1024;

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
      "SAVE_SECRET is required when GitHub-backed sync is enabled",
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

function normalizeKeys(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry || "").trim()).filter(Boolean);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET") {
    try {
      const { state, persistence } = await getReadState();
      return res.status(200).json({
        ok: true,
        ...state,
        persistence,
      });
    } catch (err) {
      const status = err instanceof SaveError ? err.status : 500;
      return res.status(status).json({
        ok: false,
        error: err.message,
        code: err.code || "read_state_load_failed",
      });
    }
  }

  if (req.method === "PATCH") {
    try {
      const body = await readJsonBody(req);
      assertAuthorized(req, body);

      const patched = await patchReadState({
        read: normalizeKeys(body.read),
        unread: normalizeKeys(body.unread),
      });

      return res.status(200).json({
        ok: true,
        ...patched.state,
        persistence: patched.persistence,
      });
    } catch (err) {
      const status = err instanceof SaveError ? err.status : 400;
      return res.status(status).json({
        ok: false,
        error: err.message,
        code: err.code || "read_state_patch_failed",
      });
    }
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
};
