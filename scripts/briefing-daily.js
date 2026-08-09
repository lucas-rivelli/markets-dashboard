#!/usr/bin/env node
/**
 * Gather headline packets + synthesize Lucas Briefing via OpenRouter,
 * then upsert into data/briefings.json (GitHub Contents when GITHUB_TOKEN is set).
 *
 * Env: OPENROUTER_API_KEY or OPEN_ROUTER_KEY (required), OPENROUTER_MODEL (optional),
 *      GITHUB_TOKEN (optional — writes via Contents API for production).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();

  const {
    briefingDateKey,
    briefingIdForDate,
    briefingTitle,
    loadBriefingConfig,
  } = require("../lib/briefing-config");
  const { gatherBriefingPacket } = require("../lib/briefing-gather");
  const { synthesizeBriefingHtml } = require("../lib/briefing-llm");
  const { upsertBriefing, writeLocalBriefings } = require("../lib/briefings");

  const config = loadBriefingConfig();
  const dateKey = briefingDateKey(config.timezone);
  const briefingId = briefingIdForDate(dateKey);
  const title = briefingTitle(config.titlePrefix, dateKey);

  console.log(`Gathering headline packet for ${dateKey}…`);
  const packet = await gatherBriefingPacket(config);
  const headlineCount =
    packet.sections.global.headlines.length +
    packet.sections.brazil.headlines.length +
    packet.sections.topic.headlines.length +
    Object.values(packet.sections.companies.byCompany).reduce((n, list) => n + list.length, 0);

  console.log(
    JSON.stringify(
      {
        dateKey,
        headlines: headlineCount,
        failures: packet.failures,
        global: packet.sections.global.headlines.length,
        brazil: packet.sections.brazil.headlines.length,
        companies: Object.fromEntries(
          Object.entries(packet.sections.companies.byCompany).map(([k, v]) => [k, v.length])
        ),
        topic: packet.sections.topic.headlines.length,
      },
      null,
      2
    )
  );

  if (headlineCount < 5) {
    throw new Error(`Too few headlines gathered (${headlineCount}) — aborting synthesize`);
  }

  console.log("Synthesizing via OpenRouter…");
  const synthesized = await synthesizeBriefingHtml(packet, config);

  // Morning BRT ≈ 11:00 UTC when cron runs; keep a stable local morning stamp.
  const date = `${dateKey}T11:00:00.000Z`;
  const saved = await upsertBriefing({
    id: briefingId,
    title,
    date,
    contentHtml: synthesized.contentHtml,
    source: config.sourceName,
    category: config.category,
  });

  // Mirror disk when persistence went through GitHub Contents (local runs with a token).
  if (saved.persistence !== "local") {
    writeLocalBriefings(saved.items);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: saved.item.briefingId,
        title: saved.item.title,
        persistence: saved.persistence,
        model: synthesized.model,
        htmlChars: synthesized.contentHtml.length,
        count: saved.items.length,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
