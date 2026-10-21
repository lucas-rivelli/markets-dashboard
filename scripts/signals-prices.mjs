// Price backfill / update for given tickers (default: 3-ticker checkpoint set).
// Usage: node scripts/signals-prices.mjs [TICKER ...] [--years 2]
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { updatePrices } = require("../lib/signals/prices.js");

const args = process.argv.slice(2);
const yearsIdx = args.indexOf("--years");
const years = yearsIdx >= 0 ? Number(args[yearsIdx + 1]) || 2 : 2;
const tickers = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--years") { i += 1; continue; }
  if (!args[i].startsWith("--")) tickers.push(args[i]);
}
const symbols = tickers.length ? tickers : ["NVDA", "AAPL", "SPY"];

for (const [idx, ticker] of symbols.entries()) {
  if (idx > 0) await new Promise((r) => setTimeout(r, 800)); // avoid Yahoo burst 429s
  try {
    const saved = await updatePrices(ticker, { years });
    const first = saved.closes[0];
    const last = saved.closes[saved.closes.length - 1];
    console.log(
      `ok   ${saved.ticker.padEnd(6)} provider=${saved.provider} bars=${saved.closes.length} ${first.date} (${first.close.toFixed(2)}) → ${last.date} (${last.close.toFixed(2)})`
    );
  } catch (err) {
    console.log(`FAIL ${ticker} — ${err.message}`);
    process.exitCode = 1;
  }
}
