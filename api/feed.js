const { getFeed, REFRESH_MS } = require("../lib/feed-cache");
const { fundLetterSources } = require("../lib/fund-letters");

// SOURCES array — edit here to add/remove RSS and launchpad sources.
// Fund letters come from data/fund-letters-config.json (appended via allSources()).
const BASE_SOURCES = [
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
    name: "Wizard's Winners",
    category: "Substack",
    site: "https://wizardswinners.substack.com",
    rss: "https://wizardswinners.substack.com/feed",
  },
  {
    name: "Bristlemoon Capital",
    category: "Substack",
    site: "https://www.bristlemoonresearch.com",
    rss: "https://www.bristlemoonresearch.com/feed",
  },
  {
    name: "Philipp Haas",
    category: "Substack",
    site: "https://investresearch.substack.com",
    rss: "https://investresearch.substack.com/feed",
  },
  {
    name: "Indra's Thoughts",
    category: "Substack",
    site: "https://indrastocks.substack.com",
    rss: "https://indrastocks.substack.com/feed",
  },
  {
    name: "Casteleyn Partnership",
    category: "Substack",
    site: "https://kevincasteleijn.substack.com",
    rss: "https://kevincasteleijn.substack.com/feed",
  },
  {
    name: "TacticzHazel",
    category: "Substack",
    site: "https://tacticzhazel.substack.com",
    rss: "https://tacticzhazel.substack.com/feed",
  },
  {
    name: "HF Best Ideas",
    category: "Substack",
    site: "https://hfbestideas.substack.com",
    rss: "https://hfbestideas.substack.com/feed",
  },
  {
    name: "Hated Moats",
    category: "Substack",
    site: "https://hatedmoats.substack.com",
    rss: "https://hatedmoats.substack.com/feed",
  },
  {
    name: "Works in Progress",
    category: "Substack",
    site: "https://www.worksinprogress.news",
    rss: "https://www.worksinprogress.news/feed",
  },
  {
    name: "The Etymology Nerd",
    category: "Substack",
    site: "https://etymology.substack.com",
    rss: "https://etymology.substack.com/feed",
  },
  {
    name: "Meditations for the Anxious",
    category: "Substack",
    site: "https://meditationsfortheanxiousmind.substack.com",
    rss: "https://meditationsfortheanxiousmind.substack.com/feed",
  },
  {
    name: "Experimental History",
    category: "Substack",
    site: "https://www.experimental-history.com",
    rss: "https://www.experimental-history.com/feed",
  },
  {
    name: "luminousmen",
    category: "Substack",
    site: "https://luminousmen.substack.com",
    rss: "https://luminousmen.substack.com/feed",
  },
  {
    name: "Value Investors Club",
    category: "Investing",
    site: "https://valueinvestorsclub.com/ideas",
    rss: null,
    dynamic: true,
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
  {
    name: "Saved Links",
    category: "Bookmarks",
    site: "/",
    rss: null,
    dynamic: true,
  },
];

function allSources() {
  return [...BASE_SOURCES, ...fundLetterSources()];
}

const CACHE_SECONDS = Math.floor(REFRESH_MS / 1000);

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const force =
    req.query?.fresh === "1" ||
    req.query?.fresh === "true";

  const data = await getFeed(allSources(), { force });

  res.setHeader(
    "Cache-Control",
    force
      ? "no-store, no-cache, must-revalidate"
      : `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 2}`
  );
  res.setHeader("Content-Type", "application/json");

  return res.status(200).json(data);
};

Object.defineProperty(module.exports, "SOURCES", {
  enumerable: true,
  get: () => allSources(),
});
