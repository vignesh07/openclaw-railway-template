import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("interactive setup terminal exposes session lifecycle routes behind setup auth", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

  assert.match(src, /app\.post\("\/setup\/api\/terminal\/session", requireSetupAuth/);
  assert.match(src, /app\.get\("\/setup\/api\/terminal\/session\/:sessionId", requireSetupAuth/);
  assert.match(src, /app\.post\("\/setup\/api\/terminal\/session\/:sessionId\/input", requireSetupAuth/);
  assert.match(src, /app\.post\("\/setup\/api\/terminal\/session\/:sessionId\/terminate", requireSetupAuth/);
});

test("interactive setup terminal stays limited to openclaw and gateway commands and accepts blank stdin lines", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

  assert.match(src, /Command not allowed in setup terminal\. Use a setup-safe OpenClaw command/);
  assert.match(src, /Object\.prototype\.hasOwnProperty\.call\(req\.body \|\| \{\}, "input"\)/);
  assert.match(src, /session\.proc\.stdin\.write\(addNewline \? `\$\{input\}\\n` : input, "utf8"\)/);
});

test("interactive setup terminal refreshes session liveness and waits for gateway shutdown", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

  assert.match(src, /lastAccessedAt: createdAt/);
  assert.match(src, /touchTerminalSession\(session\)/);
  assert.match(src, /session\.status === "running" \|\| session\.status === "starting" \|\| session\.status === "terminating"/);
  assert.match(src, /async function stopGateway\(/);
  assert.match(src, /await stopGateway\(\)/);
});
