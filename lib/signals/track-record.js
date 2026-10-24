"use strict";

// Track record (Step 9): replay the rules day by day over history.
// For each past trading day, compute signals using ONLY extractions dated
// on/before that day, edge-trigger events (a rule firing that did not fire
// the previous replay day), then measure forward 5/20-trading-day excess
// returns vs the benchmark. This is a small-sample, in-sample check on a
// screener — NOT a backtest of a tradable strategy (no costs, no sizing,
// mentions only exist where feeds happened to publish).

const { computeSignals, priceCloses } = require("./compute");

function forwardExcess(closes, benchCloses, date, tradingDays) {
  const idx = closes.findIndex((r) => r.date > date);
  const startIdx = idx === -1 ? closes.length - 1 : idx - 1;
  if (startIdx < 0 || !closes[startIdx]) return null;
  const endIdx = startIdx + tradingDays;
  if (endIdx >= closes.length) return null;
  const bIdx = benchCloses.findIndex((r) => r.date > date);
  const bStart = bIdx === -1 ? benchCloses.length - 1 : bIdx - 1;
  if (bStart < 0 || bStart + tradingDays >= benchCloses.length) return null;
  const ret = closes[endIdx].close / closes[startIdx].close - 1;
  const bRet = benchCloses[bStart + tradingDays].close / benchCloses[bStart].close - 1;
  return ret - bRet;
}

function summarize(events, key) {
  const groups = new Map();
  for (const e of events) {
    const groupKey = e[key];
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(e);
  }
  return [...groups.entries()].map(([name, list]) => {
    const withFwd = list.filter((e) => e.fwd20 !== null && e.fwd20 !== undefined);
    const directional = withFwd.map((e) => (e.flag === "SHORT" ? -e.fwd20 : e.fwd20));
    const hits = directional.filter((v) => v > 0).length;
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    return {
      name,
      events: list.length,
      measured: withFwd.length,
      hitRate20: withFwd.length ? Math.round((hits / withFwd.length) * 1000) / 1000 : null,
      avgExcess5: avg(withFwd.map((e) => e.fwd5).filter((v) => v !== null)),
      avgExcess20: avg(withFwd.map((e) => e.fwd20)),
    };
  }).sort((a, b) => b.events - a.events);
}

function computeTrackRecord(extractions, prices, config) {
  const records = !extractions ? [] : Array.isArray(extractions) ? extractions : Object.values(extractions.items || {});
  const benchCloses = priceCloses(prices, String(config.benchmark || "SPY").toUpperCase());
  if (!records.length || !benchCloses.length) {
    return { generatedAt: new Date().toISOString(), label: "Small-sample, in-sample check — not a backtest of a tradable strategy.", events: [], byRule: [], byFlag: [] };
  }

  const dates = records.map((r) => (r.publishedAt || "").slice(0, 10)).filter(Boolean).sort();
  const earliest = dates[0];
  const windowDays = (Number(config.windows?.recentDays) || 7) + (Number(config.windows?.baselineDays) || 30);
  const startIdx = benchCloses.findIndex((r) => r.date >= earliest);
  const replayDates = benchCloses.slice(Math.max(0, startIdx)).map((r) => r.date);

  const events = [];
  let prevFired = new Set();

  for (const date of replayDates) {
    const rows = computeSignals(records, prices, config, date);
    const firedNow = new Set();
    for (const row of rows) {
      const closes = priceCloses(prices, row.ticker);
      for (const rule of row.rules || []) {
        const key = `${row.ticker}|${rule.id}`;
        firedNow.add(key);
        if (prevFired.has(key)) continue; // edge-trigger only
        events.push({
          date,
          ticker: row.ticker,
          rule: rule.id,
          flag: rule.flag,
          fwd5: forwardExcess(closes, benchCloses, date, 5),
          fwd20: forwardExcess(closes, benchCloses, date, 20),
        });
      }
    }
    prevFired = firedNow;
  }

  return {
    generatedAt: new Date().toISOString(),
    label: "Small-sample, in-sample check — not a backtest of a tradable strategy. No costs, no position sizing; mention history only exists where feeds published.",
    replayFrom: replayDates[0] || null,
    replayTo: replayDates[replayDates.length - 1] || null,
    windowDays,
    events: events.slice(-200),
    byRule: summarize(events, "rule"),
    byFlag: summarize(events, "flag"),
  };
}

module.exports = { computeTrackRecord };
