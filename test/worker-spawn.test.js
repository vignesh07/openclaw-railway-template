// Tests for M3 worker spawn safety validation.
// Validates depth limit, timeout cap, and tool whitelist enforcement.
import test from "node:test";
import assert from "node:assert/strict";
import { validateSpawnRequest } from "../src/lib/worker-activity.js";

test("worker spawn: clean request with safe defaults passes", () => {
  const result = validateSpawnRequest({
    depth: 0,
    tools: ["read"],
    timeoutSec: 60,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("worker spawn: depth 1 is allowed (leaf node boundary)", () => {
  const result = validateSpawnRequest({
    depth: 1,
    tools: ["read"],
    timeoutSec: 60,
  });
  assert.equal(result.ok, true);
});

test("worker spawn: depth > 1 is rejected", () => {
  const result = validateSpawnRequest({
    depth: 2,
    tools: ["read"],
    timeoutSec: 60,
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.ok(result.errors[0].includes("depth"));
});

test("worker spawn: timeout at 300s is allowed", () => {
  const result = validateSpawnRequest({
    depth: 0,
    tools: ["read"],
    timeoutSec: 300,
  });
  assert.equal(result.ok, true);
});

test("worker spawn: timeout > 300s is rejected", () => {
  const result = validateSpawnRequest({
    depth: 0,
    tools: ["read"],
    timeoutSec: 301,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("301")));
});

test("worker spawn: known tools (read, write, web_fetch, web_search) are allowed", () => {
  const result = validateSpawnRequest({
    depth: 0,
    tools: ["read", "write", "web_fetch", "web_search"],
    timeoutSec: 60,
  });
  assert.equal(result.ok, true);
});

test("worker spawn: unknown tool is rejected", () => {
  const result = validateSpawnRequest({
    depth: 0,
    tools: ["bash_exec"],
    timeoutSec: 60,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("bash_exec")));
});

test("worker spawn: multiple violations accumulate all errors", () => {
  const result = validateSpawnRequest({
    depth: 3,
    tools: ["bash_exec", "fs_write"],
    timeoutSec: 600,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 3);
});

test("worker spawn: allowedTools override enables custom whitelists", () => {
  const result = validateSpawnRequest({
    depth: 0,
    tools: ["shopify_orders"],
    timeoutSec: 60,
    allowedTools: ["shopify_orders", "shopify_products"],
  });
  assert.equal(result.ok, true);
});

test("worker spawn: empty tools list always passes whitelist check", () => {
  const result = validateSpawnRequest({ depth: 0, tools: [], timeoutSec: 60 });
  assert.equal(result.ok, true);
});
