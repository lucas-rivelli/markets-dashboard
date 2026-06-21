const Parser = require("rss-parser");

// ─── SOURCES ──────────────────────────────────────────────────────────────────
// This is the ONLY place you need to edit to add or remove sources.
//
// Schema: { name, category, site, rss }
//   name     – display name shown in the UI
//   category – one of: "Substack" | "YouTube" | "Blog" | "Macro/Official" | "X"
//   site     – homepage URL (used for the launchpad card link)
//   rss      – feed URL, or null if no usable feed exists (source still appears
//              in the launchpad but not in Latest)
//
// ── How to find feed URLs ─────────────────────────────────────────────────────
//   Substack  → https://PUBLICATION.substack.com/feed
//   YouTube   → https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
//               (Find channel_id: go to the channel page → view source → search
//               for "channelId" or use a site like commentpicker.com/youtube-channel-id.php)
//   Blog      → try https://DOMAIN/feed or https://DOMAIN/rss or https://DOMAIN/rss.xml
//   X/Twitter → X does not offer native RSS. Leave rss: null (launchpad only).
//               If you use RSS.app or Inoreader to create a feed for an X account,
//               paste that URL here and it will work like any other feed.
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
    rss: null, // Morgan Stanley does not publish RSS for this series
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
    category: "X",
    site: "https://x.com/gregoryblotnick",
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
];

// ─── HANDLER ──────────────────────────────────────────────────────────────────

const ITEMS_PER_FEED = 10;
const TOTAL_ITEM_CAP = 80;
const FETCH_TIMEOUT_MS = 8000;

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; MarketsDashboard/1.0; +https://github.com/your-handle/markets-dashboard)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  customFields: {
    item: [["media:thumbnail", "mediaThumbnail"]],
  },
});

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSnippet(item) {
  const raw = item.contentSnippet || item.summary || item.content || "";
  const text = stripHtml(raw);
  if (!text) return "";
  return text.length > 200 ? text.slice(0, 197) + "…" : text;
}

async function fetchFeed(source) {
  const feed = await parser.parseURL(source.rss);
  const items = (feed.items || []).slice(0, ITEMS_PER_FEED).map((item) => ({
    source: source.name,
    category: source.category,
    title: (item.title || "Untitled").trim(),
    link: item.link || item.guid || source.site,
    date: item.isoDate || item.pubDate || null,
    snippet: extractSnippet(item),
  }));
  return items;
}

module.exports = async function handler(req, res) {
  // Only GET
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const feedSources = SOURCES.filter((s) => s.rss !== null);

  const results = await Promise.allSettled(feedSources.map(fetchFeed));

  const allItems = [];
  const failed = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    } else {
      failed.push(feedSources[i].name);
    }
  });

  // Sort by date descending; items with no date go to the bottom
  allItems.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });

  const items = allItems.slice(0, TOTAL_ITEM_CAP);

  const sources = SOURCES.map((s) => ({
    name: s.name,
    category: s.category,
    site: s.site,
    hasFeed: s.rss !== null,
  }));

  res.setHeader(
    "Cache-Control",
    "s-maxage=1800, stale-while-revalidate=3600"
  );
  res.setHeader("Content-Type", "application/json");

  return res.status(200).json({
    updated: new Date().toISOString(),
    items,
    sources,
    failed,
  });
};
