const { loadSignalsPayload } = require("../../lib/signals/data");

// GET /api/signals — state.json + computed rows + recent alerts + chart data.
// Public and login-free by design: no auth, no personal data, ever.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const payload = await loadSignalsPayload();
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
