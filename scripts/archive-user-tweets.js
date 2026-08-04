#!/usr/bin/env node
/**
 * Archive a public X user's tweets via the same bird + AUTH_TOKEN/CT0 path
 * used for bookmark sync. Writes only live API results — nothing fabricated.
 *
 * Sources (all live):
 *   1. bird user-tweets (profile timeline, cursor-paginated)
 *   2. bird search "from:handle" (search index, --all)
 *   3. bird read for any bookmarked status IDs for that handle not yet seen
 *   4. bird thread --all for conversations that look truncated
 *
 * Usage:
 *   AUTH_TOKEN=… CT0=… node scripts/archive-user-tweets.js [handle]
 */
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HANDLE = (process.argv[2] || "gregoryblotnick").replace(/^@/, "").toLowerCase();
const OUT_DIR = path.join(ROOT, "archive", HANDLE, "tweets");
const PAGE_COUNT = 200; // bird user-tweets hard cap: 20 × 10
const PAGE_DELAY_MS = 1200;
const MAX_ROUNDS = 500;
const BETWEEN_MS = 1500;
const SEARCH_MAX_PAGES = 250;

function requireAuth() {
  if (!process.env.AUTH_TOKEN || !process.env.CT0) {
    console.error(
      "Missing AUTH_TOKEN or CT0. Same cookies as bookmark sync are required."
    );
    process.exit(1);
  }
}

function sleep(ms) {
  const secs = Math.max(1, Math.ceil(ms / 1000));
  spawnSync("sleep", [String(secs)], { stdio: "ignore" });
}

function runNpx(args) {
  const result = spawnSync("npx", args, {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  return result;
}

function parseTweetsJson(stdout, label) {
  const text = (stdout || "").trim();
  if (!text) return { tweets: [], nextCursor: null };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`${label}: JSON parse failed: ${e.message}\n${text.slice(0, 400)}`);
  }
  if (Array.isArray(parsed)) return { tweets: parsed, nextCursor: null };
  // single tweet object from `bird read`
  if (parsed && parsed.id && (parsed.text !== undefined || parsed.author)) {
    return { tweets: [parsed], nextCursor: null };
  }
  return {
    tweets: Array.isArray(parsed.tweets) ? parsed.tweets : [],
    nextCursor: parsed.nextCursor || null,
  };
}

function tweetId(t) {
  return t && (t.id || t.id_str || t.rest_id || null);
}

function authorHandle(t) {
  const a = t && t.author;
  if (!a) return "";
  return String(a.username || a.screen_name || a.handle || "").replace(/^@/, "").toLowerCase();
}

function addTweets(byId, tweets, source) {
  let added = 0;
  for (const t of tweets) {
    const id = tweetId(t);
    if (!id) continue;
    // Keep non-author tweets that appear in threads, but tag source
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { ...t, _archiveSource: source });
      added += 1;
    } else if (!existing._archiveSource) {
      existing._archiveSource = source;
    }
  }
  return added;
}

function loadExisting(byId) {
  const allPath = path.join(OUT_DIR, "all.json");
  if (!fs.existsSync(allPath)) return 0;
  try {
    const prev = JSON.parse(fs.readFileSync(allPath, "utf8"));
    const added = addTweets(byId, prev.tweets || [], "prior-archive");
    console.error(`[0/4] Seeded ${added} tweets from existing all.json`);
    return added;
  } catch (e) {
    console.error(`  could not seed prior archive: ${e.message}`);
    return 0;
  }
}

function isRateLimit(stderr) {
  return /429|rate limit/i.test(stderr || "");
}

function runBirdWithRetries(args, label, attempts = 6) {
  let lastErr = "";
  for (let i = 1; i <= attempts; i++) {
    const result = runNpx(args);
    if (result.status === 0) return result;
    lastErr = (result.stderr || result.stdout || "").trim();
    if (isRateLimit(lastErr) && i < attempts) {
      const wait = Math.min(900, 60 * i); // 60s, 120s, … up to 15m
      console.error(`  ${label}: 429 — sleeping ${wait}s then retry ${i}/${attempts}…`);
      sleep(wait * 1000);
      continue;
    }
    const err = new Error(`${label} failed: ${lastErr}`);
    err.rateLimited = isRateLimit(lastErr);
    throw err;
  }
  const err = new Error(`${label} failed: ${lastErr}`);
  err.rateLimited = true;
  throw err;
}

function fetchUserTweets(byId) {
  if (process.env.SKIP_TIMELINE === "1") {
    console.error(`[1/4] Skipping profile timeline (SKIP_TIMELINE=1)`);
    return;
  }
  console.error(`[1/4] Profile timeline via bird user-tweets @${HANDLE}…`);
  let cursor = null;
  let rounds = 0;
  let stalled = 0;
  while (rounds < MAX_ROUNDS) {
    rounds += 1;
    const args = [
      "bird",
      "user-tweets",
      HANDLE,
      "-n",
      String(PAGE_COUNT),
      "--max-pages",
      "10",
      "--delay",
      String(PAGE_DELAY_MS),
      "--json",
    ];
    if (cursor) args.push("--cursor", cursor);
    console.error(`  round ${rounds}${cursor ? " (resume)" : ""}…`);
    let result;
    try {
      result = runBirdWithRetries(args, "user-tweets");
    } catch (e) {
      if (e.rateLimited && byId.size > 0) {
        console.error(
          `  timeline rate-limited with ${byId.size} tweets already — continuing other sources`
        );
        return;
      }
      throw e;
    }
    const { tweets, nextCursor } = parseTweetsJson(result.stdout, "user-tweets");
    const added = addTweets(byId, tweets, "user-tweets");
    console.error(
      `    +${added} new (page ${tweets.length}, total ${byId.size}), next=${nextCursor ? "yes" : "no"}`
    );
    if (!nextCursor || tweets.length === 0) break;
    if (added === 0) {
      stalled += 1;
      if (stalled >= 2) break;
    } else stalled = 0;
    if (nextCursor === cursor) break;
    cursor = nextCursor;
    sleep(BETWEEN_MS);
  }
}

function fetchSearch(byId) {
  console.error(`[2/4] Search index via bird search from:${HANDLE}…`);
  let result;
  try {
    result = runBirdWithRetries(
      [
        "bird",
        "search",
        `from:${HANDLE}`,
        "--all",
        "--max-pages",
        String(SEARCH_MAX_PAGES),
        "--json",
      ],
      "search",
      4
    );
  } catch (e) {
    console.error(`  search failed (continuing): ${e.message}`);
    return;
  }
  const { tweets } = parseTweetsJson(result.stdout, "search");
  const added = addTweets(byId, tweets, "search");
  console.error(`  +${added} new from search (page ${tweets.length}, total ${byId.size})`);
}

function bookmarkIdsForHandle() {
  const bookmarksPath = path.join(ROOT, "data", "bookmarks.json");
  if (!fs.existsSync(bookmarksPath)) return [];
  let data;
  try {
    data = JSON.parse(fs.readFileSync(bookmarksPath, "utf8"));
  } catch {
    return [];
  }
  const items = Array.isArray(data) ? data : data.items || [];
  const ids = [];
  const re = new RegExp(
    `(?:x\\.com|twitter\\.com)/${HANDLE}/status/(\\d+)`,
    "i"
  );
  for (const item of items) {
    const link = item.link || item.url || "";
    const m = link.match(re);
    if (m) ids.push(m[1]);
  }
  return [...new Set(ids)];
}

function fetchBookmarkGaps(byId) {
  const ids = bookmarkIdsForHandle().filter((id) => !byId.has(id));
  console.error(
    `[3/4] bird read for ${ids.length} bookmarked @${HANDLE} ids missing from timeline…`
  );
  let added = 0;
  for (const id of ids) {
    let result;
    try {
      result = runBirdWithRetries(["bird", "read", id, "--json"], `read ${id}`, 3);
    } catch (e) {
      console.error(`  read ${id} failed — skip`);
      sleep(BETWEEN_MS);
      continue;
    }
    const { tweets } = parseTweetsJson(result.stdout, `read ${id}`);
    added += addTweets(byId, tweets, "bookmark-read");
    sleep(1200);
  }
  console.error(`  +${added} from bookmark reads (total ${byId.size})`);
}

function fetchThreadExpansions(byId) {
  // Expand conversations authored by HANDLE that look short relative to replyCount
  // or that we only have a fragment of.
  const own = [...byId.values()].filter(
    (t) => authorHandle(t) === HANDLE || !authorHandle(t)
  );
  const byConv = new Map();
  for (const t of own) {
    const cid = t.conversationId || tweetId(t);
    if (!cid) continue;
    if (!byConv.has(cid)) byConv.set(cid, []);
    byConv.get(cid).push(t);
  }

  const seeds = [];
  for (const [cid, list] of byConv) {
    const maxReplies = Math.max(
      0,
      ...list.map((t) => Number(t.replyCount || 0))
    );
    if (list.length >= 2 || maxReplies >= 2) {
      // Prefer root / earliest id as seed
      const seed = list
        .slice()
        .sort((a, b) => String(tweetId(a)).localeCompare(String(tweetId(b))))[0];
      seeds.push(tweetId(seed) || cid);
    }
  }

  // Cap expansions to keep the Actions job bounded
  const uniqueSeeds = [...new Set(seeds)].slice(0, 40);
  console.error(
    `[4/4] Expanding ${uniqueSeeds.length} threads via bird thread --all…`
  );
  let added = 0;
  for (const seed of uniqueSeeds) {
    let result;
    try {
      result = runBirdWithRetries(
        [
          "bird",
          "thread",
          String(seed),
          "--all",
          "--max-pages",
          "10",
          "--delay",
          "1200",
          "--json",
        ],
        `thread ${seed}`,
        3
      );
    } catch (e) {
      console.error(`  thread ${seed} failed — skip`);
      if (e.rateLimited) {
        console.error("  rate-limited on threads — stopping expansions");
        break;
      }
      sleep(BETWEEN_MS);
      continue;
    }
    const { tweets } = parseTweetsJson(result.stdout, `thread ${seed}`);
    const mine = tweets.filter(
      (t) => authorHandle(t) === HANDLE || authorHandle(t) === ""
    );
    added += addTweets(byId, mine.length ? mine : tweets, "thread");
    sleep(BETWEEN_MS);
  }
  console.error(`  +${added} from thread expansion (total ${byId.size})`);
}

function parseDate(t) {
  const s = t.createdAt || t.created_at || "";
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : 0;
}

function main() {
  requireAuth();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const byId = new Map();
  loadExisting(byId);
  const cooldown = Number(process.env.ARCHIVE_COOLDOWN_SEC || 0);
  if (cooldown > 0) {
    console.error(`Cooling down ${cooldown}s before live calls…`);
    sleep(cooldown * 1000);
  }
  fetchUserTweets(byId);
  fetchSearch(byId);
  fetchBookmarkGaps(byId);
  fetchThreadExpansions(byId);

  const tweets = [...byId.values()].sort((a, b) => parseDate(b) - parseDate(a));
  if (tweets.length === 0) {
    console.error("Fetched zero tweets — refusing to write an empty archive.");
    process.exit(1);
  }

  const byAuthor = tweets.filter((t) => authorHandle(t) === HANDLE);
  const manifest = {
    handle: HANDLE,
    source: [
      "bird user-tweets",
      "bird search from:handle",
      "bird read (bookmark gaps)",
      "bird thread --all (expansions)",
    ],
    auth: "AUTH_TOKEN+CT0 (same as bookmark sync)",
    fetchedAt: new Date().toISOString(),
    count: tweets.length,
    authoredCount: byAuthor.length,
    note: "Live X API only. Coverage equals what bird can still retrieve; deleted/out-of-window posts will be missing.",
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "all.json"),
    JSON.stringify({ ...manifest, tweets }, null, 2)
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  const byIdDir = path.join(OUT_DIR, "by-id");
  fs.mkdirSync(byIdDir, { recursive: true });
  // Clear stale ids from prior runs that are no longer present? Keep union — don't delete.
  for (const t of tweets) {
    const id = tweetId(t);
    fs.writeFileSync(path.join(byIdDir, `${id}.json`), JSON.stringify(t, null, 2));
  }

  console.error(
    `Wrote ${tweets.length} real tweets (${byAuthor.length} authored) → ${OUT_DIR}`
  );
  console.log(JSON.stringify(manifest));
}

main();
