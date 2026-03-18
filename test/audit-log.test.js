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

// (a) Diagnostic breadcrumb variables are declared
test("audit log: diagnostic breadcrumb variables are declared", () => {
  assert.match(src, /let lastGatewayError\s*=\s*null/);
  assert.match(src, /let lastGatewayExit\s*=\s*null/);
  assert.match(src, /let lastDoctorOutput\s*=\s*null/);
  assert.match(src, /let lastDoctorAt\s*=\s*null/);
});

// (b) Gateway exit handler records code, signal, and ISO timestamp
test("audit log: gateway exit handler records structured breadcrumb", () => {
  const window = routeWindow('gatewayProc.on("exit"', 300);
  assert.match(window, /lastGatewayExit\s*=/);
  assert.match(window, /code/);
  assert.match(window, /signal/);
  assert.match(window, /toISOString\(\)/);
});

// (c) Gateway spawn error sets lastGatewayError
test("audit log: gateway spawn error records lastGatewayError", () => {
  const window = routeWindow('gatewayProc.on("error"', 300);
  assert.match(window, /lastGatewayError\s*=/);
});

// (d) /healthz exposes breadcrumbs (lastError, lastExit, lastDoctorAt)
test("audit log: /healthz exposes gateway breadcrumbs", () => {
  const window = routeWindow('app.get("/healthz"', 800);
  assert.match(window, /lastError:\s*lastGatewayError/);
  assert.match(window, /lastExit:\s*lastGatewayExit/);
  assert.match(window, /lastDoctorAt/);
});

// (e) /setup/api/debug exposes full diagnostic breadcrumbs
test("audit log: /setup/api/debug exposes full diagnostic info", () => {
  const window = routeWindow('app.get("/setup/api/debug"', 2000);
  assert.match(window, /lastGatewayError/);
  assert.match(window, /lastGatewayExit/);
  assert.match(window, /lastDoctorAt/);
  assert.match(window, /lastDoctorOutput/);
});

// (f) runDoctorBestEffort is rate-limited to avoid crash-loop spam
test("audit log: runDoctorBestEffort is rate-limited (5 min cooldown)", () => {
  const window = routeWindow("async function runDoctorBestEffort", 400);
  assert.match(window, /5\s*\*\s*60\s*\*\s*1000/);
  assert.match(window, /lastDoctorAt/);
});

// (g) Doctor output is redacted and truncated
test("audit log: doctor output is redacted and truncated to 50KB", () => {
  const window = routeWindow("async function runDoctorBestEffort", 400);
  assert.match(window, /redactSecrets/);
  assert.match(window, /50[_,]?000/);
});

// (h) ensureGatewayRunning calls runDoctorBestEffort on failure
test("audit log: ensureGatewayRunning collects diagnostics on failure", () => {
  const window = routeWindow("async function ensureGatewayRunning", 800);
  assert.match(window, /runDoctorBestEffort/);
});
