import test from "node:test";
import assert from "node:assert/strict";
import {
  WorkerResultStatus,
  buildWorkerResult,
  isWorkerResult,
} from "../src/lib/worker-result.js";

test("WorkerResultStatus is frozen with expected keys", () => {
  assert.equal(WorkerResultStatus.SUCCESS, "success");
  assert.equal(WorkerResultStatus.TIMEOUT, "timeout");
  assert.equal(WorkerResultStatus.DEPTH_EXCEEDED, "depth_exceeded");
  assert.equal(WorkerResultStatus.TOOL_DENIED, "tool_denied");
  assert.equal(WorkerResultStatus.ERROR, "error");
  assert.throws(() => {
    WorkerResultStatus.NEW_KEY = "x";
  });
});

test("buildWorkerResult SUCCESS sets ok=true and includes payload", () => {
  const result = buildWorkerResult(
    WorkerResultStatus.SUCCESS,
    { data: "ok" },
    { workerId: "w1" },
  );
  assert.equal(result.ok, true);
  assert.equal(result.status, "success");
  assert.deepEqual(result.payload, { data: "ok" });
  assert.deepEqual(result.errors, []);
  assert.equal(result.meta.workerId, "w1");
});

test("buildWorkerResult TIMEOUT sets ok=false and nulls payload", () => {
  const result = buildWorkerResult(WorkerResultStatus.TIMEOUT, {
    data: "ignored",
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, "timeout");
  assert.equal(result.payload, null);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /timeout/);
});

test("buildWorkerResult DEPTH_EXCEEDED sets ok=false", () => {
  const result = buildWorkerResult(WorkerResultStatus.DEPTH_EXCEEDED);
  assert.equal(result.ok, false);
  assert.equal(result.status, "depth_exceeded");
  assert.equal(result.payload, null);
  assert.equal(result.errors.length, 1);
});

test("buildWorkerResult TOOL_DENIED sets ok=false", () => {
  const result = buildWorkerResult(WorkerResultStatus.TOOL_DENIED);
  assert.equal(result.ok, false);
  assert.equal(result.status, "tool_denied");
});

test("buildWorkerResult ERROR sets ok=false", () => {
  const result = buildWorkerResult(WorkerResultStatus.ERROR);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
});

test("buildWorkerResult uses empty meta when meta is not an object", () => {
  const result = buildWorkerResult(
    WorkerResultStatus.SUCCESS,
    null,
    "bad-meta",
  );
  assert.deepEqual(result.meta, {});
});

test("isWorkerResult validates envelope shape", () => {
  assert.equal(isWorkerResult(null), false);
  assert.equal(isWorkerResult({}), false);
  assert.equal(
    isWorkerResult({ ok: true, status: "success", errors: [] }),
    true,
  );
  assert.equal(
    isWorkerResult(buildWorkerResult(WorkerResultStatus.SUCCESS, "x")),
    true,
  );
  assert.equal(
    isWorkerResult(buildWorkerResult(WorkerResultStatus.TIMEOUT)),
    true,
  );
});

test("isWorkerResult rejects primitives and missing fields", () => {
  assert.equal(isWorkerResult("string"), false);
  assert.equal(isWorkerResult(42), false);
  assert.equal(isWorkerResult({ ok: true, status: "success" }), false); // missing errors
});
