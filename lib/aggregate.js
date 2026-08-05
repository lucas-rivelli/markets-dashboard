const Parser = require("rss-parser");
const sanitizeHtml = require("sanitize-html");
const { fetchSpotifyEpisodes } = require("./spotify");
const { fetchVicIdeas } = require("./vic");
const { loadBookmarks } = require("./bookmarks");
const { loadManualLinks } = require("./manual-links");
const { addStableItemId } = require("./item-id");

const ITEMS_PER_FEED = 10;
const TOTAL_ITEM_CAP = 200;
const FETCH_TIMEOUT_MS = 8000;

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; MarketsDashboard/1.0; +https://github.com/lucas-rivelli/markets-dashboard)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  customFields: {
    item: [
      ["media:thumbnail", "mediaThumbnail"],
      ["content:encoded", "contentEncoded"],
    ],
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

function extractContentHtml(item, source) {
  if (source.category !== "Substack") return "";

  const raw = item.contentEncoded || item.content || "";
  if (!raw || stripHtml(raw).length <= 220) return "";

  return sanitizeHtml(raw, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "a",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "h2",
      "h3",
      "h4",
      "img",
      "figure",
      "figcaption",
      "hr",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      blockquote: ["cite"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
      img: sanitizeHtml.simpleTransform("img", {
        loading: "lazy",
      }),
    },
  });
}

async function fetchFeed(source) {
  const feed = await parser.parseURL(source.rss);
  const limit = Number(source.itemsPerFeed) > 0 ? Number(source.itemsPerFeed) : ITEMS_PER_FEED;
  const items = (feed.items || []).slice(0, limit).map((item) => ({
    source: source.name,
    category: source.category,
    title: (item.title || "Untitled").trim(),
    link: item.link || item.guid || source.site,
    date: item.isoDate || item.pubDate || null,
    snippet: extractSnippet(item),
    contentHtml: extractContentHtml(item, source),
  }));
  return items;
}

function sortByDate(items) {
  return items.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });
}

async function buildFeedResponse(sources, { force = false } = {}) {
  const feedSources = sources.filter((s) => s.rss !== null);

  const [rssResults, spotifyResult, vicResult, bookmarks, manualResult] = await Promise.all([
    Promise.allSettled(feedSources.map(fetchFeed)),
    fetchSpotifyEpisodes().catch((err) => ({
      items: [],
      error: err.message,
    })),
    fetchVicIdeas({ force }).catch((err) => ({
      items: [],
      error: err.message,
    })),
    Promise.resolve(loadBookmarks()),
    loadManualLinks().then((items) => ({ items })).catch((err) => ({
      items: [],
      error: err.message,
    })),
  ]);

  const allItems = [];
  const failed = [];

  rssResults.forEach((result, i) => {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    } else {
      failed.push(feedSources[i].name);
    }
  });

  if (spotifyResult.error) {
    failed.push("Spotify");
  } else if (spotifyResult.skipped) {
    // not configured — silent
  } else {
    allItems.push(...spotifyResult.items);
  }

  if (vicResult.items?.length) {
    allItems.push(...vicResult.items);
  }
  // Surface auth/cache problems even when stale ideas still render.
  if (vicResult.error) {
    failed.push("Value Investors Club");
  }

  const manualLinks = manualResult.items;
  if (manualResult.error) failed.push("Saved Links");

  allItems.push(...bookmarks);
  allItems.push(...manualLinks);

  const dynamicItems = allItems.filter(
    (item) =>
      item.category === "Spotify" ||
      item.category === "Bookmarks" ||
      item.category === "Investing" ||
      item.source === "Saved Links"
  );
  const otherItems = allItems.filter(
    (item) =>
      item.category !== "Spotify" &&
      item.category !== "Bookmarks" &&
      item.category !== "Investing"
  );

  const investingItems = dynamicItems.filter((item) => item.category === "Investing");
  const restDynamic = dynamicItems.filter((item) => item.category !== "Investing");
  sortByDate(investingItems);
  sortByDate(restDynamic);
  sortByDate(otherItems);
  const items = [
    ...investingItems,
    ...restDynamic,
    ...otherItems.slice(0, TOTAL_ITEM_CAP),
  ].map(addStableItemId);

  const sourceList = sources.map((s) => ({
    name: s.name,
    category: s.category,
    site: s.site,
    hasFeed: s.rss !== null || s.dynamic === true,
  }));

  return {
    updated: new Date().toISOString(),
    items,
    sources: sourceList,
    failed,
    meta: {
      spotifyEpisodes: spotifyResult.items?.length || 0,
      vicIdeas: vicResult.items?.length || 0,
      bookmarks: bookmarks.length,
      manualLinks: manualLinks.length,
    },
  };
}

module.exports = { buildFeedResponse };
