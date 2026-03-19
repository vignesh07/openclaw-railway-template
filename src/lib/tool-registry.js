// Pinned v1 semantic validation source of truth.
// Update this list deliberately whenever the supported OpenClaw tool surface changes.
const KNOWN_TOOL_NAMES = Object.freeze([
  // Core built-in tools
  "read",
  "write",
  "web_fetch",
  "web_search",
  // ConnectOS integration — Shopify data pipeline for morning briefing.
  // DESIGN NOTE: This is a static semantic allowlist, not a live capability check.
  // Tools listed here pass config validation but only work at runtime when ConnectOS
  // is deployed as an OpenClaw native tool. Pre-registering them here is intentional:
  // it lets the morning briefing config be applied/persisted before ConnectOS ships
  // without breaking the config apply gate. Verify exact names match the ConnectOS
  // implementation when it ships; this file is the single place to update if they differ.
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
