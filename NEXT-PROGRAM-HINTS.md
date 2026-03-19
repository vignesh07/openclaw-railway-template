# NEXT-PROGRAM-HINTS — nikin-wrapper

Generated: 2026-03-19T22:30:00Z after factory sprint 2 on factory/mar19

## Do Not Repeat

- **Editing server.js triggers Prettier full-file reformat** (confirmed again) — See sprint 1 hints.
  Still applies. All new code this sprint went into src/lib/ (no Prettier cascade risk).

- **Codex exec times out in this worktree** — `codex exec` with 60s timeout fails consistently.
  Skip Codex review step and note SKIPPED. This is a known environment constraint.

- **Items 1-5 from PROGRAM.md are out-of-scope for this worktree:**
  - Item 1 (bump-openclaw-ref): needs GITHUB_TOKEN + network. Script exists. Run manually.
  - Items 2-5 (ops/ configs): ops/openclaw/ and ops/treebot/ live in a separate infra repo.
    Do NOT create these files in this repo — wrong location.

## Confirmed Patterns

- **Dependency injection for all lib/ modules** — Every new module (worker-result.js,
  gateway-health.js, worker-activity.js) accepts `fetchImpl`, `runCmd`, `sleepImpl` etc. as
  options. This makes 100% of functionality testable without mocking globals. Pattern: pure
  function with options object → test with inline stubs.

- **{ ok, errors[] } return contract** — `validateSpawnRequest` and `validateSemanticConfig`
  return the same shape. Any new validation function should follow this contract.
  Tests can `assert.ok(result.errors.some(e => e.includes('expected fragment')))` for
  resilient error message matching.

- **Object.freeze for enum constants** — `WorkerResultStatus` and `KNOWN_TOOL_NAMES` both use
  Object.freeze(). Follow this for any new constant sets — prevents accidental mutation
  across module boundaries.

- **Pure lib/ modules are fast and Prettier-safe** — All 7 sprint 2 items passed first try
  because they avoided server.js edits entirely. The lib/ → test/ pattern is the safest
  way to add capability to this codebase.

## Open Threads

- **ConnectOS tool names need verification** — The registered names (`connectos`,
  `shopify_orders`, `shopify_revenue`, `shopify_products`, `briefing_bundle`) came from
  the Execution Focus Brief. When ConnectOS ships, compare against the actual API tool
  surface and update KNOWN_TOOL_NAMES if they differ. File: `src/lib/tool-registry.js`.

- **Treebot SOUL.md briefing workflow** — The morning briefing trigger and ConnectOS tool
  usage live in the Treebot config (separate repo). This wrapper's control-plane surface
  is now ready. Next step: configure Treebot's SOUL.md to trigger a morning briefing
  worker that uses `connectos` and `briefing_bundle` tools with a 300s timeout at depth 0.

- **Break-glass recovery transport** — `src/lib/break-glass-recovery.js` returns a
  recovery plan but no transport. Server returns 503. Intentional for M1. Implement
  `openclaw backup create` path when M2 begins.

- **OpenClaw ref bump** — `scripts/bump-openclaw-ref.mjs` exists but was never run.
  Run with `GITHUB_TOKEN=<token> node scripts/bump-openclaw-ref.mjs` to pin Dockerfile
  to latest stable OpenClaw release.

## Convention Discoveries

- **lib/ modules are the right home for new capabilities** — New control-plane features
  belong in `src/lib/` as pure modules, not in server.js. Server.js imports and wires
  them. This keeps server.js stable and Prettier-reformats contained.
  Confidence: CONFIRMED (4 lib files modified/created this sprint, 0 server.js touches).

- **Test file naming: <feature>.test.js** — All test files follow `<feature>.test.js`
  lowercase-hyphenated naming. `briefing-workflow.test.js`, `worker-spawn.test.js`,
  `connectos-tool.test.js` follow this convention.
  Confidence: HIGH.

## Assessment Corrections

- Sprint 1 assessment said "items 4-6 merged into prior commits" — this was inaccurate.
  Items 4-6 from the PROGRAM.md (ops/ configs, briefing cron, M3 delegation) were NOT
  done — they were skipped because they require a different repo. The sprint 2 planner
  correctly identified this and focused on the lib/ work that WAS in scope.

---

## Sprint 3 Addendum (2026-03-19T23:00:00Z)

### Do Not Repeat (sprint 3 additions)

- **Factory commits from sibling worktrees do NOT auto-merge** — If a previous factory run
  committed to a different worktree checkout of `factory/mar19`, those commits are reachable
  via `git fetch` but NOT in the current worktree's HEAD. Always run `git fetch origin factory/mar19`
  and `git log origin/factory/mar19 | head -20` before starting to understand what's already shipped.

- **Do not re-implement work that's already on origin/factory/mar19** — Check the remote first.
  Sprint 3 re-implemented all of sprint 2's work before discovering it was already there.
  Wasted cycle. Next agent: fetch first, assess remote state, then build only what's missing.

### Confirmed Patterns (sprint 3)

- **git fetch + remote inspection as sprint kickoff ritual** — Run before any implementation:
  `git fetch origin factory/mar19 && git log --oneline origin/factory/mar19 | head -20`
  This reveals what prior factory runs shipped on this branch.

### Open Threads (for next factory agent)

- **ops/ config for OpenClaw + Treebot** — This is the remaining blocker for the morning
  briefing March 24 target. The code is ready. The OpenClaw tool registration and Treebot
  SOUL.md cron workflow must be wired in the separate infra repo that manages ops/ configs.
  A human must identify which repo holds these configs and route the next factory agent there.

- **ConnectOS tool names unverified** — Tool names shopify_orders, shopify_products,
  shopify_revenue are assumed from the Execution Focus Brief. When ConnectOS ships the Shopify
  adapter, run: `CONNECTOS_URL=https://staging.connectos node scripts/smoke-briefing.js`
  to verify the health probe and validate tool registration is correct.
