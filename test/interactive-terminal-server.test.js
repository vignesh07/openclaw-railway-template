import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("wrapper exposes vibetunnel through a dedicated proxied route instead of setup terminal session routes", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

  assert.match(src, /const VIBETUNNEL_BASE_PATH = "\/vibetunnel"/);
  assert.match(src, /app\.use\(VIBETUNNEL_BASE_PATH, requireSetupAuth/);
  assert.match(src, /vibetunnelProxy\.web\(req, res, \{ target: VIBETUNNEL_TARGET \}\)/);
  assert.doesNotMatch(src, /app\.post\("\/setup\/api\/terminal\/session"/);
  assert.doesNotMatch(src, /app\.get\("\/setup\/api\/terminal\/session\/:sessionId"/);
  assert.doesNotMatch(src, /app\.post\("\/setup\/api\/terminal\/session\/:sessionId\/input"/);
  assert.doesNotMatch(src, /app\.post\("\/setup\/api\/terminal\/session\/:sessionId\/terminate"/);
});

test("wrapper starts vibetunnel in loopback no-auth mode behind wrapper auth", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

  assert.match(src, /"--no-auth"/);
  assert.match(src, /attachVibeTunnelAccessCookie\(req, res\)/);
  assert.match(src, /delete req\.headers\["x-forwarded-for"\]/);
  assert.match(src, /changeOrigin: true/);
  assert.doesNotMatch(src, /x-vibetunnel-local/);
});

test("wrapper patches vibetunnel assets for the /vibetunnel mount and stops both processes on shutdown", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

  assert.match(src, /function buildVibeTunnelPatchedIndex\(/);
  assert.match(src, /function buildVibeTunnelPatchedClientBundle\(/);
  assert.match(src, /sendPatchedVibeTunnelIndex\(res\)/);
  assert.match(src, /sendPatchedVibeTunnelBundle\(res\)/);
  assert.match(src, /async function stopGateway\(/);
  assert.match(src, /async function stopVibeTunnel\(/);
  assert.match(src, /Promise\.allSettled\(\[stopGateway\(\), stopVibeTunnel\(\)\]\)/);
});
