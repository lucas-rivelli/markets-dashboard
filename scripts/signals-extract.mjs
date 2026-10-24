// LLM extraction checkpoint / runner.
// Usage: node scripts/signals-extract.mjs [--limit 20] [--balanced]
//   --balanced  sample half TickerNews + half long-form (Substack/Blog/YouTube)
// Default: newest items first. Results persist to data/signals/extractions.json
// after every item; already-extracted items are never re-billed.
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);

// Load .env.local for local runs (GitHub Actions uses real secrets instead).
try {
  for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* no .env.local — rely on shell env */ }

const { loadConfig } = require("../lib/signals/config.js");
const { fetchAllSources } = require("../lib/signals/sources.js");
const { extractNewItems, loadExtractions } = require("../lib/signals/extract.js");

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) || 20 : 20;
const balanced = args.includes("--balanced");

const config = loadConfig();
console.log(
  `LLM: model=${config.llm.model} (Anthropic key: ${process.env.ANTHROPIC_API_KEY ? "yes" : "no"} · OpenRouter key: ${process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_KEY ? "yes" : "no"})`
);

const { items } = await fetchAllSources(config);
const already = loadExtractions().items;
const fresh = items.filter((i) => !already[i.id]);
console.log(`Fetched ${items.length} items · ${fresh.length} not yet extracted\n`);

let sample = fresh;
if (balanced) {
  const news = fresh.filter((i) => i.sourceType === "TickerNews");
  const longForm = fresh.filter((i) => i.sourceType !== "TickerNews");
  const half = Math.ceil(limit / 2);
  sample = [...news.slice(0, half), ...longForm.slice(0, limit - Math.min(half, news.length))]
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  console.log(`Balanced sample: ${Math.min(half, news.length)} TickerNews + ${sample.length - Math.min(half, news.length)} long-form\n`);
}

const { results, skipped } = await extractNewItems(sample, config, { limit, log: () => {} });

console.log(`\n===== RAW EXTRACTION OUTPUTS (${results.length} ok, ${skipped.length} skipped) =====\n`);
for (const { item, record, rawResponse } of results) {
  console.log(`--- [${item.sourceType}] ${item.source} · ${item.publishedAt || "no date"}`);
  console.log(`    ${item.title}`);
  console.log(`    ${item.url}`);
  console.log(`    RAW MODEL RESPONSE: ${String(rawResponse).trim()}`);
  console.log(`    KEPT (confidence >= ${config.minConfidence}): ${JSON.stringify(record.mentions)}`);
  console.log();
}
for (const { item, error } of skipped) {
  console.log(`--- SKIPPED [${item.sourceType}] ${item.title} — ${error}`);
}
