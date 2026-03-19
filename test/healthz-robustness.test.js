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

// (a) /healthz returns correct JSON structure with wrapper + gateway sections
test("healthz robustness: returns wrapper and gateway sections", () => {
  const window = routeWindow('app.get("/healthz"', 800);
  assert.match(window, /wrapper:\s*\{/);
  assert.match(window, /gateway:\s*\{/);
  assert.match(window, /ok:\s*true/);
});

// (b) /healthz includes configured, stateDir, workspaceDir in wrapper
test("healthz robustness: wrapper section includes configured + dirs", () => {
  const window = routeWindow('app.get("/healthz"', 800);
  assert.match(window, /configured:\s*isConfigured\(\)/);
  assert.match(window, /stateDir:\s*STATE_DIR/);
  assert.match(window, /workspaceDir:\s*WORKSPACE_DIR/);
});

// (c) /healthz includes target, reachable in gateway section
test("healthz robustness: gateway section includes target + reachable", () => {
  const window = routeWindow('app.get("/healthz"', 800);
  assert.match(window, /target:\s*GATEWAY_TARGET/);
  assert.match(window, /reachable:\s*gatewayReachable/);
});

// (d) probeGateway uses TCP connect with 750ms timeout (not HTTP)
test("healthz robustness: probeGateway uses TCP socket with 750ms timeout", () => {
  const window = routeWindow("async function probeGateway", 600);
  assert.match(window, /net\.createConnection/);
  assert.match(window, /timeout:\s*750/);
  assert.match(window, /sock\.on\("connect"/);
  assert.match(window, /sock\.on\("timeout"/);
  assert.match(window, /sock\.on\("error"/);
});

// (e) /healthz does not require auth (no requireSetupAuth)
test("healthz robustness: /healthz has no auth middleware", () => {
  const window = routeWindow('app.get("/healthz"', 100);
  assert.doesNotMatch(window, /requireSetupAuth/);
});

// (f) /setup/healthz is a minimal health check returning {ok: true}
test("healthz robustness: /setup/healthz returns minimal {ok: true}", () => {
  const window = routeWindow('app.get("/setup/healthz"', 200);
  assert.match(window, /ok:\s*true/);
  assert.doesNotMatch(window, /requireSetupAuth/);
});

// (g) requireDashboardAuth exempts /healthz and /setup/healthz
test("healthz robustness: dashboard auth exempts health endpoints", () => {
  const window = routeWindow("function requireDashboardAuth", 400);
  assert.match(window, /\/healthz/);
  assert.match(window, /\/setup\/healthz/);
});

// (h) Proxy fallback returns 503 with troubleshooting hints
test("healthz robustness: proxy fallback returns 503 with troubleshooting hints", () => {
  // The catch-all route returns 503 when gateway is not ready
  assert.match(src, /Gateway not ready/);
  assert.match(src, /503/);
  assert.match(src, /Troubleshooting/);
  assert.match(src, /\/setup\/api\/debug/);
});
