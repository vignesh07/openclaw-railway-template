import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("gateway ws upgrade still avoids Basic auth checks while vibetunnel ws requires wrapper-issued access", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  const idx = src.indexOf('server.on("upgrade"');
  assert.ok(idx >= 0);
  const window = src.slice(idx, idx + 1200);

  assert.doesNotMatch(window, /WebSocket password protection/);
  assert.doesNotMatch(window, /scheme === "Basic"/);
  assert.doesNotMatch(window, /WWW-Authenticate/);
  assert.match(window, /if \(!SETUP_PASSWORD \|\| !hasValidVibeTunnelAccess\(req\)\)/);
  assert.match(window, /HTTP\/1\.1 401 Unauthorized/);
});
