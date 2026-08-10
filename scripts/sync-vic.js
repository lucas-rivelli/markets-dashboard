#!/usr/bin/env node
/**
 * Refresh Value Investors Club ideas into data/vic-cache.json.
 * Used by GitHub Actions (daily) and local: npm run sync:vic
 *
 * Env: VIC_SESSION (+ VIC_REMEMBER recommended), or VIC_COOKIE.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();

  const { fetchVicIdeas, VIC_CACHE_FILE } = require("../lib/vic");
  const result = await fetchVicIdeas({ force: true });

  const newest = result.items?.[0];
  console.log(
    JSON.stringify(
      {
        ok: true,
        count: result.items?.length || 0,
        cached: Boolean(result.cached),
        error: result.error || null,
        skipped: result.skipped || null,
        newest: newest
          ? { title: newest.title, date: newest.date, link: newest.link }
          : null,
        file: VIC_CACHE_FILE,
      },
      null,
      2
    )
  );

  if (!result.items?.length) {
    process.exitCode = 1;
  }
  // Surface auth/cache freezes so Actions doesn't look green while stuck.
  if (result.error || result.skipped) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
