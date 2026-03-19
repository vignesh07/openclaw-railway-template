// Generic gate input for safe-apply decisions.
// Uses a native OpenClaw interface seam instead of wrapper-local heuristics.
// Must stay reusable across customers and deployments.

const MAX_SPAWN_DEPTH = 1;
const MAX_SPAWN_TIMEOUT_SEC = 300;

/**
 * Validate a proposed worker spawn request before execution.
 * Enforces M3 delegation safety constraints: depth limit, tool whitelist, timeout cap.
 * @param {object} request
 * @param {number} [request.depth] - nesting depth of the proposed spawn (0 = top-level)
 * @param {string[]} [request.tools] - tools the worker will be allowed to use
 * @param {number} [request.timeoutSec] - proposed session timeout in seconds
 * @param {string[]} [request.allowedTools] - override tool whitelist (default: read, write, web_fetch, web_search)
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateSpawnRequest({
  depth = 0,
  tools = [],
  timeoutSec = MAX_SPAWN_TIMEOUT_SEC,
  allowedTools,
} = {}) {
  const errors = [];
  const whitelist = Array.isArray(allowedTools)
    ? allowedTools
    : ["read", "write", "web_fetch", "web_search"];

  if (typeof depth !== "number" || depth > MAX_SPAWN_DEPTH) {
    errors.push(
      `Spawn depth ${depth} exceeds maximum ${MAX_SPAWN_DEPTH}. M3 workers must be leaf nodes.`,
    );
  }
  if (typeof timeoutSec !== "number" || timeoutSec > MAX_SPAWN_TIMEOUT_SEC) {
    errors.push(
      `Timeout ${timeoutSec}s exceeds maximum ${MAX_SPAWN_TIMEOUT_SEC}s.`,
    );
  }
  const unknownTools = tools.filter((tool) => !whitelist.includes(tool));
  if (unknownTools.length > 0) {
    errors.push(`Unknown tools not in whitelist: ${unknownTools.join(", ")}.`);
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
