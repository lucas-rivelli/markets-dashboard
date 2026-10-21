"use strict";

// Shared refresh pipeline used by scripts/signals-refresh.mjs (incremental,
// scheduled) and scripts/signals-backfill.mjs (first run, deep prices +
// wide extraction). Steps: fetch sources -> extract new -> update prices
// (universe + benchmark + discovered) -> compute -> alerts -> state/track.

const fs = require("fs");
const path = require("path");
const { fetchAllSources } = require("./sources");
const { extractNewItems, loadExtractions } = require("./extract");
const { updatePrices, loadPrices } = require("./prices");
const { computeSignals } = require("./compute");
const { buildReadingQueue } = require("./reading-queue");
const { updateAlerts } = require("./alerts");
const { computeTrackRecord } = require("./track-record");

const SIGNALS_DIR = path.join(__dirname, "..", "..", "data", "signals");
const STATE_PATH = path.join(SIGNALS_DIR, "state.json");
const TRACK_PATH = path.join(SIGNALS_DIR, "track-record.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function discoveredTickers(store, config) {
  if (!config.discoverNewTickers) return [];
  const counts = new Map();
  for (const record of Object.values(store.items || {})) {
    const seen = new Set();
    for (const m of record.mentions || []) {
      const t = String(m.ticker || "").toUpperCase();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  const universe = new Set(config.universe);
  return [...counts.entries()]
    .filter(([t, n]) => !universe.has(t) && n >= (Number(config.discoverMinMentions) || 3))
    .map(([t]) => t)
    .sort();
}

function loadPriceMap(tickers) {
  const prices = {};
  const status = [];
  for (const ticker of tickers) {
    const payload = loadPrices(ticker);
    if (payload?.closes?.length) {
      prices[ticker] = payload;
      status.push({ ticker, ok: true, bars: payload.closes.length, provider: payload.provider });
    } else {
      status.push({ ticker, ok: false, bars: 0, provider: null });
    }
  }
  return { prices, status };
}

async function runPipeline(config, {
  log = console.log,
  extractLimit,
  priceYears = 2,
  doTrackRecord = true,
  publicUrl = process.env.SIGNALS_PUBLIC_URL || "",
} = {}) {
  const startedAt = new Date().toISOString();

  log("1/6 Fetching sources…");
  const { items, sourceStatus } = await fetchAllSources(config);
  const okSources = sourceStatus.filter((s) => s.ok).length;
  log(`    ${items.length} unique items · ${okSources}/${sourceStatus.length} sources ok`);

  log("2/6 Extracting new items (LLM)…");
  const { store, results, skipped } = await extractNewItems(items, config, { limit: extractLimit, log });
  log(`    extracted ${results.length} new · skipped ${skipped.length} · total stored ${Object.keys(store.items).length}`);

  log("3/6 Updating prices…");
  const discovered = discoveredTickers(store, config);
  const priceTickers = [...new Set([...config.universe, config.benchmark, ...discovered])];
  for (const ticker of priceTickers) {
    try {
      const saved = await updatePrices(ticker, { years: priceYears });
      log(`    ok ${ticker} ${saved.closes.length} bars (${saved.provider})`);
    } catch (err) {
      log(`    FAIL ${ticker} — ${err.message} (using cached file if present)`);
    }
    await sleep(250);
  }

  log("4/6 Computing signals…");
  const { prices, status: priceStatus } = loadPriceMap(priceTickers);
  const asOf = new Date().toISOString().slice(0, 10);
  const freshStore = loadExtractions();
  const rows = computeSignals(freshStore, prices, config, asOf);
  log(`    ${rows.length} rows · flagged: ${rows.filter((r) => r.flag).map((r) => `${r.ticker}:${r.flag}`).join(", ") || "none"}`);

  const readingQueue = buildReadingQueue(freshStore, rows, config, asOf);
  log(`    Must-Read queue: ${readingQueue.length} items${readingQueue[0] ? ` · top: ${readingQueue[0].title.slice(0, 60)} (${readingQueue[0].score})` : ""}`);

  log("5/6 Alerts…");
  const { newAlerts, store: alertsStore } = await updateAlerts(rows, freshStore, config, { date: asOf, publicUrl, log });
  log(`    ${newAlerts.length} new alert(s) · ${alertsStore.alerts.length} total`);

  log("6/6 Track record + state…");
  let trackRecord = null;
  if (doTrackRecord) {
    trackRecord = computeTrackRecord(freshStore, prices, config);
    fs.writeFileSync(TRACK_PATH, JSON.stringify(trackRecord, null, 2) + "\n");
    log(`    replay ${trackRecord.replayFrom || "?"} → ${trackRecord.replayTo || "?"} · ${trackRecord.events.length} events`);
  }

  const mentionCount = Object.values(freshStore.items).reduce((n, r) => n + (r.mentions?.length || 0), 0);
  const state = {
    schema_version: 1,
    lastUpdated: new Date().toISOString(),
    startedAt,
    asOf,
    ntfyTopic: process.env.NTFY_TOPIC || null,
    publicUrl: publicUrl || null,
    llmModel: config.llm?.model || null,
    sourceStatus,
    priceStatus,
    counts: {
      sourcesOk: okSources,
      sourcesFailed: sourceStatus.length - okSources,
      sourcesTotal: sourceStatus.length,
      itemsFetched: items.length,
      extractionsTotal: Object.keys(freshStore.items).length,
      mentionsTotal: mentionCount,
      tickers: rows.length,
      pricesOk: priceStatus.filter((p) => p.ok).length,
      alertsTotal: alertsStore.alerts.length,
      newAlerts: newAlerts.length,
    },
    rows,
    readingQueue,
  };
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");

  return { state, rows, readingQueue, newAlerts, trackRecord, sourceStatus, priceStatus };
}

module.exports = { runPipeline, discoveredTickers, loadPriceMap, STATE_PATH, TRACK_PATH };
