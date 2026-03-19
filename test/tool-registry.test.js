import test from "node:test";
import assert from "node:assert/strict";
import {
  getKnownToolNames,
  isKnownToolName,
} from "../src/lib/tool-registry.js";

test("known tool registry exposes required worker tools", () => {
  const names = getKnownToolNames();
  assert.ok(names.includes("read"));
  assert.ok(names.includes("write"));
  assert.ok(names.includes("web_fetch"));
  assert.ok(names.includes("web_search"));
});

test("unknown tool names are rejected deterministically", () => {
  assert.equal(isKnownToolName("webfetch"), false);
  assert.equal(isKnownToolName("web_fetch"), true);
});

test("ConnectOS Shopify tool names are registered for morning briefing pipeline", () => {
  assert.equal(isKnownToolName("connectos"), true);
  assert.equal(isKnownToolName("shopify_orders"), true);
  assert.equal(isKnownToolName("shopify_revenue"), true);
  assert.equal(isKnownToolName("shopify_products"), true);
  assert.equal(isKnownToolName("briefing_bundle"), true);
});

test("unknown connectos-adjacent names are still rejected", () => {
  assert.equal(isKnownToolName("shopify"), false);
  assert.equal(isKnownToolName("connectos_shopify"), false);
  assert.equal(isKnownToolName("ShopifyOrders"), false);
});
