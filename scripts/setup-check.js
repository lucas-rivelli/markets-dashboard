#!/usr/bin/env node
/**
 * Diagnose Spotify + X bookmarks setup status.
 * Run: npm run setup:check
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const ENV_LOCAL = path.join(ROOT, ".env.local");

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function warn(msg) {
  console.log(`  ⚠ ${msg}`);
}
function fail(msg) {
  console.log(`  ✗ ${msg}`);
}

function hasEnv(name) {
  return Boolean(process.env[name]);
}

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

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function checkSpotify() {
  console.log("\nSpotify");
  const id = hasEnv("SPOTIFY_CLIENT_ID");
  const secret = hasEnv("SPOTIFY_CLIENT_SECRET");
  const refresh = hasEnv("SPOTIFY_REFRESH_TOKEN");

  if (id) ok("SPOTIFY_CLIENT_ID set");
  else fail("SPOTIFY_CLIENT_ID missing — create app at developer.spotify.com/dashboard");

  if (secret) ok("SPOTIFY_CLIENT_SECRET set");
  else fail("SPOTIFY_CLIENT_SECRET missing");

  if (refresh) ok("SPOTIFY_REFRESH_TOKEN set");
  else {
    fail("SPOTIFY_REFRESH_TOKEN missing — run: npm run spotify:auth");
    if (id && secret) {
      warn("After auth, add all three vars to Vercel → Settings → Environment Variables, then redeploy");
    }
  }

  if (id && secret && refresh) {
    ok("Spotify ready for local dev and Vercel (if vars are also on Vercel)");
  }
}

function checkBirdclaw() {
  console.log("\nX bookmarks (birdclaw)");

  const birdclawBin = path.join(ROOT, "node_modules", ".bin", "birdclaw");
  if (fs.existsSync(birdclawBin)) ok("birdclaw installed (local)");
  else fail("birdclaw not installed — run: npm install");

  const home = process.env.BIRDCLAW_HOME || path.join(process.env.HOME, ".birdclaw");
  if (fs.existsSync(path.join(home, "birdclaw.sqlite"))) ok(`birdclaw initialized (${home})`);
  else fail("birdclaw not initialized — run: npm run birdclaw:init");

  const auth = run("npx birdclaw auth status --json 2>/dev/null");
  if (auth) {
    try {
      const status = JSON.parse(auth);
      if (status.installed) ok(`Live transport: ${status.availableTransport || "ready"}`);
      else warn(`No live transport: ${status.statusText || "xurl/bird not configured"}`);
    } catch {
      warn("Could not parse birdclaw auth status");
    }
  }

  const birdWhoami = run("npx bird whoami 2>/dev/null");
  if (birdWhoami && !birdWhoami.includes("Missing")) ok("bird can read X session from browser");
  else {
    warn("bird cannot read X cookies — log into x.com in Safari/Chrome, or set AUTH_TOKEN + CT0");
    warn("Safari may need Full Disk Access for Terminal/Cursor in System Settings → Privacy");
  }

  const bookmarks = path.join(ROOT, "data", "bookmarks.json");
  if (fs.existsSync(bookmarks)) {
    const data = JSON.parse(fs.readFileSync(bookmarks, "utf8"));
    const count = data.items?.length || 0;
    if (count > 0) ok(`${count} bookmarks in data/bookmarks.json`);
    else warn("data/bookmarks.json is empty — run: npm run sync:bookmarks after X auth");
  }

  const archive = run("npx birdclaw archive find --json 2>/dev/null");
  if (archive && archive !== "[]") ok("X archive found on disk (can import without live sync)");
  else warn("No X archive in Downloads — request at x.com/settings/download_your_data (optional)");
}

function checkVercel() {
  console.log("\nVercel (production)");
  if (hasEnv("CRON_SECRET")) ok("CRON_SECRET set locally");
  else warn("CRON_SECRET not in .env.local — add in Vercel dashboard (openssl rand -hex 32)");

  if (hasEnv("GITHUB_DISPATCH_TOKEN") || hasEnv("GITHUB_TOKEN") || hasEnv("GH_TOKEN")) {
    ok("GitHub dispatch token set (for /api/trigger-bookmarks)");
  } else {
    warn("GITHUB_DISPATCH_TOKEN not set — external bookmark cron needs Actions: Read and write PAT");
  }

  if (hasEnv("VIC_SESSION") || hasEnv("VIC_COOKIE")) {
    ok("VIC session configured (live ideas refresh)");
    if (hasEnv("VIC_REMEMBER") || hasEnv("VIC_COOKIE")) {
      ok("VIC remember cookie set (keeps member access beyond ~2h)");
    } else {
      warn("VIC_REMEMBER missing — login with Remember me and copy remember_web_* cookie (vic_session alone expires ~2h)");
    }
  } else {
    warn("VIC_SESSION not set — feed uses data/vic-cache.json; add VIC_SESSION + VIC_REMEMBER to Vercel and GitHub Actions secrets");
  }

  warn("Vercel env vars must be set in the Vercel project UI (Settings → Environment Variables)");
  warn("After adding vars: redeploy from Vercel dashboard or push a commit");
}

loadEnvLocal();

console.log("Markets Dashboard — setup check");
if (fs.existsSync(ENV_LOCAL)) ok(".env.local found");
else warn(".env.local missing — copy .env.example and fill in values for local dev");

checkSpotify();
checkBirdclaw();
checkVercel();

console.log("\nNext steps:");
console.log("  1. Spotify: create app → npm run spotify:auth → add vars to Vercel");
console.log("  2. X: log into x.com in browser → npm run sync:bookmarks");
console.log("  3. Vercel: add CRON_SECRET + GITHUB_DISPATCH_TOKEN + SPOTIFY_* + VIC_SESSION + VIC_REMEMBER → redeploy");
console.log("  4. VIC daily: add VIC_SESSION (+ VIC_REMEMBER) as GitHub Actions secrets → Actions → Sync VIC ideas");
console.log("  5. External cron: npm run setup:external-cron → cron-job.org every 5 min");
console.log("");
