import test from "node:test";
import assert from "node:assert/strict";
import {
  validateWorkerSpawn,
  buildSpawnRequest,
} from "../src/lib/worker-spawn.js";

// ─── validateWorkerSpawn ───────────────────────────────────────────────────

test("validateWorkerSpawn accepts valid leaf worker request", () => {
  const result = validateWorkerSpawn({
    depth: 0,
    tools: ["read", "web_fetch"],
    timeoutMs: 60_000,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("validateWorkerSpawn rejects depth exceeding MAX_DEPTH=1", () => {
  const result = validateWorkerSpawn({ depth: 2 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("depth")));
});

test("validateWorkerSpawn rejects unknown tools", () => {
  const result = validateWorkerSpawn({ tools: ["read", "rm_rf"] });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("'rm_rf'")));
});

test("validateWorkerSpawn accepts ConnectOS Shopify tools", () => {
  const result = validateWorkerSpawn({
    tools: ["shopify_orders", "shopify_revenue"],
  });
  assert.equal(result.ok, true);
});

test("validateWorkerSpawn rejects timeoutMs above 300000ms", () => {
  const result = validateWorkerSpawn({ timeoutMs: 400_000 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("timeoutMs")));
});

test("validateWorkerSpawn rejects timeoutMs below 1000ms", () => {
  const result = validateWorkerSpawn({ timeoutMs: 500 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("timeoutMs")));
});

test("validateWorkerSpawn accepts missing timeoutMs (no default applied)", () => {
  const result = validateWorkerSpawn({ depth: 0, tools: ["read"] });
  assert.equal(result.ok, true);
});

test("validateWorkerSpawn accumulates multiple errors", () => {
  const result = validateWorkerSpawn({
    depth: 5,
    tools: ["rm_rf", "danger_cmd"],
    timeoutMs: 999_999,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 3);
});

// ─── buildSpawnRequest ─────────────────────────────────────────────────────

test("buildSpawnRequest applies safe defaults", () => {
  const req = buildSpawnRequest({});
  assert.equal(req.sessionKey, "worker");
  assert.equal(req.depth, 0);
  assert.deepEqual(req.tools, ["read"]);
  assert.equal(req.timeoutMs, 60_000);
});

test("buildSpawnRequest caps depth at MAX_DEPTH=1", () => {
  const req = buildSpawnRequest({ depth: 10 });
  assert.equal(req.depth, 1);
});

test("buildSpawnRequest caps timeoutMs at 300000ms", () => {
  const req = buildSpawnRequest({ timeoutMs: 500_000 });
  assert.equal(req.timeoutMs, 300_000);
});
