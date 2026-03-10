import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateControlPlaneHealth, getGatewayStatusProbe, getChannelsProbe, getLiveConfigReadback } from '../src/lib/gateway-health.js';

test('routing sanity requires primary binding and target agent', async () => {
  const result = evaluateControlPlaneHealth({
    livenessOk: true,
    gatewayStatusOk: true,
    channelsReady: true,
    routingOk: true,
  });
  assert.equal(result.ok, true);
});

test('degraded-but-alive state fails control-plane health gate', async () => {
  const result = evaluateControlPlaneHealth({
    livenessOk: true,
    gatewayStatusOk: true,
    channelsReady: true,
    routingOk: false,
  });
  assert.equal(result.ok, false);
});

test('channel probe failure fails control-plane health gate', async () => {
  const result = evaluateControlPlaneHealth({
    livenessOk: true,
    gatewayStatusOk: true,
    channelsReady: false,
    routingOk: true,
  });
  assert.equal(result.ok, false);
});

test('live readback mismatch keeps routing gate false', async () => {
  const result = evaluateControlPlaneHealth({
    livenessOk: true,
    gatewayStatusOk: true,
    channelsReady: true,
    routingOk: false,
  });
  assert.equal(result.ok, false);
});

test('getGatewayStatusProbe reads gateway status json', async () => {
  const result = await getGatewayStatusProbe({
    runCmd: async (_cmd, args) => {
      assert.deepEqual(args, ['gateway', 'status', '--json']);
      return { code: 0, output: JSON.stringify({ rpc: { ok: true }, targets: [{ health: { ok: true } }] }) };
    },
  });
  assert.equal(result.ok, true);
});

test('getGatewayStatusProbe retries before failing', async () => {
  let calls = 0;
  const result = await getGatewayStatusProbe({
    attempts: 3,
    delayMs: 0,
    sleepImpl: async () => {},
    runCmd: async () => {
      calls += 1;
      if (calls < 3) {
        return { code: 1, output: 'temporary failure' };
      }
      return { code: 0, output: JSON.stringify({ rpc: { ok: true }, targets: [{ health: { ok: true } }] }) };
    },
  });
  assert.equal(calls, 3);
  assert.equal(result.ok, true);
});

test('getChannelsProbe reports ready when required channel is connected', async () => {
  const result = await getChannelsProbe({
    requiredChannels: ['telegram'],
    runCmd: async (_cmd, args) => {
      assert.deepEqual(args, ['channels', 'status', '--probe', '--json']);
      return { code: 0, output: JSON.stringify({ channelAccounts: { telegram: [{ connected: true, configured: true, enabled: true }] } }) };
    },
  });
  assert.equal(result.ready, true);
});

test('getChannelsProbe retries until channel becomes healthy', async () => {
  let calls = 0;
  const result = await getChannelsProbe({
    attempts: 3,
    delayMs: 0,
    sleepImpl: async () => {},
    requiredChannels: ['telegram'],
    runCmd: async () => {
      calls += 1;
      if (calls < 3) {
        return { code: 0, output: JSON.stringify({ channelAccounts: { telegram: [{ configured: true, enabled: true, running: false, connected: false }] } }) };
      }
      return { code: 0, output: JSON.stringify({ channelAccounts: { telegram: [{ configured: true, enabled: true, running: true, connected: true }] } }) };
    },
  });
  assert.equal(calls, 3);
  assert.equal(result.ready, true);
});

test('getLiveConfigReadback parses config.get json', async () => {
  const result = await getLiveConfigReadback({
    runCmd: async (_cmd, args) => {
      assert.deepEqual(args, ['gateway', 'call', 'config.get', '--params', '{}', '--json']);
      return { code: 0, output: JSON.stringify({ hash: 'hash123', config: { bindings: [] } }) };
    },
  });
  assert.equal(result.hash, 'hash123');
});
