#!/usr/bin/env node
// Smoke test for the morning briefing pipeline.
// Probes ConnectOS health and the briefing bundle endpoint.
// Run against staging: CONNECTOS_TARGET=https://connectos.staging.example.com node scripts/smoke-briefing.js

import {
  probeConnectosHealth,
  fetchShopifyBriefingBundle,
} from "../src/lib/briefing-workflow.js";

const target = process.env.CONNECTOS_TARGET ?? "http://127.0.0.1:3100";

console.log(`smoke-briefing: target=${target}`);

// 1. Health probe
const health = await probeConnectosHealth({ connectosTarget: target });
if (!health.ok) {
  console.error(`FAIL: ConnectOS health probe failed — ${health.reason}`);
  process.exit(1);
}
console.log("ok: ConnectOS /health");

// 2. Briefing bundle fetch
const bundle = await fetchShopifyBriefingBundle({ connectosTarget: target });
if (!bundle.ok && !bundle.fallback) {
  console.error("FAIL: Briefing bundle returned unexpected error state");
  process.exit(1);
}
if (bundle.fallback) {
  console.warn(
    "warn: ConnectOS returned fallback — briefing will use placeholder",
  );
} else {
  console.log("ok: Shopify briefing bundle received");
}

console.log("smoke-briefing: PASS");
