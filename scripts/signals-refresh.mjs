// Incremental refresh (scheduled every 30 min by .github/workflows/signals-refresh.yml):
// new items -> extract -> new prices -> compute -> alerts -> state.json.
// Usage: node scripts/signals-refresh.mjs
import { createRequire } from "node:module";
import { loadEnvLocal } from "./signals-env.mjs";

loadEnvLocal();
const require = createRequire(import.meta.url);
const { loadConfig } = require("../lib/signals/config.js");
const { runPipeline } = require("../lib/signals/pipeline.js");

const config = loadConfig();
const { state } = await runPipeline(config, {});
console.log(`\nDone. lastUpdated=${state.lastUpdated} tickers=${state.counts.tickers} pricesOk=${state.counts.pricesOk} alertsTotal=${state.counts.alertsTotal}`);
