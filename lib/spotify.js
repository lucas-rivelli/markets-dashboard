const NEW_EPISODE_DAYS = 7;
const EPISODES_PAGE_SIZE = 50;
const SHOW_FETCH_CONCURRENCY = 3;
const EXCLUDED_SHOWS = ["posse de bola"];

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
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after") || 1);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(retryAfter, 3) * 1000)
    );
    const retry = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (retry.ok) return retry.json();
    throw new Error(`Spotify API ${url}: HTTP ${retry.status}`);
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
  let url = `https://api.spotify.com/v1/shows/${show.id}/episodes?limit=${EPISODES_PAGE_SIZE}`;

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

async function fetchSpotifyEpisodes() {
  const token = await getAccessToken();
  if (!token) return { items: [], skipped: "not configured" };

  const shows = await getSavedShows(token);
  const cutoff = episodeCutoff();

  const perShow = await mapWithConcurrency(shows, SHOW_FETCH_CONCURRENCY, async (show) =>
    getRecentEpisodesForShow(token, show, cutoff).catch(() => [])
  );

  const items = perShow.flat();

  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { items, skipped: null };
}

module.exports = { fetchSpotifyEpisodes, NEW_EPISODE_DAYS, EXCLUDED_SHOWS };
