// Load .env.local for local script runs (GitHub Actions uses real secrets).
import fs from "node:fs";

export function loadEnvLocal() {
  try {
    for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* no .env.local — rely on shell env */ }
}
