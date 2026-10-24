"use strict";

// Alerts for Markets Reading: Signals.
// After each compute, any newly-fired (ticker + rule + date) becomes an
// alert record in data/signals/alerts.json, is shown in the page's Alerts
// panel, and — when NTFY_TOPIC is set and config.alerts.ntfy is on — is
// posted to ntfy.sh, where anyone can watch it with no account:
// https://ntfy.sh/<topic>

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ALERTS_PATH = path.join(__dirname, "..", "..", "data", "signals", "alerts.json");

function loadAlerts(filePath = ALERTS_PATH) {
  if (!fs.existsSync(filePath)) return { schema_version: 1, alerts: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(parsed?.alerts) ? parsed : { schema_version: 1, alerts: [] };
  } catch {
    return { schema_version: 1, alerts: [] };
  }
}

function saveAlerts(store, filePath = ALERTS_PATH) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2) + "\n");
  return store;
}

function alertId(ticker, rule, date) {
  return crypto.createHash("sha256").update(`${ticker}|${rule}|${date}`).digest("hex").slice(0, 16);
}

function topItemUrlsForTicker(extractions, ticker, limit = 3) {
  const records = !extractions ? [] : Array.isArray(extractions) ? extractions : Object.values(extractions.items || {});
  return records
    .filter((r) => (r.mentions || []).some((m) => String(m.ticker).toUpperCase() === ticker))
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .slice(0, limit)
    .map((r) => r.url)
    .filter(Boolean);
}

const FLAG_TITLE = { LONG: "LONG candidate", SHORT: "SHORT candidate", WATCH: "Watch" };

async function postNtfy(alert, { publicUrl } = {}) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return { sent: false, reason: "NTFY_TOPIC not set" };
  const m = alert.metrics || {};
  const link = publicUrl ? `${publicUrl}#ticker=${alert.ticker}` : "";
  const body = [
    `${alert.ruleLabel || alert.rule} · mentions(7d)=${m.mentionsRecent ?? "?"} sent=${m.sentRecent ?? "?"} shift=${m.sentShift ?? "?"} excess7d=${m.excessRecent ?? "?"}`,
    link,
  ].filter(Boolean).join("\n");
  const ascii = (s) => String(s).replace(/[^\x20-\x7E]/g, "-");
  const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
    method: "POST",
    headers: {
      Title: ascii(`${FLAG_TITLE[alert.flag] || "Signal"}: ${alert.ticker} (${String(alert.ruleLabel || alert.rule).toLowerCase()})`),
      Tags: alert.flag === "LONG" ? "chart_with_upwards_trend" : alert.flag === "SHORT" ? "chart_with_downwards_trend" : "eyes",
      ...(link ? { Click: link } : {}),
    },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`ntfy HTTP ${res.status}`);
  return { sent: true, topic };
}

/**
 * Compare today's fired rules with alerts.json. Creates + persists new
 * alerts and (optionally) posts them to ntfy. Returns { newAlerts, store }.
 */
async function updateAlerts(rows, extractions, config, { alertsPath = ALERTS_PATH, date, publicUrl, sendNtfy = true, log = console.log } = {}) {
  const store = loadAlerts(alertsPath);
  const firedDate = (date || new Date().toISOString()).slice(0, 10);
  const existing = new Set(store.alerts.map((a) => a.id));
  const newAlerts = [];

  for (const row of rows || []) {
    for (const rule of row.rules || []) {
      const id = alertId(row.ticker, rule.id, firedDate);
      if (existing.has(id)) continue;
      const alert = {
        id,
        ticker: row.ticker,
        rule: rule.id,
        ruleLabel: rule.label,
        flag: rule.flag,
        firedAt: new Date().toISOString(),
        firedDate,
        metrics: {
          mentionsRecent: row.mentionsRecent,
          spikeRatio: row.spikeRatio,
          sentRecent: row.sentRecent,
          sentShift: row.sentShift,
          retRecent: row.retRecent,
          excessRecent: row.excessRecent,
          score: row.score,
        },
        topItems: topItemUrlsForTicker(extractions, row.ticker, 3),
      };
      store.alerts.push(alert);
      existing.add(id);
      newAlerts.push(alert);
    }
  }

  store.alerts.sort((a, b) => new Date(b.firedAt) - new Date(a.firedAt));
  saveAlerts(store, alertsPath);

  if (sendNtfy && config?.alerts?.ntfy) {
    for (const alert of newAlerts) {
      try {
        const result = await postNtfy(alert, { publicUrl });
        if (result.sent) log(`ntfy: sent ${alert.ticker} ${alert.rule}`);
      } catch (err) {
        log(`ntfy: failed ${alert.ticker} ${alert.rule} — ${err.message}`);
      }
    }
  }

  return { newAlerts, store };
}

function createTestAlert({ alertsPath = ALERTS_PATH, ticker = "NVDA" } = {}) {
  const store = loadAlerts(alertsPath);
  const now = new Date();
  const alert = {
    id: `test-${now.getTime()}`,
    ticker,
    rule: "TEST",
    ruleLabel: "Test alert (forced)",
    flag: "LONG",
    test: true,
    firedAt: now.toISOString(),
    firedDate: now.toISOString().slice(0, 10),
    metrics: { mentionsRecent: 0, spikeRatio: 0, sentRecent: 0, sentShift: 0, retRecent: 0, excessRecent: 0, score: 0 },
    topItems: [],
  };
  store.alerts.unshift(alert);
  saveAlerts(store, alertsPath);
  return { alert, store };
}

module.exports = { ALERTS_PATH, loadAlerts, saveAlerts, alertId, updateAlerts, createTestAlert, postNtfy };
