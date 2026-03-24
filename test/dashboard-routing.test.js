import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("dashboard traffic is proxied to the gateway instead of being forced back to setup", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

  assert.match(src, /const DASHBOARD_BASE_PATH = "\/dashboard";/);
  assert.match(src, /async function ensureGatewayRunning\(\) \{/);
  assert.doesNotMatch(src, /if \(!isConfigured\(\)\) return \{ ok: false, reason: "not configured" \ };/);
  assert.doesNotMatch(src, /return res\.redirect\("\/setup"\);/);
  assert.match(src, /function isDashboardRequest\(req\) \{/);
  assert.match(src, /function sendDashboardBootstrapPage\(res\) \{/);
  assert.match(src, /app\.use\(requireDashboardAuth, async \(req, res\) => \{/);
  assert.match(src, /if \(isDashboardRequest\(req\) && \(gatewayStarting \|\| !gatewayProc\)\) \{/);
  assert.match(src, /return sendDashboardBootstrapPage\(res\);/);
  assert.match(src, /await ensureGatewayRunning\(\);/);
  assert.match(src, /return proxy\.web\(req, res, \{ target: GATEWAY_TARGET \}\);/);
  assert.match(src, /gateway\.controlUi\.basePath", DASHBOARD_BASE_PATH/);
});
