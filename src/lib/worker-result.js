// Typed result envelope for M3 delegation workers.
// Establishes announce-back discipline: workers always return a structured result,
// never raw strings or untyped objects. Timeout and error states are first-class.

export const WorkerResultStatus = Object.freeze({
  SUCCESS: "success",
  TIMEOUT: "timeout",
  DEPTH_EXCEEDED: "depth_exceeded",
  TOOL_DENIED: "tool_denied",
  ERROR: "error",
});

/**
 * Build a typed worker result envelope.
 * @param {string} status — one of WorkerResultStatus
 * @param {*} payload — the worker's output (null on failure)
 * @param {object} [meta] — optional metadata (workerId, durationMs, depth, etc.)
 * @returns {{ ok: boolean, status: string, payload: *, errors: string[], meta: object }}
 */
export function buildWorkerResult(status, payload = null, meta = {}) {
  const ok = status === WorkerResultStatus.SUCCESS;
  const errors = ok ? [] : [`Worker finished with status: ${status}`];
  return {
    ok,
    status,
    payload: ok ? payload : null,
    errors,
    meta: typeof meta === "object" && meta !== null ? meta : {},
  };
}

/**
 * Returns true if the result is a valid worker result envelope.
 */
export function isWorkerResult(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.ok === "boolean" &&
    typeof value.status === "string" &&
    Array.isArray(value.errors)
  );
}
