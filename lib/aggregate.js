const Parser = require("rss-parser");

const ITEMS_PER_FEED = 10;
const TOTAL_ITEM_CAP = 80;
const FETCH_TIMEOUT_MS = 8000;

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; MarketsDashboard/1.0; +https://github.com/lucas-rivelli/markets-dashboard)",
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

async function buildFeedResponse(sources) {
  const feedSources = sources.filter((s) => s.rss !== null);

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

  allItems.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });

  const items = allItems.slice(0, TOTAL_ITEM_CAP);

  const sourceList = sources.map((s) => ({
    name: s.name,
    category: s.category,
    site: s.site,
    hasFeed: s.rss !== null,
  }));

  return {
    updated: new Date().toISOString(),
    items,
    sources: sourceList,
    failed,
  };
}

module.exports = { buildFeedResponse };
