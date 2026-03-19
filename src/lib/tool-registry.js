// Pinned v1 semantic validation source of truth.
// Update this list deliberately whenever the supported OpenClaw tool surface changes.
const KNOWN_TOOL_NAMES = Object.freeze([
  "read",
  "write",
  "web_fetch",
  "web_search",
  // ConnectOS Shopify tools — registered for briefing pipeline
  "shopify_orders",
  "shopify_revenue",
  "shopify_products",
]);

export function getKnownToolNames() {
  return [...KNOWN_TOOL_NAMES];
}

export function isKnownToolName(name) {
  return KNOWN_TOOL_NAMES.includes(String(name || "").trim());
}
