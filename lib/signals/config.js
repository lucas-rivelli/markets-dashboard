"use strict";

const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "..", "..", "data", "signals", "config.json");

function loadConfig(configPath = CONFIG_PATH) {
  const raw = fs.readFileSync(configPath, "utf8");
  const config = JSON.parse(raw);

  if (!Array.isArray(config.universe) || config.universe.length === 0) {
    throw new Error("signals config: universe must be a non-empty array");
  }
  config.universe = config.universe.map((t) => String(t).trim().toUpperCase()).filter(Boolean);
  config.benchmark = String(config.benchmark || "SPY").trim().toUpperCase();
  if (!Array.isArray(config.extraSources)) config.extraSources = [];

  return config;
}

module.exports = { CONFIG_PATH, loadConfig };
