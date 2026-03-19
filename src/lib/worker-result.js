// Typed result envelope for M3 delegation workers.
// Workers announce results back to the orchestrator using this contract.
// The envelope enforces: status, payload, timing, and announce-back discipline.
// No external dependencies — pure data module.

export const WorkerResultStatus = Object.freeze({
  COMPLETE: "complete",
  FAILED: "failed",
  TIMED_OUT: "timed_out",
});

/**
 * Create a typed worker result envelope.
 * @param {object} params
 * @param {string} params.status - WorkerResultStatus value
 * @param {unknown} [params.payload] - result payload (structured output from worker)
 * @param {object} [params.meta] - timing and session metadata
 * @param {number} [params.meta.durationMs] - wall-clock duration of the worker session
 * @param {string} [params.meta.sessionKey] - session key of the worker that produced this result
 * @param {string[]} [params.meta.toolsUsed] - tools the worker invoked
 */
export function createWorkerResult({ status, payload = null, meta = {} }) {
  const validStatuses = Object.values(WorkerResultStatus);
  if (!validStatuses.includes(status)) {
    throw new Error(
      `Invalid WorkerResultStatus: ${status}. Expected one of: ${validStatuses.join(", ")}`,
    );
  }
  return Object.freeze({
    status,
    payload,
    meta: Object.freeze({
      durationMs: typeof meta.durationMs === "number" ? meta.durationMs : null,
      sessionKey: typeof meta.sessionKey === "string" ? meta.sessionKey : null,
      toolsUsed: Array.isArray(meta.toolsUsed) ? [...meta.toolsUsed] : [],
    }),
  });
}

/** Returns true if the worker result indicates a timeout. */
export function isTimedOut(result) {
  return result?.status === WorkerResultStatus.TIMED_OUT;
}

/** Returns true if the worker result indicates successful completion. */
export function isComplete(result) {
  return result?.status === WorkerResultStatus.COMPLETE;
}

/** Returns true if the worker result indicates a failure. */
export function isFailed(result) {
  return result?.status === WorkerResultStatus.FAILED;
}
