export function evaluateControlPlaneHealth({ livenessOk, gatewayStatusOk, channelsReady, routingOk }) {
  return {
    ok: Boolean(livenessOk && gatewayStatusOk && channelsReady && routingOk),
    phases: {
      livenessOk,
      gatewayStatusOk,
      channelsReady,
      routingOk,
    },
  };
}

export async function getGatewayStatusProbe() {
  // transport: CLI subprocess
  // command: `openclaw gateway status --json`
  // success criteria: runtime running + RPC probe ok
  // timeout budget: start with the documented 10s default
  throw new Error('Not implemented yet');
}

export async function getChannelsProbe() {
  // transport: CLI subprocess
  // command: `openclaw channels status --probe --json`
  // success criteria: required channels connected/ready
  // retry policy: 3 attempts with 5s interval within the approved post-restart window
  throw new Error('Not implemented yet');
}

export async function getLiveConfigReadback() {
  // transport: CLI subprocess
  // command: `openclaw gateway call config.get --params "{}"`
  // auth context: same local gateway token/context already controlled by the wrapper process
  throw new Error('Not implemented yet');
}
