import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("dashboard traffic is proxied to the gateway instead of being forced back to setup", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

  assert.match(src, /async function ensureGatewayRunning\(\) \{/);
  assert.doesNotMatch(src, /if \(!isConfigured\(\)\) return \{ ok: false, reason: "not configured" \ };/);
  assert.doesNotMatch(src, /return res\.redirect\("\/setup"\);/);
  assert.match(src, /app\.use\(requireDashboardAuth, async \(req, res\) => \{/);
  assert.match(src, /await ensureGatewayRunning\(\);/);
  assert.match(src, /return proxy\.web\(req, res, \{ target: GATEWAY_TARGET \}\);/);
});
