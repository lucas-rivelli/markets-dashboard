#!/usr/bin/env node
/**
 * Archive a public X user's tweets via the same bird + AUTH_TOKEN/CT0 path
 * used for bookmark sync. Writes only live API results — nothing fabricated.
 *
 * Usage:
 *   AUTH_TOKEN=… CT0=… node scripts/archive-user-tweets.js [handle]
 *
 * Default handle: gregoryblotnick
 */
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HANDLE = (process.argv[2] || "gregoryblotnick").replace(/^@/, "");
const OUT_DIR = path.join(ROOT, "archive", HANDLE.toLowerCase(), "tweets");
const PAGE_COUNT = 200; // bird hard cap: 20 tweets × 10 pages
const PAGE_DELAY_MS = 1200;
const MAX_ROUNDS = 500; // safety: 500 × 200 = 100k tweets ceiling
const BETWEEN_ROUNDS_MS = 1500;

function requireAuth() {
  const auth = process.env.AUTH_TOKEN || "";
  const ct0 = process.env.CT0 || "";
  if (!auth || !ct0) {
    console.error(
      "Missing AUTH_TOKEN or CT0. Same cookies as bookmark sync are required."
    );
    process.exit(1);
  }
}

function runBird(cursor) {
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
  if (cursor) {
    args.push("--cursor", cursor);
  }

  const result = spawnSync("npx", args, {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(`bird user-tweets failed (exit ${result.status}): ${err}`);
  }

  const stdout = (result.stdout || "").trim();
  if (!stdout) {
    throw new Error("bird user-tweets returned empty stdout");
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (e) {
    throw new Error(`bird JSON parse failed: ${e.message}\n${stdout.slice(0, 500)}`);
  }

  // Shape: either { tweets, nextCursor } or a bare tweet array
  if (Array.isArray(parsed)) {
    return { tweets: parsed, nextCursor: null };
  }
  return {
    tweets: Array.isArray(parsed.tweets) ? parsed.tweets : [],
    nextCursor: parsed.nextCursor || null,
  };
}

function tweetId(t) {
  return t && (t.id || t.id_str || t.rest_id || null);
}

function sleep(ms) {
  const secs = Math.max(1, Math.ceil(ms / 1000));
  spawnSync("sleep", [String(secs)], { stdio: "ignore" });
}

function main() {
  requireAuth();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const byId = new Map();
  let cursor = null;
  let rounds = 0;
  let stalled = 0;

  console.error(`Archiving @${HANDLE} via bird user-tweets (live X)…`);

  while (rounds < MAX_ROUNDS) {
    rounds += 1;
    console.error(
      `Round ${rounds}${cursor ? ` (cursor ${cursor.slice(0, 24)}…)` : ""}…`
    );

    const { tweets, nextCursor } = runBird(cursor);
    let added = 0;
    for (const t of tweets) {
      const id = tweetId(t);
      if (!id) continue;
      if (!byId.has(id)) {
        byId.set(id, t);
        added += 1;
      }
    }

    console.error(
      `  got ${tweets.length} tweets, +${added} new (total ${byId.size}), nextCursor=${nextCursor ? "yes" : "no"}`
    );

    if (!nextCursor || tweets.length === 0) break;
    if (added === 0) {
      stalled += 1;
      if (stalled >= 2) {
        console.error("No new tweets for 2 rounds — stopping.");
        break;
      }
    } else {
      stalled = 0;
    }

    if (nextCursor === cursor) {
      console.error("Cursor did not advance — stopping.");
      break;
    }
    cursor = nextCursor;
    sleep(BETWEEN_ROUNDS_MS);
  }

  const tweets = Array.from(byId.values()).sort((a, b) => {
    const da = Date.parse(a.createdAt || a.created_at || 0) || 0;
    const db = Date.parse(b.createdAt || b.created_at || 0) || 0;
    return db - da;
  });

  if (tweets.length === 0) {
    console.error("Fetched zero tweets — refusing to write an empty archive.");
    process.exit(1);
  }

  const manifest = {
    handle: HANDLE,
    source: "bird user-tweets",
    auth: "AUTH_TOKEN+CT0 (same as bookmark sync)",
    fetchedAt: new Date().toISOString(),
    count: tweets.length,
    rounds,
  };

  const allPath = path.join(OUT_DIR, "all.json");
  const manifestPath = path.join(OUT_DIR, "manifest.json");
  fs.writeFileSync(allPath, JSON.stringify({ ...manifest, tweets }, null, 2));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // One file per tweet for easy browsing
  const byIdDir = path.join(OUT_DIR, "by-id");
  fs.mkdirSync(byIdDir, { recursive: true });
  for (const t of tweets) {
    const id = tweetId(t);
    fs.writeFileSync(path.join(byIdDir, `${id}.json`), JSON.stringify(t, null, 2));
  }

  console.error(`Wrote ${tweets.length} real tweets → ${allPath}`);
  console.log(JSON.stringify(manifest));
}

main();
