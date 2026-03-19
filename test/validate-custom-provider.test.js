import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(
  new URL("../src/server.js", import.meta.url),
  "utf8",
);

// Extract validateCustomProvider from source
function getValidator() {
  const m = src.match(
    /function validateCustomProvider\(payload\) \{([\s\S]*?)\n\}/,
  );
  assert.ok(m, "validateCustomProvider not found in server.js");
  // eslint-disable-next-line no-new-func
  return new Function(
    "return function validateCustomProvider(payload){" + m[1] + "\n}",
  )();
}

test("validateCustomProvider: valid input returns valid:true", () => {
  const validate = getValidator();
  const result = validate({
    customProviderId: "ollama",
    customProviderBaseUrl: "http://127.0.0.1:11434/v1",
    customProviderApi: "openai-completions",
    customProviderApiKeyEnv: "OLLAMA_KEY",
  });
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
});

test("validateCustomProvider: missing providerId or baseUrl returns invalid", () => {
  const validate = getValidator();
  const r1 = validate({});
  assert.strictEqual(r1.valid, false);
  assert.ok(r1.errors[0].includes("missing"));

  const r2 = validate({ customProviderId: "foo" });
  assert.strictEqual(r2.valid, false);
});

test("validateCustomProvider: rejects bad providerId", () => {
  const validate = getValidator();
  const result = validate({
    customProviderId: "foo bar!",
    customProviderBaseUrl: "http://localhost/v1",
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("provider id")));
});

test("validateCustomProvider: rejects non-http baseUrl", () => {
  const validate = getValidator();
  const result = validate({
    customProviderId: "foo",
    customProviderBaseUrl: "ftp://localhost/v1",
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("baseUrl")));
});

test("validateCustomProvider: rejects invalid api type", () => {
  const validate = getValidator();
  const result = validate({
    customProviderId: "foo",
    customProviderBaseUrl: "https://localhost/v1",
    customProviderApi: "invalid-api",
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("api must be")));
});

test("validateCustomProvider: rejects invalid env var name", () => {
  const validate = getValidator();
  const result = validate({
    customProviderId: "foo",
    customProviderBaseUrl: "https://localhost/v1",
    customProviderApiKeyEnv: "123BAD",
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("env var")));
});

test("validateCustomProvider: allows empty apiKeyEnv", () => {
  const validate = getValidator();
  const result = validate({
    customProviderId: "foo",
    customProviderBaseUrl: "https://localhost/v1",
    customProviderApiKeyEnv: "",
  });
  assert.strictEqual(result.valid, true);
});
