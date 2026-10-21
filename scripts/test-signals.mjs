// Unit tests for lib/signals/compute.js — plain Node assertions, no framework.
// Usage: node scripts/test-signals.mjs
import { createRequire } from "node:module";
import assert from "node:assert";

const require = createRequire(import.meta.url);
const { computeSignals } = require("../lib/signals/compute.js");
const { buildReadingQueue } = require("../lib/signals/reading-queue.js");

const config = {
  universe: ["AAA", "BBB"],
  benchmark: "SPY",
  discoverNewTickers: true,
  discoverMinMentions: 3,
  minConfidence: 0.6,
  windows: { recentDays: 7, baselineDays: 30 },
  rules: {
    mentionSpike: { minMentions: 3, minRatio: 2.0 },
    sentimentShift: { minAbsShift: 0.3, minMentions: 2 },
    divergence: { minAbsSentiment: 0.3, minAbsExcessReturn: 0.05 },
  },
};

const AS_OF = "2026-10-20";
const item = (id, daysAgo, mentions) => ({
  id,
  publishedAt: new Date(Date.parse(AS_OF) - daysAgo * 86400000).toISOString(),
  mentions,
});
const mention = (ticker, sentiment, confidence = 0.9) => ({ ticker, company: ticker, sentiment, confidence, stance: sentiment > 0.15 ? "bullish" : sentiment < -0.15 ? "bearish" : "neutral", rationale: "fixture" });

// Prices: AAA flat then -10% in last 7d; BBB +10% last 7d; SPY flat.
function priceSeries(dailyChangeRecent, totalDays = 60) {
  const rows = [];
  let price = 100;
  for (let i = totalDays; i >= 0; i -= 1) {
    const date = new Date(Date.parse(AS_OF) - i * 86400000).toISOString().slice(0, 10);
    if (i < 7) price *= 1 + dailyChangeRecent;
    rows.push({ date, close: Math.round(price * 100) / 100 });
  }
  return rows;
}
const prices = {
  AAA: priceSeries(-0.015), // ~ -10% over recent week
  BBB: priceSeries(0.014), // ~ +10% over recent week
  SPY: priceSeries(0),
};

const extractions = {
  items: {
    // AAA: 3 bullish recent (spike + bullish vs weak baseline), 1 neutral baseline
    a1: item("a1", 1, [mention("AAA", 0.8)]),
    a2: item("a2", 2, [mention("AAA", 0.7)]),
    a3: item("a3", 3, [mention("AAA", 0.9)]),
    a4: item("a4", 20, [mention("AAA", 0.1)]),
    // BBB: bearish recent, no baseline
    b1: item("b1", 1, [mention("BBB", -0.8)]),
    b2: item("b2", 2, [mention("BBB", -0.7)]),
    // CCC (discovered): 3 mentions in window
    c1: item("c1", 1, [mention("CCC", 0.5)]),
    c2: item("c2", 2, [mention("CCC", 0.5)]),
    c3: item("c3", 3, [mention("CCC", 0.5)]),
    // Low confidence — must be ignored
    d1: item("d1", 1, [mention("AAA", -1, 0.2)]),
    // Out of window (100 days ago) — must be ignored
    e1: item("e1", 100, [mention("BBB", 1)]),
  },
};

const rows = computeSignals(extractions, prices, config, AS_OF);
const byTicker = Object.fromEntries(rows.map((r) => [r.ticker, r]));

assert.ok(byTicker.AAA, "AAA row exists");
assert.strictEqual(byTicker.AAA.mentionsRecent, 3, "AAA recent mentions = 3 (low-conf excluded)");
assert.strictEqual(byTicker.AAA.mentionsBaseline, 1, "AAA baseline mentions = 1");
assert.ok(byTicker.AAA.spikeRatio >= 2, `AAA spike fires (${byTicker.AAA.spikeRatio})`);
assert.ok(byTicker.AAA.rules.some((r) => r.id === "MENTION_SPIKE"), "AAA MENTION_SPIKE");
assert.ok(byTicker.AAA.rules.some((r) => r.id === "BULLISH_SHIFT"), "AAA BULLISH_SHIFT (0.8 vs 0.1)");
assert.ok(byTicker.AAA.rules.some((r) => r.id === "DIVERGENCE_LONG"), "AAA DIVERGENCE_LONG (bullish + lagging SPY)");
assert.strictEqual(byTicker.AAA.flag, "LONG", "AAA flagged LONG");

assert.strictEqual(byTicker.BBB.mentionsRecent, 2, "BBB recent = 2 (100d-old excluded)");
assert.ok(byTicker.BBB.excessRecent > 0.05, "BBB beat SPY");
assert.strictEqual(byTicker.BBB.sentBaseline, null, "BBB no baseline sentiment");
assert.strictEqual(byTicker.BBB.sentShift, null, "no shift without baseline");

assert.ok(byTicker.CCC?.discovered, "CCC discovered with 3 mentions");
assert.ok(!byTicker.DDD, "no phantom tickers");

assert.ok(rows[0].score >= rows[rows.length - 1].score, "sorted by score desc");

// What-if: raising the spike threshold removes MENTION_SPIKE but not the shift.
const strict = JSON.parse(JSON.stringify(config));
strict.rules.mentionSpike.minMentions = 99;
const rows2 = computeSignals(extractions, prices, strict, AS_OF);
assert.ok(!rows2.find((r) => r.ticker === "AAA").rules.some((r) => r.id === "MENTION_SPIKE"), "slider threshold respected");

// --- Must-Read queue -------------------------------------------------
const queueConfig = {
  ...config,
  readingQueue: {
    maxItems: 25,
    windowDays: 7,
    flagWeights: { LONG: 40, SHORT: 40, WATCH: 22 },
    sourceWeights: { Substack: 10, Blog: 10, TickerNews: 3 },
  },
};
const queueRecords = [
  { id: "q1", title: "AAA deep dive", source: "Some Substack", sourceType: "Substack", url: "https://example.com/q1", publishedAt: item("q1", 1, []).publishedAt, mentions: [mention("AAA", 0.8)] },
  { id: "q2", title: "BBB mention roundup", source: "Yahoo Finance — BBB", sourceType: "TickerNews", url: "https://example.com/q2", publishedAt: item("q2", 1, []).publishedAt, mentions: [mention("BBB", -0.8)] },
  { id: "q3", title: "No mentions here", source: "Some Substack", sourceType: "Substack", url: "https://example.com/q3", publishedAt: item("q3", 1, []).publishedAt, mentions: [] },
  { id: "q4", title: "Old AAA piece", source: "Some Substack", sourceType: "Substack", url: "https://example.com/q4", publishedAt: item("q4", 30, []).publishedAt, mentions: [mention("AAA", 0.9)] },
];
const queue = buildReadingQueue(queueRecords, rows, queueConfig, AS_OF);
assert.strictEqual(queue.length, 2, "queue keeps only in-window items with mentions");
assert.strictEqual(queue[0].id, "q1", "flagged LONG ticker + long-form source outranks headline item");
assert.ok(queue[0].reasons.length >= 1 && queue[0].reasons.length <= 3, "reason chips present (max 3)");
assert.ok(queue[0].reasons.some((r) => r.includes("AAA")), "reason names the ticker");
assert.ok(queue[0].score > queue[1].score, "scores descending");
assert.deepStrictEqual(buildReadingQueue([], rows, queueConfig, AS_OF), [], "empty input -> empty queue");

console.log("test-signals: all assertions passed");
console.log(rows.map((r) => `${r.ticker} flag=${r.flag || "-"} score=${r.score} rules=${r.rules.map((x) => x.id).join(",") || "-"}`).join("\n"));
