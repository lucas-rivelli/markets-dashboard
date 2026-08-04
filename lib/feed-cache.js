const fs = require("fs");
const path = require("path");
const { buildFeedResponse } = require("./aggregate");

const ROOT = path.join(__dirname, "..");
const FEED_CACHE_FILE = path.join(ROOT, "data", "feed-cache.json");
const REFRESH_MS = 5 * 60 * 1000;

function readFeedCache() {
  if (!fs.existsSync(FEED_CACHE_FILE)) return null;

  try {
    const payload = JSON.parse(fs.readFileSync(FEED_CACHE_FILE, "utf8"));
    if (!payload?.data?.items) return null;

    const cachedAt = payload.cached_at ? new Date(payload.cached_at).getTime() : 0;
    const ageMs = cachedAt ? Date.now() - cachedAt : Infinity;

    return {
      data: payload.data,
      cachedAt: payload.cached_at || null,
      ageMs,
      stale: ageMs >= REFRESH_MS,
    };
  } catch {
    return null;
  }
}

function writeFeedCache(data) {
  fs.mkdirSync(path.dirname(FEED_CACHE_FILE), { recursive: true });
  fs.writeFileSync(
    FEED_CACHE_FILE,
    JSON.stringify(
      {
        cached_at: new Date().toISOString(),
        data,
      },
      null,
      2
    ) + "\n"
  );
}

async function refreshFeedCache(sources, { force = false } = {}) {
  const data = await buildFeedResponse(sources, { force });

  if (!process.env.VERCEL) {
    writeFeedCache(data);
  }

  return data;
}

async function getFeed(sources, { force = false } = {}) {
  if (!force && !process.env.VERCEL) {
    const cached = readFeedCache();
    if (cached && !cached.stale) {
      return {
        ...cached.data,
        cache: {
          hit: true,
          cached_at: cached.cachedAt,
          age_ms: cached.ageMs,
        },
      };
    }
  }

  const data = await refreshFeedCache(sources, { force });

  return {
    ...data,
    cache: {
      hit: false,
      cached_at: new Date().toISOString(),
      age_ms: 0,
    },
  };
}

module.exports = {
  FEED_CACHE_FILE,
  REFRESH_MS,
  getFeed,
  readFeedCache,
  refreshFeedCache,
  writeFeedCache,
};
