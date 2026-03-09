import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
const applyRouteSrc = fs.readFileSync(new URL("../src/lib/config-apply-route.js", import.meta.url), "utf8");

function routeWindow(marker, length = 900) {
  const idx = src.indexOf(marker);
  assert.ok(idx >= 0, `missing marker: ${marker}`);
  return src.slice(idx, idx + length);
}

function helperWindow(marker, length = 240) {
  const idx = src.indexOf(marker);
  assert.ok(idx >= 0, `missing helper: ${marker}`);
  return src.slice(idx, idx + length);
}

test("setup raw config writes are disabled with a guarded apply message", () => {
  const helper = helperWindow("function respondGone");
  const window = routeWindow('app.post("/setup/api/config/raw"');
  assert.match(helper, /status\(410\)/);
  assert.match(applyRouteSrc, /function createRawConfigWriteDisabledHandler/);
  assert.match(applyRouteSrc, /Raw config writes disabled\. Use \/setup\/api\/config\/apply\./);
  assert.match(applyRouteSrc, /code:\s*["']GONE["']/);
  assert.match(window, /createRawConfigWriteDisabledHandler\(\)/);
});

test("setup import and reset destructive routes are disabled", () => {
  const importWindow = routeWindow('app.post("/setup/import"');
  const resetWindow = routeWindow('app.post("/setup/api/reset"');
  assert.match(importWindow, /respondGone\(/);
  assert.match(resetWindow, /respondGone\(/);
});

test("setup console blocks gateway lifecycle commands during buildout", () => {
  const window = routeWindow('app.post("/setup/api/console/run"', 1400);
  assert.match(src, /const DISABLED_SETUP_CONSOLE_COMMANDS = new Set\(\[/);
  assert.match(src, /"gateway\.restart"/);
  assert.match(src, /"gateway\.stop"/);
  assert.match(src, /"gateway\.start"/);
  assert.match(window, /respondGone\(/);
});
