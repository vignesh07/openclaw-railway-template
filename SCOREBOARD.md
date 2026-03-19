# SCOREBOARD — nikin-wrapper — factory/mar19

Started: 2026-03-19T22:00:00Z
Completed: 2026-03-19T23:00:00Z
Total items: 8
Completed: 8
Failed: 0
Skipped: 5 (items 1-5 from PROGRAM.md)
WTF-likelihood: 0%
Status: DONE_WITH_CONCERNS
PR: [pending push]
Reflect: NEXT-PROGRAM-HINTS.md written, memory updated

## Sprint Assessment

**Repo state:** healthy — 115 tests, all pass. Recent commits are control-plane hardening (health gates, RPC probes, config apply/rollback).

**Strategic priority:** NIKIN morning briefing pipeline (red on scoreboard). Nicholas must experience daily value before revenue conversation March 25-31. M3 delegation staging proof by March 21.

**Biggest opportunity:** Items 6-12 from PROGRAM.md were committed on orphaned branches from prior factory runs — they exist as git objects but are NOT on factory/mar19. Need to re-implement cleanly so this PR actually includes them.

**Cross-repo signal:** ConnectOS manifest shows 14 items completed. No downstream_hints emitted. Shopify adapter tool names not advertised — using descriptive names from Execution Focus Brief (shopify_orders, shopify_products, shopify_revenue).

**Memory warning:** Prettier hook reformats entire server.js on any edit. Text-inspection tests must anchor on unique internal strings (handler names, error literals), not route patterns. All new capabilities belong in src/lib/ as pure injectable modules — NEVER touch server.js directly. Editing server.js triggers cascading test failures.

## Sprint Intent

Re-implement items 6-12 from PROGRAM.md on the current factory/mar19 branch: worker result envelope (M3 delegation contract), spawn safety validation, ConnectOS health probe in gateway-health.js, ConnectOS Shopify tool names in tool-registry.js, and test coverage for all of these. Skipping items 2-5 (ops/ OpenClaw config) because the ops/ directory doesn't exist, the JSON config schema is unknown, and writing fake config would be a production risk. Item 1 (bump-openclaw-ref.mjs) already exists as a functional script. This sprint closes the M3 result contract and ConnectOS integration seams that the morning briefing pipeline depends on.

## Baseline

Eval commands: `node --test`
Result: PASS — 115 tests, 0 failures, 257ms

## Skipped Items (with reasons)

- SKIP Item 1 (bump-openclaw-ref.mjs): script already exists and is functional
- SKIP Item 2 (Register ConnectOS as OpenClaw tool): ops/ dir missing, config schema unknown, production risk
- SKIP Item 3 (Treebot morning briefing workflow): ops/treebot/ missing, SOUL.md format unknown
- SKIP Item 4 (briefing cron schedule): ops/openclaw/ missing, staging config schema unknown
- SKIP Item 5 (M3 worker defaults): same as 4, staging config schema unknown

## Sprint Plan

### Item A: worker-result.js typed result envelope (RISK/P1)

- Approach: Create src/lib/worker-result.js. Export WorkerResultStatus enum (Object.freeze), createWorkerResult(), isTimedOut(), isComplete(), isFailed(). Pure data module, no deps. Follow the options-injection pattern from worker-activity.js.
- Risks: New file, but pure logic with no side effects. Low breakage risk.
- Memory check: All new capabilities go in src/lib/ as pure injectable modules. { ok, errors[] } contract for validation functions. Object.freeze for enums.

### Item B: validateSpawnRequest in worker-activity.js (RISK/P1)

- Approach: Add validateSpawnRequest({ depth, tools, timeoutSec }) → { ok, errors[] } function to existing worker-activity.js. Enforce: depth=1 max, tools must be in whitelist, timeoutSec ≤ 300. DO NOT change existing exports.
- Risks: Modifying existing file. Prettier hook may reformat. Keep change minimal.
- Memory check: No server.js edits. Editing worker-activity.js is safe (no Prettier hook on lib/ files).

### Item C: ConnectOS health probe in gateway-health.js (SAFE/P1)

- Approach: Add getConnectOsHealthProbe(options) to gateway-health.js. Uses fetchImpl (options-injection). Pings configurable URL (connectosTarget default) at /health. Returns { ok, status }.
- Risks: Modifying existing file. Must not break existing exports.
- Memory check: Dependency injection pattern (fetchImpl as option) → 100% testable.

### Item D: ConnectOS tool names in tool-registry.js (SAFE)

- Approach: Add shopify_orders, shopify_products, shopify_revenue to KNOWN_TOOL_NAMES. These are the Shopify adapter tools ConnectOS exposes per Execution Focus Brief.
- Risks: Minimal. Pure constant addition. Existing tests still pass.

### SAFE items D-H: test files + smoke script — no explicit plan needed (5 items)

## Items

- [x] A: worker-result.js typed result envelope — commit eaf0aa1
- [x] B: validateSpawnRequest in worker-activity.js — commit 57622fd
- [x] C: ConnectOS health probe in gateway-health.js — commit 7f19d7a
- [x] D: ConnectOS tool names in tool-registry.js — commit 96b3c5c
- [x] E: test/briefing-workflow.test.js (8 tests) — commit 50d5ed4
- [x] F: test/worker-spawn.test.js (10 tests) — commit d2b83fe
- [x] G: test/connectos-tool.test.js (8 tests) — commit 895ded2
- [x] H: scripts/smoke-briefing.js — commit b7ffffd

## QA Gate at item 5

node --test: PASS — 123 tests, 0 failures
New files without test coverage: 0

## QA Gate at item 8 (Final)

node --test: PASS — 141 tests, 0 failures (+26 vs baseline)

## Multi-AI Review Gate at item 8

Claude self-review: 0 issues found
Codex review: SKIPPED (CLI not available)
Cross-model overlap: N/A
Overall: CLEAN

## Convention Promotion Candidates

- PROMOTE TO CLAUDE.md: "Shopify tools (shopify_orders, shopify_products, shopify_revenue) require explicit allowedTools override in validateSpawnRequest — they are NOT in the default worker whitelist (read, write, web_fetch, web_search). This is intentional: ConnectOS tools need deliberate opt-in per workflow." — observed 3 times across tests
