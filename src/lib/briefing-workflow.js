// Wrapper-side support for the morning briefing pipeline.
// The briefing itself is delivered by OpenClaw/Treebot natively.
// This module handles: ConnectOS reachability probe, Shopify data fetch,
// and graceful fallback when ConnectOS is unavailable.

const FALLBACK_MESSAGE = "Shopify-Daten nicht verfügbar";

/**
 * Probe ConnectOS /health endpoint.
 * @param {{ connectosTarget: string, fetchImpl: Function }} options
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function probeConnectosHealth(options = {}) {
  const target = options.connectosTarget ?? "http://127.0.0.1:3100";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  try {
    const response = await fetchImpl(`${target}/health`);
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: String(err?.message ?? err) };
  }
}

/**
 * Fetch Shopify briefing bundle from ConnectOS.
 * On failure or timeout, returns a graceful fallback payload.
 * @param {{ connectosTarget: string, fetchImpl: Function, timeoutMs?: number }} options
 * @returns {Promise<{ ok: boolean, data: object, fallback: boolean }>}
 */
export async function fetchShopifyBriefingBundle(options = {}) {
  const target = options.connectosTarget ?? "http://127.0.0.1:3100";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  try {
    const response = await fetchImpl(`${target}/shopify/briefing-bundle`);
    if (!response.ok) {
      return { ok: false, data: { summary: FALLBACK_MESSAGE }, fallback: true };
    }
    const body =
      typeof response.json === "function" ? await response.json() : {};
    return { ok: true, data: body, fallback: false };
  } catch {
    return { ok: false, data: { summary: FALLBACK_MESSAGE }, fallback: true };
  }
}

/**
 * Build the briefing context object passed to OpenClaw/Treebot.
 * @param {{ shopify: object, fallback: boolean }} input
 * @returns {{ shopify: object, hasFallback: boolean, timestamp: string }}
 */
export function buildBriefingContext({ shopify = {}, fallback = false } = {}) {
  return {
    shopify: typeof shopify === "object" && shopify !== null ? shopify : {},
    hasFallback: Boolean(fallback),
    timestamp: new Date().toISOString(),
  };
}
