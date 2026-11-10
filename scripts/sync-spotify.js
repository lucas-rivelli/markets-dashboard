#!/usr/bin/env node
/**
 * Deep-backfill Spotify episodes into data/spotify-cache.json (forever cache).
 *
 * Recovers past episodes that fell out of the shallow NEW_EPISODE_DAYS window.
 * Filed folder/tag/status keys reconnect automatically (stable id = hash of link).
 *
 * Usage:
 *   npm run sync:spotify
 *   npm run sync:spotify -- --force   # ignore backfill_complete and crawl again
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ENV_LOCAL = path.join(ROOT, ".env.local");

function loadEnvLocal() {
  if (!fs.existsSync(ENV_LOCAL)) return;
  for (const line of fs.readFileSync(ENV_LOCAL, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  // Prefer repo-root .env.local when running from a worktree.
  const parentEnv = path.join(ROOT, "..", ".env.local");
  if (!fs.existsSync(ENV_LOCAL) && fs.existsSync(parentEnv)) {
    for (const line of fs.readFileSync(parentEnv, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }

  const force = process.argv.includes("--force");
  const { backfillSpotifyCache, SPOTIFY_CACHE_FILE } = require("../lib/spotify");

  console.error("Deep-backfilling Spotify episodes into %s …", SPOTIFY_CACHE_FILE);
  const result = await backfillSpotifyCache({
    force,
    onShow: ({ show, added, total, remaining }) => {
      console.error(
        "  ✓ %s (+%d eps) · cache %d · %d shows left",
        show,
        added,
        total,
        remaining
      );
    },
  });

  if (!result.ok) {
    console.error("Spotify backfill failed: %s", result.error || "unknown");
    process.exit(1);
  }

  if (result.skipped) {
    console.error("%s", result.skipped);
  }

  console.error(
    "Done. %d episodes in cache · backfill_complete=%s · processed %d show(s)",
    result.items.length,
    result.backfillComplete,
    result.processed
  );
  console.error(
    "Commit & push %s so production serves the recovered episodes.",
    SPOTIFY_CACHE_FILE
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
