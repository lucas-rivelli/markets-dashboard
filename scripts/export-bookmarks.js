#!/usr/bin/env node
/**
 * Export birdclaw bookmarked tweets → data/bookmarks.json
 *
 * Usage:
 *   birdclaw search tweets --bookmarked --limit 100 --json | node scripts/export-bookmarks.js
 *   node scripts/export-bookmarks.js path/to/birdclaw-output.json
 */

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "data", "bookmarks.json");

function readInput() {
  const file = process.argv[2];
  if (file) return fs.readFileSync(file, "utf8");
  return fs.readFileSync(0, "utf8");
}

function pickTweet(node) {
  if (!node || typeof node !== "object") return null;
  return node.tweet || node.data || node;
}

function tweetUrl(t) {
  if (t.url) return t.url;
  if (t.permalink) return t.permalink;
  const author = t.author?.username || t.author?.screen_name || t.username;
  const id = t.id || t.tweet_id || t.rest_id;
  if (author && id) return `https://x.com/${author}/status/${id}`;
  return null;
}

function tweetText(t) {
  return (
    t.plainText ||
    t.full_text ||
    t.text ||
    t.rawText ||
    ""
  ).trim();
}

function tweetDate(t) {
  const raw = t.created_at || t.createdAt || t.bookmarked_at || t.date;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function flattenTweets(payload) {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return payload.flatMap(flattenTweets);
  }

  if (payload.items) return flattenTweets(payload.items);
  if (payload.tweets) return flattenTweets(payload.tweets);
  if (payload.results) return flattenTweets(payload.results);
  if (payload.data) return flattenTweets(payload.data);

  const t = pickTweet(payload);
  if (t && (t.id || t.text || t.full_text || t.plainText)) {
    return [t];
  }

  return [];
}

function toItems(raw) {
  const tweets = flattenTweets(raw);
  const seen = new Set();

  return tweets
    .map((t) => {
      const link = tweetUrl(t);
      if (!link || seen.has(link)) return null;
      seen.add(link);

      const text = tweetText(t);
      const title =
        text.length > 120 ? text.slice(0, 117) + "…" : text || "Bookmarked post";

      return {
        source: "X Bookmarks",
        category: "Bookmarks",
        title,
        link,
        date: tweetDate(t),
        snippet: text.length > 200 ? text.slice(0, 197) + "…" : text,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });
}

const input = readInput();
const parsed = JSON.parse(input);
const items = toItems(parsed);

const out = {
  updated: new Date().toISOString(),
  items,
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.error(`Wrote ${items.length} bookmarks → ${OUT}`);
