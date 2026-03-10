#!/usr/bin/env bash
set -euo pipefail

# Railway/OpenClaw bootstrap hook
#
# Install Google Workspace CLI persistently under /data so it survives redeploys.
# The wrapper will run /data/workspace/bootstrap.sh on startup if present.
#
# Usage:
#   cp examples/bootstrap.google-workspace-cli.sh /data/workspace/bootstrap.sh
#   chmod +x /data/workspace/bootstrap.sh
#
# Optional env:
#   GWS_VERSION=latest   # or pin a version, e.g. 0.2.3

mkdir -p /data/npm /data/npm-cache /data/pnpm /data/pnpm-store

export NPM_CONFIG_PREFIX=/data/npm
export NPM_CONFIG_CACHE=/data/npm-cache
export PNPM_HOME=/data/pnpm
export PATH="/data/npm/bin:/data/pnpm:${PATH}"

# Install only if missing, unless a specific version was requested.
if ! command -v gws >/dev/null 2>&1; then
  if [ -n "${GWS_VERSION:-}" ] && [ "${GWS_VERSION}" != "latest" ]; then
    npm install -g "@googleworkspace/cli@${GWS_VERSION}"
  else
    npm install -g @googleworkspace/cli
  fi
fi

echo "[bootstrap] gws installed: $(command -v gws)"
gws --version || true

echo "[bootstrap] Done. Next step: run 'gws auth setup' interactively via the setup console or shell." 
