"use strict";

// Must-Read queue for Markets Reading: Signals. Pure function, no I/O.
// Works in Node (require) and in the browser (window.SignalsReadingQueue)
// so the page re-scores live when the what-if sliders move.
//
// "Screeners flag tickers; Signals tells you what to read."
// Given extraction records + computed screener rows, rank individual
// research items by importance and explain each ranking with reason chips.
// No LLM calls — scoring reuses extractions, rows and rule firings.

(function (global) {
  function toDateStr(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  function daysBetween(fromStr, toStr) {
    const a = Date.parse(`${fromStr}T00:00:00Z`);
    const b = Date.parse(`${toStr}T00:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 999;
    return Math.round((b - a) / 86400000);
  }

  function recordsOf(extractions) {
    if (!extractions) return [];
    if (Array.isArray(extractions)) return extractions;
    if (Array.isArray(extractions.items)) return extractions.items;
    if (extractions.items && typeof extractions.items === "object") return Object.values(extractions.items);
    return [];
  }

  const FLAG_WEIGHT_DEFAULTS = { LONG: 40, SHORT: 40, WATCH: 22 };
  const FLAG_LABEL = { LONG: "Long candidate", SHORT: "Short candidate", WATCH: "Watch" };

  /**
   * buildReadingQueue(extractions, rows, config, asOfDate)
   * -> [{ id, title, source, sourceType, url, publishedAt, ticker, tickers,
   *       flag, score, reasons: [..max 3], rationale, sentiment, confidence }]
   *    sorted by score desc, capped at config.readingQueue.maxItems (default 25).
   */
  function buildReadingQueue(extractions, rows, config, asOfDate) {
    const cfg = (config && config.readingQueue) || {};
    const maxItems = Number(cfg.maxItems) > 0 ? Number(cfg.maxItems) : 25;
    const windowDays = Number(cfg.windowDays) > 0 ? Number(cfg.windowDays) : Number(config?.windows?.recentDays) || 7;
    const flagWeights = { ...FLAG_WEIGHT_DEFAULTS, ...(cfg.flagWeights || {}) };
    const sourceWeights = cfg.sourceWeights || { Substack: 10, Blog: 10, "Macro/Official": 9, YouTube: 6, TickerNews: 3, Extra: 5 };
    const minConfidence = Number(config?.minConfidence) || 0;
    const asOf = toDateStr(asOfDate || new Date());

    const rowByTicker = new Map();
    for (const row of rows || []) rowByTicker.set(String(row.ticker).toUpperCase(), row);

    const queue = [];

    for (const record of recordsOf(extractions)) {
      const date = toDateStr(record.publishedAt);
      if (!date || date > asOf) continue;
      const ageDays = daysBetween(date, asOf);
      if (ageDays > windowDays) continue;

      const mentions = (record.mentions || []).filter(
        (m) => m && m.ticker && (Number(m.confidence) || 0) >= minConfidence
      );
      if (!mentions.length) continue;

      // Pick the mention that matters most: flagged ticker first, then
      // strongest sentiment x confidence.
      const scored = mentions.map((m) => {
        const ticker = String(m.ticker).toUpperCase();
        const row = rowByTicker.get(ticker);
        return { mention: m, ticker, row, flagWeight: row?.flag ? flagWeights[row.flag] || 0 : 0 };
      });
      scored.sort(
        (a, b) =>
          b.flagWeight - a.flagWeight ||
          Math.abs(b.mention.sentiment || 0) * (b.mention.confidence || 0) -
            Math.abs(a.mention.sentiment || 0) * (a.mention.confidence || 0)
      );
      const primary = scored[0];
      const { mention, ticker, row } = primary;

      let score = 0;
      const reasons = [];

      if (row?.flag) {
        score += flagWeights[row.flag] || 0;
        reasons.push({ text: `${ticker}: ${FLAG_LABEL[row.flag]}`, weight: flagWeights[row.flag] || 0 });
      }
      if (row && Math.abs(row.sentShift || 0) >= 0.3) {
        const w = Math.min(18, Math.abs(row.sentShift) * 30);
        score += w;
        reasons.push({
          text: `sentiment shift ${row.sentShift >= 0 ? "+" : ""}${Number(row.sentShift).toFixed(2)}`,
          weight: w,
        });
      }
      if (row && row.spikeRatio >= 2 && row.mentionsRecent >= 3) {
        const w = Math.min(14, 6 + row.spikeRatio * 2);
        score += w;
        reasons.push({ text: `${row.mentionsRecent} mentions this week (${Number(row.spikeRatio).toFixed(1)}x baseline)`, weight: w });
      }
      if (row?.rules?.some((r) => r.id === "DIVERGENCE_LONG" || r.id === "DIVERGENCE_SHORT")) {
        score += 14;
        reasons.push({ text: "stock moving against the research", weight: 14 });
      }

      const ownStrength = Math.abs(Number(mention.sentiment) || 0) * (Number(mention.confidence) || 0) * 16;
      score += ownStrength;
      if (ownStrength >= 8) {
        reasons.push({
          text: `${mention.stance || (mention.sentiment >= 0 ? "bullish" : "bearish")} view, confidence ${Number(mention.confidence).toFixed(2)}`,
          weight: ownStrength,
        });
      }

      const sourceWeight = sourceWeights[record.sourceType] ?? 5;
      score += sourceWeight;

      // Recency decay: full credit today, losing ~12% per day.
      score *= Math.max(0.35, 1 - ageDays * 0.12);

      if (row?.discovered) {
        score += 4;
        reasons.push({ text: "new name outside the universe", weight: 4 });
      }

      reasons.sort((a, b) => b.weight - a.weight);

      queue.push({
        id: record.id,
        title: record.title,
        source: record.source,
        sourceType: record.sourceType,
        url: record.url,
        publishedAt: record.publishedAt || null,
        ticker,
        tickers: [...new Set(scored.map((s) => s.ticker))],
        flag: row?.flag || null,
        score: Math.round(score * 10) / 10,
        reasons: reasons.slice(0, 3).map((r) => r.text),
        rationale: mention.rationale || "",
        sentiment: mention.sentiment,
        confidence: mention.confidence,
      });
    }

    queue.sort((a, b) => b.score - a.score || String(b.publishedAt).localeCompare(String(a.publishedAt)));
    // Diversity: at most 3 items per ticker in the first pass, then backfill,
    // so one hot name cannot fill the whole morning edition.
    const perTicker = new Map();
    const diverse = [];
    const overflow = [];
    for (const item of queue) {
      const n = perTicker.get(item.ticker) || 0;
      if (n < 3) {
        diverse.push(item);
        perTicker.set(item.ticker, n + 1);
      } else {
        overflow.push(item);
      }
      if (diverse.length >= maxItems) break;
    }
    return [...diverse, ...overflow].slice(0, maxItems);
  }

  const api = { buildReadingQueue };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.SignalsReadingQueue = api;
})(typeof window !== "undefined" ? window : globalThis);
