#!/usr/bin/env node
const { searchWiki } = require("../lib/wiki-search");

const query = process.argv.slice(2).join(" ").trim();
if (!query) {
  console.error("Usage: npm run wiki:search -- <query>");
  process.exit(1);
}

const results = searchWiki(query, { limit: 12 });
if (!results.length) {
  console.log("No matches.");
  process.exit(0);
}

for (const hit of results) {
  console.log(`${hit.score.toFixed(2)}  ${hit.type.padEnd(8)}  ${hit.title}`);
  if (hit.summary) console.log(`         ${hit.summary.slice(0, 100)}`);
  console.log(`         ${hit.path}`);
}
