# Mission Control UI

Minimal internal UI for the Threads pipeline. Reads directly from workspace JSON files — no database.

## Features

- Inbox page for draft records from `agents/mission-control/state/index.json`
- Draft detail page for full copy, source metadata, review state, and history
- Source browser for JSON scrape/source files under `intel/data/`
- Queue page for Postpone payloads under `intel/postpone-queue/`
- Review actions: approve / needs revision / reject
  - Updates the matching file in `agents/mission-control/state/reviews/`
  - Syncs status + `updated_at` back into `agents/mission-control/state/index.json`

## Data sources

- `/data/workspace/intel/data/`
- `/data/workspace/intel/threads-drafts/`
- `/data/workspace/agents/mission-control/state/index.json`
- `/data/workspace/agents/mission-control/state/reviews/`
- `/data/workspace/intel/postpone-queue/`

## Run

```bash
cd /data/workspace/repos/mission-control-ui
cp .env.example .env.local
pnpm dev
```

Open: `http://localhost:3000`

## Env

```bash
WORKSPACE_ROOT=/data/workspace
NEXT_PUBLIC_BASE_PATH=/mission-control
```

## Reverse proxy mode

If the wrapper proxies this app under the existing public service, build/run it with:

```bash
WORKSPACE_ROOT=/data/workspace NEXT_PUBLIC_BASE_PATH=/mission-control pnpm build
WORKSPACE_ROOT=/data/workspace NEXT_PUBLIC_BASE_PATH=/mission-control pnpm start --hostname 127.0.0.1 --port 3000
```

## Notes

- No auth yet.
- Built for speed/readability, not final polish.
- Queue page handles empty folders gracefully.
- File updates are JSON rewrite operations; no database required.
