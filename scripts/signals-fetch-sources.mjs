// Checkpoint / debug tool: fetch all public Signals sources and print
// per-source item counts. Headlines only — no full text is printed or saved.
// Usage: node scripts/signals-fetch-sources.mjs [--samples 3]
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadConfig } = require("../lib/signals/config.js");
const { fetchAllSources } = require("../lib/signals/sources.js");

const sampleCount = Number(process.argv[process.argv.indexOf("--samples") + 1]) || 3;

const config = loadConfig();
console.log(`Universe: ${config.universe.join(", ")} (benchmark ${config.benchmark})\n`);

const started = Date.now();
const { items, sourceStatus } = await fetchAllSources(config);
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

let ok = 0;
let failed = 0;
let fetched = 0;
for (const s of sourceStatus) {
  if (s.ok) ok += 1;
  else failed += 1;
  fetched += s.count;
  console.log(`${s.ok ? "ok  " : "FAIL"}  ${String(s.count).padStart(3)}  [${s.sourceType}] ${s.name}${s.error ? ` — ${s.error}` : ""}`);
}

console.log(
  `\n${sourceStatus.length} sources (${ok} ok, ${failed} failed) · ${fetched} fetched · ${items.length} unique items after dedupe · ${elapsed}s`
);

if (sampleCount > 0) {
  console.log(`\nFirst ${sampleCount} normalized items (headline + metadata only):`);
  for (const item of items.slice(0, sampleCount)) {
    console.log(
      JSON.stringify(
        { id: item.id.slice(0, 12) + "…", source: item.source, sourceType: item.sourceType, title: item.title, url: item.url, publishedAt: item.publishedAt, textChars: item.text.length, tickerHint: item.tickerHint || null },
        null,
        2
      )
    );
  }
}
