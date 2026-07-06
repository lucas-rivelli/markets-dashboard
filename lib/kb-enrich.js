const { execFile } = require("child_process");
const { promisify } = require("util");
const { YoutubeTranscript } = require("youtube-transcript");

const execFileAsync = promisify(execFile);
const FETCH_TIMEOUT_MS = 12000;
const MAX_CONTENT_TEXT = 200000;

function cleanText(value, maxLength = MAX_CONTENT_TEXT) {
  const text = String(value || "").replace(/\r/g, "").trim();
  if (!text) return "";
  const normalized = text.replace(/\n{3,}/g, "\n\n");
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function withTimeout(promise, ms = FETCH_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("enrichment timeout")), ms)
    ),
  ]);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MarketsDashboard/1.0)",
      Accept: "application/json",
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function parseYouTubeId(url) {
  const match = String(url || "").match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  return match ? match[1] : null;
}

function parseXStatus(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)(x|twitter)\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const statusIndex = parts.findIndex((part) => part === "status" || part === "statuses");
    const id = statusIndex >= 0 ? parts[statusIndex + 1] : null;
    if (!parts[0] || !id || !/^\d+$/.test(id)) return null;
    return { user: parts[0], id };
  } catch {
    return null;
  }
}

function statusText(status) {
  if (!status) return "";
  return cleanText(status.text || status.raw_text?.text || status.raw_text || "");
}

function classifyXContent(status, threadTweets = []) {
  if (!status) return "tweet";
  if (status.type === "article" || status.article) return "article";
  if (threadTweets.length > 1) return "thread";
  if (status.is_note_tweet) return "note";
  if (status.embed_card?.type === "article") return "article";
  return "tweet";
}

function formatThreadText(threadTweets) {
  return threadTweets
    .map((tweet, index) => {
      const author = tweet.author?.screen_name || tweet.author?.name || "author";
      const text = statusText(tweet);
      if (!text) return "";
      return `[${index + 1}/${threadTweets.length} @${author}]\n${text}`;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}

async function fetchFxThread(id) {
  const data = await fetchJson(`https://api.fxtwitter.com/2/thread/${id}`);
  if (!Array.isArray(data?.thread) || !data.thread.length) return null;
  return data.thread;
}

async function fetchFxStatus(id) {
  const data = await fetchJson(`https://api.fxtwitter.com/2/status/${id}`);
  return data?.status || null;
}

async function fetchSyndicatedTweet(id) {
  const data = await fetchJson(
    `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en`
  );
  if (!data?.text) return null;
  return {
    type: "status",
    id,
    text: data.text,
    is_note_tweet: Boolean(data.note_tweet || data.__typename === "TweetNote"),
    author: { screen_name: data.user?.screen_name, name: data.user?.name },
  };
}

async function fetchBirdThread(url) {
  if (!process.env.AUTH_TOKEN || !process.env.CT0) return null;

  const birdBin = require.resolve("@steipete/bird/dist/cli.js");
  const { stdout } = await execFileAsync(
    process.execPath,
    [birdBin, "thread", url, "--json"],
    {
      timeout: FETCH_TIMEOUT_MS,
      env: {
        ...process.env,
        AUTH_TOKEN: process.env.AUTH_TOKEN,
        CT0: process.env.CT0,
      },
      maxBuffer: 4 * 1024 * 1024,
    }
  );

  const parsed = JSON.parse(stdout || "[]");
  if (!Array.isArray(parsed) || !parsed.length) return null;
  return parsed.map((tweet) => ({
    type: "status",
    id: tweet.id,
    text: tweet.text,
    author: { screen_name: tweet.author?.username, name: tweet.author?.name },
  }));
}

async function enrichTwitter(url) {
  const parsed = parseXStatus(url);
  if (!parsed) return null;

  let threadTweets = null;
  let status = null;

  try {
    threadTweets = await fetchFxThread(parsed.id);
    status =
      threadTweets?.find((tweet) => String(tweet.id) === parsed.id) ||
      threadTweets?.[0] ||
      (await fetchFxStatus(parsed.id));
  } catch {
    status = null;
  }

  if (!status) {
    try {
      status = await fetchSyndicatedTweet(parsed.id);
    } catch {
      status = null;
    }
  }

  if (!threadTweets || threadTweets.length <= 1) {
    try {
      const birdThread = await fetchBirdThread(url);
      if (birdThread?.length > 1) threadTweets = birdThread;
    } catch {
      // optional fallback
    }
  }

  if (!status && threadTweets?.length) {
    status =
      threadTweets.find((tweet) => String(tweet.id) === parsed.id) || threadTweets[0];
  }

  if (!status) return null;

  const tweets = threadTweets?.length ? threadTweets : [status];
  const content_kind = classifyXContent(status, tweets);
  const content_text =
    content_kind === "thread" ? formatThreadText(tweets) : statusText(status);

  if (!content_text) return null;

  return {
    content_kind,
    content_text,
    content_meta: {
      platform: "x",
      tweet_id: parsed.id,
      thread_length: tweets.length,
      is_note_tweet: Boolean(status.is_note_tweet),
      enriched_at: new Date().toISOString(),
    },
  };
}

async function enrichYouTube(url) {
  const videoId = parseYouTubeId(url);
  if (!videoId) return null;

  try {
    const parts = await YoutubeTranscript.fetchTranscript(videoId);
    const content_text = cleanText(parts.map((part) => part.text).join(" "));
    if (!content_text) return null;

    return {
      content_kind: "video_transcript",
      content_text,
      content_meta: {
        platform: "youtube",
        video_id: videoId,
        transcript_parts: parts.length,
        enriched_at: new Date().toISOString(),
      },
    };
  } catch {
    return null;
  }
}

async function enrichKnowledgeInput(input) {
  const raw = input?.item && typeof input.item === "object" ? input.item : input;
  const url = raw?.url || raw?.link;
  if (!url) return input;

  let enrichment = null;

  try {
    if (parseXStatus(url)) {
      enrichment = await withTimeout(enrichTwitter(url));
    } else if (parseYouTubeId(url) || raw.category === "YouTube") {
      enrichment = await withTimeout(enrichYouTube(url));
    }
  } catch {
    enrichment = null;
  }

  if (!enrichment) return input;

  const item = { ...raw, ...enrichment };
  if (!item.snippet && enrichment.content_text) {
    item.snippet = enrichment.content_text.slice(0, 280);
  }

  return input?.item ? { ...input, item } : item;
}

module.exports = {
  enrichKnowledgeInput,
  parseYouTubeId,
  parseXStatus,
};
