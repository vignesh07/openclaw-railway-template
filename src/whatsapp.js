import fs from "node:fs";

// ---------------------------------------------------------------------------
// WhatsApp account provisioning helpers
// ---------------------------------------------------------------------------
// Each function below corresponds to a single responsibility that was
// previously inlined inside the POST /setup/api/whatsapp/accounts handler.
// Dependencies (runCmd, clawArgs, openclawNode, etc.) are injected as a
// context object so that the functions are decoupled from server-level
// globals and remain easy to test or reuse.
// ---------------------------------------------------------------------------

/**
 * Ensures the WhatsApp channel config for the given accountId exists in the
 * OpenClaw config file. Idempotent: does nothing if the config entry already
 * exists.
 *
 * @param {string} accountId
 * @param {{ runCmd: Function, clawArgs: Function, openclawNode: string, redactSecrets: Function }} ctx
 * @returns {Promise<{ existed: boolean, changed: boolean, output?: string }>}
 */
export async function ensureWhatsAppConfig(accountId, { runCmd, clawArgs, openclawNode, redactSecrets }) {
  const cfgPath = `channels.whatsapp.accounts.${accountId}`;

  // Idempotency check: if the key already exists, skip.
  const get = await runCmd(openclawNode, clawArgs(["config", "get", cfgPath]));
  if (get.code === 0) {
    return { existed: true, changed: false };
  }

  const configOptions = {
    enabled: true,
    dmPolicy: "allowlist",
    allowFrom: ["*"],
    groupPolicy: "disabled",
    debounceMs: 0,
  };

  const set = await runCmd(
    openclawNode,
    clawArgs([
      "config",
      "set",
      "--json",
      cfgPath,
      JSON.stringify(configOptions),
    ]),
  );

  if (set.code !== 0) {
    const err = new Error("config set failed");
    err.status = 500;
    err.output = redactSecrets(set.output);
    throw err;
  }

  return { existed: false, changed: true, output: set.output };
}

/**
 * Ensures an OpenClaw agent exists for the given accountId, bound to the
 * whatsapp channel. Idempotent: `openclaw agents add` is called with
 * --non-interactive.
 *
 * @param {string} accountId
 * @param {{ runCmd: Function, clawArgs: Function, openclawNode: string, redactSecrets: Function, agentBasePath: string }} ctx
 * @returns {Promise<{ output: string }>}
 */
export async function ensureAgent(accountId, { runCmd, clawArgs, openclawNode, redactSecrets, agentBasePath }) {
  const workspace = `${agentBasePath}/${accountId}/workspace`;
  const agentDir = `${agentBasePath}/${accountId}/agent`;

  const result = await runCmd(
    openclawNode,
    clawArgs([
      "agents",
      "add",
      accountId,
      "--workspace",
      workspace,
      "--agent-dir",
      agentDir,
      "--non-interactive",
      "--bind",
      `whatsapp:${accountId}`,
    ]),
  );

  if (result.code !== 0) {
    const err = new Error("agent add failed");
    err.status = 500;
    err.output = redactSecrets(result.output);
    throw err;
  }

  return { output: result.output };
}

/**
 * Copies the template workspace into the new account's workspace directory.
 * Uses `fs.promises.cp` (recursive, force-overwrite) so any custom files in
 * the template are propagated.
 *
 * @param {string} _accountId         Reserved for future use (logging, etc.).
 * @param {string} templateWorkspace  Absolute path to the source template workspace.
 * @param {string} workspace          Absolute path to the destination workspace.
 * @returns {Promise<void>}
 */
export async function ensureWorkspaceFromTemplate(_accountId, templateWorkspace, workspace) {
  await fs.promises.cp(templateWorkspace, workspace, {
    recursive: true,
    force: true,
  });
}

/**
 * Triggers a gateway reload (restart) so the newly provisioned account and
 * its config changes are picked up immediately.
 *
 * Named wrapper around restartGateway() so the call site reads as an
 * explicit, domain-named operation. Future per-account reload logic (e.g.
 * hot-reload via signal) can be added here without touching the handler.
 *
 * @param {string} _accountId  Reserved for future per-account targeting.
 * @param {{ restartGateway: Function }} ctx
 * @returns {Promise<void>}
 */
export async function reloadGatewayIfNeeded(_accountId, { restartGateway }) {
  await restartGateway();
}

/**
 * Obtains the WhatsApp QR code ASCII art for the given accountId by calling
 * the underlying QR generator and returning the ASCII string.
 *
 * @param {string} accountId
 * @param {{ generateWhatsappQrAscii: Function }} ctx
 * @returns {Promise<string>} ASCII QR string
 */
export async function getQrCode(accountId, { generateWhatsappQrAscii }) {
  return generateWhatsappQrAscii({ accountId });
}

