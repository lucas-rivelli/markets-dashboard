#!/usr/bin/env node
/**
 * Refresh Spotify's sticky cache: recent window ∪ episodes you filed.
 *
 * Does NOT pull full show archives. Unfiled aged-out episodes are pruned.
 *
 * Usage: npm run sync:spotify
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
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
  loadEnvFile(path.join(ROOT, ".env.local"));
  loadEnvFile(path.join(ROOT, "..", ".env.local"));

  const { syncStickySpotifyCache, SPOTIFY_CACHE_FILE } = require("../lib/spotify");

  console.error("Refreshing sticky Spotify cache (%s) …", SPOTIFY_CACHE_FILE);
  const result = await syncStickySpotifyCache({
    onProgress: ({ fetched, sticky, filedKept }) => {
      console.error(
        "  fetched %d recent · sticky cache %d (of which %d filed)",
        fetched,
        sticky,
        filedKept
      );
    },
  });

  if (!result.ok) {
    console.error("Spotify sync failed: %s", result.error || "unknown");
    process.exit(1);
  }

  console.error("Done. %d episodes in sticky cache.", result.items.length);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
