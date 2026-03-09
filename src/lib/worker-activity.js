// Generic gate input for safe-apply decisions.
// Uses a native OpenClaw interface seam instead of wrapper-local heuristics.
// Must stay reusable across customers and deployments.

export function summarizeWorkerActivity(workerSessions) {
  const sessions = Array.isArray(workerSessions) ? workerSessions : [];
  return {
    count: sessions.length,
    blocked: sessions.length > 0,
    sessions,
    sessionKeys: sessions.map((session) => session.sessionKey).filter(Boolean),
  };
}

export function buildWorkerActivityRequest({ sessionKey = 'main', activeMinutes = 5 } = {}) {
  return {
    path: '/tools/invoke',
    body: {
      tool: 'sessions_list',
      action: 'json',
      args: { kinds: ['subagent'], activeMinutes, messageLimit: 0 },
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
  throw new Error('Not implemented yet');
}
