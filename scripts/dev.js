const http = require("http");
const fs = require("fs");
const path = require("path");
const feedHandler = require("../api/feed");
const cronHandler = require("../api/cron");
const triggerBookmarksHandler = require("../api/trigger-bookmarks");
const libraryHandler = require("../api/library");
const saveHandler = require("../api/save");
const manualLinkHandler = require("../api/manual-link");
const workspaceHandler = require("../api/workspace");
const readStateHandler = require("../api/read-state");
const { refreshFeedCache, REFRESH_MS } = require("../lib/feed-cache");
const { SOURCES } = require("../api/feed");

const ROOT = path.join(__dirname, "..");
const PORT = 3000;

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
};

function vercelRes(nodeRes) {
  return {
    setHeader: (key, value) => nodeRes.setHeader(key, value),
    status(code) {
      nodeRes.statusCode = code;
      return {
        json(body) {
          if (!nodeRes.getHeader("Content-Type")) {
            nodeRes.setHeader("Content-Type", "application/json");
          }
          nodeRes.end(JSON.stringify(body));
        },
      };
    },
  };
}

function serveStatic(urlPath, nodeRes) {
  const safePath = urlPath === "/" ? "index.html" : urlPath.replace(/^\//, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    nodeRes.statusCode = 403;
    nodeRes.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      nodeRes.statusCode = 404;
      nodeRes.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    nodeRes.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    nodeRes.end(data);
  });
}

function parseUrl(url) {
  const [pathname, search = ""] = url.split("?");
  const query = {};
  for (const part of search.split("&")) {
    if (!part) continue;
    const [key, value = ""] = part.split("=");
    query[decodeURIComponent(key)] = decodeURIComponent(value);
  }
  return { pathname, query };
}

const server = http.createServer(async (nodeReq, nodeRes) => {
  const { pathname, query } = parseUrl(nodeReq.url);
  nodeReq.query = query;

  if (pathname === "/api/feed") {
    try {
      await feedHandler(nodeReq, vercelRes(nodeRes));
    } catch (err) {
      nodeRes.statusCode = 500;
      nodeRes.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === "/api/cron") {
    try {
      await cronHandler(nodeReq, vercelRes(nodeRes));
    } catch (err) {
      nodeRes.statusCode = 500;
      nodeRes.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === "/api/trigger-bookmarks") {
    try {
      await triggerBookmarksHandler(nodeReq, vercelRes(nodeRes));
    } catch (err) {
      nodeRes.statusCode = 500;
      nodeRes.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === "/api/library") {
    try {
      await libraryHandler(nodeReq, vercelRes(nodeRes));
    } catch (err) {
      nodeRes.statusCode = 500;
      nodeRes.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === "/api/save") {
    try {
      await saveHandler(nodeReq, vercelRes(nodeRes));
    } catch (err) {
      nodeRes.statusCode = 500;
      nodeRes.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === "/api/manual-link") {
    try {
      await manualLinkHandler(nodeReq, vercelRes(nodeRes));
    } catch (err) {
      nodeRes.statusCode = 500;
      nodeRes.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === "/api/workspace") {
    try {
      await workspaceHandler(nodeReq, vercelRes(nodeRes));
    } catch (err) {
      nodeRes.statusCode = 500;
      nodeRes.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === "/api/read-state") {
    try {
      await readStateHandler(nodeReq, vercelRes(nodeRes));
    } catch (err) {
      nodeRes.statusCode = 500;
      nodeRes.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  serveStatic(pathname, nodeRes);
});

async function warmFeedCache() {
  try {
    const data = await refreshFeedCache(SOURCES);
    console.log(
      `Feed cache refreshed — ${data.items.length} items` +
        (data.failed?.length ? ` (${data.failed.length} source(s) failed)` : "")
    );
  } catch (err) {
    console.error("Feed cache refresh failed:", err.message);
  }
}

server.listen(PORT, () => {
  console.log(`Markets dashboard running at http://localhost:${PORT}`);
  warmFeedCache();
  setInterval(warmFeedCache, REFRESH_MS);
});
