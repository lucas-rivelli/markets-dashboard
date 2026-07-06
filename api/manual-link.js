const crypto = require("crypto");
const { addManualLink } = require("../lib/manual-links");
const { SaveError } = require("../lib/kb-save");

const MAX_BODY_BYTES = 64 * 1024;
const FETCH_TIMEOUT_MS = 5000;

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

function extractMetaContent(html, property) {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  return html.match(pattern)?.[1] || "";
}

function extractTitle(html) {
  const ogTitle = extractMetaContent(html, "og:title");
  if (ogTitle) return ogTitle;
  const twitterTitle = extractMetaContent(html, "twitter:title");
  if (twitterTitle) return twitterTitle;
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function enrichFromUrl(body) {
  if (body.title && body.snippet) return body;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(body.link || body.url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MarketsDashboard/1.0; +https://github.com/lucas-rivelli/markets-dashboard)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return body;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return body;

    const html = (await res.text()).slice(0, 200000);
    return {
      ...body,
      title: body.title || decodeEntities(extractTitle(html)),
      snippet:
        body.snippet ||
        decodeEntities(
          extractMetaContent(html, "description") ||
          extractMetaContent(html, "og:description") ||
          extractMetaContent(html, "twitter:description")
        ),
    };
  } catch {
    return body;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    assertAuthorized(req, body);
    const saved = await addManualLink(await enrichFromUrl(body));

    return res.status(201).json({
      ok: true,
      item: saved.item,
      count: saved.items.length,
      persistence: saved.persistence,
    });
  } catch (err) {
    const status = err instanceof SaveError ? err.status : 400;
    return res.status(status).json({
      ok: false,
      error: err.message,
      code: err.code || "manual_link_failed",
    });
  }
};
