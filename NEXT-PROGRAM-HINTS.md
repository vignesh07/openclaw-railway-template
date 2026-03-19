# NEXT-PROGRAM-HINTS — nikin-wrapper

Generated: 2026-03-19 after factory sprint on factory/mar19 (sprint 4)

## Do Not Repeat

- **Pushing to origin/factory/mar19 from a new worktree** — the remote factory/mar19 has
  accumulated diverged commits from sprints 1–3. Always push to a NEW branch (e.g.,
  factory/mar19-sprint5) and create a PR from there. Never try to push to the same
  factory/mar19 remote again — it will always reject as non-fast-forward.

- **PROGRAM.md items 2–5** (ops/ configs): These touch `ops/openclaw/` and `ops/treebot/`
  which are in a SEPARATE infra repo — confirmed 4 sprints in a row. Do not attempt these
  here. Flag immediately, skip, move on.

## Confirmed Patterns

- **Injectable module pattern** (`src/lib/`): All new modules export pure functions with
  `fetchImpl`, `runCmd`, `sleepImpl` etc. as options. No mocks needed in tests. This has
  worked cleanly every sprint — continue this pattern.

- **`{ ok, errors[] }` return contract**: Every validation function uses this shape.
  `buildWorkerResult`, `validateWorkerSpawn`, `evaluateControlPlaneHealth` all use it.
  Test assertions follow `assert.equal(result.ok, true/false)` + errors array checks.

- **lib/ + test/ atomic commit pair**: Write the module and its test, run `node --test`,
  commit together in one atomic commit. Has worked 0 failures across 4 sprints.

- **ConnectOS Shopify tools in registry**: shopify_orders, shopify_revenue, shopify_products
  are now registered in tool-registry.js AND validated in worker-spawn.js. They flow
  through the entire stack correctly.

## Open Threads

- **ops/ configuration**: Items 2–5 from PROGRAM.md (ConnectOS as OpenClaw tool, Treebot
  briefing workflow, cron schedule, M3 worker defaults) are the remaining critical-path
  blockers for the morning briefing to actually run. These need to be done in the separate
  infra repo, not here.

- **briefing-workflow.js fallback testing in staging**: smoke-briefing.js exists but hasn't
  been run against a real staging ConnectOS. When ConnectOS Shopify adapter is live (being
  built by ConnectOS factory agent), run:
  `CONNECTOS_TARGET=<staging-url> node scripts/smoke-briefing.js`

- **worker-result.js integration into apply route**: worker-result.js exists as a pure module
  but isn't wired into config-apply-route.js yet. If M3 delegation needs the wrapper to
  gate apply on worker completion, connect these.

## Convention Discoveries

- **Remote branch collision pattern**: Factory worktrees started from main but push to the
  same named remote branch → non-fast-forward rejection on 2nd+ sprints. Solution: always
  use sprint-numbered branches (factory/mar19-sprint4, factory/mar19-sprint5).

- **Test count is a lagging indicator**: PROGRAM.md said "consolidate to ~85 tests" when
  baseline was 115. After adding new functionality, count reached 154. Never reduce
  test count just to hit a numeric target from an older spec.

- **ops/ always in separate infra repo** — observed and confirmed across EVERY sprint on
  this repo (4 consecutive sprints). This should be in CLAUDE.md.

## Assessment Corrections

- Phase 1 assessed item 13 (test consolidation) as feasible. It is not — the baseline has
  grown from 115 to 154 through new functionality. Consolidation would remove coverage, not
  redundancy. Future agents: skip item 13 unless specifically asked.
