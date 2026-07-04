#!/usr/bin/env node
/**
 * Extract X cookies from Safari/Chrome and push to GitHub Actions secrets.
 * Run: npm run setup:github-x-secrets
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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

function upsertEnvLocal(key, value) {
  let lines = fs.existsSync(ENV_LOCAL)
    ? fs.readFileSync(ENV_LOCAL, "utf8").split("\n")
    : [];

  let found = false;
  lines = lines.map((line) => {
    if (line.startsWith(`${key}=`) || line.startsWith(`# ${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    const idx = lines.findIndex((line) => line.includes("AUTH_TOKEN"));
    if (idx >= 0) {
      lines.splice(idx, 0, `${key}=${value}`);
    } else {
      lines.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(ENV_LOCAL, lines.filter((l, i, arr) => !(i === arr.length - 1 && l === "")).join("\n") + "\n");
}

function setGhSecret(name, value) {
  execSync(`gh secret set ${name} --body ${JSON.stringify(value)}`, {
    stdio: "inherit",
  });
}

async function main() {
  loadEnvLocal();

  let authToken = process.env.AUTH_TOKEN;
  let ct0 = process.env.CT0;
  let source = "env";

  if (!authToken || !ct0) {
    const { resolveCredentials } = await import("@steipete/bird");
    const { cookies, warnings } = await resolveCredentials({
      cookieSource: ["safari", "chrome", "firefox"],
    });
    warnings.forEach((w) => console.warn("  ⚠", w));
    authToken = cookies.authToken;
    ct0 = cookies.ct0;
    source = cookies.source || "browser";
  }

  if (!authToken || !ct0) {
    console.error("\nCould not resolve X cookies.");
    console.error("Log into x.com in Safari, or set AUTH_TOKEN and CT0 in .env.local");
    process.exit(1);
  }

  console.log(`\nResolved X cookies from ${source}`);
  upsertEnvLocal("AUTH_TOKEN", authToken);
  upsertEnvLocal("CT0", ct0);
  console.log("  ✓ Updated .env.local");

  setGhSecret("AUTH_TOKEN", authToken);
  setGhSecret("CT0", ct0);
  console.log("  ✓ Set GitHub secrets AUTH_TOKEN and CT0");

  console.log("\nNext: GitHub Actions → Sync X bookmarks → Run workflow");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
