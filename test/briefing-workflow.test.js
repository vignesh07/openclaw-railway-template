// Tests for the morning briefing workflow integration seams.
// Validates ConnectOS health probe behavior during briefing and graceful
// degradation when ConnectOS is unavailable.
import test from "node:test";
import assert from "node:assert/strict";
import { getConnectOsHealthProbe } from "../src/lib/gateway-health.js";
import { isKnownToolName } from "../src/lib/tool-registry.js";

// -- ConnectOS health probe: healthy path --

test("briefing workflow: ConnectOS health probe returns ok when /health responds 200", async () => {
  const result = await getConnectOsHealthProbe({
    connectosTarget: "http://connectos.internal",
    fetchImpl: async (_url) => ({ ok: true, status: 200 }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.reason, null);
});

test("briefing workflow: ConnectOS health probe returns ok:false on 503", async () => {
  const result = await getConnectOsHealthProbe({
    connectosTarget: "http://connectos.internal",
    fetchImpl: async (_url) => ({ ok: false, status: 503 }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.ok(result.reason.includes("503"));
});

test("briefing workflow: ConnectOS health probe degrades gracefully on network error", async () => {
  const result = await getConnectOsHealthProbe({
    connectosTarget: "http://connectos.internal",
    fetchImpl: async () => {
      throw new Error("ECONNREFUSED");
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, null);
  assert.ok(result.reason.includes("ECONNREFUSED"));
});

test("briefing workflow: ConnectOS health probe hits /health endpoint", async () => {
  let capturedUrl = null;
  await getConnectOsHealthProbe({
    connectosTarget: "http://connectos:4000",
    fetchImpl: async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200 };
    },
  });
  assert.equal(capturedUrl, "http://connectos:4000/health");
});

// -- Tool registry: Shopify tools available for briefing workflow --

test("briefing workflow: shopify_orders tool is registered", () => {
  assert.equal(isKnownToolName("shopify_orders"), true);
});

test("briefing workflow: shopify_products tool is registered", () => {
  assert.equal(isKnownToolName("shopify_products"), true);
});

test("briefing workflow: shopify_revenue tool is registered", () => {
  assert.equal(isKnownToolName("shopify_revenue"), true);
});

test("briefing workflow: unknown briefing tool is rejected", () => {
  assert.equal(isKnownToolName("shopify_inventory_snapshot"), false);
});
