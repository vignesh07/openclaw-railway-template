import test from "node:test";
import assert from "node:assert/strict";
import {
  probeConnectosHealth,
  fetchShopifyBriefingBundle,
  buildBriefingContext,
} from "../src/lib/briefing-workflow.js";

test("probeConnectosHealth returns ok when health endpoint responds 200", async () => {
  const result = await probeConnectosHealth({
    connectosTarget: "http://connectos.test",
    fetchImpl: async (url) => {
      assert.equal(url, "http://connectos.test/health");
      return { ok: true, status: 200 };
    },
  });
  assert.equal(result.ok, true);
});

test("probeConnectosHealth returns not-ok on non-200 response", async () => {
  const result = await probeConnectosHealth({
    connectosTarget: "http://connectos.test",
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /503/);
});

test("probeConnectosHealth returns not-ok on network error", async () => {
  const result = await probeConnectosHealth({
    connectosTarget: "http://connectos.test",
    fetchImpl: async () => {
      throw new Error("ECONNREFUSED");
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /ECONNREFUSED/);
});

test("fetchShopifyBriefingBundle returns shopify data on success", async () => {
  const shopifyData = { orders: 42, revenue: 12500 };
  const result = await fetchShopifyBriefingBundle({
    connectosTarget: "http://connectos.test",
    fetchImpl: async (url) => {
      assert.equal(url, "http://connectos.test/shopify/briefing-bundle");
      return {
        ok: true,
        status: 200,
        async json() {
          return shopifyData;
        },
      };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.fallback, false);
  assert.deepEqual(result.data, shopifyData);
});

test("fetchShopifyBriefingBundle returns fallback when ConnectOS is down", async () => {
  const result = await fetchShopifyBriefingBundle({
    connectosTarget: "http://connectos.test",
    fetchImpl: async () => {
      throw new Error("Connection refused");
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.fallback, true);
  assert.match(result.data.summary, /nicht verfügbar/);
});

test("fetchShopifyBriefingBundle returns fallback on non-200 response", async () => {
  const result = await fetchShopifyBriefingBundle({
    connectosTarget: "http://connectos.test",
    fetchImpl: async () => ({ ok: false, status: 502 }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.fallback, true);
  assert.ok(result.data.summary);
});

test("buildBriefingContext includes shopify data and timestamp", () => {
  const ctx = buildBriefingContext({
    shopify: { revenue: 9999 },
    fallback: false,
  });
  assert.equal(ctx.hasFallback, false);
  assert.equal(ctx.shopify.revenue, 9999);
  assert.ok(ctx.timestamp);
  assert.ok(new Date(ctx.timestamp).getTime() > 0);
});

test("buildBriefingContext sets hasFallback when fallback is true", () => {
  const ctx = buildBriefingContext({ shopify: {}, fallback: true });
  assert.equal(ctx.hasFallback, true);
});

test("buildBriefingContext handles null shopify gracefully", () => {
  const ctx = buildBriefingContext({ shopify: null, fallback: false });
  assert.deepEqual(ctx.shopify, {});
});
