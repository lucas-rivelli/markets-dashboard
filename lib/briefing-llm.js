const sanitizeHtml = require("sanitize-html");
const { packetToPromptText } = require("./briefing-gather");

const SANITIZE_OPTIONS = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "h2",
    "h3",
    "h4",
    "hr",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
  },
  allowedSchemes: ["http", "https"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noopener noreferrer",
    }),
  },
};

function sanitizeBriefingHtml(raw) {
  let html = String(raw || "").trim();
  // Models sometimes wrap in markdown fences.
  html = html.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const match = html.match(/<h2[\s\S]*$/i);
  if (match) html = match[0];
  return sanitizeHtml(html, SANITIZE_OPTIONS).trim();
}

function buildSystemPrompt(config) {
  const s = config.sections;
  return [
    "You write Lucas Briefing — a personal morning markets reading for one investor.",
    "Write ONLY HTML using: h2, h3, p, ul, ol, li, a, strong, em, blockquote, hr.",
    "Do not wrap in <html> or <body>. No markdown.",
    "Ground every claim in the headline packet. If a section has thin coverage, say so briefly.",
    "Include 1–3 source links per major point using the provided URLs.",
    "Tone: clear, compressed, non-hype. Prefer what moved / why it matters.",
    "",
    "Required section order and reading-time targets:",
    `1. <h2>${s.global.label}</h2> — ~${s.global.readingMinutes} minutes (~${s.global.readingMinutes * 160} words)`,
    `2. <h2>${s.brazil.label}</h2> — ~${s.brazil.readingMinutes} minutes`,
    `3. <h2>${s.companies.label}</h2> — ~${s.companies.readingMinutes} minutes; use <h3> for each company`,
    `4. <h2>${s.topic.label}: ${s.topic.name}</h2> — ~${s.topic.readingMinutes} minute`,
    "",
    "End with <h2>Sources snapshot</h2> listing a short bullet of the most useful links you cited.",
  ].join("\n");
}

async function synthesizeBriefingHtml(packet, config) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY (or OPEN_ROUTER_KEY) is required to synthesize the briefing");
  }

  const model = process.env.OPENROUTER_MODEL || config.model || "anthropic/claude-sonnet-4";
  const packetText = packetToPromptText(packet);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/lucas-rivelli/markets-dashboard",
      "X-Title": "Markets Dashboard Lucas Briefing",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 4500,
      messages: [
        { role: "system", content: buildSystemPrompt(config) },
        {
          role: "user",
          content: [
            `Write today's Lucas Briefing HTML from this packet only.`,
            "",
            packetText,
          ].join("\n"),
        },
      ],
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 400)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "";
  const contentHtml = sanitizeBriefingHtml(raw);
  if (!contentHtml || contentHtml.length < 200) {
    throw new Error("OpenRouter returned empty or too-short briefing HTML");
  }

  return {
    contentHtml,
    model: data?.model || model,
    usage: data?.usage || null,
  };
}

module.exports = {
  sanitizeBriefingHtml,
  synthesizeBriefingHtml,
};
