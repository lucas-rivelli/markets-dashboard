"use strict";

// Market data for Markets Reading: Signals — provider interface.
//
// Verified 2026-10-20 from this machine:
// - Stooq CSV (stooq.com/q/d/l/?s=<t>.us&i=d) returns HTTP 200 but an HTML
//   JavaScript anti-bot challenge, not CSV. It cannot work from a script,
//   a Vercel function or a GitHub Action. Kept as a provider below (it
//   detects the challenge page and throws) but NOT used first.
// - Yahoo Finance chart API (query1/query2.finance.yahoo.com/v8/finance/chart)
//   is free and key-less and returns 2y of bars in single requests, but
//   burst traffic from one IP gets HTTP 429. Used with backoff, as fallback.
// - Nasdaq API (api.nasdaq.com/api/quote/<t>/historical) is free, key-less
//   and returned the full 500-bar 2y history reliably in one call. PRIMARY.
// - Financial Modeling Prep is the keyed fallback (FMP_API_KEY env only).
//
// Each price file records its provider and whether closes are adjusted
// (Yahoo/FMP: adjusted close; Nasdaq/Stooq: traded close).

const fs = require("fs");
const path = require("path");

const PRICES_DIR = path.join(__dirname, "..", "..", "data", "signals", "prices");
const FETCH_TIMEOUT_MS = 20000;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

// ---------------------------------------------------------------- providers

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const yahooProvider = {
  name: "yahoo",
  async fetchDailyCloses(ticker, { from, to }) {
    const period1 = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000);
    const period2 = Math.floor(new Date(`${addDays(to, 1)}T00:00:00Z`).getTime() / 1000);
    const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
    let lastError = null;
    // Yahoo rate-limits bursts (HTTP 429): retry with backoff across hosts.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const host = hosts[attempt % hosts.length];
      try {
        const url =
          `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}` +
          `?period1=${period1}&period2=${period2}&interval=1d&events=div%2Csplit`;
        const raw = await fetchText(url);
        const payload = JSON.parse(raw);
        const result = payload?.chart?.result?.[0];
        if (!result?.timestamp?.length) throw new Error("Yahoo: empty chart result");
        const closes = result.indicators?.quote?.[0]?.close || [];
        const adjusted = result.indicators?.adjclose?.[0]?.adjclose || [];
        const rows = [];
        result.timestamp.forEach((ts, i) => {
          const value = adjusted[i] ?? closes[i];
          if (value == null || !Number.isFinite(value)) return;
          rows.push({ date: toISODate(new Date(ts * 1000)), close: Number(value) });
        });
        if (!rows.length) throw new Error("Yahoo: no usable closes");
        return rows;
      } catch (err) {
        lastError = err;
        if (attempt < 3) await sleep(1200 * 2 ** attempt);
      }
    }
    throw lastError || new Error("Yahoo: failed");
  },
};

const stooqProvider = {
  name: "stooq",
  async fetchDailyCloses(ticker) {
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(ticker.toLowerCase())}.us&i=d`;
    const raw = await fetchText(url);
    if (!/^Date,/m.test(raw)) {
      // Stooq currently serves a JS anti-bot challenge page to scripts.
      throw new Error("Stooq: non-CSV response (anti-bot challenge)");
    }
    const rows = [];
    for (const line of raw.trim().split("\n").slice(1)) {
      const [date, , , , close] = line.split(",");
      const value = Number(close);
      if (date && Number.isFinite(value)) rows.push({ date, close: value });
    }
    if (!rows.length) throw new Error("Stooq: no usable closes");
    return rows;
  },
};

const fmpProvider = {
  name: "fmp",
  async fetchDailyCloses(ticker, { from, to }) {
    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) throw new Error("FMP: FMP_API_KEY not set");
    const url =
      `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(ticker)}` +
      `?from=${from}&to=${to}&apikey=${encodeURIComponent(apiKey)}`;
    const raw = await fetchText(url);
    const payload = JSON.parse(raw);
    const rows = (payload?.historical || [])
      .map((r) => ({ date: r.date, close: Number(r.adjClose ?? r.close) }))
      .filter((r) => r.date && Number.isFinite(r.close));
    if (!rows.length) throw new Error("FMP: no usable closes");
    return rows.sort((a, b) => (a.date < b.date ? -1 : 1));
  },
};

function parseNasdaqDate(mdy) {
  const [m, d, y] = String(mdy).split("/").map(Number);
  if (!m || !d || !y) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const nasdaqProvider = {
  name: "nasdaq",
  async fetchDailyCloses(ticker, { from, to }) {
    // SPY and other ETFs live under assetclass=etf; try stocks first, then etf.
    let lastError = null;
    for (const assetClass of ["stocks", "etf"]) {
      try {
        const url =
          `https://api.nasdaq.com/api/quote/${encodeURIComponent(ticker)}/historical` +
          `?assetclass=${assetClass}&fromdate=${from}&todate=${to}&limit=9999`;
        const raw = await fetchText(url);
        const payload = JSON.parse(raw);
        const rawRows = payload?.data?.tradesTable?.rows || [];
        const rows = rawRows
          .map((r) => ({
            date: parseNasdaqDate(r.date),
            close: Number(String(r.close || "").replace(/[$,]/g, "")),
          }))
          .filter((r) => r.date && Number.isFinite(r.close));
        if (!rows.length) throw new Error(`Nasdaq: no rows (${assetClass})`);
        return rows.sort((a, b) => (a.date < b.date ? -1 : 1));
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("Nasdaq: failed");
  },
};

// Order matters: first success wins.
const PROVIDERS = [nasdaqProvider, yahooProvider, stooqProvider, fmpProvider];
const ADJUSTED_PROVIDERS = new Set(["yahoo", "fmp"]);

async function fetchDailyCloses(ticker, range) {
  const errors = [];
  for (const provider of PROVIDERS) {
    try {
      const closes = await provider.fetchDailyCloses(ticker, range);
      return { provider: provider.name, closes, adjusted: ADJUSTED_PROVIDERS.has(provider.name) };
    } catch (err) {
      errors.push(`${provider.name}: ${err.message}`);
    }
  }
  throw new Error(`All price providers failed for ${ticker} — ${errors.join(" | ")}`);
}

// ------------------------------------------------------------------ storage

function pricesPath(ticker, pricesDir = PRICES_DIR) {
  return path.join(pricesDir, `${String(ticker).toUpperCase()}.json`);
}

function loadPrices(ticker, pricesDir = PRICES_DIR) {
  const file = pricesPath(ticker, pricesDir);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(parsed?.closes)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function mergeCloses(existing, incoming) {
  const byDate = new Map();
  for (const row of existing || []) byDate.set(row.date, row);
  for (const row of incoming || []) byDate.set(row.date, row);
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function savePrices(ticker, closes, provider, pricesDir = PRICES_DIR, adjusted = false) {
  const symbol = String(ticker).toUpperCase();
  fs.mkdirSync(pricesDir, { recursive: true });
  const payload = {
    ticker: symbol,
    provider,
    adjusted,
    updatedAt: new Date().toISOString(),
    closes,
  };
  fs.writeFileSync(pricesPath(symbol, pricesDir), JSON.stringify(payload, null, 2) + "\n");
  return payload;
}

/**
 * Fetch closes for a ticker, backfilling `years` on first run and only the
 * missing tail afterwards (re-fetching the last stored day to catch fixes).
 * Returns the saved payload.
 */
async function updatePrices(ticker, { years = 2, pricesDir = PRICES_DIR, today = toISODate(new Date()) } = {}) {
  const symbol = String(ticker).toUpperCase();
  const existing = loadPrices(symbol, pricesDir);
  const existingCloses = existing?.closes || [];

  let from;
  if (existingCloses.length) {
    from = existingCloses[existingCloses.length - 1].date;
  } else {
    const start = new Date(`${today}T00:00:00Z`);
    start.setUTCFullYear(start.getUTCFullYear() - years);
    from = toISODate(start);
  }

  const { provider, closes: fetched, adjusted } = await fetchDailyCloses(symbol, { from, to: today });
  const merged = mergeCloses(existingCloses, fetched);
  return savePrices(symbol, merged, provider, pricesDir, adjusted);
}

module.exports = {
  PRICES_DIR,
  PROVIDERS,
  nasdaqProvider,
  yahooProvider,
  stooqProvider,
  fmpProvider,
  fetchDailyCloses,
  pricesPath,
  loadPrices,
  mergeCloses,
  savePrices,
  updatePrices,
  toISODate,
  addDays,
};
