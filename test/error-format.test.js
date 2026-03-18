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

// (a) 400 errors return JSON with ok:false and error field
test("error format: 400 responses include ok:false and error field", () => {
  // Console: Command not allowed
  const consoleWindow = routeWindow('app.post("/setup/api/console/run"', 1400);
  assert.match(consoleWindow, /status\(400\)\.json\(\{.*ok:\s*false.*error:/s);

  // Devices approve: Missing device request ID
  const devWindow = routeWindow('app.post("/setup/api/devices/approve"', 400);
  assert.match(devWindow, /status\(400\)\.json\(/);
});

// (b) 410 Gone errors use consistent respondGone with ok:false, error, code:"GONE"
test("error format: 410 Gone responses use respondGone with consistent structure", () => {
  const goneHelper = routeWindow("function respondGone", 200);
  assert.match(goneHelper, /ok:\s*false/);
  assert.match(goneHelper, /error/);
  assert.match(goneHelper, /code:\s*["']GONE["']/);
});

// (c) 401 errors set WWW-Authenticate header
test("error format: 401 responses set WWW-Authenticate header", () => {
  // Setup auth
  const setupAuth = routeWindow("function requireSetupAuth", 600);
  assert.match(setupAuth, /WWW-Authenticate/);
  assert.match(setupAuth, /status\(401\)/);

  // Dashboard auth
  const dashAuth = routeWindow("function requireDashboardAuth", 600);
  assert.match(dashAuth, /WWW-Authenticate/);
  assert.match(dashAuth, /status\(401\)/);
});

// (d) 500 errors in console catch block include error field
test("error format: 500 console errors include error field", () => {
  // The catch block at end of console handler: status(500).json({ ok: false, error: ... })
  assert.match(
    src,
    /catch\s*\(err\)\s*\{[\s\S]*?status\(500\)\.json\(\{\s*ok:\s*false,\s*error:\s*String\(err\)/,
  );
});

// (e) 500 errors from SETUP_PASSWORD missing return descriptive text
test("error format: missing SETUP_PASSWORD returns 500 with descriptive text", () => {
  const window = routeWindow("function requireSetupAuth", 400);
  assert.match(window, /status\(500\)/);
  assert.match(window, /SETUP_PASSWORD is not set/);
});

// (f) Proxy 502 errors return text/plain
test("error format: proxy errors return 502 with text/plain", () => {
  assert.match(src, /writeHead\(502/);
  assert.match(src, /Gateway unavailable/);
});

// (g) Pairing approve returns 400 for missing channel/code
test("error format: pairing approve validates required fields", () => {
  const window = routeWindow('app.post("/setup/api/pairing/approve"', 400);
  assert.match(window, /status\(400\)/);
  assert.match(window, /Missing channel or code/);
});

// (h) Config raw read catches errors with 500 and error string
test("error format: config raw read catches errors with 500", () => {
  const window = routeWindow('app.get("/setup/api/config/raw"', 400);
  assert.match(window, /status\(500\)\.json\(/);
  assert.match(window, /error:\s*String\(err\)/);
});
