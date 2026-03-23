import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("server routes setup UI through Next under the existing auth gate", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(src, /import next from "next"/);
  assert.match(src, /app\.use\(async \(req, res, nextMiddleware\) => \{/);
  assert.match(src, /req\.path === "\/setup" \|\| req\.path\.startsWith\("\/setup\/"\)/);
  assert.match(src, /return requireSetupAuth\(req, res, async \(\) => \{/);
  assert.match(src, /await nextHandler\(req, res\)/);
});

test("server mounts vibetunnel separately from the setup app", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(src, /const VIBETUNNEL_BASE_PATH = "\/vibetunnel"/);
  assert.match(src, /app\.use\(VIBETUNNEL_BASE_PATH, requireSetupAuth/);
  assert.match(src, /attachVibeTunnelAccessCookie\(req, res\)/);
  assert.doesNotMatch(src, /app\.get\("\/setup\/api\/terminal"/);
});
