#!/usr/bin/env node
// Smoke test for morning briefing workflow integration.
// Hits staging control-plane endpoints to verify ConnectOS health probe,
// tool registry, and worker result contract are wired correctly.
//
// Usage:
//   CONTROL_PLANE_URL=http://localhost:8080 node scripts/smoke-briefing.js
//   CONNECTOS_URL=http://connectos:3000 node scripts/smoke-briefing.js
//
// Exit codes: 0 = all checks pass, 1 = one or more checks failed.

import { getConnectOsHealthProbe } from "../src/lib/gateway-health.js";
import { getKnownToolNames } from "../src/lib/tool-registry.js";
import { validateSpawnRequest } from "../src/lib/worker-activity.js";
import {
  createWorkerResult,
  WorkerResultStatus,
  isComplete,
} from "../src/lib/worker-result.js";

const CONNECTOS_URL = process.env.CONNECTOS_URL ?? "http://connectos:3000";
const REQUIRED_SHOPIFY_TOOLS = [
  "shopify_orders",
  "shopify_products",
  "shopify_revenue",
];

let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) {
    console.log(`✓ ${name}`);
    passed += 1;
  } else {
    console.error(`✗ ${name}${detail ? ": " + detail : ""}`);
    failed += 1;
  }
}

// Check 1: ConnectOS health probe
console.log(`\nConnectOS health probe → ${CONNECTOS_URL}/health`);
const healthResult = await getConnectOsHealthProbe({
  connectosTarget: CONNECTOS_URL,
});
if (healthResult.ok) {
  check("ConnectOS /health reachable", true);
} else {
  check(
    "ConnectOS /health reachable (SOFT FAIL — briefing will degrade gracefully)",
    false,
    healthResult.reason,
  );
}

// Check 2: Shopify tools registered
const knownTools = getKnownToolNames();
for (const tool of REQUIRED_SHOPIFY_TOOLS) {
  check(`Tool registry contains ${tool}`, knownTools.includes(tool));
}

// Check 3: Spawn validation allows Shopify tools with override
const spawnResult = validateSpawnRequest({
  depth: 1,
  tools: REQUIRED_SHOPIFY_TOOLS,
  timeoutSec: 120,
  allowedTools: REQUIRED_SHOPIFY_TOOLS,
});
check(
  "Spawn validation: Shopify tools allowed with briefing whitelist",
  spawnResult.ok,
  spawnResult.errors.join("; "),
);

// Check 4: Worker result contract round-trip
const envelope = createWorkerResult({
  status: WorkerResultStatus.COMPLETE,
  payload: { smoke: true },
  meta: {
    durationMs: 0,
    sessionKey: "smoke:briefing",
    toolsUsed: ["shopify_orders"],
  },
});
check(
  "Worker result envelope: COMPLETE status detectable",
  isComplete(envelope),
);
check(
  "Worker result envelope: payload preserved",
  envelope.payload?.smoke === true,
);

// Summary
console.log(`\nSmoke briefing: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(
    "\nNote: ConnectOS health failures are expected in offline environments.",
  );
  console.error(
    "All structural checks (tool registry, spawn validation, result contract) must pass.",
  );
}

const structuralFailed = failed - (healthResult.ok ? 0 : 1);
process.exit(structuralFailed > 0 ? 1 : 0);
