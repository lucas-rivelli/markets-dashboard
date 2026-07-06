const NEW_EPISODE_DAYS = 7;
const EPISODES_PAGE_SIZE = 50;
const SHOW_FETCH_CONCURRENCY = 1;
const SPOTIFY_REQUEST_DELAY_MS = 250;
const EXCLUDED_SHOWS = ["posse de bola"];

// Episodes change slowly; fetching every feed build (~57 API calls) trips
// Spotify's dev-mode rate limit, and each early retry escalates the penalty.
// The cache and the rate-limit cooldown are persisted to the repo
// (data/spotify-cache.json) because serverless memory resets on every cold
// start — without persistence each new instance re-burst Spotify and kept
// the app rate-limited indefinitely.
const SPOTIFY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const SPOTIFY_CACHE_FILE = "data/spotify-cache.json";

const fs = require("fs");
const path = require("path");
const CACHE_PATH = path.join(__dirname, "..", SPOTIFY_CACHE_FILE);

// Module-level state survives across warm serverless invocations.
const state = {
  items: null,
  fetchedAt: 0,
  cooldownUntil: 0,
  persistedLoaded: false,
};

class SpotifyRateLimitError extends Error {
  constructor(retryAfter) {
    super(
      retryAfter
        ? `Spotify API rate limited; retry after ${retryAfter}s`
        : "Spotify API rate limited"
    );
    this.name = "SpotifyRateLimitError";
    this.status = 429;
    this.retryAfter = retryAfter;
  }
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isExcludedShow(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return EXCLUDED_SHOWS.some((excluded) => normalized === excluded);
}

function episodeCutoff() {
  const d = new Date();
  d.setDate(d.getDate() - NEW_EPISODE_DAYS);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Spotify token refresh failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function spotifyGet(token, url) {
  await new Promise((resolve) => setTimeout(resolve, SPOTIFY_REQUEST_DELAY_MS));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) {
    // Never retry before retry-after: Spotify escalates the penalty on every
    // early retry (this is how the cooldown once grew to ~18 hours).
    const retryAfter = Number(res.headers.get("retry-after") || 60);
    throw new SpotifyRateLimitError(retryAfter);
  }
  if (!res.ok) {
    throw new Error(`Spotify API ${url}: HTTP ${res.status}`);
  }
  return res.json();
}

async function getSavedShows(token) {
  const shows = [];
  let url = "https://api.spotify.com/v1/me/shows?limit=50";

  while (url) {
    const data = await spotifyGet(token, url);
    for (const entry of data.items || []) {
      if (!entry.show || isExcludedShow(entry.show.name)) continue;
      shows.push(entry.show);
    }
    url = data.next;
  }

  return shows;
}

function mapEpisode(show, episode) {
  const description = stripHtml(episode.description || episode.html_description);
  const releaseDate = episode.release_date
    ? new Date(episode.release_date).toISOString()
    : null;

  return {
    source: show.name,
    category: "Spotify",
    title: episode.name || "Untitled episode",
    link: episode.external_urls?.spotify || `https://open.spotify.com/show/${show.id}`,
    date: releaseDate,
    snippet: description
      ? description.slice(0, 200) + (description.length > 200 ? "…" : "")
      : `New episode on ${show.publisher || show.name}`,
  };
}

async function getRecentEpisodesForShow(token, show, cutoff) {
  const items = [];
  let url = `https://api.spotify.com/v1/shows/${show.id}/episodes?limit=${EPISODES_PAGE_SIZE}&market=from_token`;

  while (url) {
    const data = await spotifyGet(token, url);
    const episodes = (data.items || []).filter(Boolean);
    let reachedOlder = false;

    for (const episode of episodes) {
      if (!episode.release_date) continue;
      const released = new Date(episode.release_date);
      if (released >= cutoff) {
        items.push(mapEpisode(show, episode));
      } else {
        reachedOlder = true;
      }
    }

    if (reachedOlder || !data.next) break;
    url = data.next;
  }

  return items;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

async function fetchAllEpisodes() {
  const token = await getAccessToken();
  if (!token) return null;

  const shows = await getSavedShows(token);
  const cutoff = episodeCutoff();

  const perShow = await mapWithConcurrency(shows, SHOW_FETCH_CONCURRENCY, async (show) =>
    getRecentEpisodesForShow(token, show, cutoff).catch((err) => {
      if (err?.status === 429) throw err;
      return [];
    })
  );

  const items = perShow.flat();
  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  return items;
}

/* ── Persistent cache (repo file via GitHub Contents API) ─────────────── */

function applyPersistedPayload(payload) {
  if (!payload || typeof payload !== "object") return;
  // Only trust items as a cache when a fetch actually happened; the seeded
  // empty file must not masquerade as a successful (empty) fetch.
  if (payload.fetched_at && Array.isArray(payload.items)) {
    state.items = payload.items;
    state.fetchedAt = new Date(payload.fetched_at).getTime();
  }
  if (payload.cooldown_until) {
    const until = new Date(payload.cooldown_until).getTime();
    if (until > Date.now()) state.cooldownUntil = until;
  }
}

async function loadPersistedCache() {
  if (state.persistedLoaded) return;
  state.persistedLoaded = true;

  // Prefer the live repo file (fresher than the copy bundled at deploy time).
  try {
    const { hasGithubToken, readGithubJson } = require("./github-content");
    if (hasGithubToken()) {
      const { json } = await readGithubJson(SPOTIFY_CACHE_FILE);
      if (json) {
        applyPersistedPayload(json);
        return;
      }
    }
  } catch {
    // fall through to the bundled/local file
  }

  try {
    applyPersistedPayload(JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")));
  } catch {
    // no cache yet
  }
}

async function persistCache() {
  const payload = {
    schema_version: 1,
    fetched_at: state.fetchedAt ? new Date(state.fetchedAt).toISOString() : null,
    cooldown_until: state.cooldownUntil ? new Date(state.cooldownUntil).toISOString() : null,
    items: state.items || [],
  };

  try {
    const { hasGithubToken, writeGithubJson } = require("./github-content");
    if (hasGithubToken()) {
      await writeGithubJson(SPOTIFY_CACHE_FILE, payload, "Update Spotify episode cache");
      return;
    }
  } catch {
    // fall through to local write
  }

  if (!process.env.VERCEL) {
    try {
      fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
      fs.writeFileSync(CACHE_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
    } catch {
      // best effort
    }
  }
}

async function fetchSpotifyEpisodes() {
  await loadPersistedCache();

  const now = Date.now();
  const cached = state.items;

  const coolingDown = now < state.cooldownUntil;
  const cacheFresh = cached && now - state.fetchedAt < SPOTIFY_CACHE_TTL_MS;

  if (coolingDown || cacheFresh) {
    if (cached) return { items: cached, skipped: null, cached: true };
    if (coolingDown) {
      throw new SpotifyRateLimitError(
        Math.ceil((state.cooldownUntil - now) / 1000)
      );
    }
  }

  try {
    const items = await fetchAllEpisodes();
    if (items === null) return { items: [], skipped: "not configured" };

    state.items = items;
    state.fetchedAt = now;
    state.cooldownUntil = 0;
    await persistCache();
    return { items, skipped: null };
  } catch (err) {
    if (err?.status === 429) {
      const waitMs = Math.min((err.retryAfter || 60) * 1000, MAX_COOLDOWN_MS);
      state.cooldownUntil = now + waitMs;
      // Persist the cooldown so new cold instances don't re-burst Spotify.
      await persistCache();
    }
    // Serve stale episodes rather than dropping Spotify from the feed.
    if (cached) return { items: cached, skipped: null, cached: true };
    throw err;
  }
}

module.exports = { fetchSpotifyEpisodes, NEW_EPISODE_DAYS, EXCLUDED_SHOWS };
