#!/usr/bin/env node
/**
 * Refresh fund letters into data/fund-letters-cache.json.
 * Used by GitHub Actions (daily) and local: npm run sync:fund-letters
 *
 * Configure funds in data/fund-letters-config.json (listing | rss | static).
 */
const path = require("path");

const ROOT = path.join(__dirname, "..");

function loadEnvLocal() {
  const fs = require("fs");
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

  const {
    refreshFundLetters,
    getFundLetterConfig,
    FUND_LETTERS_CACHE_FILE,
  } = require("../lib/fund-letters");

  const config = getFundLetterConfig();
  const result = await refreshFundLetters();
  const newest = result.items?.[0];

  console.log(
    JSON.stringify(
      {
        ok: true,
        funds: config.funds?.length || 0,
        count: result.items?.length || 0,
        errors: result.errors || [],
        fetched_at: result.fetched_at || null,
        newest: newest
          ? { title: newest.title, date: newest.date, link: newest.link, source: newest.source }
          : null,
        file: FUND_LETTERS_CACHE_FILE,
      },
      null,
      2
    )
  );

  if (result.errors?.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
