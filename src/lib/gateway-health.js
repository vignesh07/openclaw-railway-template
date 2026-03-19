import { fetchCurrentConfigState } from "./config-ops.js";

function parseJsonOutput(output) {
  const trimmed = String(output || "").trim();
  if (!trimmed) {
    throw new Error("Command returned empty output");
  }
  const attempts = [trimmed];
  const lines = trimmed.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    attempts.push(lines.slice(index).join("\n"));
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

async function defaultSleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function evaluateControlPlaneHealth({
  livenessOk,
  gatewayStatusOk,
  channelsReady,
  routingOk,
}) {
  return {
    ok: Boolean(livenessOk && gatewayStatusOk && channelsReady && routingOk),
    phases: {
      livenessOk,
      gatewayStatusOk,
      channelsReady,
      routingOk,
    },
  };
}

export async function getGatewayStatusProbe(options = {}) {
  // transport: CLI subprocess
  // command: `openclaw gateway status --json`
  // success criteria: runtime running + RPC probe ok
  // timeout budget: start with the documented 10s default
  const runCmd = options.runCmd;
  if (typeof runCmd !== "function") {
    throw new Error("runCmd is required");
  }
  const args =
    typeof options.clawArgs === "function"
      ? options.clawArgs(["gateway", "status", "--json"])
      : ["gateway", "status", "--json"];
  const cmd = options.openclawNode ?? "openclaw";
  const attempts = Math.max(1, options.attempts ?? 1);
  const delayMs = Math.max(0, options.delayMs ?? 0);
  const sleepImpl = options.sleepImpl ?? defaultSleep;
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await runCmd(cmd, args);
    try {
      const parsed = parseJsonOutput(result.output);
      const ok = Boolean(parsed?.ok ?? parsed?.rpc?.ok);
      if (ok || result.code === 0) {
        return {
          ok,
          raw: parsed,
        };
      }
      lastError = new Error(
        String(result.output || "gateway status failed").trim(),
      );
    } catch {
      lastError = new Error(
        String(result.output || "gateway status failed").trim(),
      );
    }
    if (attempt < attempts - 1) {
      await sleepImpl(delayMs);
    }
  }
  throw lastError;
}

export async function getChannelsProbe(options = {}) {
  // transport: CLI subprocess
  // command: `openclaw channels status --probe --json`
  // success criteria: required channels connected/ready
  // retry policy: 3 attempts with 5s interval within the approved post-restart window
  const runCmd = options.runCmd;
  if (typeof runCmd !== "function") {
    throw new Error("runCmd is required");
  }
  const args =
    typeof options.clawArgs === "function"
      ? options.clawArgs(["channels", "status", "--probe", "--json"])
      : ["channels", "status", "--probe", "--json"];
  const cmd = options.openclawNode ?? "openclaw";
  const requiredChannels = Array.isArray(options.requiredChannels)
    ? options.requiredChannels
    : [];
  const isHealthyAccount = (account) =>
    account &&
    account.enabled !== false &&
    account.configured !== false &&
    (account.connected === true ||
      account.running === true ||
      account.linked === true);
  const attempts = Math.max(1, options.attempts ?? 1);
  const delayMs = Math.max(0, options.delayMs ?? 0);
  const sleepImpl = options.sleepImpl ?? defaultSleep;
  let lastParsed = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await runCmd(cmd, args);
    if (result.code !== 0) {
      throw new Error(String(result.output || "channels status failed").trim());
    }
    const parsed = parseJsonOutput(result.output);
    lastParsed = parsed;
    const accountsByChannel =
      parsed?.channelAccounts && typeof parsed.channelAccounts === "object"
        ? parsed.channelAccounts
        : {};
    const ready =
      requiredChannels.length === 0
        ? Object.values(accountsByChannel)
            .flat()
            .some((account) => isHealthyAccount(account))
        : requiredChannels.every(
            (channel) =>
              Array.isArray(accountsByChannel[channel]) &&
              accountsByChannel[channel].some((account) =>
                isHealthyAccount(account),
              ),
          );
    if (ready || attempt === attempts - 1) {
      return {
        ok: true,
        ready,
        raw: parsed,
      };
    }
    await sleepImpl(delayMs);
  }
  return {
    ok: true,
    ready: false,
    raw: lastParsed,
  };
}

export async function getLiveConfigReadback(options = {}) {
  // transport: CLI subprocess
  // command: `openclaw gateway call config.get --params "{}"`
  // auth context: same local gateway token/context already controlled by the wrapper process
  return await fetchCurrentConfigState(options);
}

/**
 * Probe the ConnectOS health endpoint.
 * Gracefully degrades: if ConnectOS is down, returns ok:false with reason.
 * The morning briefing pipeline must tolerate ConnectOS unavailability.
 * @param {object} [options]
 * @param {string} [options.connectosTarget] - base URL for ConnectOS (e.g. 'http://connectos:3000')
 * @param {Function} [options.fetchImpl] - injectable fetch for testing
 * @param {number} [options.timeoutMs] - request timeout in ms (default 5000)
 * @returns {Promise<{ ok: boolean, status: number|null, reason: string|null }>}
 */
export async function getConnectOsHealthProbe(options = {}) {
  const connectosTarget =
    options.connectosTarget ??
    process.env.CONNECTOS_URL ??
    "http://connectos:3000";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 5000;
  const url = `${connectosTarget}/health`;
  try {
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
    let response;
    try {
      response = await fetchImpl(
        url,
        controller ? { signal: controller.signal } : {},
      );
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
    if (response.ok) {
      return { ok: true, status: response.status, reason: null };
    }
    return {
      ok: false,
      status: response.status,
      reason: `ConnectOS /health returned ${response.status}`,
    };
  } catch (err) {
    const reason =
      err?.name === "AbortError"
        ? `ConnectOS /health timed out after ${timeoutMs}ms`
        : `ConnectOS /health unreachable: ${String(err?.message ?? err)}`;
    return { ok: false, status: null, reason };
  }
}
