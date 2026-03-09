// In-process wrapper request gate for a single-replica deployment.
// Native OpenClaw still owns restart coalescing and write RPC rate limiting.
// Crash recovery relies on process restart clearing the in-memory lock.

export function createApplyMutex({ maxLockMs = 90000 } = {}) {
  let locked = false;
  let lockedAt = 0;
  return {
    async acquire() {
      if (locked && Date.now() - lockedAt < maxLockMs) {
        throw new Error('apply already in progress');
      }
      locked = true;
      lockedAt = Date.now();
      return () => {
        locked = false;
        lockedAt = 0;
      };
    },
  };
}
