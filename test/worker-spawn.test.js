import test from "node:test";
import assert from "node:assert/strict";
import { validateSpawnRequest } from "../src/lib/worker-activity.js";

test("validateSpawnRequest accepts valid M3 briefing worker config", () => {
  const result = validateSpawnRequest({
    depth: 0,
    tools: ["connectos", "briefing_bundle"],
    toolAllowlist: [
      "connectos",
      "shopify_orders",
      "shopify_revenue",
      "briefing_bundle",
    ],
    timeoutSeconds: 300,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("validateSpawnRequest rejects depth > 1 (M3 bounded leaf workers only)", () => {
  const result = validateSpawnRequest({
    depth: 2,
    tools: ["read"],
    toolAllowlist: ["read"],
    timeoutSeconds: 60,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("depth 2 exceeds maximum")));
});

test("validateSpawnRequest rejects missing timeoutSeconds", () => {
  const result = validateSpawnRequest({
    depth: 0,
    tools: ["read"],
    toolAllowlist: ["read"],
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.includes("timeoutSeconds is required")),
  );
});

test("validateSpawnRequest rejects zero timeout", () => {
  const result = validateSpawnRequest({
    depth: 0,
    tools: ["read"],
    toolAllowlist: ["read"],
    timeoutSeconds: 0,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("positive number")));
});

test("validateSpawnRequest rejects timeout exceeding 600s", () => {
  const result = validateSpawnRequest({
    depth: 0,
    tools: ["read"],
    toolAllowlist: ["read"],
    timeoutSeconds: 601,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("exceeds maximum 600")));
});

test("validateSpawnRequest rejects tool not in allowlist", () => {
  const result = validateSpawnRequest({
    depth: 0,
    tools: ["read", "shell_exec"],
    toolAllowlist: ["read", "write"],
    timeoutSeconds: 60,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("shell_exec")));
});

test("validateSpawnRequest allows any tools when toolAllowlist is empty", () => {
  // empty allowlist = no tool restriction (caller opted out of tool gating)
  const result = validateSpawnRequest({
    depth: 0,
    tools: ["read", "shell_exec", "anything"],
    toolAllowlist: [],
    timeoutSeconds: 60,
  });
  assert.equal(result.ok, true);
});

test("validateSpawnRequest collects multiple errors", () => {
  const result = validateSpawnRequest({
    depth: 3,
    tools: ["disallowed_tool"],
    toolAllowlist: ["read"],
    timeoutSeconds: 700,
  });
  assert.equal(result.ok, false);
  // should flag depth, timeout, and disallowed tool
  assert.ok(result.errors.length >= 3);
});
