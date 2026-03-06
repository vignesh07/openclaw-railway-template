import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("ws upgrade handler does not enforce Basic auth (browsers can't send headers)", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  const idx = src.indexOf('server.on("upgrade"');
  assert.ok(idx >= 0);
  const window = src.slice(idx, idx + 700);

  // Regression guard for issue #162: do not destroy browser websocket connections
  // due to missing Authorization: Basic.
  assert.doesNotMatch(window, /WebSocket password protection/);
  assert.doesNotMatch(window, /scheme === "Basic"/);
  assert.doesNotMatch(window, /WWW-Authenticate/);
});
