import test from "node:test";
import assert from "node:assert/strict";
import {
  isKnownToolName,
  getKnownToolNames,
} from "../src/lib/tool-registry.js";
import {
  getConnectOSHealthProbe,
  evaluateControlPlaneHealth,
} from "../src/lib/gateway-health.js";

// Tool registry — ConnectOS tool surface
test("ConnectOS tool names are registered in the tool registry", () => {
  assert.equal(isKnownToolName("connectos"), true);
  assert.equal(isKnownToolName("shopify_orders"), true);
  assert.equal(isKnownToolName("shopify_revenue"), true);
  assert.equal(isKnownToolName("shopify_products"), true);
  assert.equal(isKnownToolName("briefing_bundle"), true);
});

test("adjacent incorrect tool names are still rejected", () => {
  assert.equal(isKnownToolName("shopify"), false);
  assert.equal(isKnownToolName("ShopifyOrders"), false);
  assert.equal(isKnownToolName("connect_os"), false);
  assert.equal(isKnownToolName("ConnectOS"), false);
});

test("all ConnectOS tools appear in getKnownToolNames array", () => {
  const names = getKnownToolNames();
  for (const name of [
    "connectos",
    "shopify_orders",
    "shopify_revenue",
    "shopify_products",
    "briefing_bundle",
  ]) {
    assert.ok(names.includes(name), `Expected ${name} in registry`);
  }
});

// ConnectOS health probe
test("getConnectOSHealthProbe reports ok when ConnectOS returns 200", async () => {
  const result = await getConnectOSHealthProbe({
    connectosUrl: "http://connectos.internal",
    fetchImpl: async (url) => {
      assert.equal(url, "http://connectos.internal/health");
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, version: "1.0.0" }),
      };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
});

test("getConnectOSHealthProbe degrades gracefully when ConnectOS returns 503", async () => {
  const result = await getConnectOSHealthProbe({
    connectosUrl: "http://connectos.internal",
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      json: async () => ({ ok: false, error: "Service Unavailable" }),
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.degraded, true);
  assert.equal(result.status, 503);
});

test("getConnectOSHealthProbe degrades gracefully on network error", async () => {
  const result = await getConnectOSHealthProbe({
    connectosUrl: "http://connectos.internal",
    fetchImpl: async () => {
      throw new Error("ECONNREFUSED");
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.degraded, true);
  assert.equal(result.status, "unreachable");
});

test("control-plane health gate fails when connectosOk=false", () => {
  const result = evaluateControlPlaneHealth({
    livenessOk: true,
    gatewayStatusOk: true,
    channelsReady: true,
    routingOk: true,
    connectosOk: false,
  });
  assert.equal(result.ok, false);
  assert.equal(result.phases.connectosOk, false);
});

test("control-plane health gate passes when connectosOk omitted (backward compat)", () => {
  const result = evaluateControlPlaneHealth({
    livenessOk: true,
    gatewayStatusOk: true,
    channelsReady: true,
    routingOk: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.phases.connectosOk, true);
});
