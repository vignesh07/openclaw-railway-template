#!/usr/bin/env node
// Staging smoke test for the morning briefing control-plane surface.
// Verifies: ConnectOS health endpoint reachable, tool registry valid,
// and spawn validation accepts the expected briefing worker config.
//
// Usage: node scripts/smoke-briefing.js [--connectos-url <url>]
//
// Exit 0 = all checks passed
// Exit 1 = one or more checks failed

import { validateSpawnRequest } from "../src/lib/worker-activity.js";
import { getConnectOSHealthProbe } from "../src/lib/gateway-health.js";
import { isKnownToolName } from "../src/lib/tool-registry.js";

const args = process.argv.slice(2);
const connectosUrlIdx = args.indexOf("--connectos-url");
const connectosUrl =
  connectosUrlIdx >= 0
    ? args[connectosUrlIdx + 1]
    : (process.env.CONNECTOS_URL ?? "http://localhost:4000");

let failures = 0;

function check(name, passed, detail = "") {
  if (passed) {
    console.log(`  ok  ${name}`);
  } else {
    console.error(`  FAIL ${name}${detail ? ": " + detail : ""}`);
    failures += 1;
  }
}

console.log(`\n=== smoke-briefing ===`);
console.log(`connectosUrl: ${connectosUrl}\n`);

// 1. Tool registry — ConnectOS tool names
console.log("--- Tool Registry ---");
const briefingTools = [
  "connectos",
  "shopify_orders",
  "shopify_revenue",
  "shopify_products",
  "briefing_bundle",
];
for (const name of briefingTools) {
  check(`tool registered: ${name}`, isKnownToolName(name));
}

// 2. Spawn validation — briefing worker config
console.log("\n--- Spawn Validation ---");
const spawnResult = validateSpawnRequest({
  depth: 0,
  tools: ["connectos", "shopify_orders", "briefing_bundle"],
  toolAllowlist: briefingTools,
  timeoutSeconds: 300,
});
check(
  "briefing spawn config valid",
  spawnResult.ok,
  spawnResult.errors.join(", "),
);

// depth guard
const depthResult = validateSpawnRequest({
  depth: 2,
  tools: ["read"],
  toolAllowlist: ["read"],
  timeoutSeconds: 60,
});
check("depth > 1 rejected", !depthResult.ok);

// 3. ConnectOS health probe (optional — may be unavailable in CI)
console.log("\n--- ConnectOS Health ---");
try {
  const health = await getConnectOSHealthProbe({
    connectosUrl,
    timeoutMs: 3000,
  });
  if (health.ok) {
    check("ConnectOS /health reachable", true);
  } else {
    console.log(
      `  INFO ConnectOS unreachable (degraded=${health.degraded}, status=${health.status}) — not a hard failure`,
    );
  }
} catch (err) {
  console.log(
    `  INFO ConnectOS probe threw: ${err.message} — not a hard failure`,
  );
}

console.log(
  `\n=== result: ${failures === 0 ? "PASS" : `FAIL (${failures} checks failed)`} ===\n`,
);
process.exit(failures > 0 ? 1 : 0);
