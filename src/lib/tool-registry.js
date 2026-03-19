// Pinned v1 semantic validation source of truth.
// Update this list deliberately whenever the supported OpenClaw tool surface changes.
// ConnectOS Shopify tools added 2026-03-19: shopify_orders, shopify_products, shopify_revenue.
const KNOWN_TOOL_NAMES = Object.freeze([
  "read",
  "write",
  "web_fetch",
  "web_search",
  "shopify_orders",
  "shopify_products",
  "shopify_revenue",
]);

export function getKnownToolNames() {
  return [...KNOWN_TOOL_NAMES];
}

export function isKnownToolName(name) {
  return KNOWN_TOOL_NAMES.includes(String(name || "").trim());
}
