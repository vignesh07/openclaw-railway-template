import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("setup dashboard embeds vibetunnel and removes the old command runner controls", () => {
  const src = fs.readFileSync(new URL("../components/setup/setup-dashboard.jsx", import.meta.url), "utf8");

  assert.match(src, /src="\/vibetunnel"/);
  assert.match(src, /Open full screen/);
  assert.match(src, /full VibeTunnel remote terminal/);
  assert.doesNotMatch(src, /"\/setup\/api\/terminal/);
  assert.doesNotMatch(src, /Send input/);
  assert.doesNotMatch(src, /Send EOF/);
  assert.doesNotMatch(src, /Stop command/);
});

test("setup dashboard places status cards above the remote terminal surface", () => {
  const src = fs.readFileSync(new URL("../components/setup/setup-dashboard.jsx", import.meta.url), "utf8");

  assert.match(src, /<div className="grid gap-4 sm:grid-cols-2">/);
  assert.ok(src.indexOf("<CardTitle>Wrapper status</CardTitle>") < src.indexOf('<CardTitle className="text-lg">Remote terminal</CardTitle>'));
  assert.ok(src.indexOf("<CardTitle>App info</CardTitle>") < src.indexOf('<CardTitle className="text-lg">Remote terminal</CardTitle>'));
});
