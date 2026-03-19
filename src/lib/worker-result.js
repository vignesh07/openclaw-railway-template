// Typed result envelope for M3 delegation workers.
// Workers announce results back to the orchestrator using this contract.
// The envelope enforces: status, payload, timing, and announce-back discipline.
// No external dependencies — pure data module.

export const WorkerResultStatus = Object.freeze({
  COMPLETE: "complete",
  TIMED_OUT: "timed_out",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

/**
 * Create a typed worker result envelope.
 * @param {string} status - One of WorkerResultStatus values.
 * @param {*} payload - The result payload (tool output, briefing bundle, etc.)
 * @param {object} [meta] - Optional metadata: durationMs, workerSessionKey, toolsUsed.
 * @returns {{ status, payload, meta, createdAt }}
 */
export function createWorkerResult(status, payload = null, meta = {}) {
  if (!Object.values(WorkerResultStatus).includes(status)) {
    throw new Error(`Invalid worker result status: ${status}`);
  }
  return {
    status,
    payload,
    meta: {
      durationMs: meta.durationMs ?? null,
      workerSessionKey: meta.workerSessionKey ?? null,
      toolsUsed: Array.isArray(meta.toolsUsed) ? [...meta.toolsUsed] : [],
      ...meta,
    },
    createdAt: meta.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Returns true if the result indicates the worker timed out.
 * @param {{ status: string }} result
 */
export function isTimedOut(result) {
  return result?.status === WorkerResultStatus.TIMED_OUT;
}

/**
 * Returns true if the result is a successful completion (not error/timeout).
 * @param {{ status: string }} result
 */
export function isComplete(result) {
  return result?.status === WorkerResultStatus.COMPLETE;
}

/**
 * Returns true if the result indicates the worker failed.
 * @param {{ status: string }} result
 */
export function isFailed(result) {
  return result?.status === WorkerResultStatus.FAILED;
}
