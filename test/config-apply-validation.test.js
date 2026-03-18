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
