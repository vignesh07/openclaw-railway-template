import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("reset handler is disabled during Milestone 1 buildout", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  const idx = src.indexOf('app.post("/setup/api/reset"');
  assert.ok(idx >= 0);
  const window = src.slice(idx, idx + 320);
  assert.match(window, /respondGone\(/);
  assert.match(window, /Reset disabled during Milestone 1 buildout/);
});
