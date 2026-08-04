#!/usr/bin/env node
/**
 * Build a markets / L/S / pitches master document from a live bird archive.
 * Original tweet text only — connector notes are minimal ordering labels.
 *
 * Usage:
 *   node scripts/build-blotnick-markets-book.js [handle]
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HANDLE = (process.argv[2] || "gregoryblotnick").replace(/^@/, "").toLowerCase();
const ARCHIVE = path.join(ROOT, "archive", HANDLE, "tweets", "all.json");
const OUT_DIR = path.join(ROOT, "archive", HANDLE, "book");
const OUT_MD = path.join(OUT_DIR, "markets-ls-pitches.md");
const OUT_INDEX = path.join(OUT_DIR, "markets-ls-pitches.index.json");

// Require at least one strong markets / L/S / pitch signal.
const STRONG = [
  /\bL\/?S\b/i,
  /\blong[\s/-]?short\b/i,
  /\bpitch(es|ing)?\b/i,
  /\bhedge\s*funds?\b/i,
  /\bdrawdowns?\b/i,
  /\bposition\s*siz/i,
  /\bstop[\s-]?loss/i,
  /\brisk\s*(mgmt|management)\b/i,
  /\bmental\s*capital\b/i,
  /\bshorts?\b/i,
  /\blongs?\b/i,
  /\bequity\s*(valuation|analyst|research|markets?)\b/i,
  /\bvaluation\b/i,
  /\bearnings\b/i,
  /\bcatalysts?\b/i,
  /\bthesis\b/i,
  /\bstock\s*pitch/i,
  /\bstocks?\b/i,
  /\btickers?\b/i,
  /\bEBITDA\b/i,
  /\bFCF\b/i,
  /\bROIC\b/i,
  /\bcompounders?\b/i,
  /\bmarkets?\b/i,
  /\btrading\b/i,
  /\btraders?\b/i,
  /\binvestors?\b/i,
  /\binvesting\b/i,
  /\bportfolio\b/i,
  /\bmemo\b/i,
  /\bone[\s-]?pagers?\b/i,
  /\bLivermore\b/i,
  /\bDruck(enmiller)?\b/i,
  /\bBuffett\b/i,
  /\bMunger\b/i,
  /\bP&L\b/i,
  /\bPnL\b/i,
  /\b\bHF\b/,
  /\bMM\s*L\/?S\b/i,
  /\bcoverage\b/i,
  /\bDCF\b/i,
  /\bmoat\b/i,
  /\bvariant\s*perception\b/i,
  /\basymmetric\b/i,
  /\b10[\s-]?[KQ]\b/i,
  /\bcapex\b/i,
  /\bEV\/|P\/E\b/i,
  /\bshort[\s-]?sell/i,
  /\bbuy[\s-]?side\b/i,
  /\bsell[\s-]?side\b/i,
  /\balpha\b/i,
  /\bbook\b.*\b(long|short|size|risk|P&L)/i,
  /\bSchwager\b/i,
  /\bMarket\s*Wizards\b/i,
  /\bSeykota\b/i,
  /\bPTJ\b/,
  /\bCohen\b.*\b(trader|trading|market)/i,
  /\bfundamental\s*equity\b/i,
  /\bprimary\s*research\b/i,
  /\bunit\s*growth\b/i,
  /\bequity\s*issuance\b/i,
];

// Drop even on keyword hit when the piece is clearly life/philosophy/politics.
const HARD_EXCLUDE = [
  /\bplutarch\b/i,
  /\bpascal\b/i,
  /\bpens[eé]es\b/i,
  /\bconfucius\b/i,
  /\bwill\s+durant\b/i,
  /\brock\s*bottom\b/i,
  /\badderall\b/i,
  /\barchetypes?\b/i,
  /\bmeditation\b/i,
  /\bhealth and fitness\b/i,
  /\bbouncy shoes\b/i,
  /\byoung kings in cities\b/i,
  /\bcomplaining about women\b/i,
  /\breading\s*list\b/i,
  /\bbook\s*recs?\b/i,
  /\bNewsom\b/i,
  /\bJeter\b/i,
  /\bAltman\/dario\b/i,
  /\bpost-IPO u gotta consider moving\b/i,
];

function authorHandle(t) {
  const a = t && t.author;
  if (!a) return "";
  return String(a.username || a.screen_name || "").replace(/^@/, "").toLowerCase();
}

function parseDate(t) {
  const s = t.createdAt || t.created_at || "";
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : 0;
}

function isoDate(t) {
  const ms = parseDate(t);
  if (!ms) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

function textOf(t) {
  return (t.text || t.fullText || t.full_text || "").trim();
}

function isMarketPiece(t) {
  const text = textOf(t);
  if (!text) return false;
  if (HARD_EXCLUDE.some((re) => re.test(text))) {
    // Allow if it also has very strong L/S craft terms (rare overlap)
    if (!/\b(L\/?S|stock\s*pitch|hedge\s*fund|drawdown|stop[\s-]?loss|position\s*siz|Livermore|Druck)/i.test(text)) {
      return false;
    }
  }
  return STRONG.some((re) => re.test(text));
}

function tweetUrl(t) {
  const id = t.id;
  return `https://x.com/${HANDLE}/status/${id}`;
}

function main() {
  if (!fs.existsSync(ARCHIVE)) {
    console.error(`Missing archive: ${ARCHIVE}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(ARCHIVE, "utf8"));
  const tweets = (data.tweets || []).filter((t) => authorHandle(t) === HANDLE);
  const market = tweets.filter(isMarketPiece);

  // Group by conversationId into threads
  const byConv = new Map();
  for (const t of market) {
    const cid = String(t.conversationId || t.id);
    if (!byConv.has(cid)) byConv.set(cid, []);
    byConv.get(cid).push(t);
  }
  for (const list of byConv.values()) {
    list.sort((a, b) => parseDate(a) - parseDate(b) || String(a.id).localeCompare(String(b.id)));
  }

  const threads = [...byConv.entries()]
    .map(([cid, list]) => ({
      conversationId: cid,
      tweets: list,
      start: parseDate(list[0]),
      title: textOf(list[0]).split("\n")[0].slice(0, 120),
    }))
    .sort((a, b) => a.start - b.start);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const lines = [];
  lines.push(`# Gregory Blotnick — Markets, L/S & Pitches`);
  lines.push(``);
  lines.push(`An ordered reading of **original** posts from [@${HANDLE}](https://x.com/${HANDLE}), filtered to markets / long-short / stock-pitch craft. Non-market life and philosophy posts are omitted.`);
  lines.push(``);
  lines.push(`> Source: live X archive via \`bird\` + the same \`AUTH_TOKEN\`/\`CT0\` cookies used for bookmark sync.`);
  lines.push(`> Archive fetched: ${data.fetchedAt || "unknown"} · authored in archive: ${tweets.length} · included here: ${market.length} posts in ${threads.length} threads.`);
  lines.push(`> Editor role: connect and order only — wording below is his.`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Contents`);
  lines.push(``);
  threads.forEach((th, i) => {
    const d = isoDate(th.tweets[0]) || "?";
    lines.push(`${i + 1}. [${d} — ${th.title.replace(/[\[\]]/g, "")}](#t-${th.conversationId})`);
  });
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  threads.forEach((th, i) => {
    const d = isoDate(th.tweets[0]) || "";
    lines.push(`## ${i + 1}. ${d}`);
    lines.push(`<a id="t-${th.conversationId}"></a>`);
    lines.push(``);
    if (th.tweets.length > 1) {
      lines.push(`*Thread · ${th.tweets.length} posts · conversation \`${th.conversationId}\`*`);
    } else {
      lines.push(`*Single post · [${th.tweets[0].id}](${tweetUrl(th.tweets[0])})*`);
    }
    lines.push(``);
    th.tweets.forEach((t, j) => {
      if (th.tweets.length > 1) {
        lines.push(`### ${j + 1}/${th.tweets.length}`);
        lines.push(``);
        lines.push(`*${isoDate(t)} · [${t.id}](${tweetUrl(t)})*`);
        lines.push(``);
      }
      lines.push(textOf(t));
      lines.push(``);
      if (t.quotedTweet && (t.quotedTweet.text || t.quotedTweet.fullText)) {
        const qt = t.quotedTweet;
        const qAuthor = (qt.author && (qt.author.username || qt.author.screen_name)) || "quoted";
        lines.push(`> QT @${qAuthor}: ${textOf(qt)}`);
        lines.push(``);
      }
    });
    lines.push(`---`);
    lines.push(``);
  });

  lines.push(`## End matter`);
  lines.push(``);
  lines.push(`All body text above is from @${HANDLE}'s posts as returned by X through \`bird\`. Gaps mean the live API no longer returned that post (deleted or outside the retrievable window), not that content was invented.`);
  lines.push(``);

  fs.writeFileSync(OUT_MD, lines.join("\n"));
  fs.writeFileSync(
    OUT_INDEX,
    JSON.stringify(
      {
        handle: HANDLE,
        builtAt: new Date().toISOString(),
        archiveFetchedAt: data.fetchedAt || null,
        authoredInArchive: tweets.length,
        includedPosts: market.length,
        threads: threads.length,
        conversationIds: threads.map((t) => t.conversationId),
      },
      null,
      2
    )
  );

  console.log(
    JSON.stringify({
      out: OUT_MD,
      includedPosts: market.length,
      threads: threads.length,
      authoredInArchive: tweets.length,
    })
  );
}

main();
