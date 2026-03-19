// Generic gate input for safe-apply decisions.
// Uses a native OpenClaw interface seam instead of wrapper-local heuristics.
// Must stay reusable across customers and deployments.

// M3 delegation safety bounds. Keep these conservative — bounded leaf workers only.
const MAX_WORKER_DEPTH = 1;
const MAX_WORKER_TIMEOUT_SECONDS = 600;

/**
 * Validate a spawn request before launching a subagent worker.
 * Enforces M3 safety bounds: depth limit, tool whitelist, timeout bounds.
 *
 * @param {object} request
 * @param {number} [request.depth] - Delegation depth. Must be 0 for top-level workers.
 * @param {string[]} [request.tools] - Tools requested by the worker.
 * @param {string[]} [request.toolAllowlist] - Allowed tools for this spawn context.
 * @param {number} [request.timeoutSeconds] - Worker timeout. Must be > 0 and ≤ 600.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateSpawnRequest({
  depth = 0,
  tools = [],
  toolAllowlist = [],
  timeoutSeconds,
} = {}) {
  const errors = [];

  if (depth > MAX_WORKER_DEPTH) {
    errors.push(
      `Worker depth ${depth} exceeds maximum allowed depth ${MAX_WORKER_DEPTH}`,
    );
  }

  if (timeoutSeconds === undefined || timeoutSeconds === null) {
    errors.push("timeoutSeconds is required for spawn validation");
  } else if (typeof timeoutSeconds !== "number" || timeoutSeconds <= 0) {
    errors.push("timeoutSeconds must be a positive number");
  } else if (timeoutSeconds > MAX_WORKER_TIMEOUT_SECONDS) {
    errors.push(
      `timeoutSeconds ${timeoutSeconds} exceeds maximum ${MAX_WORKER_TIMEOUT_SECONDS}`,
    );
  }

  if (toolAllowlist.length > 0) {
    for (const tool of tools) {
      if (!toolAllowlist.includes(tool)) {
        errors.push(`Tool not in allowlist: ${tool}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function summarizeWorkerActivity(workerSessions) {
  const sessions = Array.isArray(workerSessions) ? workerSessions : [];
  return {
    count: sessions.length,
    blocked: sessions.length > 0,
    sessions,
    sessionKeys: sessions.map((session) => session.sessionKey).filter(Boolean),
  };
}

export function buildWorkerActivityRequest({
  sessionKey = "main",
  activeMinutes = 5,
} = {}) {
  return {
    path: "/tools/invoke",
    body: {
      tool: "sessions_list",
      action: "json",
      args: { kinds: ["subagent"], activeMinutes, messageLimit: 0 },
      sessionKey,
    },
  };
}

export async function listActiveWorkerSessions() {
  // preferred v1 implementation source:
  // POST /tools/invoke with bearer auth using the local gateway token
  // token source: OPENCLAW_GATEWAY_TOKEN (or the wrapper's resolved gateway token path/value)
  // body: { tool: 'sessions_list', action: 'json', args: { kinds: ['subagent'], activeMinutes: 5, messageLimit: 0 }, sessionKey: 'main' }
  // expect response: { ok: true, result }
  // normalize result into [{ kind, sessionKey }]
  const options = arguments[0] || {};
  const gatewayTarget = options.gatewayTarget ?? "http://127.0.0.1:18789";
  const gatewayToken =
    options.gatewayToken ?? process.env.OPENCLAW_GATEWAY_TOKEN;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!gatewayToken) {
    throw new Error(
      "OPENCLAW_GATEWAY_TOKEN is required for worker activity checks",
    );
  }
  const request = buildWorkerActivityRequest({
    sessionKey: options.sessionKey ?? "main",
    activeMinutes: options.activeMinutes ?? 5,
  });
  const response = await fetchImpl(gatewayTarget + request.path, {
    method: "POST",
    headers: {
      authorization: `Bearer ${gatewayToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(request.body),
  });
  const body = typeof response.json === "function" ? await response.json() : {};
  if (!response.ok || body?.ok === false) {
    throw new Error(
      body?.error?.message ||
        body?.error ||
        `Worker activity request failed: ${response.status}`,
    );
  }
  const payload = body?.result ?? body?.payload ?? body;
  const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
  return sessions
    .filter((session) => session?.kind === "subagent")
    .map((session) => ({
      kind: session.kind,
      sessionKey: String(session.sessionKey ?? session.key ?? "").trim(),
    }))
    .filter((session) => session.sessionKey);
}
