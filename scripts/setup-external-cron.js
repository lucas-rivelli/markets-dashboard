#!/usr/bin/env node
/**
 * Validate external bookmark cron setup and print cron-job.org instructions.
 * Run: npm run setup:external-cron
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ENV_LOCAL = path.join(ROOT, ".env.local");

function loadEnvLocal() {
  if (!fs.existsSync(ENV_LOCAL)) return;
  for (const line of fs.readFileSync(ENV_LOCAL, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

function hasEnv(name) {
  return Boolean(process.env[name]?.trim());
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function warn(msg) {
  console.log(`  ! ${msg}`);
}

function fail(msg) {
  console.log(`  ✗ ${msg}`);
}

loadEnvLocal();

const siteUrl =
  process.env.SITE_URL || "https://markets-dashboard-knowledgemaxxing.vercel.app";
const cronSecret = process.env.CRON_SECRET;
const dispatchToken =
  process.env.GITHUB_DISPATCH_TOKEN ||
  process.env.GITHUB_TOKEN ||
  process.env.GH_TOKEN;

console.log("External bookmark cron — setup check\n");

if (cronSecret) ok("CRON_SECRET set locally");
else fail("CRON_SECRET missing — run: openssl rand -hex 32, add to .env.local + Vercel");

if (dispatchToken) {
  ok("GitHub dispatch token found (GITHUB_DISPATCH_TOKEN or GITHUB_TOKEN)");
} else {
  fail("No GitHub dispatch token — create a fine-grained PAT with Actions: Read and write");
  console.log(
    "    GitHub → Settings → Developer settings → Fine-grained tokens → markets-dashboard"
  );
  console.log("    Add as GITHUB_DISPATCH_TOKEN in Vercel (and .env.local for local tests).");
}

if (hasEnv("VERCEL_BYPASS_SECRET")) ok("VERCEL_BYPASS_SECRET set (Deployment Protection bypass)");
else warn("VERCEL_BYPASS_SECRET not set — only needed if Vercel Deployment Protection is on");

console.log("\ncron-job.org (free, no Mac required)\n");
console.log("1. Create account at https://cron-job.org");
console.log("2. Create job → URL:");
console.log(`     ${siteUrl}/api/trigger-bookmarks`);
console.log("3. Schedule: every 60 minutes (not every 5 — that floods GitHub Actions emails)");
console.log("4. Request method: GET");
console.log("5. Request headers:");
console.log(`     Authorization: Bearer <your CRON_SECRET>`);
if (hasEnv("VERCEL_BYPASS_SECRET")) {
  console.log(`     x-vercel-protection-bypass: <your VERCEL_BYPASS_SECRET>`);
}
console.log("6. Enable the job\n");

console.log("Alternative (no Vercel deploy needed): call GitHub API directly from cron-job.org");
console.log("  URL: https://api.github.com/repos/lucas-rivelli/markets-dashboard/actions/workflows/sync-bookmarks.yml/dispatches");
console.log("  Method: POST");
console.log("  Headers: Authorization: Bearer <fine-grained PAT with Actions: Read and write>");
console.log("           Accept: application/vnd.github+json");
console.log("           X-GitHub-Api-Version: 2022-11-28");
console.log('  Body (JSON): {"ref":"main"}\n');

console.log("Optional second job (feed cache, same interval):");
console.log(`     ${siteUrl}/api/feed`);
console.log("   No auth header needed for /api/feed.\n");

console.log("Test from this machine:");
console.log("  npm run ping:bookmarks-cron\n");

if (!cronSecret || !dispatchToken) {
  process.exit(1);
}

const { dispatchWorkflow } = require("../lib/github-actions");

dispatchWorkflow("sync-bookmarks.yml")
  .then((result) => {
    console.log("Live dispatch test:");
    ok(`Queued ${result.workflow} on ${result.ref}`);
    console.log("  Check: gh run list --workflow=sync-bookmarks.yml --limit 1");
  })
  .catch((err) => {
    console.log("Live dispatch test:");
    fail(err.message);
    if (String(err.message).includes("Resource not accessible")) {
      warn("Add GITHUB_DISPATCH_TOKEN with Actions: Read and write scope.");
    }
    process.exit(1);
  });
