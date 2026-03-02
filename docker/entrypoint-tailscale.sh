#!/usr/bin/env bash
set -euo pipefail

APP_USER="${APP_USER:-openclaw}"
APP_GROUP="${APP_GROUP:-openclaw}"

ensure_dir() {
  local dir="$1"
  mkdir -p "$dir" || true
  if [ ! -w "$dir" ]; then
    chown -R "${APP_USER}:${APP_GROUP}" "$dir" || true
  fi
}

# Keep persistent paths writable even when Railway mounts /data as root-owned.
ensure_dir /data
ensure_dir /data/.openclaw
ensure_dir /data/workspace
ensure_dir /data/npm
ensure_dir /data/npm-cache
ensure_dir /data/pnpm
ensure_dir /data/pnpm-store
ensure_dir /data/tailscale
ensure_dir /app
ensure_dir /home/openclaw

# Start Tailscale if TS_AUTHKEY is set
if [ -n "${TS_AUTHKEY:-}" ]; then
  echo "Starting Tailscale..."
  tailscaled --statedir=/data/tailscale --tun=userspace-networking &
  TAILSCALE_PID=$!
  # Wait for tailscaled to be ready
  sleep 2
  tailscale up --auth-key="${TS_AUTHKEY}" --hostname="${TS_HOSTNAME:-openclaw-railway}" --ssh ${TS_EXTRA_ARGS:-}
  echo "Tailscale joined. Node ready for SSH access."
else
  echo "TS_AUTHKEY not set; skipping Tailscale. Set via Railway Variables or -e for SSH access."
fi

exec gosu "${APP_USER}:${APP_GROUP}" "$@"
