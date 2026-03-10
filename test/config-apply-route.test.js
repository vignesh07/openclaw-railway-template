import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createConfigApplyHandler, createRawConfigWriteDisabledHandler } from '../src/lib/config-apply-route.js';
import { createApplyMutex } from '../src/lib/apply-mutex.js';

const policy = {
  primaryAgentId: 'primary-agent',
  primaryChannel: 'test-channel',
  requiredWorkerTools: ['read', 'write', 'web_fetch', 'web_search'],
  requiredPrimaryAgentDeniedTools: ['gateway'],
  requirePrimaryAgentWorkspaceOnly: true,
  forbidRunTimeoutSecondsZero: true,
};

const baseConfig = {
  agents: {
    list: [
      { id: 'main' },
      { id: 'primary-agent', tools: { fs: { workspaceOnly: true }, deny: ['gateway'] } },
    ],
    defaults: { subagents: { runTimeoutSeconds: 300 } },
  },
  bindings: [{ agentId: 'primary-agent', match: { channel: 'test-channel' } }],
  tools: { subagents: { tools: { allow: ['read', 'write', 'web_fetch', 'web_search'] } } },
};

async function buildTestServer(overrides = {}) {
  const events = [];
  const mutationCalls = [];
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.post('/setup/api/config/raw', createRawConfigWriteDisabledHandler());
  app.post('/setup/api/config/apply', createConfigApplyHandler({
    loadPolicy: async () => overrides.policy ?? policy,
    fetchCurrentConfigState: overrides.fetchCurrentConfigState ?? (async () => overrides.currentState ?? { payload: baseConfig, hash: 'base123' }),
    runConfigMutation: async (input) => {
      mutationCalls.push(input);
      if (overrides.runConfigMutation) return overrides.runConfigMutation(input, mutationCalls);
      return { ok: true, hash: 'next456' };
    },
    listActiveWorkerSessions: async () => overrides.workerSessions ?? [],
    appendAuditEvent: async (_path, event) => {
      events.push(event);
    },
    checkPostApplyHealth: async () => overrides.health ?? { ok: true },
    enterSafeMode: async () => {
      if (overrides.enterSafeMode) return overrides.enterSafeMode();
      return { ok: true };
    },
    mutex: overrides.mutex ?? createApplyMutex(),
    auditLogPath: '/tmp/config-ops.jsonl',
  }));

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function postJson(path, body) {
    const response = await fetch(baseUrl + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return {
      status: response.status,
      body: await response.json(),
    };
  }

  return {
    events,
    mutationCalls,
    postJson,
    async close() {
      await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    },
  };
}

test('raw config write route is no longer the normal write path', async () => {
  const app = await buildTestServer();
  try {
    const response = await app.postJson('/setup/api/config/raw', { raw: '{}' });
    assert.equal(response.status, 410);
    assert.equal(response.body.code, 'GONE');
  } finally {
    await app.close();
  }
});

test('guarded apply rejects semantically invalid config', async () => {
  const app = await buildTestServer();
  try {
    const response = await app.postJson('/setup/api/config/apply', {
      type: 'partial',
      raw: JSON.stringify({ tools: { subagents: { tools: { allow: ['read', 'webfetch'] } } } }),
    });
    assert.equal(response.status, 422);
    assert.equal(response.body.ok, false);
    assert.match(response.body.errors[0], /Unknown tool name/);
  } finally {
    await app.close();
  }
});

test('guarded apply rejects active workers without force', async () => {
  const app = await buildTestServer({ workerSessions: [{ kind: 'subagent', sessionKey: 'agent:primary:subagent:1' }] });
  try {
    const response = await app.postJson('/setup/api/config/apply', {
      type: 'partial',
      raw: JSON.stringify({ messages: { ackReactionScope: 'group-mentions' } }),
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.ok, false);
    assert.equal(app.events.some((event) => event.event === 'apply_blocked_active_workers'), true);
  } finally {
    await app.close();
  }
});

test('guarded apply rolls back when write succeeds but post-apply health fails', async () => {
  let fetchCount = 0;
  const app = await buildTestServer({
    currentState: undefined,
    fetchCurrentConfigState: async () => {
      fetchCount += 1;
      if (fetchCount === 1) {
        return { payload: baseConfig, hash: 'base123' };
      }
      return { payload: baseConfig, hash: 'after456' };
    },
    runConfigMutation: async (_input, mutationCalls) => {
      if (mutationCalls.length === 1) {
        return { ok: true };
      }
      return { ok: true, hash: 'rolledback' };
    },
    health: { ok: false, reason: 'routing failed' },
  });
  try {
    const response = await app.postJson('/setup/api/config/apply', {
      type: 'partial',
      raw: JSON.stringify({ messages: { ackReactionScope: 'group-mentions' } }),
      note: 'test apply',
    });
    assert.equal(response.status, 500);
    assert.equal(response.body.ok, false);
    assert.equal(app.mutationCalls.length, 2);
    assert.equal(app.mutationCalls[1].change.type, 'full');
    assert.equal(app.mutationCalls[1].change.baseHash, 'after456');
    assert.equal(app.events.some((event) => event.event === 'apply_rollback'), true);
  } finally {
    await app.close();
  }
});
