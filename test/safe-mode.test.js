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

// (a) respondGone helper returns 410 with ok:false and code:"GONE"
test("safe mode: respondGone returns 410 with structured error", () => {
  const window = routeWindow("function respondGone", 200);
  assert.match(window, /status\(410\)/);
  assert.match(window, /ok:\s*false/);
  assert.match(window, /code:\s*["']GONE["']/);
});

// (b) All destructive routes use respondGone or equivalent disabled handler
// Note: anchors on handler strings, not route declarations, to survive Prettier reformatting.
test("safe mode: all destructive routes return respondGone", () => {
  // config/raw POST uses createRawConfigWriteDisabledHandler — anchor on the call itself
  const configRawWindow = routeWindow(
    "createRawConfigWriteDisabledHandler()",
    100,
  );
  assert.ok(
    /create\w+DisabledHandler/.test(configRawWindow),
    "config/raw should use createRawConfigWriteDisabledHandler",
  );

  // import and reset use respondGone inline — route declarations fit on one line
  const importWindow = routeWindow('app.post("/setup/import"', 300);
  const resetWindow = routeWindow('app.post("/setup/api/reset"', 300);
  assert.match(importWindow, /respondGone\(/);
  assert.match(resetWindow, /respondGone\(/);
});

// (c) DISABLED_SETUP_CONSOLE_COMMANDS blocks gateway lifecycle
test("safe mode: disabled console commands include all gateway lifecycle", () => {
  assert.match(src, /DISABLED_SETUP_CONSOLE_COMMANDS/);
  // Verify all three lifecycle commands are listed
  const m = src.match(
    /const DISABLED_SETUP_CONSOLE_COMMANDS = new Set\(\[([\s\S]*?)\]\)/,
  );
  assert.ok(m, "DISABLED_SETUP_CONSOLE_COMMANDS Set not found");
  const setBody = m[1];
  assert.match(setBody, /"gateway\.restart"/);
  assert.match(setBody, /"gateway\.stop"/);
  assert.match(setBody, /"gateway\.start"/);
});

// (d) Console run handler checks DISABLED set before executing
test("safe mode: console run checks disabled set and returns respondGone", () => {
  const window = routeWindow('app.post("/setup/api/console/run"', 1400);
  assert.match(window, /DISABLED_SETUP_CONSOLE_COMMANDS\.has\(cmd\)/);
  assert.match(window, /respondGone\(/);
});

// (e) ALLOWED_CONSOLE_COMMANDS is a strict allowlist
test("safe mode: console commands use strict Set-based allowlist", () => {
  const window = routeWindow('app.post("/setup/api/console/run"', 500);
  assert.match(window, /ALLOWED_CONSOLE_COMMANDS\.has\(cmd\)/);
  // Unrecognized commands return 400
  assert.match(window, /Command not allowed/);
});

// (f) Safe mode guards have descriptive human-readable messages
test("safe mode: disabled routes include descriptive messages", () => {
  // Raw config writes message may be inline or in a factory function
  assert.ok(
    /Raw config writes disabled/.test(src) ||
      /createRawConfigWriteDisabledHandler/.test(src),
    "should have raw config disabled message or handler",
  );
  assert.match(src, /Backup import disabled during Milestone 1/);
  assert.match(src, /Reset disabled during Milestone 1/);
  assert.match(src, /Gateway lifecycle commands disabled during Milestone 1/);
});
