import childProcess from 'node:child_process';

// config.apply is dangerous for partial objects and stays explicit full-replacement only.
// config.patch is the default path for normal policy and config changes.
// Native OpenClaw RPC semantics own rate limiting and restart coalescing; the wrapper should not re-invent them.

function defaultRunCmd(cmd, args) {
  return new Promise((resolve) => {
    const proc = childProcess.spawn(cmd, args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    proc.stdout?.on('data', (chunk) => {
      output += chunk.toString('utf8');
    });
    proc.stderr?.on('data', (chunk) => {
      output += chunk.toString('utf8');
    });
    proc.on('error', (error) => {
      resolve({ code: 127, output: `${output}\n${String(error)}` });
    });
    proc.on('close', (code) => {
      resolve({ code: code ?? 0, output });
    });
  });
}

function resolveRunCmd(options = {}) {
  return options.runCmd ?? defaultRunCmd;
}

function resolveOpenClawInvocation(args, options = {}) {
  const cmd = options.openclawNode ?? 'openclaw';
  const resolvedArgs = typeof options.clawArgs === 'function' ? options.clawArgs(args) : args;
  return { cmd, args: resolvedArgs };
}

function parseJsonOutput(output) {
  const trimmed = String(output || '').trim();
  if (!trimmed) {
    throw new Error('Command returned empty output');
  }

  const attempts = [trimmed];
  const lines = trimmed.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    attempts.push(lines.slice(index).join('\n'));
  }

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next
    }
  }

  throw new Error(`Unable to parse JSON output: ${trimmed}`);
}

function normalizeGatewayResult(parsed) {
  return parsed?.payload ?? parsed?.result ?? parsed;
}

function parseRetryAfterMs(message) {
  const explicit = message.match(/retryAfterMs[=: ]+(\d+)/i);
  if (explicit) return Number.parseInt(explicit[1], 10);
  const seconds = message.match(/retry after (\d+)s/i);
  if (seconds) return Number.parseInt(seconds[1], 10) * 1000;
  return undefined;
}

function buildMutationError(output) {
  const message = String(output || 'Gateway call failed').trim();
  const error = new Error(message);
  const retryAfterMs = parseRetryAfterMs(message);
  if (retryAfterMs !== undefined) {
    error.retryAfterMs = retryAfterMs;
  }
  return error;
}

function shouldApproveLocalPairing(result) {
  return result.code !== 0 && /pairing required/i.test(String(result.output || ''));
}

async function runGatewayJsonCommand(args, options = {}) {
  const runCmd = resolveRunCmd(options);
  const invocation = resolveOpenClawInvocation(args, options);
  let result = await runCmd(invocation.cmd, invocation.args);
  if (shouldApproveLocalPairing(result)) {
    const approveInvocation = resolveOpenClawInvocation(['devices', 'approve', '--latest', '--json'], options);
    const approveResult = await runCmd(approveInvocation.cmd, approveInvocation.args);
    if (approveResult.code === 0) {
      result = await runCmd(invocation.cmd, invocation.args);
    }
  }
  if (result.code !== 0) {
    throw buildMutationError(result.output);
  }
  return normalizeGatewayResult(parseJsonOutput(result.output));
}

function buildGatewayCallArgs(method, params) {
  return ['gateway', 'call', method, '--params', JSON.stringify(params ?? {}), '--json'];
}

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

export async function fetchCurrentConfigState(options = {}) {
  return await runGatewayJsonCommand(buildGatewayCallArgs('config.get', {}), options);
}

export async function runConfigMutation({ change, note, sessionKey, restartDelayMs }, options = {}) {
  // transport: CLI subprocess
  // commands: `openclaw gateway call config.patch` or `openclaw gateway call config.apply`
  // 1. call native `config.get` and require a readable config hash when config exists
  // 2. capture `payload.hash` as baseHash
  // 3. use `config.patch` for partial updates and `config.apply` only for intentional full replacement
  // 4. always pass `raw`, `baseHash`, `note`, `sessionKey`, and `restartDelayMs`
  // 5. handle control-plane write RPC rate limits (3 requests / 60s) and surface `retryAfterMs`
  // 6. surface base-hash mismatch or RPC-unavailable errors clearly
  // 7. do not assume every config write triggers a restart; `gateway.reload` and `gateway.remote` are documented exceptions
  const effectiveChange = change?.baseHash
    ? change
    : {
        ...change,
        baseHash: (await fetchCurrentConfigState(options)).hash,
      };
  const request = buildMutationRequest({
    ...effectiveChange,
    sessionKey,
    note,
    restartDelayMs,
  });
  return await runGatewayJsonCommand(buildGatewayCallArgs(request.method, request.params), options);
}
