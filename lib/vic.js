const fs = require("fs");
const path = require("path");

const VIC_BASE = "https://valueinvestorsclub.com";
const VIC_CACHE_FILE = "data/vic-cache.json";
const VIC_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_PAGES = 15;
const FETCH_TIMEOUT_MS = 20000;

const CACHE_PATH = path.join(__dirname, "..", VIC_CACHE_FILE);

const state = {
  items: null,
  fetchedAt: 0,
  persistedLoaded: false,
};

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, max = 200) {
  const clean = stripHtml(text);
  if (!clean) return "";
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

function ideaLink(idea) {
  const slug = idea.encode_company_name || String(idea.company_name || "idea").replace(/\s+/g, "_");
  return `${VIC_BASE}/idea/${slug}/${idea.keyid}`;
}

function ideaTitle(idea) {
  const symbol = (idea.symbol || "").trim();
  const name = (idea.company_name || "Untitled").trim();
  const side = idea.is_long === 0 ? "Short" : idea.is_long === 1 ? "Long" : "";
  const bits = [symbol, name].filter(Boolean);
  const base = bits.join(" — ") || name;
  return side ? `${base} (${side})` : base;
}

function normalizeIdea(idea) {
  return {
    source: "Value Investors Club",
    category: "Investing",
    title: ideaTitle(idea),
    link: ideaLink(idea),
    date: idea.add_date || null,
    snippet: truncate(idea.description),
  };
}

function flattenIdeas(result) {
  if (!result || typeof result !== "object") return [];

  const ideas = [];
  for (const bucket of Object.values(result)) {
    if (!Array.isArray(bucket)) continue;
    for (const idea of bucket) {
      if (!idea?.keyid) continue;
      ideas.push(normalizeIdea(idea));
    }
  }

  return ideas.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });
}

function sessionCookie() {
  const full = process.env.VIC_COOKIE || "";
  if (full.trim()) return full.trim();

  const session = (process.env.VIC_SESSION || "").trim();
  if (!session) return null;

  const remember = (process.env.VIC_REMEMBER || "").trim();
  let cookie = `vic_session=${session}`;
  if (remember) {
    cookie += `; remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d=${remember}`;
  }
  return cookie;
}

async function fetchVicPage(page, cookie) {
  const body = new URLSearchParams({
    show: "all",
    daterange: "3",
    ls: "",
    loc: "",
    sort: "new",
    marketcap_l: "0",
    marketcap_h: "",
    rtr_l: "",
    rtr_h: "",
    country: "",
    state: "",
    aum: "",
    yio: "",
    gotodate: "",
    page: String(page),
    end_page: String(page),
    is_login: cookie ? "1" : "0",
    show_alt_msgb: "0",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json, text/plain, */*",
      "User-Agent":
        "Mozilla/5.0 (compatible; MarketsDashboard/1.0; +https://github.com/lucas-rivelli/markets-dashboard)",
    };
    if (cookie) headers.Cookie = cookie;

    const res = await fetch(`${VIC_BASE}/ideas/loadideas`, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`VIC HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data?.success) {
      throw new Error(cookie ? "VIC session rejected — refresh VIC_SESSION" : "VIC ideas request failed");
    }

    return flattenIdeas(data.result);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchVicIdeasFromApi() {
  const cookie = sessionCookie();
  const seen = new Set();
  const items = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchVicPage(page, cookie);
    let added = 0;

    for (const item of batch) {
      if (seen.has(item.link)) continue;
      seen.add(item.link);
      items.push(item);
      added++;
    }

    if (added === 0) break;
  }

  return items.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function applyPersistedPayload(payload) {
  if (!payload || typeof payload !== "object") return;
  if (!Array.isArray(payload.items) || !payload.items.length) return;
  state.items = payload.items;
  state.fetchedAt = payload.fetched_at ? new Date(payload.fetched_at).getTime() : Date.now();
}

async function loadPersistedCache() {
  if (state.persistedLoaded) return;
  state.persistedLoaded = true;

  try {
    const { hasGithubToken, readGithubJson } = require("./github-content");
    if (hasGithubToken()) {
      const { json } = await readGithubJson(VIC_CACHE_FILE);
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
  };

  try {
    const { hasGithubToken, writeGithubJson } = require("./github-content");
    if (hasGithubToken()) {
      await writeGithubJson(VIC_CACHE_FILE, payload, "Update VIC ideas cache");
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

async function fetchVicIdeas() {
  await loadPersistedCache();

  const now = Date.now();
  const cached = state.items;
  const cacheFresh = cached && now - state.fetchedAt < VIC_CACHE_TTL_MS;
  const cookie = sessionCookie();

  if (cacheFresh) {
    return { items: cached, cached: true };
  }

  // Without a session, keep the committed cache instead of downgrading to guest delay.
  if (!cookie && cached?.length) {
    return { items: cached, cached: true, skipped: "no session" };
  }

  try {
    const items = await fetchVicIdeasFromApi();
    state.items = items;
    state.fetchedAt = now;
    await persistCache();
    return { items, cached: false };
  } catch (err) {
    if (cached) return { items: cached, cached: true, error: err.message };
    throw err;
  }
}

module.exports = { fetchVicIdeas, fetchVicIdeasFromApi, persistCache, VIC_CACHE_FILE };
