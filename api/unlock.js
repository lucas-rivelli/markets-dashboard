const crypto = require("crypto");
const { SaveError } = require("../lib/kb-save");

const MAX_BODY_BYTES = 8 * 1024;

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
    body?.password ||
    ""
  );
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
    const configured = Boolean(process.env.SAVE_SECRET);

    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        required: configured,
      });
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      if (!configured) {
        return res.status(200).json({ ok: true, required: false, unlocked: true });
      }
      if (!safeEqual(requestSecret(req, body), process.env.SAVE_SECRET)) {
        throw new SaveError(401, "Wrong password", "unauthorized");
      }
      return res.status(200).json({ ok: true, required: true, unlocked: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    const status = err instanceof SaveError ? err.status : 400;
    return res.status(status).json({
      ok: false,
      error: err.message,
      code: err.code || "unlock_failed",
    });
  }
};
