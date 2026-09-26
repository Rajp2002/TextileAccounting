# Weavly refactor program — status

Updated 2026-09-26. **Packages 1F (CI gate) and 1A (costing safety net) are complete, committed and pushed** to branch `maintenance/weavly-refactor` (not `main`). Awaiting approval of the next package. No application source, existing test, dependency, `package.json`, lint rule or existing workflow has been changed.

## Decisions needed

1. **CS-1, multi-weft picks (re-opened; EVIDENCE E15).** Research and the code show that three of four places (weave cost, weaver wage rate, quotation "N Picks" text) treat a weft row's PPI as that yarn's own picks, as industry formulas do. Only the weft-yarn weight (100/N split, added in `20c4546f`) assumes every row carries the full fabric PPI. The owner needs to say how two alternating weft yarns in a 68-pick fabric are entered: **34 + 34** or **68 + 68**. The answer decides which formula is wrong; either fix is a separate, versioned costing change.
2. **Approve Package 1B** (below), or pick another package.
3. **Open a pull request?** CI runs on pull requests and on pushes to `main`. A PR from this branch would run it for the first time without touching `main` or production.
4. **Still open:**
   - OS-1/OS-2/OS-3 fixes (inventory audit fails, audit writes blocked, challan archive lost);
   - AS-01 onboarding admin fallback;
   - a fail-closed code change for CS-3 once the key is set;
   - AS-05 locked-org scope;
   - OS-5 export scope.

## Decisions and facts recorded (user, 2026-09-26)

- **CS-3/AS-04:** `WEAVLY_FREE_SIGNING_KEYS` is **not set** in Vercel production, so production signs Free tokens with the public fallback. The owner received the setup steps (new key id, JSON keyring, production redeploy). Impact is limited: the quota is enforced in the database.
- **CS-1:** the owner first confirmed the 100/N weft split; E15 research re-opened it (see decision 1).
- **AS-02:** Free signups stay auto-confirmed for now (accepted temporary risk).
- **Approved and done:** the field Web Vitals read (E6), Package 1F, Package 1A, commit and push.

## Git state

- Branch `maintenance/weavly-refactor`, based on `main` @ `d748008e`, pushed to `origin`. `main` is untouched.
- Preserved: 17 stashes, worktrees, branches, `.env*` files.

| Commit | Package | Content |
| --- | --- | --- |
| `e6bbb7ba` | 1F | `.github/workflows/ci.yml`, `scripts/ci/lint-changed.mjs`, `__tests__/ci-lint-changed.test.ts` |
| `9c682ace` | 1A | `__tests__/costing-{characterization,export-boundary,save-boundary}.test.ts`, `__tests__/fixtures/costing-characterization.ts` |
| docs commit (this file) | — | `docs/maintenance/weavly-refactor/**` including `evidence/p1a-independent-costing.py` |

- **Rollback:** `git revert` the commit for the package concerned.

## Gate results (1F + 1A)

| Check | Result |
| --- | --- |
| Full vitest | PASS: 232 files, 2,019 passed / 1 skipped (baseline 1,989 + 6 + 24) |
| tsc | PASS |
| New code files | lint 0/0 |
| Full lint | unchanged pre-existing 3 errors / 81 warnings |
| 1A mutation check | 6/6 mutations detected (E14) |
| Workflow steps in a clean export | tsc and vitest PASS |
| Lint ratchet cases | seeded violation exit 1; docs-only, recent-commit, zero-SHA and rename cases exit 0 |
| Integrated commit in a disposable clone | tsc, vitest and ratchet PASS |

The CS-1 weft test was renamed from INVARIANT to CHARACTERIZATION after E15; its assertions are unchanged (30/30 new tests re-run PASS).

Limits:
- CI has not yet run on GitHub (it needs a PR or a `main` push).
- CS-2 reopen mapping and Quick/Detailed UI parity remain untested.

## Next proposed package: 1B — disposable database behavior harness

- **Problem:** RPC, RLS and trigger behavior is only text-asserted, and no harness covers migrations `0913`–`0922`.
- **Scope:**
  - `scripts/test-db/` harness: a fresh `initdb` cluster in a temp dir on loopback only, with the E9 Supabase stubs, replaying all migrations and destroyed afterwards.
  - One `package.json` script, `test:db`. `npm test` and CI are unchanged.
  - A first test set labeled CHARACTERIZATION or KNOWN DEFECT: costing save RPC (replay, `no_change`, stale version, immutability), Free debit (replay, exhaustion, binding conflict), locked-org and cross-tenant rejection, and reproductions of OS-1…OS-4.
  - No migrations, schema, app changes or dependencies.
- **Acceptance:**
  - `npm run test:db` passes, with KNOWN DEFECT cases asserting today's failure.
  - The harness refuses non-loopback targets and leaves no running cluster.
  - The full vitest, tsc and lint gates are unchanged.
- **Rollback:** revert its commit.
- **Needs approval:** the new `package.json` script; a local Postgres process runs only during the test.
