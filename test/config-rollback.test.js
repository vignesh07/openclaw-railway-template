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

// (a) No dedicated rollback endpoint exists — reset returns 410
test("config rollback: reset endpoint returns 410 Gone", () => {
  const window = routeWindow('app.post("/setup/api/reset"');
  assert.match(window, /respondGone\(/);
  assert.match(window, /Reset disabled during Milestone 1/);
});

// (b) Import (restore from backup) is disabled with 410
test("config rollback: import endpoint returns 410 Gone", () => {
  const window = routeWindow('app.post("/setup/import"');
  assert.match(window, /respondGone\(/);
  assert.match(window, /Backup import disabled/);
});

// (c) Export endpoint exists and streams tar.gz
test("config rollback: export endpoint exists and sets gzip content-type", () => {
  const window = routeWindow('app.get("/setup/export"', 600);
  assert.match(window, /application\/gzip/);
  assert.match(window, /content-disposition/);
  assert.match(window, /openclaw-backup/);
});

// (d) Tar path safety validator rejects path traversal
test("config rollback: looksSafeTarPath rejects traversal and absolute paths", () => {
  // Extract the function and test it directly
  const m = src.match(/function looksSafeTarPath\(p\) \{([\s\S]*?)\n\}/);
  assert.ok(m, "looksSafeTarPath not found");
  // eslint-disable-next-line no-new-func
  const looksSafeTarPath = new Function(
    "return function looksSafeTarPath(p){" + m[1] + "\n}",
  )();

  assert.strictEqual(looksSafeTarPath("data/config.json"), true);
  assert.strictEqual(looksSafeTarPath(".openclaw/openclaw.json"), true);
  assert.strictEqual(looksSafeTarPath("/etc/passwd"), false);
  assert.strictEqual(looksSafeTarPath("../../etc/passwd"), false);
  assert.strictEqual(looksSafeTarPath("C:\\Windows\\System32"), false);
  assert.strictEqual(looksSafeTarPath(""), false);
  assert.strictEqual(looksSafeTarPath(null), false);
  assert.strictEqual(looksSafeTarPath(undefined), false);
});

// (e) Gateway restart function exists for config apply cycle
test("config rollback: restartGateway function exists with SIGTERM + ensureGatewayRunning", () => {
  const window = routeWindow("async function restartGateway", 400);
  assert.match(window, /SIGTERM/);
  assert.match(window, /ensureGatewayRunning/);
});
