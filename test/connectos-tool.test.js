// Tests for ConnectOS tool integration in the wrapper's control plane.
// Validates tool registration, spawn validation with Shopify tools,
// health probe auth behavior, and timeout fallback.
import test from "node:test";
import assert from "node:assert/strict";
import {
  getKnownToolNames,
  isKnownToolName,
} from "../src/lib/tool-registry.js";
import { validateSpawnRequest } from "../src/lib/worker-activity.js";
import { getConnectOsHealthProbe } from "../src/lib/gateway-health.js";
import {
  createWorkerResult,
  WorkerResultStatus,
} from "../src/lib/worker-result.js";

// -- Tool registration --

test("connectos tool: all shopify tools are in registry", () => {
  const names = getKnownToolNames();
  assert.ok(names.includes("shopify_orders"), "shopify_orders missing");
  assert.ok(names.includes("shopify_products"), "shopify_products missing");
  assert.ok(names.includes("shopify_revenue"), "shopify_revenue missing");
});

test("connectos tool: isKnownToolName validates each shopify tool", () => {
  assert.equal(isKnownToolName("shopify_orders"), true);
  assert.equal(isKnownToolName("shopify_products"), true);
  assert.equal(isKnownToolName("shopify_revenue"), true);
});

// -- Spawn validation with ConnectOS tools --

test("connectos tool: spawn request using shopify tools passes whitelist check", () => {
  const result = validateSpawnRequest({
    depth: 1,
    tools: ["shopify_orders", "shopify_revenue"],
    timeoutSec: 120,
    allowedTools: ["shopify_orders", "shopify_products", "shopify_revenue"],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("connectos tool: spawn request without allowedTools override rejects shopify tools", () => {
  // Without override, default whitelist is the 4 base tools — shopify tools require explicit allow
  const result = validateSpawnRequest({
    depth: 0,
    tools: ["shopify_orders"],
    timeoutSec: 60,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("shopify_orders")));
});

// -- Health probe: timeout handling --

test("connectos tool: health probe uses custom target URL from env-style option", async () => {
  let seen;
  await getConnectOsHealthProbe({
    connectosTarget: "http://staging.connectos:8080",
    fetchImpl: async (url) => {
      seen = url;
      return { ok: true, status: 200 };
    },
  });
  assert.equal(seen, "http://staging.connectos:8080/health");
});

test("connectos tool: health probe ok:false on non-2xx response", async () => {
  const result = await getConnectOsHealthProbe({
    connectosTarget: "http://connectos",
    fetchImpl: async () => ({ ok: false, status: 500 }),
  });
  assert.equal(result.ok, false);
  assert.ok(result.reason !== null);
});

// -- Worker result contract for ConnectOS tool call --

test("connectos tool: successful result envelope has COMPLETE status", () => {
  const result = createWorkerResult({
    status: WorkerResultStatus.COMPLETE,
    payload: { orders: 42, revenue_chf: 12500 },
    meta: {
      durationMs: 1200,
      sessionKey: "shopify:briefing:1",
      toolsUsed: ["shopify_orders", "shopify_revenue"],
    },
  });
  assert.equal(result.status, "complete");
  assert.equal(result.payload.orders, 42);
  assert.deepEqual(result.meta.toolsUsed, [
    "shopify_orders",
    "shopify_revenue",
  ]);
});

test("connectos tool: timed out result is detectable", () => {
  const result = createWorkerResult({
    status: WorkerResultStatus.TIMED_OUT,
    payload: null,
    meta: { durationMs: 300000, sessionKey: "shopify:briefing:1" },
  });
  assert.equal(result.status, "timed_out");
});
