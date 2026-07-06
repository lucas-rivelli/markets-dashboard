#!/usr/bin/env node
const { lintWiki, formatLintReport } = require("../lib/wiki-lint");
const { appendLog } = require("../lib/wiki-ingest");

async function main() {
  const report = lintWiki();
  const markdown = formatLintReport(report);
  console.log(markdown);

  if (!process.argv.includes("--no-log")) {
    await appendLog({
      kind: "lint",
      title: `${report.health.toUpperCase()} health`,
      pages: [`lint:${report.health}`],
    });
  }

  process.exit(report.health === "red" ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
