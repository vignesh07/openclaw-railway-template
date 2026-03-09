import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeWorkerActivity, buildWorkerActivityRequest, listActiveWorkerSessions } from '../src/lib/worker-activity.js';

test('summarizeWorkerActivity reports zero cleanly', () => {
  const result = summarizeWorkerActivity([]);
  assert.equal(result.count, 0);
  assert.equal(result.blocked, false);
  assert.deepEqual(result.sessionKeys, []);
});

test('summarizeWorkerActivity blocks when active subagent sessions are present', () => {
  const result = summarizeWorkerActivity([
    { kind: 'subagent', sessionKey: 'agent:primary:subagent:1' },
    { kind: 'subagent', sessionKey: 'agent:primary:subagent:2' },
  ]);
  assert.equal(result.count, 2);
  assert.equal(result.blocked, true);
  assert.deepEqual(result.sessionKeys, ['agent:primary:subagent:1', 'agent:primary:subagent:2']);
});

test('buildWorkerActivityRequest targets tools invoke with sessions_list', () => {
  const req = buildWorkerActivityRequest({ sessionKey: 'main', activeMinutes: 5 });
  assert.equal(req.path, '/tools/invoke');
  assert.equal(req.body.tool, 'sessions_list');
  assert.equal(req.body.action, 'json');
  assert.equal(req.body.args.activeMinutes, 5);
});

test('listActiveWorkerSessions uses tools invoke and normalizes session keys', async () => {
  let seen;
  const sessions = await listActiveWorkerSessions({
    gatewayTarget: 'http://127.0.0.1:18789',
    gatewayToken: 'tok',
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            result: {
              sessions: [
                { kind: 'subagent', key: 'agent:main:subagent:1' },
                { kind: 'main', key: 'main' },
              ],
            },
          };
        },
      };
    },
  });
  assert.equal(seen.url, 'http://127.0.0.1:18789/tools/invoke');
  assert.equal(seen.init.method, 'POST');
  assert.match(seen.init.headers.authorization, /^Bearer /);
  assert.deepEqual(sessions, [{ kind: 'subagent', sessionKey: 'agent:main:subagent:1' }]);
});
