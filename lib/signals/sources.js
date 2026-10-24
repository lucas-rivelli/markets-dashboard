"use strict";

// Public source crawling for Markets Reading: Signals.
// Reuses the patterns from lib/aggregate.js (rss-parser, per-feed timeout,
// Promise.allSettled so one dead feed never kills a run, stable SHA-256 ids)
// and the source list from api/feed.js, filtered to login-free categories.
//
// Excluded by construction: X Bookmarks, Value Investors Club, Spotify,
// Saved Links, Writing and fund letters — all are `dynamic: true` / rss:null
// in api/feed.js and none of their categories are in PUBLIC_CATEGORIES.

const Parser = require("rss-parser");
const { stableItemId } = require("../item-id");

const FETCH_TIMEOUT_MS = 8000;
const PUBLIC_ITEMS_PER_FEED = 10;
const TICKER_ITEMS_PER_FEED = 25;
const MAX_TEXT_CHARS = 12000;

const PUBLIC_CATEGORIES = new Set(["Substack", "Blog", "YouTube", "Macro/Official"]);

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; MarketsDashboard/1.0; +https://github.com/lucas-rivelli/markets-dashboard)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  customFields: {
    item: [["content:encoded", "contentEncoded"]],
  },
});

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function yahooNewsUrl(ticker) {
  const t = encodeURIComponent(String(ticker).trim().toUpperCase());
  return `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${t}&region=US&lang=en-US`;
}

/** Public RSS sources from api/feed.js (SOURCES = BASE_SOURCES + fund letters). */
function getPublicSources() {
  // eslint-disable-next-line global-require
  const feedModule = require("../../api/feed");
  const all = feedModule.SOURCES || [];
  return all
    .filter((s) => s && s.rss && s.dynamic !== true && PUBLIC_CATEGORIES.has(s.category))
    .map((s) => ({
      name: s.name,
      sourceType: s.category,
      site: s.site || null,
      rss: s.rss,
    }));
}

/** One Yahoo Finance headline RSS source per universe ticker. */
function getTickerNewsSources(config) {
  return (config.universe || []).map((ticker) => ({
    name: `Yahoo Finance — ${ticker}`,
    sourceType: "TickerNews",
    site: `https://finance.yahoo.com/quote/${ticker}`,
    rss: yahooNewsUrl(ticker),
    tickerHint: ticker,
  }));
}

/** User-added sources from config.extraSources: {name, rss|url, sourceType|category, site}. */
function getExtraSources(config) {
  return (config.extraSources || [])
    .map((entry) => {
      if (typeof entry === "string") {
        return { name: entry, sourceType: "Extra", site: null, rss: entry };
      }
      const rss = entry.rss || entry.url || entry.feed;
      if (!rss) return null;
      return {
        name: entry.name || rss,
        sourceType: entry.sourceType || entry.category || "Extra",
        site: entry.site || null,
        rss,
        tickerHint: entry.ticker ? String(entry.ticker).toUpperCase() : undefined,
      };
    })
    .filter(Boolean);
}

function allSources(config) {
  return [...getPublicSources(), ...getTickerNewsSources(config), ...getExtraSources(config)];
}

function normalizeItem(raw, source) {
  const url = String(raw.link || raw.guid || "").trim();
  if (!url) return null;
  const title = String(raw.title || "Untitled").replace(/\s+/g, " ").trim();
  if (!title) return null;

  const text = stripHtml(
    raw.contentEncoded || raw.content || raw.summary || raw.contentSnippet || ""
  ).slice(0, MAX_TEXT_CHARS);

  let publishedAt = null;
  const rawDate = raw.isoDate || raw.pubDate || null;
  if (rawDate) {
    const d = new Date(rawDate);
    if (!Number.isNaN(d.getTime())) publishedAt = d.toISOString();
  }

  const item = {
    id: stableItemId(url),
    source: source.name,
    sourceType: source.sourceType,
    title,
    url,
    publishedAt,
    text,
  };
  if (source.tickerHint) item.tickerHint = source.tickerHint;
  return item;
}

async function fetchSourceItems(source, limit) {
  const feed = await parser.parseURL(source.rss);
  const items = [];
  for (const raw of (feed.items || []).slice(0, limit)) {
    const item = normalizeItem(raw, source);
    if (item) items.push(item);
  }
  return items;
}

/**
 * Fetch every source. Returns:
 * { items: [normalizedItem] (deduped by id, newest first),
 *   sourceStatus: [{ name, sourceType, ok, count, error }] }
 */
async function fetchAllSources(config, { onSource } = {}) {
  const sources = allSources(config);
  const limitFor = (s) => (s.sourceType === "TickerNews" ? TICKER_ITEMS_PER_FEED : PUBLIC_ITEMS_PER_FEED);

  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const items = await fetchSourceItems(source, limitFor(source));
      return { source, items };
    })
  );

  const sourceStatus = [];
  const byId = new Map();

  results.forEach((result, i) => {
    const source = sources[i];
    if (result.status === "fulfilled") {
      sourceStatus.push({
        name: source.name,
        sourceType: source.sourceType,
        ok: true,
        count: result.value.items.length,
        error: null,
      });
      for (const item of result.value.items) {
        if (!byId.has(item.id)) byId.set(item.id, item);
      }
    } else {
      sourceStatus.push({
        name: source.name,
        sourceType: source.sourceType,
        ok: false,
        count: 0,
        error: result.reason?.message || String(result.reason),
      });
    }
    if (typeof onSource === "function") onSource(sourceStatus[sourceStatus.length - 1]);
  });

  const items = [...byId.values()].sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0;
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });

  return { items, sourceStatus };
}

module.exports = {
  PUBLIC_CATEGORIES,
  PUBLIC_ITEMS_PER_FEED,
  TICKER_ITEMS_PER_FEED,
  yahooNewsUrl,
  getPublicSources,
  getTickerNewsSources,
  getExtraSources,
  allSources,
  normalizeItem,
  fetchAllSources,
};
