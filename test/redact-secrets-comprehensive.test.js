import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(
  new URL("../src/server.js", import.meta.url),
  "utf8",
);

function getRedactor() {
  const m = src.match(/function redactSecrets\(text\) \{([\s\S]*?)\n\}/);
  assert.ok(m, "redactSecrets not found");
  // eslint-disable-next-line no-new-func
  return new Function("return function redactSecrets(text){" + m[1] + "\n}")();
}

test("redactSecrets: redacts OpenAI API keys", () => {
  const redact = getRedactor();
  const s = "key: sk-1234567890abcdefghij";
  assert.ok(!redact(s).includes("sk-1234567890"));
  assert.match(redact(s), /\[REDACTED\]/);
});

test("redactSecrets: redacts GitHub tokens (gho_)", () => {
  const redact = getRedactor();
  const s = "token: gho_abcdef1234567890xyz";
  assert.ok(!redact(s).includes("gho_abcdef"));
  assert.match(redact(s), /\[REDACTED\]/);
});

test("redactSecrets: redacts Slack tokens (xoxb-)", () => {
  const redact = getRedactor();
  const s = "SLACK_TOKEN=xoxb-12345678901-abcdefghij";
  assert.ok(!redact(s).includes("xoxb-12345"));
  assert.match(redact(s), /\[REDACTED\]/);
});

test("redactSecrets: redacts Discord tokens (AA prefix)", () => {
  const redact = getRedactor();
  const s = "DISCORD=AAabcdefghijklm:nopqrstuvwxyz1234";
  assert.ok(!redact(s).includes("AAabcdef"));
  assert.match(redact(s), /\[REDACTED\]/);
});

test("redactSecrets: preserves non-secret text", () => {
  const redact = getRedactor();
  const s = "Hello world, nothing secret here";
  assert.strictEqual(redact(s), s);
});

test("redactSecrets: handles null/undefined gracefully", () => {
  const redact = getRedactor();
  assert.strictEqual(redact(null), null);
  assert.strictEqual(redact(undefined), undefined);
  assert.strictEqual(redact(""), "");
});

test("redactSecrets: redacts multiple secrets in one string", () => {
  const redact = getRedactor();
  const s =
    "openai=sk-1234567890abcdefghij telegram=123456789:AAABBBcccDDD_eee-FFF";
  const out = redact(s);
  assert.ok(!out.includes("sk-1234567890"));
  assert.ok(!out.includes("123456789:"));
});

// Verify redactSecrets is called on all sensitive output paths
test("redactSecrets: is applied to console command outputs", () => {
  // Every console command that returns output should redact
  const consoleWindow = src.slice(
    src.indexOf('app.post("/setup/api/console/run"'),
    src.indexOf('app.post("/setup/api/console/run"') + 5000,
  );
  // Count occurrences of redactSecrets in the console handler
  const matches = consoleWindow.match(/redactSecrets/g) || [];
  assert.ok(
    matches.length >= 5,
    `expected >=5 redactSecrets calls in console handler, got ${matches.length}`,
  );
});
