import test from 'node:test';
import assert from 'node:assert/strict';
import { pickConfigOperation, buildMutationRequest } from '../src/lib/config-ops.js';

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
