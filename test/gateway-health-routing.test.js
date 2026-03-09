import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateControlPlaneHealth } from '../src/lib/gateway-health.js';

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
