function escapeYaml(value) {
  const text = String(value ?? "");
  if (!text) return '""';
  if (/[:#\n\r"'[\]{}>|*&!%@`]/.test(text)) {
    return JSON.stringify(text);
  }
  return text;
}

function formatYamlList(values) {
  const list = Array.isArray(values) ? values.filter(Boolean) : [];
  if (!list.length) return "[]";
  return `[${list.map((entry) => escapeYaml(entry)).join(", ")}]`;
}

function serializeFrontmatter(fields) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: ${formatYamlList(value)}`);
    } else if (value === null || value === undefined) {
      lines.push(`${key}:`);
    } else {
      lines.push(`${key}: ${escapeYaml(value)}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

function parseScalar(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed === "[]") return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((part) => part.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return trimmed.replace(/^["']|["']$/g, "");
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith("---\n")) {
    return { frontmatter: {}, body: markdown };
  }

  const end = markdown.indexOf("\n---", 4);
  if (end === -1) return { frontmatter: {}, body: markdown };

  const raw = markdown.slice(4, end).trim();
  const body = markdown.slice(end + 4).trim();
  const frontmatter = {};

  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    frontmatter[key] = parseScalar(value);
  }

  return { frontmatter, body };
}

function buildMarkdown(fields, body) {
  return `${serializeFrontmatter(fields)}\n\n${String(body || "").trim()}\n`;
}

module.exports = {
  buildMarkdown,
  parseFrontmatter,
  serializeFrontmatter,
};
