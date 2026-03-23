import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("setup dashboard uses live terminal session endpoints and stdin controls", () => {
  const src = fs.readFileSync(new URL("../components/setup/setup-dashboard.jsx", import.meta.url), "utf8");

  assert.match(src, /"\/setup\/api\/terminal\/session"/);
  assert.match(src, /`\/setup\/api\/terminal\/session\/\$\{activeSessionId\}\/input`/);
  assert.match(src, /`\/setup\/api\/terminal\/session\/\$\{activeSessionId\}\/terminate`/);
  assert.match(src, /sessionRequestInFlightRef/);
  assert.match(src, /terminalCursorRef/);
  assert.match(src, /Send input/);
  assert.match(src, /Send EOF/);
  assert.match(src, /Stop command/);
});
