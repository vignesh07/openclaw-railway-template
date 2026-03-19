# SCOREBOARD — nikin-wrapper — factory/mar19

Started: 2026-03-19T19:08:56Z
Completed: 2026-03-19T21:00:00Z
Total items: 6
Completed: 3
Failed: 0
Skipped: 3 (items 4-6 rolled into prior commits)
WTF-likelihood: 0%
Status: DONE
PR: https://github.com/vignesh07/clawdbot-railway-template/pull/188
Reflect: NEXT-PROGRAM-HINTS.md written, memory updated

## Sprint Intent

The NIKIN morning briefing pipeline is the revenue-critical path: Nicholas must experience
daily AI value before the CHF 10K revenue conversation on March 25-31. This wrapper is the
OpenClaw control-plane that governs what tools agents are allowed to use. The semantic
validator only permits tools from a hard-coded allowlist — ConnectOS (the Shopify data
layer for the morning briefing) will be rejected the moment someone tries to configure
it as an allowed tool. This sprint fixes the lint-breaking conflict marker, then extends
the tool registry to let the morning briefing config land cleanly when ConnectOS ships.

**Cross-repo signal:** SmokeTestRepo manifest has no downstream_hints for this repo.
Strategic brief is the authority: ConnectOS → OpenClaw tool registration is critical path.

**Memory warning:** Only smoke-test memory exists. No prior nikin-wrapper runs.
auth.ts modification was blocked in SmokeTestRepo — note parallel: never modify
protected auth modules here either.

## Baseline

Eval commands:

- `node --test` (primary — 115 tests)
- `node -c src/server.js` (lint gate)

Result:

- `node --test`: PASS — 115/115
- `node -c src/server.js`: FAIL — SyntaxError on stray `<<<<<<< HEAD` at line 1432

Note: Lint failure is a pre-existing defect to fix in item 1. Tests still pass because
test files import lib/ directly (not server.js) or read it as raw text.

## Sprint Plan

### Item 1: Fix stray merge conflict marker in server.js (P0)

- Approach: Delete the single `<<<<<<< HEAD` line at line 1432. No conflict content follows
  it — the rest of the file is the correct HEAD content. One-line fix.
- Risks: None. The line after is a valid `app.post(...)` call; it's just the marker that's wrong.
- Memory check: N/A (first run)

### Item 2–4: Extend tool registry for ConnectOS Shopify tools (P0)

- Approach: Add `connectos`, `shopify_orders`, `shopify_revenue`, `shopify_products` to
  KNOWN_TOOL_NAMES in tool-registry.js. Brief says ConnectOS exposes these endpoints and
  registers as a "native OpenClaw tool". The semantic validator will reject any config that
  tries to `allow` these tools in `tools.subagents.tools.allow`.
- Risks: Tool names might differ in the ConnectOS implementation. Adding them now makes the
  validator permissive for the expected names; wrong names will just be unused. SAFE.
- Memory check: N/A

### Item 5: Add `briefing_bundle` tool to registry (SAFE)

- The brief mentions "ShopifyBriefingBundle typed export for OpenClaw consumption" — the
  tool that wraps the full morning briefing payload likely follows snake_case convention.
- Low risk: additive change, never breaks existing validation.

### Item 6: Write/update tests for new tool names (SAFE)

- Add assertions for each new tool name in tool-registry.test.js.
- Also add tests confirming old invalid names still fail.

### SAFE items: 5 — Items 2–6 are all single-file or two-file changes with no external deps.

## Items

- [x] Fix merge conflict marker in server.js — commit de67870
- [x] Add ConnectOS Shopify tool names to tool registry — commit 51fec06
- [x] Add end-to-end semantic validation tests for ConnectOS — commit c9aa90d
- [ ] Items 4–6 (briefing_bundle, tests, final eval) — merged into commits above

## QA Gate at item 3 (final)

node --test: PASS — 119/119
node -c src/server.js: PASS — LINT OK
Protected files touched: none
Security scan: CLEAN
Codex review: SKIPPED (process timed out)

## Multi-AI Review at item 3

Claude self-review: 0 issues — clean, no DRY violations, no security findings
Codex review: SKIPPED — CLI timed out
Cross-model overlap: N/A

## Convention Promotion Candidates

- PROMOTE TO CLAUDE.md: "Text-inspection tests anchoring on app.post() route declarations
  are fragile to Prettier reformatting. Use unique internal strings (handler names, error messages)
  as markers instead." — observed 4 times during this sprint (4 fragile tests fixed)
