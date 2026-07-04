const { getFeed, REFRESH_MS } = require("../lib/feed-cache");

// SOURCES array — edit here to add/remove sources
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
  {
    name: "Spotify Podcasts",
    category: "Spotify",
    site: "https://open.spotify.com/collection/shows",
    rss: null,
    dynamic: true,
  },
  {
    name: "X Bookmarks",
    category: "Bookmarks",
    site: "https://x.com/i/bookmarks",
    rss: null,
    dynamic: true,
  },
];

const CACHE_SECONDS = Math.floor(REFRESH_MS / 1000);

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const force =
    req.query?.fresh === "1" ||
    req.query?.fresh === "true";

  const data = await getFeed(SOURCES, { force });

  res.setHeader(
    "Cache-Control",
    force
      ? "no-store, no-cache, must-revalidate"
      : `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 2}`
  );
  res.setHeader("Content-Type", "application/json");

  return res.status(200).json(data);
};

module.exports.SOURCES = SOURCES;
