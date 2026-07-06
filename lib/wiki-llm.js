const { excerpt, primaryText } = require("./wiki-text");

async function maybeEnhanceWithLlm(record) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const text = primaryText(record);
  if (!text || text.length < 120) return null;

  const model = process.env.WIKI_LLM_MODEL || "claude-sonnet-4-20250514";
  const prompt = [
    "You maintain a personal markets-reading wiki.",
    "Given the source below, return JSON only with keys:",
    "summary (2-3 sentences), key_claims (string[] max 5), tensions (string[] max 3, empty if none).",
    "Be factual; only use the source text.",
    "",
    `Title: ${record.title}`,
    `Source: ${record.source}`,
    `Category: ${record.category}`,
    `Folders: ${(record.folders || []).join(", ")}`,
    "",
    "Source text:",
    text.slice(0, 12000),
  ].join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.content?.find((part) => part.type === "text")?.text || "";
    const jsonText = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonText) return null;
    const parsed = JSON.parse(jsonText);
    return {
      summary: excerpt(parsed.summary, 500),
      key_claims: Array.isArray(parsed.key_claims)
        ? parsed.key_claims.map((c) => excerpt(c, 280)).filter(Boolean).slice(0, 5)
        : [],
      tensions: Array.isArray(parsed.tensions)
        ? parsed.tensions.map((c) => excerpt(c, 280)).filter(Boolean).slice(0, 3)
        : [],
    };
  } catch {
    return null;
  }
}

module.exports = { maybeEnhanceWithLlm };
