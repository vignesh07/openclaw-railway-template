import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("setup writes gateway.trustedProxies", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(src, /gateway\.trustedProxies/);
});
