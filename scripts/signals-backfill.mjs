// One-off backfill: 2 years of prices for the whole universe + benchmark,
// extraction over every currently available item (feeds + per-ticker news),
// then compute, alerts, track record and state.
// Usage: node scripts/signals-backfill.mjs [--extract-limit 500]
// Note: --extract-limit overrides config.llm.maxItemsPerRun for this run so
// the historical import is complete; it is the one run that costs real money.
import { createRequire } from "node:module";
import { loadEnvLocal } from "./signals-env.mjs";

loadEnvLocal();
const require = createRequire(import.meta.url);
const { loadConfig } = require("../lib/signals/config.js");
const { runPipeline } = require("../lib/signals/pipeline.js");

const args = process.argv.slice(2);
const idx = args.indexOf("--extract-limit");
const extractLimit = idx >= 0 ? Number(args[idx + 1]) || 500 : 500;

const config = loadConfig();
const { state } = await runPipeline(config, { extractLimit, priceYears: 2, doTrackRecord: true });
console.log(`\nBackfill done. extractions=${state.counts.extractionsTotal} mentions=${state.counts.mentionsTotal} tickers=${state.counts.tickers}`);
