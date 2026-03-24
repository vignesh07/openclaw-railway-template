import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("setup dashboard exposes a raw config editor backed by the config API", () => {
  const src = fs.readFileSync(new URL("../components/setup/setup-dashboard.jsx", import.meta.url), "utf8");

  assert.match(src, /readJson\("\/setup\/api\/config\/raw"\)/);
  assert.match(src, /fetch\("\/setup\/api\/config\/raw"/);
  assert.match(src, /Raw config editor/);
  assert.match(src, /Reload from disk/);
  assert.match(src, /Save config/);
  assert.match(src, /<textarea/);
});
