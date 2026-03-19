// Pinned v1 semantic validation source of truth.
// Update this list deliberately whenever the supported OpenClaw tool surface changes.
const KNOWN_TOOL_NAMES = Object.freeze([
  // Core built-in tools
  "read",
  "write",
  "web_fetch",
  "web_search",
  // ConnectOS integration — Shopify data pipeline for morning briefing
  // These tool names are registered when ConnectOS is deployed as a native OpenClaw tool.
  // configs that allow these will pass semantic validation once ConnectOS ships.
  "connectos",
  "shopify_orders",
  "shopify_revenue",
  "shopify_products",
  "briefing_bundle",
]);

export function getKnownToolNames() {
  return [...KNOWN_TOOL_NAMES];
}

export function isKnownToolName(name) {
  return KNOWN_TOOL_NAMES.includes(String(name || "").trim());
}
