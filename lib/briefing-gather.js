const Parser = require("rss-parser");
const {
  googleNewsSearchUrl,
  loadBriefingConfig,
} = require("./briefing-config");

const FETCH_TIMEOUT_MS = 10000;

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; MarketsDashboard/1.0; +https://github.com/lucas-rivelli/markets-dashboard)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeadline(item, feedName) {
  const title = String(item.title || "").replace(/\s+/g, " ").trim();
  const link = item.link || item.guid || "";
  if (!title || !link) return null;
  return {
    title,
    link: String(link).trim(),
    source: feedName,
    date: item.isoDate || item.pubDate || null,
    snippet: stripHtml(item.contentSnippet || item.summary || item.content || "").slice(0, 280),
  };
}

async function fetchHeadlines(url, feedName, limit) {
  try {
    const feed = await parser.parseURL(url);
    const items = [];
    const seen = new Set();
    for (const raw of feed.items || []) {
      const item = normalizeHeadline(raw, feedName);
      if (!item) continue;
      const key = item.link || item.title;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
      if (items.length >= limit) break;
    }
    return { feedName, url, items, error: null };
  } catch (err) {
    return {
      feedName,
      url,
      items: [],
      error: err?.message || String(err),
    };
  }
}

function dedupeHeadlines(items, limit) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

async function gatherBriefingPacket(config = loadBriefingConfig()) {
  const { sections } = config;
  const failures = [];

  const globalFeeds = sections.global.feeds || [];
  const brazilFeeds = sections.brazil.feeds || [];
  const companies = sections.companies.companies || [];
  const topic = sections.topic;

  const companyFeeds = companies.map((c) => ({
    name: c.name,
    url: googleNewsSearchUrl(c.query, {
      hl: c.hl || "en-US",
      gl: c.gl || "US",
      ceid: c.ceid || "US:en",
    }),
    limit: sections.companies.maxHeadlinesPerCompany || 6,
  }));

  const topicFeed = {
    name: topic.name || "Topic",
    url: googleNewsSearchUrl(topic.query, {
      hl: topic.hl || "en-US",
      gl: topic.gl || "US",
      ceid: topic.ceid || "US:en",
    }),
    limit: topic.maxHeadlines || 12,
  };

  const jobs = [
    ...globalFeeds.map((f) =>
      fetchHeadlines(f.url, f.name, sections.global.maxHeadlines || 28).then((r) => ({
        bucket: "global",
        ...r,
      }))
    ),
    ...brazilFeeds.map((f) =>
      fetchHeadlines(f.url, f.name, sections.brazil.maxHeadlines || 18).then((r) => ({
        bucket: "brazil",
        ...r,
      }))
    ),
    ...companyFeeds.map((f) =>
      fetchHeadlines(f.url, f.name, f.limit).then((r) => ({
        bucket: "companies",
        company: f.name,
        ...r,
      }))
    ),
    fetchHeadlines(topicFeed.url, topicFeed.name, topicFeed.limit).then((r) => ({
      bucket: "topic",
      ...r,
    })),
  ];

  const results = await Promise.all(jobs);

  const globalItems = [];
  const brazilItems = [];
  const companyMap = Object.fromEntries(companies.map((c) => [c.name, []]));
  const topicItems = [];

  for (const result of results) {
    if (result.error) {
      failures.push({ feed: result.feedName, error: result.error });
    }
    if (result.bucket === "global") globalItems.push(...result.items);
    if (result.bucket === "brazil") brazilItems.push(...result.items);
    if (result.bucket === "topic") topicItems.push(...result.items);
    if (result.bucket === "companies" && result.company) {
      companyMap[result.company] = dedupeHeadlines(
        [...(companyMap[result.company] || []), ...result.items],
        sections.companies.maxHeadlinesPerCompany || 6
      );
    }
  }

  return {
    gatheredAt: new Date().toISOString(),
    failures,
    sections: {
      global: {
        label: sections.global.label,
        readingMinutes: sections.global.readingMinutes,
        headlines: dedupeHeadlines(globalItems, sections.global.maxHeadlines || 28),
      },
      brazil: {
        label: sections.brazil.label,
        readingMinutes: sections.brazil.readingMinutes,
        headlines: dedupeHeadlines(brazilItems, sections.brazil.maxHeadlines || 18),
      },
      companies: {
        label: sections.companies.label,
        readingMinutes: sections.companies.readingMinutes,
        byCompany: companyMap,
      },
      topic: {
        label: sections.topic.label,
        name: sections.topic.name,
        readingMinutes: sections.topic.readingMinutes,
        headlines: dedupeHeadlines(topicItems, sections.topic.maxHeadlines || 12),
      },
    },
  };
}

function packetToPromptText(packet) {
  const lines = [];
  lines.push(`Gathered at: ${packet.gatheredAt}`);
  if (packet.failures?.length) {
    lines.push(`Feed failures: ${packet.failures.map((f) => f.feed).join(", ")}`);
  }

  const g = packet.sections.global;
  lines.push("");
  lines.push(`## ${g.label} (~${g.readingMinutes} min target)`);
  for (const h of g.headlines) {
    lines.push(`- ${h.title} | ${h.link}${h.snippet ? ` | ${h.snippet}` : ""}`);
  }

  const b = packet.sections.brazil;
  lines.push("");
  lines.push(`## ${b.label} (~${b.readingMinutes} min target)`);
  for (const h of b.headlines) {
    lines.push(`- ${h.title} | ${h.link}${h.snippet ? ` | ${h.snippet}` : ""}`);
  }

  const c = packet.sections.companies;
  lines.push("");
  lines.push(`## ${c.label} (~${c.readingMinutes} min target)`);
  for (const [name, headlines] of Object.entries(c.byCompany || {})) {
    lines.push(`### ${name}`);
    if (!headlines.length) {
      lines.push("- (no headlines found)");
      continue;
    }
    for (const h of headlines) {
      lines.push(`- ${h.title} | ${h.link}${h.snippet ? ` | ${h.snippet}` : ""}`);
    }
  }

  const t = packet.sections.topic;
  lines.push("");
  lines.push(`## ${t.label}: ${t.name} (~${t.readingMinutes} min target)`);
  for (const h of t.headlines) {
    lines.push(`- ${h.title} | ${h.link}${h.snippet ? ` | ${h.snippet}` : ""}`);
  }

  return lines.join("\n");
}

module.exports = {
  gatherBriefingPacket,
  packetToPromptText,
};
