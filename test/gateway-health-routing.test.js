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
      return { code: 0, output: JSON.stringify({ ok: true, targets: [{ health: { ok: true } }] }) };
    },
  });
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

test('getLiveConfigReadback parses config.get json', async () => {
  const result = await getLiveConfigReadback({
    runCmd: async (_cmd, args) => {
      assert.deepEqual(args, ['gateway', 'call', 'config.get', '--params', '{}', '--json']);
      return { code: 0, output: JSON.stringify({ hash: 'hash123', config: { bindings: [] } }) };
    },
  });
  assert.equal(result.hash, 'hash123');
});
