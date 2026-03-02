#!/usr/bin/env bash
set -euo pipefail

APP_USER="${APP_USER:-openclaw}"
APP_GROUP="${APP_GROUP:-openclaw}"
TS_STATE_DIR="${TS_STATE_DIR:-/data/tailscale}"
TS_SOCKET="${TS_SOCKET:-/tmp/tailscaled.sock}"
TS_UP_RETRIES="${TS_UP_RETRIES:-3}"
TS_UP_RETRY_DELAY_SEC="${TS_UP_RETRY_DELAY_SEC:-2}"
TS_STRICT="${TS_STRICT:-false}"

log() {
  echo "[tailscale] $*"
}

# Shared writable-dir setup + optional non-root preinstalls/bootstrap.
. /usr/local/bin/prestart-common.sh
prestart_common
ensure_dir "${TS_STATE_DIR}"

start_tailscale_non_blocking() {
  [ -n "${TS_AUTHKEY:-}" ] || {
    log "TS_AUTHKEY not set; skipping Tailscale"
    return 0
  }

  log "Starting tailscaled in userspace mode"
  tailscaled --statedir="${TS_STATE_DIR}" --socket="${TS_SOCKET}" --tun=userspace-networking &
  local tailscaled_pid=$!
  sleep 2

  local attempt=1
  while [ "${attempt}" -le "${TS_UP_RETRIES}" ]; do
    log "Running tailscale up (attempt ${attempt}/${TS_UP_RETRIES})"
    if tailscale --socket="${TS_SOCKET}" up --auth-key="${TS_AUTHKEY}" --hostname="${TS_HOSTNAME:-openclaw-railway}" --ssh ${TS_EXTRA_ARGS:-}; then
      log "Tailscale joined. Node ready for SSH access."
      return 0
    fi
    attempt=$((attempt + 1))
    sleep "${TS_UP_RETRY_DELAY_SEC}"
  done

  log "tailscale up failed after ${TS_UP_RETRIES} attempts"
  if [ "${TS_STRICT}" = "true" ]; then
    log "TS_STRICT=true, exiting because Tailscale failed"
    kill "${tailscaled_pid}" >/dev/null 2>&1 || true
    return 1
  fi

  log "Continuing without a healthy Tailscale session so app setup remains available"
  return 0
}

start_tailscale_non_blocking

exec gosu "${APP_USER}:${APP_GROUP}" "$@"
