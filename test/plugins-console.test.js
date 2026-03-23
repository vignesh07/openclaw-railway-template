import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("server no longer exposes the legacy debug console command allowlist", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /openclaw\.plugins\.list/);
  assert.doesNotMatch(src, /openclaw\.plugins\.enable/);
  assert.doesNotMatch(src, /app\.post\("\/setup\/api\/console\/run"/);
});
