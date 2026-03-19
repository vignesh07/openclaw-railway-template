import test from "node:test";
import assert from "node:assert/strict";
import { validateSemanticConfig } from "../src/lib/config-semantic-checks.js";

const policy = {
  primaryAgentId: "primary-agent",
  primaryChannel: "test-channel",
  requiredWorkerTools: ["read", "write", "web_fetch", "web_search"],
  requiredPrimaryAgentDeniedTools: ["gateway"],
  requirePrimaryAgentWorkspaceOnly: true,
  forbidRunTimeoutSecondsZero: true,
};

const baseConfig = {
  agents: {
    list: [
      { id: "main" },
      {
        id: "primary-agent",
        tools: { fs: { workspaceOnly: true }, deny: ["gateway"] },
      },
    ],
    defaults: { subagents: { runTimeoutSeconds: 300 } },
  },
  bindings: [{ agentId: "primary-agent", match: { channel: "test-channel" } }],
  tools: {
    subagents: {
      tools: { allow: ["read", "write", "web_fetch", "web_search"] },
    },
  },
};

test("semantic config validation accepts valid policy-aligned config", () => {
  const result = validateSemanticConfig(baseConfig, policy);
  assert.equal(result.ok, true);
});

test("semantic config validation rejects unknown tool name", () => {
  const result = validateSemanticConfig(
    {
      ...baseConfig,
      tools: { subagents: { tools: { allow: ["read", "webfetch"] } } },
    },
    policy,
  );
  assert.equal(result.ok, false);
});

test("semantic config validation rejects missing required primary binding", () => {
  const result = validateSemanticConfig(
    { ...baseConfig, bindings: [] },
    policy,
  );
  assert.equal(result.ok, false);
});

test("semantic config validation rejects wrong primary binding target", () => {
  const result = validateSemanticConfig(
    {
      ...baseConfig,
      bindings: [{ agentId: "main", match: { channel: "test-channel" } }],
    },
    policy,
  );
  assert.equal(result.ok, false);
});

test("semantic config validation rejects missing workspaceOnly for primary agent", () => {
  const result = validateSemanticConfig(
    {
      ...baseConfig,
      agents: {
        list: [
          { id: "main" },
          { id: "primary-agent", tools: { fs: {}, deny: ["gateway"] } },
        ],
        defaults: { subagents: { runTimeoutSeconds: 300 } },
      },
    },
    policy,
  );
  assert.equal(result.ok, false);
});

test("semantic config validation rejects missing runTimeoutSeconds", () => {
  const result = validateSemanticConfig(
    {
      ...baseConfig,
      agents: { ...baseConfig.agents, defaults: { subagents: {} } },
    },
    policy,
  );
  assert.equal(result.ok, false);
});

test("semantic config validation accepts ConnectOS tools in subagent allow list", () => {
  // Validates the full end-to-end path: registry → semantic check → config apply.
  // A morning briefing config that allows connectos tools must pass validation.
  const result = validateSemanticConfig(
    {
      ...baseConfig,
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
    },
    policy,
  );
  assert.equal(
    result.ok,
    true,
    `Expected ok but got errors: ${JSON.stringify(result.errors)}`,
  );
});

test("semantic config validation still rejects unregistered tool names alongside connectos", () => {
  const result = validateSemanticConfig(
    {
      ...baseConfig,
      tools: { subagents: { tools: { allow: ["connectos", "shopify"] } } },
    },
    policy,
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.includes("shopify")),
    "Should report shopify as unknown",
  );
});
