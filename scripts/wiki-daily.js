#!/usr/bin/env node
/**
 * Prepare the daily Cursor-agent wiki run.
 * Writes kb/wiki/RUN.md from queue + inbox state. Does not call any LLM API.
 */
const fs = require("fs");
const path = require("path");
const { syncWikiQueue, readQueueLocal } = require("../lib/wiki-queue");
const { lintWiki, formatLintReport } = require("../lib/wiki-lint");
const { KB_WIKI_DIR } = require("../lib/wiki-paths");

const ROOT = path.join(__dirname, "..");
const RUN_FILE = path.join(KB_WIKI_DIR, "RUN.md");

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

function buildRunMarkdown(queue, lint) {
  const date = new Date().toISOString().slice(0, 10);
  const pending = queue.pending || [];
  const lines = [
    `# Wiki Agent Run — ${date}`,
    "",
    "> **Cursor agent:** read `kb/wiki/AGENT.md` then execute this run. No Anthropic API — you author the wiki.",
    "",
    "## Queue",
    "",
    pending.length
      ? pending
          .map(
            (item, index) =>
              `${index + 1}. \`${item.id}\` — ${item.title} (${item.reason || "pending"})`
          )
          .join("\n")
      : "_Queue empty — run lint + refresh overview if sources changed._",
    "",
    "## Lint snapshot",
    "",
    `\`\`\`markdown`,
    formatLintReport(lint),
    "```",
    "",
    "## Done checklist",
    "",
    "- [ ] Process every queued id (see AGENT.md)",
    "- [ ] Set `agent_status: done` on each `sources/<id>.md`",
    "- [ ] Update touched `concepts/*` and `entities/*`",
    "- [ ] Revise `overview.md` if material new synthesis",
    "- [ ] `npm run wiki:lint`",
    "- [ ] `npm run kb:index`",
    "- [ ] Commit + push `kb/wiki/` + `kb/index.json`",
    "",
  ];
  return lines.join("\n");
}

async function main() {
  loadEnvLocal();
  const queue = await syncWikiQueue();
  const lint = lintWiki();
  const markdown = buildRunMarkdown(queue, lint);

  fs.mkdirSync(KB_WIKI_DIR, { recursive: true });
  fs.writeFileSync(RUN_FILE, markdown, "utf8");

  console.log(`Wiki daily prepared: ${queue.pending?.length || 0} pending item(s).`);
  console.log(`Wrote ${path.relative(ROOT, RUN_FILE)}`);
  console.log(`Lint: ${lint.health}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
