# NEXT-PROGRAM-HINTS — nikin-wrapper

Generated: 2026-03-19T21:00:00Z after factory sprint on factory/mar19

## Do Not Repeat

- **Editing server.js triggers Prettier full-file reformat** — The `auto-lint.sh` hook
  (PostToolUse: Edit|Write) runs `npx prettier --write` on the entire file. server.js is
  1900+ lines. Before editing, check all text-inspection tests in `test/` that use
  `src.indexOf(marker)` as a string anchor — if the marker is a multi-arg route declaration
  like `app.post("/path", handler1, handler2)`, Prettier may split it to 3 lines and break
  the test. Files affected: safe-mode.test.js, config-apply-validation.test.js,
  day-zero-guardrail.test.js, setup-run-error-handling.test.js. Fixed in de67870.

- **Do not attempt to run Codex review with tight timeouts** — `codex exec` in this worktree
  timed out at 60s with no output. Increase timeout or skip and note SKIPPED.

## Confirmed Patterns

- **Tool registry is the right seam for ConnectOS integration** — `src/lib/tool-registry.js`
  is the single source of truth for allowed tool names. Adding tool names here is additive,
  non-breaking, and immediately enables config validation for morning briefing configs.
  Pattern: add tool name → add test → one commit.

- **Test anchoring on internal strings** — Text-inspection tests that verify server.js
  behavior should anchor on unique internal strings (function names, error message literals,
  handler call expressions) rather than route registration lines. Route declarations are
  Prettier-volatile; internal strings are stable.

- **3 commits is the right granularity** — Each factory commit in this sprint was atomic
  (one logical change, all tests passing). The pattern of fixing-then-testing-then-committing
  worked cleanly.

## Open Threads

- **ConnectOS tool names may differ** — The names registered (`connectos`, `shopify_orders`,
  `shopify_revenue`, `shopify_products`, `briefing_bundle`) are based on the Execution Focus
  Brief. When ConnectOS ships, verify the actual tool names match. Update `KNOWN_TOOL_NAMES`
  if they differ. File: `src/lib/tool-registry.js`.

- **Break-glass recovery transport** — `src/lib/break-glass-recovery.js` currently returns
  a recovery plan but no actual transport. The server returns 503. This is intentional for
  Milestone 1 but will need to be implemented. The plan references `openclaw backup create`
  - verify as the preferred path.

- **Morning briefing Treebot config** — The next step after this repo is configuring
  Treebot's `SOUL.md` + cron to use ConnectOS as a tool. That's a separate repo/config.
  This repo's part (tool registry + semantic validation) is now ready.

## Convention Discoveries

- **PROMOTE TO CLAUDE.md**: Text-inspection tests that use `src.indexOf()` on route
  declaration strings (`app.post("/path", ...)`) are fragile to Prettier reformatting.
  Anchor on the **handler name** or a unique **error message literal** inside the handler
  instead. Observed and fixed 4 times in this sprint. Confidence: HIGH.

- **Prettier runs on the full file, not just the edit** — `npx prettier --write FILE`
  reformats the entire file regardless of what changed. For large files like server.js,
  this means any edit can cascade into test failures for tests that rely on exact formatting.
  Confidence: CONFIRMED (observed directly).
