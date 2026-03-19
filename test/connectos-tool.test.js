// ConnectOS tool integration tests — exercises the wrapper's ConnectOS
// surface: tool registry membership, health probe, and briefing bundle fetch.
// All network calls are injected as fakes.

import test from "node:test";
import assert from "node:assert/strict";
import {
  isKnownToolName,
  getKnownToolNames,
} from "../src/lib/tool-registry.js";
import {
  probeConnectosHealth,
  fetchShopifyBriefingBundle,
} from "../src/lib/briefing-workflow.js";
import { validateWorkerSpawn } from "../src/lib/worker-spawn.js";

// ─── Tool registration ─────────────────────────────────────────────────────

test("ConnectOS shopify_orders tool is registered", () => {
  assert.equal(isKnownToolName("shopify_orders"), true);
});

test("ConnectOS shopify_revenue tool is registered", () => {
  assert.equal(isKnownToolName("shopify_revenue"), true);
});

test("ConnectOS shopify_products tool is registered", () => {
  assert.equal(isKnownToolName("shopify_products"), true);
});

test("all ConnectOS tools appear in getKnownToolNames()", () => {
  const names = getKnownToolNames();
  for (const tool of [
    "shopify_orders",
    "shopify_revenue",
    "shopify_products",
  ]) {
    assert.ok(names.includes(tool), `${tool} should be in registry`);
  }
});

// ─── Health probe integration ──────────────────────────────────────────────

test("ConnectOS health probe succeeds on valid response", async () => {
  const result = await probeConnectosHealth({
    connectosTarget: "http://connectos.internal",
    fetchImpl: async () => ({ ok: true, status: 200 }),
  });
  assert.equal(result.ok, true);
});

test("ConnectOS health probe degrades gracefully on timeout/error", async () => {
  const result = await probeConnectosHealth({
    connectosTarget: "http://connectos.internal",
    fetchImpl: async () => {
      throw new Error("timeout");
    },
  });
  assert.equal(result.ok, false);
  assert.ok(typeof result.reason === "string");
});

// ─── Briefing bundle fetch ─────────────────────────────────────────────────

test("ConnectOS briefing bundle returns structured Shopify data", async () => {
  const fixture = { orders: 15, revenue: 3750.5, products: 200 };
  const result = await fetchShopifyBriefingBundle({
    connectosTarget: "http://connectos.internal",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return fixture;
      },
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.fallback, false);
  assert.deepEqual(result.data, fixture);
});

test("ConnectOS briefing bundle falls back when 503 returned", async () => {
  const result = await fetchShopifyBriefingBundle({
    connectosTarget: "http://connectos.internal",
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.fallback, true);
  assert.ok(result.data.summary, "fallback must include a summary message");
});

// ─── Tool allowlist in spawn context ──────────────────────────────────────

test("ConnectOS tools are allowed in worker spawn validation", () => {
  const result = validateWorkerSpawn({
    depth: 0,
    tools: ["shopify_orders", "shopify_revenue", "shopify_products"],
    timeoutMs: 30_000,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});
