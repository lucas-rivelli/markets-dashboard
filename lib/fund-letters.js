const fs = require("fs");
const path = require("path");
const Parser = require("rss-parser");

const FUND_LETTERS_CONFIG_FILE = "data/fund-letters-config.json";
const FUND_LETTERS_CACHE_FILE = "data/fund-letters-cache.json";
const CATEGORY = "Letters";
const FETCH_TIMEOUT_MS = 20000;
const DEFAULT_MAX_ITEMS = 12;
const DEFAULT_LINK_PATTERN = "\\.pdf($|\\?)";
const VERDE_BASE = "https://www.verdeasset.com.br";
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const CONFIG_PATH = path.join(__dirname, "..", FUND_LETTERS_CONFIG_FILE);
const CACHE_PATH = path.join(__dirname, "..", FUND_LETTERS_CACHE_FILE);

const BROWSER_UA =
  "Mozilla/5.0 (compatible; MarketsDashboard/1.0; +https://github.com/lucas-rivelli/markets-dashboard)";

const rssParser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    "User-Agent": BROWSER_UA,
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

const state = {
  items: null,
  errors: [],
  fetchedAt: 0,
  persistedLoaded: false,
  config: null,
};

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, max = 200) {
  const clean = stripHtml(text);
  if (!clean) return "";
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

function cleanString(value, max = 500) {
  const text = stripHtml(value);
  if (!text) return "";
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function resolveUrl(href, base) {
  try {
    return new URL(String(href || "").trim(), base).href;
  } catch {
    return "";
  }
}

function loadConfigFromDisk() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { schema_version: 1, funds: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    const funds = Array.isArray(raw?.funds) ? raw.funds : [];
    return {
      schema_version: Number(raw?.schema_version) || 1,
      funds: funds.filter((f) => f && typeof f === "object" && f.name && f.site),
    };
  } catch {
    return { schema_version: 1, funds: [] };
  }
}

function getFundLetterConfig() {
  if (!state.config) {
    state.config = loadConfigFromDisk();
  }
  return state.config;
}

/** Reload config from disk (sync scripts / tests). */
function reloadFundLetterConfig() {
  state.config = loadConfigFromDisk();
  return state.config;
}

function fundLetterSources() {
  return reloadFundLetterConfig().funds.map((fund) => ({
    name: String(fund.name).trim(),
    category: String(fund.category || CATEGORY).trim() || CATEGORY,
    site: String(fund.site).trim(),
    rss: null,
    dynamic: true,
  }));
}

function itemCategory(fund) {
  return String(fund.category || CATEGORY).trim() || CATEGORY;
}

function normalizeItem(fund, partial) {
  const link = String(partial.link || "").trim();
  if (!link) return null;
  const title = cleanString(partial.title || link, 300) || "Untitled letter";
  return {
    source: String(fund.name).trim(),
    category: itemCategory(fund),
    title,
    link,
    date: partial.date || null,
    snippet: truncate(partial.snippet || "", 200),
  };
}

async function fetchUrl(url, accept) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: accept,
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url) {
  const res = await fetchUrl(
    url,
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  );
  return res.text();
}

async function fetchJson(url) {
  const res = await fetchUrl(url, "application/json, text/plain, */*");
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Response was not JSON");
  }
}

function reportDate(ano, mes) {
  const year = Number(ano);
  const month = Number(mes);
  if (!year || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function reportTitle(fund, ano, mes) {
  const month = Number(mes);
  const label = MONTH_LABELS[month - 1] || String(mes);
  return `${fund.name} — ${label} ${ano}`;
}

async function refreshVerdeFund(fund) {
  const fundId = Number(fund.verdeFundId || fund.fundId);
  if (!fundId) {
    throw new Error("verdeFundId required for mode=verde");
  }
  const maxItems = Number(fund.maxItems) > 0 ? Number(fund.maxItems) : DEFAULT_MAX_ITEMS;
  const data = await fetchJson(`${VERDE_BASE}/public/fundos/data/relatorios/${fundId}.json`);
  const reports = (Array.isArray(data?.relatorios) ? data.relatorios : [])
    .slice()
    .sort((a, b) => {
      const da = (Number(a?.ano) || 0) * 12 + (Number(a?.mes) || 0);
      const db = (Number(b?.ano) || 0) * 12 + (Number(b?.mes) || 0);
      return db - da;
    });
  return reports
    .slice(0, maxItems)
    .map((entry) => {
      const path = String(entry?.url || "").trim();
      if (!path) return null;
      return normalizeItem(fund, {
        title: reportTitle(fund, entry.ano, entry.mes),
        link: resolveUrl(path, VERDE_BASE),
        date: reportDate(entry.ano, entry.mes),
        snippet: "Relatório de gestão",
      });
    })
    .filter(Boolean);
}

const MAUBOUSSIN_BASE = "https://www.michaelmauboussin.com";

function stableHttpLink(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.href;
  } catch {
    return String(url || "").trim();
  }
}

function parseMauboussinArchive(js) {
  const raw = String(js || "");
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error("Mauboussin archive-data.js was not JSON");
  }
}

function mauboussinSortKey(entry) {
  const date = String(entry?.date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(date)) return date;
  const year = Number(entry?.y || entry?.year);
  if (year) return `${year}-12-31`;
  return "";
}

async function refreshMauboussinFund(fund) {
  const maxItems = Number(fund.maxItems) > 0 ? Number(fund.maxItems) : 1;
  const [archiveJs, addsJson] = await Promise.all([
    fetchText(`${MAUBOUSSIN_BASE}/archive-data.js`),
    fetchJson(`${MAUBOUSSIN_BASE}/api/writing`).catch(() => ({ writing: [] })),
  ]);

  const archive = parseMauboussinArchive(archiveJs).map((row) => ({
    title: row?.t,
    link: row?.l,
    date: row?.y ? `${Number(row.y)}-12-31` : null,
    snippet: [row?.v, row?.f].filter(Boolean).join(" · "),
    sort: mauboussinSortKey(row),
  }));

  const adds = (Array.isArray(addsJson?.writing) ? addsJson.writing : []).map((row) => ({
    title: row?.title,
    link: row?.link,
    date: row?.date || null,
    snippet: [row?.venue, row?.type].filter(Boolean).join(" · "),
    sort: mauboussinSortKey(row),
  }));

  const seen = new Set();
  const merged = [...adds, ...archive]
    .sort((a, b) => String(b.sort).localeCompare(String(a.sort)))
    .map((entry) => {
      const link = stableHttpLink(entry.link);
      if (!link || seen.has(link)) return null;
      seen.add(link);
      return normalizeItem(fund, {
        title: entry.title,
        link,
        date: entry.date,
        snippet: entry.snippet,
      });
    })
    .filter(Boolean);

  return merged.slice(0, maxItems);
}

function extractListingItems(fund, html, baseUrl) {
  const pattern = new RegExp(fund.linkPattern || DEFAULT_LINK_PATTERN, "i");
  const maxItems = Number(fund.maxItems) > 0 ? Number(fund.maxItems) : DEFAULT_MAX_ITEMS;
  const seen = new Set();
  const items = [];

  // Match anchors; href may appear before or after other attributes.
  const re =
    /<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const href = match[2];
    const attrs = `${match[1] || ""} ${match[3] || ""}`;
    const inner = match[4] || "";
    const absolute = resolveUrl(href, baseUrl);
    if (!absolute || !pattern.test(absolute) || seen.has(absolute)) continue;
    seen.add(absolute);

    const titleAttr = /title\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const title =
      cleanString(titleAttr?.[1] || "", 300) ||
      cleanString(inner, 300) ||
      absolute.split("/").pop() ||
      "Untitled letter";

    const item = normalizeItem(fund, { title, link: absolute, date: null, snippet: "" });
    if (item) items.push(item);
    if (items.length >= maxItems) break;
  }

  return items;
}

async function refreshListingFund(fund) {
  const listingUrl = String(fund.listingUrl || fund.site || "").trim();
  if (!listingUrl) {
    throw new Error("listingUrl (or site) required for mode=listing");
  }
  const html = await fetchText(listingUrl);
  return extractListingItems(fund, html, listingUrl);
}

async function refreshRssFund(fund) {
  const feedUrl = String(fund.rss || fund.listingUrl || "").trim();
  if (!feedUrl) {
    throw new Error("rss (or listingUrl) required for mode=rss");
  }
  const maxItems = Number(fund.maxItems) > 0 ? Number(fund.maxItems) : DEFAULT_MAX_ITEMS;
  const feed = await rssParser.parseURL(feedUrl);
  return (feed.items || [])
    .slice(0, maxItems)
    .map((item) =>
      normalizeItem(fund, {
        title: item.title || "Untitled",
        link: item.link || item.guid || fund.site,
        date: item.isoDate || item.pubDate || null,
        snippet: item.contentSnippet || item.summary || item.content || "",
      })
    )
    .filter(Boolean);
}

function refreshStaticFund(fund) {
  const maxItems = Number(fund.maxItems) > 0 ? Number(fund.maxItems) : DEFAULT_MAX_ITEMS;
  const links = Array.isArray(fund.links) ? fund.links : [];
  return links
    .slice(0, maxItems)
    .map((entry) =>
      normalizeItem(fund, {
        title: entry?.title || entry?.url || "Untitled letter",
        link: entry?.url || entry?.link || "",
        date: entry?.date || null,
        snippet: entry?.snippet || "",
      })
    )
    .filter(Boolean);
}

async function refreshOneFund(fund) {
  const mode = String(fund.mode || fund.adapter || "listing").toLowerCase();
  if (mode === "rss") return refreshRssFund(fund);
  if (mode === "static") return refreshStaticFund(fund);
  if (mode === "listing") return refreshListingFund(fund);
  if (mode === "verde") return refreshVerdeFund(fund);
  if (mode === "mauboussin") return refreshMauboussinFund(fund);
  throw new Error(`Unknown mode "${fund.mode}" (use listing|rss|static|verde|mauboussin)`);
}

function applyPersistedPayload(payload) {
  if (!payload || typeof payload !== "object") return;
  state.items = Array.isArray(payload.items) ? payload.items : [];
  state.errors = Array.isArray(payload.errors) ? payload.errors : [];
  state.fetchedAt = payload.fetched_at
    ? new Date(payload.fetched_at).getTime()
    : 0;
}

async function loadPersistedCache() {
  if (state.persistedLoaded) return;
  state.persistedLoaded = true;

  try {
    const { hasGithubToken, readGithubJson } = require("./github-content");
    if (hasGithubToken()) {
      const { json } = await readGithubJson(FUND_LETTERS_CACHE_FILE);
      if (json) {
        applyPersistedPayload(json);
        return;
      }
    }
  } catch {
    // fall through to bundled/local file
  }

  if (!fs.existsSync(CACHE_PATH)) return;

  try {
    applyPersistedPayload(JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")));
  } catch {
    // ignore corrupt cache
  }
}

async function persistCache() {
  const payload = {
    schema_version: 1,
    fetched_at: state.fetchedAt ? new Date(state.fetchedAt).toISOString() : null,
    items: state.items || [],
    errors: state.errors || [],
  };

  try {
    const { hasGithubToken, writeGithubJson } = require("./github-content");
    if (hasGithubToken()) {
      await writeGithubJson(FUND_LETTERS_CACHE_FILE, payload, "Update fund letters cache");
      return;
    }
  } catch {
    // fall through to local write
  }

  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
  } catch {
    // best effort
  }
}

/** Serve cached letters for /api/feed — never scrapes. */
async function fetchFundLetters() {
  await loadPersistedCache();
  return {
    items: state.items || [],
    cached: true,
    errors: state.errors || [],
  };
}

/** Scrape all configured funds and write cache (cron / local sync). */
async function refreshFundLetters() {
  const config = reloadFundLetterConfig();
  const funds = config.funds || [];
  const seen = new Set();
  const items = [];
  const errors = [];

  for (const fund of funds) {
    const name = String(fund.name || "Unknown").trim();
    try {
      const batch = await refreshOneFund(fund);
      for (const item of batch) {
        if (!item?.link || seen.has(item.link)) continue;
        seen.add(item.link);
        items.push(item);
      }
    } catch (err) {
      errors.push({ fund: name, error: err.message || String(err) });
    }
  }

  items.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });

  state.items = items;
  state.errors = errors;
  state.fetchedAt = Date.now();
  state.persistedLoaded = true;
  await persistCache();

  return {
    items,
    errors,
    cached: false,
    fetched_at: new Date(state.fetchedAt).toISOString(),
  };
}

module.exports = {
  CATEGORY,
  FUND_LETTERS_CONFIG_FILE,
  FUND_LETTERS_CACHE_FILE,
  getFundLetterConfig,
  reloadFundLetterConfig,
  fundLetterSources,
  fetchFundLetters,
  refreshFundLetters,
  extractListingItems,
  persistCache,
};
