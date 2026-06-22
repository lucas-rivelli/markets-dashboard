const http = require("http");
const fs = require("fs");
const path = require("path");
const feedHandler = require("../api/feed");
const cronHandler = require("../api/cron");

const ROOT = path.join(__dirname, "..");
const PORT = 3000;

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

  serveStatic(pathname, nodeRes);
});

server.listen(PORT, () => {
  console.log(`Markets dashboard running at http://localhost:${PORT}`);
});
