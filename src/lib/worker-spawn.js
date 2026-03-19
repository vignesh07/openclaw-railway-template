// Pre-spawn validation for M3 delegation workers.
// Enforces depth limits, tool whitelist, and timeout bounds before any
// worker session is created. Returns { ok, errors[] } contract.

import { getKnownToolNames } from "./tool-registry.js";

const MAX_DEPTH = 1; // Leaf workers only — no recursive delegation
const MAX_TIMEOUT_MS = 300_000; // 5 minutes hard cap
const MIN_TIMEOUT_MS = 1_000; // 1 second minimum

/**
 * Validate a worker spawn request before execution.
 * @param {{ depth?: number, tools?: string[], timeoutMs?: number }} request
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateWorkerSpawn(request = {}) {
  const errors = [];

  const depth = typeof request.depth === "number" ? request.depth : 0;
  if (depth > MAX_DEPTH) {
    errors.push(`depth ${depth} exceeds maximum allowed depth ${MAX_DEPTH}`);
  }

  const tools = Array.isArray(request.tools) ? request.tools : [];
  const knownTools = getKnownToolNames();
  for (const tool of tools) {
    if (!knownTools.includes(String(tool))) {
      errors.push(`tool '${tool}' is not in the allowed tool list`);
    }
  }

  const timeoutMs =
    typeof request.timeoutMs === "number" ? request.timeoutMs : null;
  if (timeoutMs !== null) {
    if (timeoutMs > MAX_TIMEOUT_MS) {
      errors.push(`timeoutMs ${timeoutMs} exceeds maximum ${MAX_TIMEOUT_MS}ms`);
    }
    if (timeoutMs < MIN_TIMEOUT_MS) {
      errors.push(
        `timeoutMs ${timeoutMs} is below minimum ${MIN_TIMEOUT_MS}ms`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Build a spawn request with safe defaults applied.
 * @param {{ sessionKey?: string, depth?: number, tools?: string[], timeoutMs?: number }} options
 * @returns {{ sessionKey: string, depth: number, tools: string[], timeoutMs: number }}
 */
export function buildSpawnRequest(options = {}) {
  return {
    sessionKey: String(options.sessionKey || "worker"),
    depth: Math.min(
      typeof options.depth === "number" ? options.depth : 0,
      MAX_DEPTH,
    ),
    tools: Array.isArray(options.tools) ? options.tools : ["read"],
    timeoutMs: Math.min(
      Math.max(
        typeof options.timeoutMs === "number" ? options.timeoutMs : 60_000,
        MIN_TIMEOUT_MS,
      ),
      MAX_TIMEOUT_MS,
    ),
  };
}
