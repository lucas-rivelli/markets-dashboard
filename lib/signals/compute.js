"use strict";

// Signal engine for Markets Reading: Signals. Pure function, no I/O.
// Works in Node (require) and in the browser (window.SignalsCompute) so the
// page's what-if sliders re-run exactly the code the server runs.

(function (global) {
  function toDateStr(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  function addDaysStr(dateStr, days) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function extractionRecords(extractions) {
    if (!extractions) return [];
    if (Array.isArray(extractions)) return extractions;
    if (Array.isArray(extractions.items)) return extractions.items;
    if (extractions.items && typeof extractions.items === "object") return Object.values(extractions.items);
    return [];
  }

  function priceCloses(prices, ticker) {
    if (!prices) return [];
    const entry = prices[ticker] || prices[ticker.toUpperCase()];
    if (!entry) return [];
    if (Array.isArray(entry)) return entry;
    if (Array.isArray(entry.closes)) return entry.closes;
    return [];
  }

  function closeOnOrBefore(closes, dateStr) {
    let found = null;
    for (const row of closes) {
      if (row.date <= dateStr) found = row;
      else break;
    }
    return found;
  }

  function priceReturn(closes, asOf, days) {
    if (!closes.length) return null;
    const end = closeOnOrBefore(closes, asOf);
    if (!end) return null;
    const start = closeOnOrBefore(closes, addDaysStr(asOf, -days));
    if (!start || !start.close) return null;
    return end.close / start.close - 1;
  }

  function weightedSentiment(mentions) {
    let num = 0;
    let den = 0;
    for (const m of mentions) {
      const c = Number(m.confidence) || 0;
      num += (Number(m.sentiment) || 0) * c;
      den += c;
    }
    return den > 0 ? num / den : null;
  }

  const round = (n, dp = 4) => (n === null || n === undefined || !Number.isFinite(n) ? n : Math.round(n * 10 ** dp) / 10 ** dp);

  /**
   * computeSignals(extractions, prices, config, asOfDate)
   * -> one row per universe ticker (+ discovered tickers), sorted by score desc.
   */
  function computeSignals(extractions, prices, config, asOfDate) {
    const asOf = toDateStr(asOfDate || new Date());
    const R = Number(config.windows?.recentDays) || 7;
    const B = Number(config.windows?.baselineDays) || 30;
    const minConfidence = Number(config.minConfidence) || 0;
    const benchmark = String(config.benchmark || "SPY").toUpperCase();
    const universe = (config.universe || []).map((t) => String(t).toUpperCase());
    const universeSet = new Set(universe);

    const recentStart = addDaysStr(asOf, -R);
    const baselineStart = addDaysStr(asOf, -R - B);

    // Per-ticker mention buckets: { recent: [], baseline: [], totalWindowItems:Set }
    const buckets = new Map();
    const bucketFor = (ticker) => {
      if (!buckets.has(ticker)) buckets.set(ticker, { recent: [], baseline: [], recentItems: new Set(), baselineItems: new Set(), totalMentions: 0 });
      return buckets.get(ticker);
    };

    for (const record of extractionRecords(extractions)) {
      const date = toDateStr(record.publishedAt);
      if (!date || date > asOf || date <= baselineStart) continue;
      const window = date > recentStart ? "recent" : "baseline";
      const seenInItem = new Set();
      for (const mention of record.mentions || []) {
        const ticker = String(mention.ticker || "").toUpperCase();
        if (!ticker || seenInItem.has(ticker)) continue;
        if ((Number(mention.confidence) || 0) < minConfidence) continue;
        seenInItem.add(ticker);
        const bucket = bucketFor(ticker);
        bucket[window].push(mention);
        bucket[`${window}Items`].add(record.id || record.url);
        bucket.totalMentions += 1;
      }
    }

    const tickers = new Set(universe);
    if (config.discoverNewTickers) {
      const minMentions = Number(config.discoverMinMentions) || 3;
      for (const [ticker, bucket] of buckets) {
        if (!universeSet.has(ticker) && bucket.totalMentions >= minMentions) tickers.add(ticker);
      }
    }

    const benchCloses = priceCloses(prices, benchmark);
    const benchRetRecent = priceReturn(benchCloses, asOf, R);

    const spike = config.rules?.mentionSpike || {};
    const shift = config.rules?.sentimentShift || {};
    const div = config.rules?.divergence || {};

    const rows = [];
    for (const ticker of tickers) {
      const bucket = buckets.get(ticker) || { recent: [], baseline: [], recentItems: new Set(), baselineItems: new Set(), totalMentions: 0 };
      const mentionsRecent = bucket.recentItems.size;
      const mentionsBaseline = bucket.baselineItems.size;
      const baselineRate = (mentionsBaseline * R) / B;
      const spikeRatio = mentionsRecent / Math.max(baselineRate, 0.5);
      const sentRecent = weightedSentiment(bucket.recent);
      const sentBaseline = weightedSentiment(bucket.baseline);
      const sentShift = sentRecent !== null && sentBaseline !== null ? sentRecent - sentBaseline : null;

      const closes = priceCloses(prices, ticker);
      const retRecent = priceReturn(closes, asOf, R);
      const ret30 = priceReturn(closes, asOf, 30);
      const excessRecent = retRecent !== null && benchRetRecent !== null ? retRecent - benchRetRecent : null;
      const lastBar = closes.length ? closes[closes.length - 1] : null;

      const rules = [];
      if (mentionsRecent >= (Number(spike.minMentions) || 3) && spikeRatio >= (Number(spike.minRatio) || 2)) {
        rules.push({ id: "MENTION_SPIKE", flag: "WATCH", label: "Mention spike" });
      }
      if (sentShift !== null && mentionsRecent >= (Number(shift.minMentions) || 2) && sentShift >= (Number(shift.minAbsShift) || 0.3)) {
        rules.push({ id: "BULLISH_SHIFT", flag: "LONG", label: "Bullish sentiment shift" });
      }
      if (sentShift !== null && mentionsRecent >= (Number(shift.minMentions) || 2) && sentShift <= -(Number(shift.minAbsShift) || 0.3)) {
        rules.push({ id: "BEARISH_SHIFT", flag: "SHORT", label: "Bearish sentiment shift" });
      }
      if (sentRecent !== null && excessRecent !== null && sentRecent >= (Number(div.minAbsSentiment) || 0.3) && excessRecent <= -(Number(div.minAbsExcessReturn) || 0.05)) {
        rules.push({ id: "DIVERGENCE_LONG", flag: "LONG", label: "Bullish divergence (research up, price lagging)" });
      }
      if (sentRecent !== null && excessRecent !== null && sentRecent <= -(Number(div.minAbsSentiment) || 0.3) && excessRecent >= (Number(div.minAbsExcessReturn) || 0.05)) {
        rules.push({ id: "DIVERGENCE_SHORT", flag: "SHORT", label: "Bearish divergence (research down, price leading)" });
      }

      const hasLong = rules.some((r) => r.flag === "LONG");
      const hasShort = rules.some((r) => r.flag === "SHORT");
      const score = (sentRecent || 0) * Math.log(1 + mentionsRecent);
      let flag = null;
      if (hasLong && hasShort) flag = score >= 0 ? "LONG" : "SHORT";
      else if (hasLong) flag = "LONG";
      else if (hasShort) flag = "SHORT";
      else if (rules.length) flag = "WATCH";

      rows.push({
        ticker,
        discovered: !universeSet.has(ticker),
        flag,
        rules,
        mentionsRecent,
        mentionsBaseline,
        baselineRate: round(baselineRate, 3),
        spikeRatio: round(spikeRatio, 3),
        sentRecent: sentRecent === null ? null : round(sentRecent, 3),
        sentBaseline: sentBaseline === null ? null : round(sentBaseline, 3),
        sentShift: sentShift === null ? null : round(sentShift, 3),
        retRecent: retRecent === null ? null : round(retRecent),
        excessRecent: excessRecent === null ? null : round(excessRecent),
        ret30: ret30 === null ? null : round(ret30),
        score: round(score, 4),
        lastPrice: lastBar ? lastBar.close : null,
        lastPriceDate: lastBar ? lastBar.date : null,
        priceBars: closes.length,
      });
    }

    rows.sort((a, b) => b.score - a.score || b.mentionsRecent - a.mentionsRecent || a.ticker.localeCompare(b.ticker));
    return rows;
  }

  const api = { computeSignals, extractionRecords, priceCloses, priceReturn, toDateStr, addDaysStr };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.SignalsCompute = api;
})(typeof window !== "undefined" ? window : globalThis);
