// Force one clearly-labeled TEST alert: writes it to data/signals/alerts.json
// (so it shows in the page's Alerts panel) and posts it to ntfy when
// NTFY_TOPIC is set. Usage: node scripts/signals-test-alert.mjs [TICKER]
import { createRequire } from "node:module";
import { loadEnvLocal } from "./signals-env.mjs";

loadEnvLocal();
const require = createRequire(import.meta.url);
const { createTestAlert, postNtfy } = require("../lib/signals/alerts.js");

const ticker = (process.argv[2] || "NVDA").toUpperCase();
const { alert } = createTestAlert({ ticker });
console.log(`TEST alert written: ${alert.id} ${alert.ticker} at ${alert.firedAt}`);

try {
  const labelled = { ...alert, ruleLabel: "TEST ALERT — forced demo alert, not a signal" };
  const result = await postNtfy(labelled, { publicUrl: process.env.SIGNALS_PUBLIC_URL || "" });
  console.log(result.sent ? `ntfy: sent to https://ntfy.sh/${result.topic}` : `ntfy: not sent (${result.reason})`);
} catch (err) {
  console.log(`ntfy: failed — ${err.message}`);
  process.exitCode = 1;
}
