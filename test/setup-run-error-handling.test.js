import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("setup run catch path returns JSON directly", () => {
  const src = fs.readFileSync(
    new URL("../src/server.js", import.meta.url),
    "utf8",
  );
  const idx = src.indexOf('app.post("/setup/api/run"');
  assert.ok(idx >= 0);
  const window = src.slice(idx, idx + 11000);
  assert.match(window, /\[\/setup\/api\/run\] error:/);
  // Allow for Prettier splitting res.status(500).json( across lines.
  assert.ok(
    /res\.status\(500\)\.json\(/.test(window) ||
      /res\s*\n\s*\.status\(500\)[\s\S]{0,20}\.json\(/.test(window),
    "catch block must send status 500 as JSON",
  );
  assert.doesNotMatch(window, /return respondJson\(500,/);
});
