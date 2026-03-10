import test from 'node:test';
import assert from 'node:assert/strict';
import { pickConfigOperation, buildMutationRequest, fetchCurrentConfigState, runConfigMutation } from '../src/lib/config-ops.js';

test('pickConfigOperation uses patch for partial updates', () => {
  assert.equal(pickConfigOperation({ type: 'partial' }), 'config.patch');
});

test('pickConfigOperation uses apply for full replacement', () => {
  assert.equal(pickConfigOperation({ type: 'full' }), 'config.apply');
});

test('buildMutationRequest requires an explicit baseHash', () => {
  const req = buildMutationRequest({ type: 'partial', raw: '{ tools: {} }', baseHash: 'abc123', sessionKey: 'agent:main:channel:dm:123', note: 'safe apply' });
  assert.equal(req.method, 'config.patch');
  assert.equal(req.params.baseHash, 'abc123');
  assert.equal(req.params.sessionKey, 'agent:main:channel:dm:123');
  assert.equal(req.params.note, 'safe apply');
});

test('fetchCurrentConfigState parses gateway call json output', async () => {
  const state = await fetchCurrentConfigState({
    runCmd: async (_cmd, args) => {
      assert.deepEqual(args, ['gateway', 'call', 'config.get', '--params', '{}', '--json']);
      return { code: 0, output: JSON.stringify({ hash: 'base123', config: { agents: { list: [] } }, raw: '{}' }) };
    },
  });
  assert.equal(state.hash, 'base123');
  assert.deepEqual(state.config, { agents: { list: [] } });
});

test('runConfigMutation executes config.patch and returns parsed result', async () => {
  const result = await runConfigMutation({
    change: { type: 'partial', raw: '{"tools":{}}', baseHash: 'base123' },
    note: 'safe apply',
    sessionKey: 'main',
    restartDelayMs: 2000,
  }, {
    runCmd: async (_cmd, args) => {
      assert.deepEqual(args, ['gateway', 'call', 'config.patch', '--params', '{"raw":"{\\"tools\\":{}}","baseHash":"base123","sessionKey":"main","note":"safe apply","restartDelayMs":2000}', '--json']);
      return { code: 0, output: JSON.stringify({ ok: true, hash: 'next456' }) };
    },
  });
  assert.equal(result.hash, 'next456');
});

test('runConfigMutation surfaces retryAfterMs on rate limit errors', async () => {
  await assert.rejects(
    () => runConfigMutation({
      change: { type: 'partial', raw: '{"tools":{}}', baseHash: 'base123' },
      note: 'safe apply',
      sessionKey: 'main',
      restartDelayMs: 2000,
    }, {
      runCmd: async () => ({ code: 1, output: 'Gateway call failed: rate limit exceeded for config.patch; retryAfterMs=30000' }),
    }),
    (error) => {
      assert.equal(error.retryAfterMs, 30000);
      return true;
    },
  );
});

test('fetchCurrentConfigState approves latest local pairing request and retries once', async () => {
  const calls = [];
  const state = await fetchCurrentConfigState({
    runCmd: async (_cmd, args) => {
      calls.push(args);
      if (calls.length === 1) {
        return { code: 1, output: 'Gateway call failed: Error: gateway closed (1008): pairing required' };
      }
      if (calls.length === 2) {
        assert.deepEqual(args, ['devices', 'approve', '--latest', '--json']);
        return { code: 0, output: JSON.stringify({ requestId: 'req1' }) };
      }
      return { code: 0, output: JSON.stringify({ hash: 'base456', config: { ok: true } }) };
    },
  });
  assert.equal(state.hash, 'base456');
  assert.deepEqual(calls[0], ['gateway', 'call', 'config.get', '--params', '{}', '--json']);
  assert.deepEqual(calls[2], ['gateway', 'call', 'config.get', '--params', '{}', '--json']);
});
