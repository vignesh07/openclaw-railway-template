import test from "node:test";
import assert from "node:assert/strict";

function extractDeviceRequestIds(text) {
  const s = String(text || "");
  const out = new Set();

  // Common patterns: requestId=XYZ, requestId: XYZ, "requestId":"XYZ".
  for (const m of s.matchAll(/requestId\s*(?:=|:)\s*([A-Za-z0-9_-]{6,})/g)) out.add(m[1]);
  for (const m of s.matchAll(/"requestId"\s*:\s*"([A-Za-z0-9_-]{6,})"/g)) out.add(m[1]);

  return Array.from(out);
}

test("extractDeviceRequestIds: finds requestId formats", () => {
  const sample = `pending:\n- requestId=abc123_DEF\n{"requestId":"REQ_456-xy"}\nrequestId: ZZZ999`;
  assert.deepEqual(extractDeviceRequestIds(sample).sort(), ["REQ_456-xy", "ZZZ999", "abc123_DEF"].sort());
});
