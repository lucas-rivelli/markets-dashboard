const { buildFeedResponse } = require("../lib/aggregate");

// ─── SOURCES ──────────────────────────────────────────────────────────────────
// This is the ONLY place you need to edit to add or remove sources.
//
// Schema: { name, category, site, rss }
//   name     – display name shown in the UI
//   category – one of: "Substack" | "YouTube" | "Blog" | "Macro/Official"
//   site     – homepage URL (used for the launchpad card link)
//   rss      – feed URL, or null if no usable feed exists (source still appears
//              in the launchpad but not in Latest)
//
// ── How to find feed URLs ─────────────────────────────────────────────────────
//   Substack  → https://PUBLICATION.substack.com/feed
//   YouTube   → https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
//   Blog      → try https://DOMAIN/feed or https://DOMAIN/rss or https://DOMAIN/rss.xml
// ─────────────────────────────────────────────────────────────────────────────

const SOURCES = [
  {
    name: "Jordi Visser",
    category: "Substack",
    site: "https://visserlabs.substack.com",
    rss: "https://visserlabs.substack.com/feed",
  },
  {
    name: "Jordi Visser Labs",
    category: "YouTube",
    site: "https://www.youtube.com/@JordiVisserLabs",
    rss: "https://www.youtube.com/feeds/videos.xml?channel_id=UCSLOw8JrFTBb3qF-p4v0v_w",
  },
  {
    name: "Consilient Observer",
    category: "Macro/Official",
    site: "https://www.morganstanley.com/im/en-us/financial-advisor/insights/series/consilient-observer.html",
    rss: null,
  },
  {
    name: "ARK Next Gen Internet",
    category: "Substack",
    site: "https://substack.com/@arknextgeninternetteam",
    rss: "https://arknextgeninternetteam.substack.com/feed",
  },
  {
    name: "Rebound Capital",
    category: "Substack",
    site: "https://substack.com/@reboundcapital",
    rss: "https://reboundcapital.substack.com/feed",
  },
  {
    name: "Citrini Research",
    category: "Substack",
    site: "https://substack.com/@citrini",
    rss: "https://citrini.substack.com/feed",
  },
  {
    name: "Gregory Blotnick",
    category: "Blog",
    site: "https://gregoryblotnick.com/posts/",
    rss: "https://gregoryblotnick.com/posts/feed/",
  },
  {
    name: "Kyle Samani",
    category: "Blog",
    site: "https://kylesamani.com/",
    rss: "https://kylesamani.com/rss.xml",
  },
  {
    name: "Paul Graham",
    category: "Blog",
    site: "https://paulgraham.com/articles.html",
    rss: "https://raw.githubusercontent.com/olshansk/pgessays-rss/main/feed.xml",
  },
  {
    name: "Ray Dalio",
    category: "Substack",
    site: "https://raydalio.substack.com",
    rss: "https://raydalio.substack.com/feed",
  },
];

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const fresh =
    req.query?.fresh === "1" ||
    req.query?.fresh === "true";

  const data = await buildFeedResponse(SOURCES);

  res.setHeader(
    "Cache-Control",
    fresh
      ? "no-store, no-cache, must-revalidate"
      : "s-maxage=1800, stale-while-revalidate=3600"
  );
  res.setHeader("Content-Type", "application/json");

  return res.status(200).json(data);
};

module.exports.SOURCES = SOURCES;
