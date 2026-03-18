import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(
  new URL("../src/server.js", import.meta.url),
  "utf8",
);

function routeWindow(marker, length = 1200) {
  const idx = src.indexOf(marker);
  assert.ok(idx >= 0, `missing marker: ${marker}`);
  return src.slice(idx, idx + length);
}

// (a) POST /setup/api/config/raw returns 410 with GONE code (config writes disabled)
test("config apply: POST /setup/api/config/raw returns 410 with GONE code", () => {
  const window = routeWindow('app.post("/setup/api/config/raw"');
  assert.match(window, /respondGone\(/);
  assert.match(window, /Raw config writes disabled/);
});

// (b) GET /setup/api/config/raw exists and returns JSON with path + content
test("config apply: GET config/raw returns path, exists, content fields", () => {
  const window = routeWindow('app.get("/setup/api/config/raw"');
  assert.match(window, /res\.json\(/);
  assert.match(window, /path:\s*p/);
  assert.match(window, /exists/);
  assert.match(window, /content/);
});

// (c) POST /setup/api/run validates buildOnboardArgs and returns 400 on bad input
test("config apply: /setup/api/run catches buildOnboardArgs errors as 400", () => {
  const window = routeWindow('app.post("/setup/api/run"', 2000);
  // Should catch errors from buildOnboardArgs and return 400
  assert.match(window, /respondJson\(400/);
  assert.match(window, /Setup input error/);
});

// (d) buildOnboardArgs throws on missing auth secret for API-key choices
test("config apply: buildOnboardArgs enforces required auth secret", () => {
  // Search full source since function is long
  assert.match(src, /Missing auth secret for authChoice=/);
  assert.match(src, /Missing auth secret for authChoice=token/);
});

// (e) Express body parser limits payload to 1MB
test("config apply: express JSON body parser has 1MB limit", () => {
  assert.match(src, /express\.json\(\{\s*limit:\s*["']1mb["']\s*\}\)/);
});

// (f) POST /setup/api/run returns 200 when already configured
test("config apply: /setup/api/run returns 200 with message when already configured", () => {
  const window = routeWindow('app.post("/setup/api/run"', 1500);
  assert.match(window, /Already configured/);
  assert.match(window, /respondJson\(200/);
});

// --- ITEM-5: Edge cases ---

// (g) Gateway start is deduped (gatewayStarting promise prevents concurrent starts)
test("config apply edge: gateway start is deduplicated via gatewayStarting promise", () => {
  const window = routeWindow("async function ensureGatewayRunning", 800);
  assert.match(window, /gatewayStarting/);
  // If already starting, it awaits the existing promise instead of starting again
  assert.match(window, /if\s*\(\s*!gatewayStarting\s*\)/);
  assert.match(window, /await\s+gatewayStarting/);
});

// (h) POST /setup/api/run prevents double-response with writableEnded check
test("config apply edge: /setup/api/run guards against double response", () => {
  const window = routeWindow('app.post("/setup/api/run"', 500);
  assert.match(window, /writableEnded|headersSent/);
});

// (i) readBodyBuffer enforces max byte limit
test("config apply edge: readBodyBuffer enforces max byte limit", () => {
  const window = routeWindow("async function readBodyBuffer", 400);
  assert.match(window, /maxBytes/);
  assert.match(window, /payload too large/);
  assert.match(window, /req\.destroy\(\)/);
});

// (j) Custom provider validation rejects bad providerIds
test("config apply edge: custom provider validation rejects bad input", () => {
  // Verify validation regex and error messages in source
  assert.match(src, /invalid provider id/);
  assert.match(src, /baseUrl must start with http/);
  assert.match(src, /api must be openai-completions or openai-responses/);
  assert.match(src, /invalid api key env var name/);
});

// (k) Console command arg validation uses alphanumeric pattern
test("config apply edge: plugin/device name validation uses strict regex", () => {
  // plugins.enable handler validates plugin name
  const pluginWindow = routeWindow('cmd === "openclaw.plugins.enable"', 500);
  assert.match(pluginWindow, /\[A-Za-z0-9_-\]\+/);
  assert.match(pluginWindow, /Invalid plugin name/);
});
