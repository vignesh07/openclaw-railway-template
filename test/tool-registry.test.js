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

test("ConnectOS Shopify tools are registered", () => {
  const names = getKnownToolNames();
  assert.ok(names.includes("shopify_orders"));
  assert.ok(names.includes("shopify_revenue"));
  assert.ok(names.includes("shopify_products"));
});

test("unknown tool names are rejected deterministically", () => {
  assert.equal(isKnownToolName("webfetch"), false);
  assert.equal(isKnownToolName("web_fetch"), true);
  assert.equal(isKnownToolName("shopify_unknown"), false);
});
