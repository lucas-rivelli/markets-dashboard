const { buildKbIndex } = require("../lib/kb-index");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const index = buildKbIndex();

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
  res.setHeader("Content-Type", "application/json");

  return res.status(200).json(index);
};
