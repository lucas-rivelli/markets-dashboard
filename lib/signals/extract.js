"use strict";

// LLM extraction for Markets Reading: Signals.
//
// For each item not already in data/signals/extractions.json, call the LLM
// once (model from data/signals/config.json), validate the strict JSON it
// returns (retry once on a parse failure, then skip + log), keep mentions
// at/above config.minConfidence, and persist the result with the model and
// timestamp so an item is never paid for twice.
//
// Providers: Anthropic Messages API when ANTHROPIC_API_KEY is set (the
// production path, and the GitHub Action secret); otherwise OpenRouter ->
// Claude when OPENROUTER_API_KEY / OPEN_ROUTER_KEY is set (the pattern the
// existing briefing code in lib/briefing-llm.js already uses locally).
//
// Copyright: extraction records store headline/source/date/URL + the
// model's mentions only. Article body text is never written to disk here.

const fs = require("fs");
const path = require("path");
const { SYSTEM_PROMPT, buildUserPrompt } = require("./prompt");

const EXTRACTIONS_PATH = path.join(__dirname, "..", "..", "data", "signals", "extractions.json");
const VALID_STANCES = new Set(["bullish", "bearish", "neutral"]);

function toOpenRouterModel(model) {
  const m = String(model || "claude-haiku-5-5");
  if (m.includes("/")) return m;
  // claude-haiku-5-5 -> anthropic/claude-haiku-5.5
  return `anthropic/${m.replace(/-(\d+)$/, ".$1")}`;
}

async function callAnthropic(system, user, config) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = config.llm?.model || "claude-haiku-5-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      temperature: 0,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = await res.json();
  const text = (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return { text, model: data?.model || model, provider: "anthropic" };
}

async function callOpenRouter(system, user, config) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_KEY;
  const model = toOpenRouterModel(config.llm?.model);
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/lucas-rivelli/markets-dashboard",
      "X-Title": "Markets Reading Signals",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 900,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = await res.json();
  return { text: data?.choices?.[0]?.message?.content || "", model: data?.model || model, provider: "openrouter" };
}

function pickProvider() {
  if (process.env.ANTHROPIC_API_KEY) return callAnthropic;
  if (process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_KEY) return callOpenRouter;
  throw new Error("No LLM key: set ANTHROPIC_API_KEY (production) or OPENROUTER_API_KEY / OPEN_ROUTER_KEY (local)");
}

// ------------------------------------------------------------- validation

function parseMentionsJson(raw) {
  let text = String(raw || "").trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in model response");
  const parsed = JSON.parse(text.slice(start, end + 1));
  if (!parsed || !Array.isArray(parsed.mentions)) throw new Error("Response has no mentions array");
  return parsed.mentions;
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function validateMentions(rawMentions, config) {
  const minConfidence = Number(config.minConfidence) || 0;
  const kept = [];
  for (const m of rawMentions || []) {
    const ticker = String(m?.ticker || "").trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.]{0,5}$/.test(ticker)) continue;
    const sentiment = clamp(Number(m?.sentiment) || 0, -1, 1);
    const confidence = clamp(Number(m?.confidence) || 0, 0, 1);
    if (confidence < minConfidence) continue;
    let stance = String(m?.stance || "").toLowerCase();
    if (!VALID_STANCES.has(stance)) {
      stance = sentiment > 0.15 ? "bullish" : sentiment < -0.15 ? "bearish" : "neutral";
    }
    const rationale = String(m?.rationale || "").trim().split(/\s+/).filter(Boolean).slice(0, 25).join(" ");
    kept.push({
      ticker,
      company: String(m?.company || ticker).trim().slice(0, 80),
      sentiment: Math.round(sentiment * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      stance,
      rationale,
    });
  }
  return kept;
}

// ---------------------------------------------------------------- storage

function loadExtractions(filePath = EXTRACTIONS_PATH) {
  if (!fs.existsSync(filePath)) return { schema_version: 1, updatedAt: null, items: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed.items !== "object") return { schema_version: 1, updatedAt: null, items: {} };
    return parsed;
  } catch {
    return { schema_version: 1, updatedAt: null, items: {} };
  }
}

function saveExtractions(store, filePath = EXTRACTIONS_PATH) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2) + "\n");
  return store;
}

// ------------------------------------------------------------- extraction

async function extractItem(item, config, callProvider) {
  const user = buildUserPrompt(item, config);
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = attempt === 0
      ? user
      : `${user}\n\nYour previous response was not valid JSON. Return strict JSON only, in exactly the shape above.`;
    const { text, model, provider } = await callProvider(SYSTEM_PROMPT, prompt, config);
    try {
      const rawMentions = parseMentionsJson(text);
      return {
        mentions: validateMentions(rawMentions, config),
        rawMentions,
        model,
        provider,
        rawResponse: text,
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Extraction failed");
}

/**
 * Extract mentions for items not already in the store (newest first),
 * capped at config.llm.maxItemsPerRun unless `limit` overrides it.
 * Persists after every item so a crash never re-bills completed work.
 */
async function extractNewItems(items, config, { storePath = EXTRACTIONS_PATH, limit, log = console.log } = {}) {
  const store = loadExtractions(storePath);
  const cap = Number(limit) > 0 ? Number(limit) : Number(config.llm?.maxItemsPerRun) || 80;
  const pending = (items || [])
    .filter((item) => item && item.id && !store.items[item.id])
    .slice(0, cap);

  const callProvider = pickProvider();
  const results = [];
  const skipped = [];
  const concurrency = Math.max(1, Math.min(6, Number(process.env.SIGNALS_EXTRACT_CONCURRENCY) || 4));
  let cursor = 0;

  async function worker() {
    while (cursor < pending.length) {
      const item = pending[cursor];
      cursor += 1;
      try {
        const result = await extractItem(item, config, callProvider);
        const record = {
          id: item.id,
          title: item.title,
          source: item.source,
          sourceType: item.sourceType,
          url: item.url,
          publishedAt: item.publishedAt || null,
          ...(item.tickerHint ? { tickerHint: item.tickerHint } : {}),
          mentions: result.mentions,
          model: result.model,
          provider: result.provider,
          extractedAt: new Date().toISOString(),
        };
        store.items[item.id] = record;
        saveExtractions(store, storePath);
        results.push({ item, record, rawResponse: result.rawResponse, rawMentions: result.rawMentions });
        log(`ok   [${item.sourceType}] ${item.title.slice(0, 80)} -> ${result.mentions.map((m) => `${m.ticker} ${m.sentiment >= 0 ? "+" : ""}${m.sentiment}`).join(", ") || "(no mentions)"}`);
      } catch (err) {
        skipped.push({ item, error: err.message });
        log(`skip [${item.sourceType}] ${item.title.slice(0, 80)} — ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { store, results, skipped, pendingCount: pending.length };
}

module.exports = {
  EXTRACTIONS_PATH,
  toOpenRouterModel,
  parseMentionsJson,
  validateMentions,
  loadExtractions,
  saveExtractions,
  extractItem,
  extractNewItems,
};
