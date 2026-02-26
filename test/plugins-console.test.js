import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("debug console exposes plugins list/enable", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(src, /openclaw\.plugins\.list/);
  assert.match(src, /openclaw\.plugins\.enable/);
});
