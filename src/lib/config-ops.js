// config.apply is dangerous for partial objects and stays explicit full-replacement only.
// config.patch is the default path for normal policy and config changes.
// Native OpenClaw RPC semantics own rate limiting and restart coalescing; the wrapper should not re-invent them.

export function pickConfigOperation(change) {
  return change?.type === 'full' ? 'config.apply' : 'config.patch';
}

export function buildMutationRequest(change) {
  const method = pickConfigOperation(change);
  return {
    method,
    params: {
      raw: change.raw,
      baseHash: change.baseHash,
      sessionKey: change.sessionKey,
      note: change.note,
      restartDelayMs: change.restartDelayMs ?? 2000,
    },
  };
}

export async function fetchCurrentConfigState() {
  // transport: CLI subprocess
  // command: `openclaw gateway call config.get --params "{}"`
  // return current payload + hash
  throw new Error('Not implemented yet');
}

export async function runConfigMutation({ change, note, sessionKey, restartDelayMs }) {
  // transport: CLI subprocess
  // commands: `openclaw gateway call config.patch` or `openclaw gateway call config.apply`
  // 1. call native `config.get` and require a readable config hash when config exists
  // 2. capture `payload.hash` as baseHash
  // 3. use `config.patch` for partial updates and `config.apply` only for intentional full replacement
  // 4. always pass `raw`, `baseHash`, `note`, `sessionKey`, and `restartDelayMs`
  // 5. handle control-plane write RPC rate limits (3 requests / 60s) and surface `retryAfterMs`
  // 6. surface base-hash mismatch or RPC-unavailable errors clearly
  // 7. do not assume every config write triggers a restart; `gateway.reload` and `gateway.remote` are documented exceptions
  throw new Error('Not implemented yet');
}
