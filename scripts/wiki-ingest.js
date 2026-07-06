#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { ingestWikiItem, ingestAllWiki } = require("../lib/wiki-ingest");
const { writeKbIndex } = require("../lib/kb-index");

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

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const useLlm = !process.argv.includes("--no-llm");
  const all = process.argv.includes("--all");
  const id = argValue("--id");

  if (!all && !id) {
    console.error("Usage: npm run wiki:ingest -- --all | --id <inbox-id> [--dry-run] [--no-llm]");
    process.exit(1);
  }

  const results = all
    ? await ingestAllWiki({ dryRun, useLlm })
    : [await ingestWikiItem(id, { dryRun, useLlm })];

  if (!dryRun) {
    const index = writeKbIndex();
    console.log(`Rebuilt kb/index.json (${index.counts.items} items).`);
  }

  console.log(`Wiki ingest complete: ${results.length} source(s).`);
  for (const result of results.slice(0, 5)) {
    console.log(`  · ${result.title} → ${result.pages.length} page(s)${result.llm ? " [llm]" : ""}`);
  }
  if (results.length > 5) console.log(`  … and ${results.length - 5} more`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
