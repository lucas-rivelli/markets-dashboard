#!/usr/bin/env node
/**
 * Store GITHUB_DISPATCH_TOKEN in .env.local from `gh auth token`.
 * For production, prefer a fine-grained PAT (Actions: Read and write) in Vercel.
 * Run: npm run setup:github-dispatch-token
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const ENV_LOCAL = path.join(ROOT, ".env.local");

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

  if (!found) lines.push(`${key}=${value}`);
  fs.writeFileSync(ENV_LOCAL, lines.filter((l, i, a) => i < a.length - 1 || l).join("\n") + "\n");
}

try {
  execSync("gh auth status", { stdio: "pipe" });
} catch {
  console.error("gh CLI not logged in. Run: gh auth login");
  process.exit(1);
}

try {
  execSync("gh auth refresh -s workflow", { stdio: "pipe" });
} catch {
  // gh may refuse non-interactive refresh; existing token may still work.
}

const token = execSync("gh auth token", { encoding: "utf8" }).trim();
if (!token) {
  console.error("Could not read gh auth token.");
  process.exit(1);
}

upsertEnvLocal("GITHUB_DISPATCH_TOKEN", token);
console.log("✓ GITHUB_DISPATCH_TOKEN saved to .env.local");
console.log("");
console.log("Add the same value to Vercel → Settings → Environment Variables → GITHUB_DISPATCH_TOKEN");
console.log("For long-lived production use, create a fine-grained PAT instead of the gh OAuth token.");
console.log("");
console.log("Next: npm run setup:external-cron");
