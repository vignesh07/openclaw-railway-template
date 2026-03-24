import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("gateway proxy overwrites browser auth with the gateway bearer token", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

  assert.match(src, /function attachGatewayAuthHeader\(req\) \{/);
  assert.match(src, /if \(OPENCLAW_GATEWAY_TOKEN\) \{/);
  assert.match(src, /req\.headers\.authorization = `Bearer \$\{OPENCLAW_GATEWAY_TOKEN\}`;/);
  assert.match(src, /delete req\.headers\.authorization;/);
  assert.match(src, /proxy\.on\("proxyReq", \(proxyReq, req\) => \{/);
  assert.match(src, /proxyReq\.setHeader\("authorization", req\.headers\.authorization\);/);
});
