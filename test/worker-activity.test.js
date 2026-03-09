import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeWorkerActivity, buildWorkerActivityRequest } from '../src/lib/worker-activity.js';

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
