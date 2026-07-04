const NEW_EPISODE_DAYS = 14;
const MAX_SHOWS = 20;
const EPISODES_PER_SHOW = 5;

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function episodeCutoff() {
  const d = new Date();
  d.setDate(d.getDate() - NEW_EPISODE_DAYS);
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
  if (!res.ok) {
    throw new Error(`Spotify API ${url}: HTTP ${res.status}`);
  }
  return res.json();
}

async function getSavedShows(token) {
  const shows = [];
  let url = "https://api.spotify.com/v1/me/shows?limit=50";

  while (url && shows.length < MAX_SHOWS) {
    const data = await spotifyGet(token, url);
    for (const entry of data.items || []) {
      if (entry.show) shows.push(entry.show);
      if (shows.length >= MAX_SHOWS) break;
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

async function fetchSpotifyEpisodes() {
  const token = await getAccessToken();
  if (!token) return { items: [], skipped: "not configured" };

  const shows = await getSavedShows(token);
  const cutoff = episodeCutoff();
  const items = [];

  for (const show of shows) {
    const data = await spotifyGet(
      token,
      `https://api.spotify.com/v1/shows/${show.id}/episodes?limit=${EPISODES_PER_SHOW}`
    );

    for (const episode of data.items || []) {
      if (!episode.release_date) continue;
      const released = new Date(episode.release_date);
      if (released >= cutoff) {
        items.push(mapEpisode(show, episode));
      }
    }
  }

  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { items, skipped: null };
}

module.exports = { fetchSpotifyEpisodes, NEW_EPISODE_DAYS };
