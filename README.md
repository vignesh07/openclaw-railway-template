# OpenClaw Railway Template (1‑click deploy)

This repo packages **OpenClaw** for Railway with a small **/setup** web wizard so users can deploy and onboard **without running any commands**.

## What you get

- **OpenClaw Gateway + Control UI** (served at `/` and `/openclaw`)
- A friendly **Setup Wizard** at `/setup` (protected by a password)
- Persistent state via **Railway Volume** (so config/credentials/memory survive redeploys)
- One-click **Export backup** (so users can migrate off Railway later)
- **Import backup** from `/setup` (advanced recovery)
- **Optional Tailscale SSH** via `Dockerfile-tailscale` — passwordless, key-based access with no exposed port
- **Unfinished work tracker** at `docs/UNFINISHED_WORK.md` for blocked/deferred follow-ups

## How it works (high level)

- The container runs a wrapper web server.
- The wrapper protects `/setup` (and the Control UI at `/openclaw`) with `SETUP_PASSWORD` using HTTP Basic auth.
- During setup, the wrapper runs `openclaw onboard --non-interactive ...` inside the container, writes state to the volume, and then starts the gateway.
- After setup, **`/` is OpenClaw**. The wrapper reverse-proxies all traffic (including WebSockets) to the local gateway process.

## Railway deploy instructions (what you’ll publish as a Template)

In Railway Template Composer:

1) Create a new template from this GitHub repo.
2) Add a **Volume** mounted at `/data`.
3) Set the following variables:

Required:
- `SETUP_PASSWORD` — user-provided password to access `/setup` and the Control UI (`/openclaw`) via HTTP Basic auth. The wrapper exits at startup if this is missing.

Recommended:
- `OPENCLAW_STATE_DIR=/data/.openclaw`
- `OPENCLAW_WORKSPACE_DIR=/data/workspace`

Optional:
- `OPENCLAW_GATEWAY_TOKEN` — if not set, the wrapper generates one (not ideal). In a template, set it using a generated secret.

Notes:
- This template pins OpenClaw to a released version by default via Docker build arg `OPENCLAW_GIT_REF` (override if you want `main`).

4) Enable **Public Networking** (HTTP). Railway will assign a domain.
   - This service listens on Railway’s injected `PORT` at runtime (recommended).
5) Deploy.

Then:
- Visit `https://<your-app>.up.railway.app/setup`
  - Your browser will prompt for **HTTP Basic auth**. Use any username; the password is `SETUP_PASSWORD`.
- Complete setup
- Visit `https://<your-app>.up.railway.app/` and `/openclaw` (same Basic auth)

### Tailscale SSH (optional)

Use `Dockerfile-tailscale` for passwordless, key-based SSH access through your Tailscale network — no exposed port, no password prompt.

**Quick setup:**

1. Set `RAILWAY_DOCKERFILE_PATH=Dockerfile-tailscale` in Railway Variables.
2. Add `TS_AUTHKEY` as a **secret** Railway Variable (never commit it). Generate one at [Tailscale Admin → Settings → Keys](https://login.tailscale.com/admin/settings/keys). Ephemeral keys are recommended for cloud containers.
3. Set `TS_HOSTNAME` to a name meaningful to you (e.g. `myapp-railway`). Default is the generic `openclaw-railway`.
4. Deploy. SSH from any Tailscale device: `tailscale ssh <TS_HOSTNAME>`.

**Key env vars:**

| Variable | Default | Purpose |
|---|---|---|
| `TS_AUTHKEY` | _(empty — must set)_ | Tailscale auth key. Secret. Never commit. |
| `TS_HOSTNAME` | `openclaw-railway` | Node name in your tailnet. Set to something meaningful to you. |
| `TS_EXTRA_ARGS` | `--accept-routes --accept-dns=false` | Extra flags passed to `tailscale up`. |
| `TS_USERSPACE` | `true` | Enables userspace networking (required without `/dev/net/tun`). |

**ACL policy:**
See `access-controls.example.json` for a sanitized template. Copy it to your [Tailscale admin console](https://login.tailscale.com/admin/acls) and substitute your own email and tag. Your real `access controls.json` is git-ignored — never commit it.

> For the full setup guide including flag explanations, SSH limitations under userspace networking, and the contributor security checklist, see [docs/SECURITY.md](docs/SECURITY.md).

## Support / community

- GitHub Issues: https://github.com/vignesh07/clawdbot-railway-template/issues
- Discord: https://discord.com/invite/clawd

If you’re filing a bug, please include the output of:
- `/healthz`
- `/setup/api/debug` (after authenticating to /setup)

## Getting chat tokens (so you don’t have to scramble)

### Telegram bot token
1) Open Telegram and message **@BotFather**
2) Run `/newbot` and follow the prompts
3) BotFather will give you a token that looks like: `123456789:AA...`
4) Paste that token into `/setup`

### Discord bot token
1) Go to the Discord Developer Portal: https://discord.com/developers/applications
2) **New Application** → pick a name
3) Open the **Bot** tab → **Add Bot**
4) Copy the **Bot Token** and paste it into `/setup`
5) Invite the bot to your server (OAuth2 URL Generator → scopes: `bot`, `applications.commands`; then choose permissions)

## Persistence (Railway volume)

Railway containers have an ephemeral filesystem. Only the mounted volume at `/data` persists across restarts/redeploys.

What persists cleanly today:
- **Custom skills / code:** anything under `OPENCLAW_WORKSPACE_DIR` (default: `/data/workspace`)
- **Node global tools (npm/pnpm):** this template configures defaults so global installs land under `/data`:
  - npm globals: `/data/npm` (binaries in `/data/npm/bin`)
  - pnpm globals: `/data/pnpm` (binaries) + `/data/pnpm-store` (store)
- **Python packages:** create a venv under `/data` (example below). The runtime image includes Python + venv support.

What does *not* persist cleanly:
- `apt-get install ...` (installs into `/usr/*`)
- Homebrew installs (typically `/opt/homebrew` or similar)

### Optional bootstrap hook

If `/data/workspace/bootstrap.sh` exists, the wrapper will run it on startup (best-effort) before starting the gateway.
Use this to initialize persistent install prefixes or create a venv.

Example `bootstrap.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Example: create a persistent python venv
python3 -m venv /data/venv || true

# Example: ensure npm/pnpm dirs exist
mkdir -p /data/npm /data/npm-cache /data/pnpm /data/pnpm-store
```

## Security

> Full details, contributor checklist, and Tailscale ACL setup: **[docs/SECURITY.md](docs/SECURITY.md)**

### What goes where

| Item | Where it lives |
|---|---|
| `SETUP_PASSWORD`, `OPENCLAW_GATEWAY_TOKEN`, `TS_AUTHKEY` | Railway Variables only — never in the repo |
| `TS_HOSTNAME` (your personal value) | Railway Variables — the image default is the generic `openclaw-railway` |
| Tailscale ACL policy with your email/tag | Local `access controls.json` — **git-ignored** |
| Sanitized ACL template | `access-controls.example.json` — safe to commit and share |

### Credential hygiene — quick rules

- **Never** commit a `tskey-` string, email address, or personal hostname.
- **Always** use Railway secret variables for auth keys and passwords.
- Run this before any commit to catch accidental leaks:

```bash
git diff --cached | grep -iE "tskey-|@gmail|@.*\.com|password\s*=\s*\S"
```

## Troubleshooting

### “disconnected (1008): pairing required” / dashboard health offline

This is not a crash — it means the gateway is running, but no device has been approved yet.

Fix:
- Open `/setup`
- Use the **Debug Console**:
  - `openclaw devices list`
  - `openclaw devices approve <requestId>`

If `openclaw devices list` shows no pending request IDs:
- Make sure you’re visiting the Control UI at `/openclaw` (or your native app) and letting it attempt to connect
  - Note: the Railway wrapper now proxies the gateway and injects the auth token automatically, so you should not need to paste the gateway token into the Control UI when using `/openclaw`.
- Ensure your state dir is the Railway volume (recommended): `OPENCLAW_STATE_DIR=/data/.openclaw`
- Check `/setup/api/debug` for the active state/workspace dirs + gateway readiness

### “unauthorized: gateway token mismatch”

The Control UI connects using `gateway.remote.token` and the gateway validates `gateway.auth.token`.

Fix:
- Re-run `/setup` so the wrapper writes both tokens.
- Or set both values to the same token in config.

### “Application failed to respond” / 502 Bad Gateway

Most often this means the wrapper is up, but the gateway can’t start or can’t bind.

Checklist:
- Ensure you mounted a **Volume** at `/data` and set:
  - `OPENCLAW_STATE_DIR=/data/.openclaw`
  - `OPENCLAW_WORKSPACE_DIR=/data/workspace`
- Ensure **Public Networking** is enabled (Railway will inject `PORT`).
- Check Railway logs for the wrapper error: it will show `Gateway not ready:` with the reason.

**"Internal Server Error" when running setup?** Check Railway logs for `[wrapper] unhandled error:` — you must select an auth method (e.g. OpenAI API key) and paste the key; ensure a Volume is mounted at `/data`.

### Tailscale logs show many `[err]` lines

Tailscale writes most logs to stderr and uses `[err]` for many non-error messages. Messages like `logpolicy.ConfigFromFile ... no such file`, `TPM: error opening`, and `magicsock: failed to force-set UDP buffer size` are **expected and harmless** in containers. If you see `Tailscale joined. Node ready for SSH access.` and `[wrapper] listening on :8080`, the deployment is healthy. See [docs/SECURITY.md](docs/SECURITY.md#7-log-noise--expected-and-benign) for details.

### Legacy CLAWDBOT_* env vars / multiple state directories

If you see warnings about deprecated `CLAWDBOT_*` variables or state dir split-brain (e.g. `~/.openclaw` vs `/data/...`):
- Use `OPENCLAW_*` variables only
- Ensure `OPENCLAW_STATE_DIR=/data/.openclaw` and `OPENCLAW_WORKSPACE_DIR=/data/workspace`
- Redeploy after fixing Railway Variables

### Build OOM (out of memory) on Railway

Building OpenClaw from source can exceed small memory tiers.

Recommendations:
- Use a plan with **2GB+ memory**.
- If you see `Reached heap limit Allocation failed - JavaScript heap out of memory`, upgrade memory and redeploy.

## Local smoke test

```bash
docker build -t clawdbot-railway-template .

docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e SETUP_PASSWORD=test \
  -e OPENCLAW_STATE_DIR=/data/.openclaw \
  -e OPENCLAW_WORKSPACE_DIR=/data/workspace \
  -v $(pwd)/.tmpdata:/data \
  clawdbot-railway-template

# open http://localhost:8080/setup (password: test)
```

---

## Official template / endorsements

- Officially recommended by OpenClaw: <https://docs.openclaw.ai/railway>
- Railway announcement (official): [Railway tweet announcing 1‑click OpenClaw deploy](https://x.com/railway/status/2015534958925013438)

  ![Railway official tweet screenshot](assets/railway-official-tweet.jpg)

- Endorsement from Railway CEO: [Jake Cooper tweet endorsing the OpenClaw Railway template](https://x.com/justjake/status/2015536083514405182)

  ![Jake Cooper endorsement tweet screenshot](assets/railway-ceo-endorsement.jpg)

- Created and maintained by **Vignesh N (@vignesh07)**
- **1800+ deploys on Railway and counting** [Link to template on Railway](https://railway.com/deploy/clawdbot-railway-template)

![Railway template deploy count](assets/railway-deploys.jpg)
