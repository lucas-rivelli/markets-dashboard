const { buildFeedResponse } = require("../lib/aggregate");
const { SOURCES } = require("./feed");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = req.headers.authorization;
  const secret = process.env.CRON_SECRET;

  if (secret && auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const data = await buildFeedResponse(SOURCES);

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
  res.setHeader("Content-Type", "application/json");

  return res.status(200).json({
    ok: true,
    refreshed: data.updated,
    items: data.items.length,
    failed: data.failed,
  });
};
