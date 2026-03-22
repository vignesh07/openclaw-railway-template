#!/bin/sh
# nikin-entrypoint.sh — NIKIN OpenClaw config seeder for Railway
#
# Runs before `node src/server.js` on every container start.
# - Always re-renders config + tools from templates (picks up rotated secrets).
# - Seeds workspace files only if absent (preserves agent-written data on redeploy).
#
# Required env vars (set in Railway Variables panel):
#   ANTHROPIC_API_KEY, SETUP_PASSWORD, TELEGRAM_BOT_TOKEN,
#   TELEGRAM_WEBHOOK_SECRET, TELEGRAM_NICHOLAS_CHAT_ID,
#   CONNECTOS_URL, CONNECTOS_TOKEN
#
# Injected by railway.toml:
#   OPENCLAW_STATE_DIR    — /data/.openclaw (persistent volume)
#   OPENCLAW_WORKSPACE_DIR — /data/workspace (persistent volume)

set -e

STATE_DIR="${OPENCLAW_STATE_DIR:-/data/.openclaw}"
WORKSPACE_DIR="${OPENCLAW_WORKSPACE_DIR:-/data/workspace}"
INIT_DIR="/etc/nikin-config"

echo "[nikin-entrypoint] STATE_DIR=$STATE_DIR"
echo "[nikin-entrypoint] WORKSPACE_DIR=$WORKSPACE_DIR"

# ── Create required directories ───────────────────────────────────────────────
mkdir -p "$STATE_DIR/tools"
mkdir -p "$WORKSPACE_DIR/nikin-assistant/skills"

# ── Render config template → openclaw.json ───────────────────────────────────
echo "[nikin-entrypoint] Rendering config template..."
envsubst < "$INIT_DIR/openclaw.config.jsonc.tmpl" > "$STATE_DIR/openclaw.json"
echo "[nikin-entrypoint] Config written to $STATE_DIR/openclaw.json"

# ── Render tool definitions (envsubst replaces CONNECTOS_URL, CONNECTOS_TOKEN) ──
echo "[nikin-entrypoint] Seeding tool definitions..."
for f in "$INIT_DIR/tools/"*.json; do
  [ -f "$f" ] || continue
  fname=$(basename "$f")
  envsubst < "$f" > "$STATE_DIR/tools/$fname"
  echo "[nikin-entrypoint] Tool: $STATE_DIR/tools/$fname"
done

# ── Seed workspace files (only if absent — preserves user data) ───────────────
echo "[nikin-entrypoint] Seeding workspace skills..."
for f in "$INIT_DIR/workspace/nikin-assistant/skills/"*; do
  [ -f "$f" ] || continue
  fname=$(basename "$f")
  dest="$WORKSPACE_DIR/nikin-assistant/skills/$fname"
  if [ ! -f "$dest" ]; then
    cp "$f" "$dest"
    echo "[nikin-entrypoint] Seeded: $dest"
  else
    echo "[nikin-entrypoint] Exists (skipped): $dest"
  fi
done

echo "[nikin-entrypoint] Done. Handing off to: $*"
exec "$@"
