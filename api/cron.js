const { refreshFeedCache } = require("../lib/feed-cache");
const { SOURCES } = require("./feed");

const CACHE_SECONDS = 5 * 60;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = req.headers.authorization;
  const secret = process.env.CRON_SECRET;

  if (secret && auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const data = await refreshFeedCache(SOURCES, { force: true });

  res.setHeader(
    "Cache-Control",
    `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 2}`
  );
  res.setHeader("Content-Type", "application/json");

  return res.status(200).json({
    ok: true,
    refreshed: data.updated,
    items: data.items.length,
    failed: data.failed,
    meta: data.meta,
  });
};
