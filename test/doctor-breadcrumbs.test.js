import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("debug JSON includes lastDoctor fields", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(src, /lastDoctorOutput/);
  assert.match(src, /lastDoctorAt/);
});
