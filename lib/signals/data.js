"use strict";

// Data loading for GET /api/signals.
// Locally (and in a fresh deployment) files are read from data/signals/ on
// disk. On Vercel, the deployed files go stale between data-only commits
// (which skip redeploys via scripts/vercel-ignore.sh), so production reads
// the latest committed JSON from raw.githubusercontent.com instead.
// Branch/repo overridable via SIGNALS_DATA_BRANCH / SIGNALS_DATA_REPO.

const fs = require("fs");
const path = require("path");
const { computeSignals, extractionRecords } = require("./compute");
const { buildReadingQueue } = require("./reading-queue");

const SIGNALS_DIR = path.join(__dirname, "..", "..", "data", "signals");
const CHART_BARS = 190; // ~9 months — enough for the 6-month chart + ret30

function dataBranch() {
  return process.env.SIGNALS_DATA_BRANCH || "fmkt256-signals";
}
function dataRepo() {
  return process.env.SIGNALS_DATA_REPO || "lucas-rivelli/markets-dashboard";
}

async function fetchRawJson(relPath) {
  const url = `https://raw.githubusercontent.com/${dataRepo()}/${dataBranch()}/${relPath}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "MarketsReadingSignals/1.0" } });
  if (!res.ok) throw new Error(`raw GitHub ${res.status} for ${relPath}`);
  return res.json();
}

function readLocalJson(relPath) {
  const file = path.join(__dirname, "..", "..", relPath);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function loadJson(relPath) {
  if (process.env.VERCEL) {
    try {
      return await fetchRawJson(relPath);
    } catch {
      return readLocalJson(relPath);
    }
  }
  return readLocalJson(relPath);
}

async function loadSignalsPayload() {
  const [config, state, alertsStore, extractions, trackRecord] = await Promise.all([
    loadJson("data/signals/config.json"),
    loadJson("data/signals/state.json"),
    loadJson("data/signals/alerts.json"),
    loadJson("data/signals/extractions.json"),
    loadJson("data/signals/track-record.json"),
  ]);
  if (!config) throw new Error("data/signals/config.json not found");

  const records = extractionRecords(extractions || { items: {} });

  // Mentions grouped by ticker (for detail view), newest first.
  const mentionsByTicker = {};
  for (const record of records) {
    for (const mention of record.mentions || []) {
      const ticker = String(mention.ticker || "").toUpperCase();
      if (!ticker) continue;
      (mentionsByTicker[ticker] = mentionsByTicker[ticker] || []).push({
        id: record.id,
        title: record.title,
        source: record.source,
        sourceType: record.sourceType,
        url: record.url,
        publishedAt: record.publishedAt,
        sentiment: mention.sentiment,
        confidence: mention.confidence,
        stance: mention.stance,
        rationale: mention.rationale,
      });
    }
  }
  for (const list of Object.values(mentionsByTicker)) {
    list.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  }

  // Prices for universe + benchmark + tickers that have screener rows.
  // (Detail charts for other mentioned tickers lazy-load their static file.)
  const rowTickers = (state?.rows || []).map((r) => r.ticker);
  const tickers = [...new Set([...(config.universe || []), config.benchmark, ...rowTickers])];
  const pricesFull = {};
  const pricesByTicker = {};
  await Promise.all(tickers.map(async (ticker) => {
    const payload = await loadJson(`data/signals/prices/${ticker}.json`);
    if (payload?.closes?.length) {
      pricesFull[ticker] = payload;
      pricesByTicker[ticker] = payload.closes.slice(-CHART_BARS);
    }
  }));

  const asOf = (state?.asOf || new Date().toISOString().slice(0, 10));
  const rows = state?.rows?.length && state.asOf === asOf
    ? state.rows
    : computeSignals(extractions || { items: {} }, pricesFull, config, asOf);

  // Slim extraction list so the browser can re-run computeSignals for sliders.
  const extractionsForCompute = records.map((r) => ({
    id: r.id,
    publishedAt: r.publishedAt,
    mentions: (r.mentions || []).map((m) => ({ ticker: m.ticker, sentiment: m.sentiment, confidence: m.confidence })),
  }));

  const readingQueue = state?.readingQueue?.length
    ? state.readingQueue
    : buildReadingQueue(extractions || { items: {} }, rows, config, asOf);

  return {
    config,
    state,
    rows,
    readingQueue,
    alerts: (alertsStore?.alerts || []).slice(0, 50),
    mentionsByTicker,
    pricesByTicker,
    extractionsForCompute,
    trackRecord: trackRecord || null,
    ntfyTopic: state?.ntfyTopic || process.env.NTFY_TOPIC || null,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { loadSignalsPayload, loadJson };
