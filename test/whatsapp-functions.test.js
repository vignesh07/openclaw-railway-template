import test from "node:test";
import assert from "node:assert/strict";

import {
  ensureWhatsAppConfig,
  ensureAgent,
  ensureWorkspaceFromTemplate,
  reloadGatewayIfNeeded,
  getQrCode,
} from "../src/whatsapp.js";

test("whatsapp.js exports the 5 isolated responsibility functions", () => {
  assert.strictEqual(typeof ensureWhatsAppConfig, "function", "ensureWhatsAppConfig must be exported");
  assert.strictEqual(typeof ensureAgent, "function", "ensureAgent must be exported");
  assert.strictEqual(typeof ensureWorkspaceFromTemplate, "function", "ensureWorkspaceFromTemplate must be exported");
  assert.strictEqual(typeof reloadGatewayIfNeeded, "function", "reloadGatewayIfNeeded must be exported");
  assert.strictEqual(typeof getQrCode, "function", "getQrCode must be exported");
});

test("reloadGatewayIfNeeded delegates to restartGateway", async () => {
  let called = false;
  await reloadGatewayIfNeeded("test-account", {
    restartGateway: async () => { called = true; },
  });
  assert.ok(called, "restartGateway should have been called");
});

test("getQrCode delegates to generateWhatsappQrAscii with correct accountId", async () => {
  const qr = await getQrCode("my-account", {
    generateWhatsappQrAscii: async ({ accountId }) => `qr-for-${accountId}`,
  });
  assert.strictEqual(qr, "qr-for-my-account");
});

test("ensureWhatsAppConfig returns existed=true when config already exists", async () => {
  const result = await ensureWhatsAppConfig("existing-acc", {
    openclawNode: "node",
    clawArgs: (args) => args,
    redactSecrets: (s) => s,
    runCmd: async (_node, args) => {
      // Simulate 'config get' succeeding (account exists)
      if (args[0] === "config" && args[1] === "get") return { code: 0, output: "" };
      return { code: 0, output: "" };
    },
  });
  assert.strictEqual(result.existed, true);
  assert.strictEqual(result.changed, false);
});

test("ensureWhatsAppConfig returns changed=true when config is newly created", async () => {
  const result = await ensureWhatsAppConfig("new-acc", {
    openclawNode: "node",
    clawArgs: (args) => args,
    redactSecrets: (s) => s,
    runCmd: async (_node, args) => {
      // Simulate 'config get' failing (not found) then 'config set' succeeding
      if (args[0] === "config" && args[1] === "get") return { code: 1, output: "" };
      return { code: 0, output: "" };
    },
  });
  assert.strictEqual(result.existed, false);
  assert.strictEqual(result.changed, true);
});
