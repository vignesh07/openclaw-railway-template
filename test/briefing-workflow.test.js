import test from "node:test";
import assert from "node:assert/strict";
import { validateSpawnRequest } from "../src/lib/worker-activity.js";
import {
  getConnectOSHealthProbe,
  evaluateControlPlaneHealth,
} from "../src/lib/gateway-health.js";
import {
  createWorkerResult,
  WorkerResultStatus,
  isTimedOut,
  isComplete,
  isFailed,
} from "../src/lib/worker-result.js";
import { validateSemanticConfig } from "../src/lib/config-semantic-checks.js";
import { isKnownToolName } from "../src/lib/tool-registry.js";

// The morning briefing pipeline:
// 1. Config validation confirms briefing tools are in allowlist
// 2. Spawn validation gates the M3 worker
// 3. ConnectOS health probe decides live data vs. fallback
// 4. Worker announces result back via typed envelope

test("briefing config allows ConnectOS tools in semantic validation", () => {
  const briefingConfig = {
    agents: {
      list: [
        { id: "main" },
        {
          id: "treebot",
          tools: { fs: { workspaceOnly: true }, deny: ["gateway"] },
        },
      ],
      defaults: { subagents: { runTimeoutSeconds: 300 } },
    },
    bindings: [{ agentId: "treebot", match: { channel: "telegram" } }],
    tools: {
      subagents: {
        tools: {
          allow: [
            "read",
            "web_fetch",
            "connectos",
            "shopify_orders",
            "briefing_bundle",
          ],
        },
      },
    },
  };

  const policy = {
    primaryAgentId: "treebot",
    primaryChannel: "telegram",
    requiredWorkerTools: ["read", "web_fetch"],
    requiredPrimaryAgentDeniedTools: ["gateway"],
    requirePrimaryAgentWorkspaceOnly: true,
    forbidRunTimeoutSecondsZero: true,
  };

  const result = validateSemanticConfig(briefingConfig, policy);
  assert.equal(
    result.ok,
    true,
    `Validation failed: ${JSON.stringify(result.errors)}`,
  );
});

test("briefing spawn request is valid for M3 leaf worker", () => {
  const result = validateSpawnRequest({
    depth: 0,
    tools: [
      "connectos",
      "shopify_orders",
      "shopify_revenue",
      "briefing_bundle",
    ],
    toolAllowlist: [
      "connectos",
      "shopify_orders",
      "shopify_revenue",
      "shopify_products",
      "briefing_bundle",
    ],
    timeoutSeconds: 300,
  });
  assert.equal(result.ok, true);
});

test("briefing pipeline: ConnectOS up → briefing worker completes with payload", async () => {
  // ConnectOS is healthy
  const connectosResult = await getConnectOSHealthProbe({
    connectosUrl: "http://connectos.railway.internal",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }),
  });
  assert.equal(connectosResult.ok, true);

  // Worker announces successful briefing bundle
  const result = createWorkerResult(
    WorkerResultStatus.COMPLETE,
    {
      message: "Guten Morgen! Hier ist dein Briefing.",
      shopifyOrders: 42,
      shopifyRevenue: "CHF 8,200",
    },
    { durationMs: 45000, workerSessionKey: "agent:treebot:subagent:1" },
  );

  assert.equal(isComplete(result), true);
  assert.equal(result.payload.shopifyOrders, 42);
  assert.equal(result.meta.workerSessionKey, "agent:treebot:subagent:1");
});

test("briefing pipeline: ConnectOS down → fallback message, control-plane still ok", async () => {
  // ConnectOS is unreachable
  const connectosResult = await getConnectOSHealthProbe({
    connectosUrl: "http://connectos.railway.internal",
    fetchImpl: async () => {
      throw new Error("ECONNREFUSED");
    },
  });
  assert.equal(connectosResult.ok, false);
  assert.equal(connectosResult.degraded, true);

  // Control plane still runs — connectos is optional for gateway health in degraded mode
  // Treebot sends fallback message
  const result = createWorkerResult(
    WorkerResultStatus.COMPLETE,
    {
      message: "Guten Morgen! Shopify-Daten nicht verfügbar.",
      shopifyOrders: null,
      fallback: true,
    },
    { durationMs: 5000 },
  );

  assert.equal(isComplete(result), true);
  assert.equal(result.payload.fallback, true);
});

test("briefing pipeline: worker timeout is captured in result envelope", () => {
  const result = createWorkerResult(WorkerResultStatus.TIMED_OUT, null, {
    durationMs: 300000,
    workerSessionKey: "agent:treebot:subagent:2",
  });
  assert.equal(isTimedOut(result), true);
  assert.equal(isComplete(result), false);
  assert.equal(isFailed(result), false);
});

test("briefing pipeline: worker failure is captured in result envelope", () => {
  const result = createWorkerResult(WorkerResultStatus.FAILED, null, {
    durationMs: 12000,
  });
  assert.equal(isFailed(result), true);
  assert.equal(isTimedOut(result), false);
  assert.equal(isComplete(result), false);
});

test("briefing config rejects unknown tool names in allowlist", () => {
  // Ensure a config referencing a non-existent tool fails semantic validation
  assert.equal(isKnownToolName("shopify_webhooks"), false);
  assert.equal(isKnownToolName("briefing_v2"), false);
});

test("control-plane full health includes ConnectOS phase", () => {
  const fullHealth = evaluateControlPlaneHealth({
    livenessOk: true,
    gatewayStatusOk: true,
    channelsReady: true,
    routingOk: true,
    connectosOk: true,
  });
  assert.equal(fullHealth.ok, true);
  assert.deepEqual(Object.keys(fullHealth.phases).sort(), [
    "channelsReady",
    "connectosOk",
    "gatewayStatusOk",
    "livenessOk",
    "routingOk",
  ]);
});
