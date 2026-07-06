#!/usr/bin/env node
/**
 * Backfill kb/inbox from workspace: filed items without To-read (Spotify excluded).
 * Usage: npm run kb:backfill [-- --dry-run]
 */
const fs = require("fs");
const path = require("path");
const { buildFeedResponse } = require("../lib/aggregate");
const { SOURCES } = require("../api/feed");
const { stableItemId } = require("../lib/item-id");
const { enrichKnowledgeInput } = require("../lib/kb-enrich");
const { normalizeSavedItem, saveToLocalFs } = require("../lib/kb-save");

const ROOT = path.join(__dirname, "..");
const WORKSPACE_FILE = path.join(ROOT, "data", "workspace.json");
const DRY_RUN = process.argv.includes("--dry-run");
const PAUSE_MS = 400;

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tagNameById(tags, id) {
  return tags.find((tag) => tag.id === id)?.name || id;
}

function buildPayload(item, workspace, itemKey) {
  const tagIds = workspace.item_tags?.[itemKey] || [];
  const tagNames = tagIds
    .map((id) => tagNameById(workspace.tags || [], id))
    .filter(Boolean);

  return {
    item: {
      link: item.link,
      title: item.title,
      source: item.source,
      category: item.category,
      date: item.date,
      snippet: item.snippet || "",
      content_html: item.contentHtml || "",
      folders: workspace.item_folders[itemKey] || [],
      tags: tagNames,
      highlights: workspace.item_highlights?.[itemKey] || [],
    },
  };
}

function shouldBackfill(itemKey, item, workspace, toReadId) {
  const folders = workspace.item_folders?.[itemKey];
  if (!folders?.length) return false;
  const tagIds = workspace.item_tags?.[itemKey] || [];
  if (tagIds.includes(toReadId)) return false;
  if (!item || item.category === "Spotify") return false;
  return true;
}

async function main() {
  loadEnvLocal();

  const workspace = JSON.parse(fs.readFileSync(WORKSPACE_FILE, "utf8"));
  const toReadId =
    (workspace.tags || []).find((tag) => tag.name.toLowerCase() === "to-read")?.id ||
    "to-read";

  console.log("Fetching feed…");
  const feed = await buildFeedResponse(SOURCES);
  const byKey = new Map();
  for (const item of feed.items || []) {
    byKey.set(item.id || stableItemId(item), item);
  }

  const candidates = Object.keys(workspace.item_folders || {}).filter((key) =>
    shouldBackfill(key, byKey.get(key), workspace, toReadId)
  );

  console.log(
    `${candidates.length} item(s) to backfill${DRY_RUN ? " (dry run)" : ""}.`
  );

  let saved = 0;
  let skipped = 0;
  let missing = 0;
  let failed = 0;

  for (const itemKey of candidates) {
    const item = byKey.get(itemKey);
    if (!item) {
      missing++;
      console.warn(`  skip (not in feed): ${itemKey.slice(0, 12)}…`);
      continue;
    }

    const label = `${item.category} · ${item.title?.slice(0, 60) || itemKey.slice(0, 12)}`;
    if (DRY_RUN) {
      console.log(`  would save: ${label}`);
      saved++;
      continue;
    }

    try {
      const enriched = await enrichKnowledgeInput(buildPayload(item, workspace, itemKey));
      const record = normalizeSavedItem(enriched);
      const result = saveToLocalFs(record);
      if (result.alreadySaved) {
        skipped++;
        console.log(`  exists: ${label}`);
      } else {
        saved++;
        const extra = record.content_kind ? ` [${record.content_kind}]` : "";
        console.log(`  saved: ${label}${extra}`);
      }
    } catch (err) {
      failed++;
      console.warn(`  failed: ${label} — ${err.message}`);
    }

    await sleep(PAUSE_MS);
  }

  console.log(
    `Done. saved=${saved} skipped=${skipped} missing=${missing} failed=${failed}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
