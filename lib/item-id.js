const crypto = require("crypto");

function normalizeLinkForId(link) {
  return String(link || "").trim();
}

function stableItemId(itemOrLink) {
  const link =
    typeof itemOrLink === "string"
      ? itemOrLink
      : itemOrLink?.link || itemOrLink?.url;
  const normalized = normalizeLinkForId(link);

  if (!normalized) {
    throw new Error("Cannot build item id without a link");
  }

  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function addStableItemId(item) {
  if (!item || (!item.link && !item.url)) return item;
  return {
    ...item,
    id: item.id || stableItemId(item),
  };
}

module.exports = { addStableItemId, normalizeLinkForId, stableItemId };
