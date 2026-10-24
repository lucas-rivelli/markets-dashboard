"use strict";

// Extraction prompt for Markets Reading: Signals.
// Kept in its own file so it can be quoted verbatim in the write-up
// (docs/SIGNALS.md). See lib/signals/extract.js for validation rules.

const SYSTEM_PROMPT = [
  "You extract stock mentions from financial research items for a signal screener.",
  "You return strict JSON only — no markdown, no commentary, no code fences.",
].join("\n");

function buildUserPrompt(item, config = {}) {
  const maxChars = Number(config.llm?.maxCharsPerItem) || 4000;
  const text = String(item.text || "").slice(0, maxChars);

  return [
    "Read the research item below and extract every US-listed stock it discusses.",
    "",
    "Return JSON in exactly this shape:",
    '{"mentions":[{"ticker":"NVDA","company":"Nvidia","sentiment":0.6,"confidence":0.9,"stance":"bullish","rationale":"Argues data-center capex guidance is still too low."}]}',
    "",
    "Rules:",
    "- sentiment is the author's stance toward that specific company's stock, from -1 (strongly bearish) to +1 (strongly bullish). It is NOT the general tone of the article. A passing mention with no view counts as 0.",
    "- stance is one of: bullish (sentiment > 0.15), bearish (sentiment < -0.15), neutral (otherwise).",
    "- Map company names to US tickers (for example Nvidia -> NVDA, Taiwan Semiconductor -> TSM). Only US-listed common stock and ADRs. Skip funds, indexes, crypto and private companies.",
    "- Skip ambiguous words that only look like tickers (AI, ON, NOW, IT, ALL, SO, BE, GO) unless the company is clearly named in the text.",
    "- confidence (0 to 1) is how sure you are about BOTH the ticker identity and the stance. Use low confidence when the mention is brief or the view is implied rather than stated.",
    "- rationale is ONE sentence, maximum 25 words, in your own words. Do not quote more than 10 consecutive words from the item.",
    "- If the item discusses no US-listed stock, return {\"mentions\":[]}. An empty list is a valid answer.",
    "- Only use what the item says. Do not add outside knowledge about the company.",
    "",
    `Source: ${item.source} (${item.sourceType})`,
    `Published: ${item.publishedAt || "unknown"}`,
    `Title: ${item.title}`,
    "",
    "Item text:",
    text || "(no body text available — judge from the title only, with low confidence)",
  ].join("\n");
}

module.exports = { SYSTEM_PROMPT, buildUserPrompt };
