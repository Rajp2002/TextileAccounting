# Guided tours: execution status

Implementation state only. Planning is complete (see [PLANNING_CHECKLIST.md](PLANNING_CHECKLIST.md)); **no implementation work has been done.** A task is complete only when its row says PASSED and its ledger entry has the evidence. Only PASSED satisfies a dependency.

States: `NOT_STARTED` · `IN_PROGRESS` · `REVIEW_REQUIRED` · `PASSED` · `FAILED` · `BLOCKED`.

## Task board

| # | Task | Status | Revision at start | Last updated | Ledger |
| --- | --- | --- | --- | --- | --- |
| 1 | GT-00 Baseline and harness | IN_PROGRESS | `2275e920` | 2026-09-27 | [GT-00 ledger](#gt-00--in_progress--2026-09-27) |
| 2 | GT-01 Runtime foundation | NOT_STARTED | — | — | — |
| 3 | GT-02 Invitation and persistence | NOT_STARTED | — | — | — |
| 4 | GT-03 Saved Costings (reference) | NOT_STARTED | — | — | — |
| 5 | GT-04 Gate G1 | NOT_STARTED | — | — | — |
| 6 | GT-05 Cost Estimator | NOT_STARTED | — | — | — |
| 7 | GT-06 Yarn Rate Book | NOT_STARTED | — | — | — |
| 8 | GT-07 Dispatches | NOT_STARTED | — | — | — |
| 9 | GT-08 Fabric Stock | NOT_STARTED | — | — | — |
| 10 | GT-09 Yarn Stock | NOT_STARTED | — | — | — |
| 11 | GT-10 Payroll | NOT_STARTED | — | — | — |
| 12 | GT-11 Production (Overview) | NOT_STARTED | — | — | — |
| 13 | GT-12 Daily Sheet | NOT_STARTED | — | — | — |
| 14 | GT-13 Machines | NOT_STARTED | — | — | — |
| 15 | GT-14 Workers | NOT_STARTED | — | — | — |
| 16 | GT-15 Machine Assignments | NOT_STARTED | — | — | — |
| 17 | GT-16 Retire legacy tour code | NOT_STARTED | — | — | — |
| 18 | GT-17 Final acceptance (G2) | NOT_STARTED | — | — | — |
| — | GT-B1 Stock audit tour | BLOCKED (PI-06, PI-07) | — | — | — |

**Exact next action:** owner decides whether GT-00 may proceed with owner QA runs only, or provides Playwright and Chromium paths so the harness can be verified.

## Planning baseline (for comparison in GT-00)

Recorded 2026-09-27 at `f7cff98` (`claude/gracious-sagan-dnwtsm` = `main`), clean worktree apart from this package.

| Check | Result |
| --- | --- |
| tsc | PASS |
| lint | exit 0 |
| Vitest | 227 files, 1,949 passed, 1 skipped |
| Tour subset | 41 files, 604 passed |
| Harness | every scenario runs; findings in plan §3 |

## Owner answers and decisions

| ID | Question | Answer | Date | By |
| --- | --- | --- | --- | --- |
| U-04 | Does the production database deduct yarn at production save (migration `20260920000000…`), not at dispatch? | Yes. Also: yarn used to make fabric that is still in stock must count toward yarn inventory in the audit, worked out from each quality's costing kg per 100 m (recorded as plan D-19). | 2026-09-27 | Owner |
| U-06 | On QA, does changing date or shift on the Daily Sheet stay on the Daily Sheet? | It should keep the owner on the Daily Sheet for the selected date; past dates up to today, never future dates; purpose: correcting wrong past entries. Recorded as intended behavior; GT-12 verifies the code (PI-04). | 2026-09-27 | Owner |
| GT-B1 | Which path should owners use for a routine count: Correct balance, or Audit → Adjust? | Correct balance. A routine count is about produced fabric in stock and unused (available) yarn, which the Fabric and Yarn Stock pages show; the Stock audit is the full dated record (recorded as plan D-20). | 2026-09-27 | Owner |

## Approved deviations

None. A deviation is recorded here only with the approver's name and the plan/spec section it changes.

## Open issues

None yet.

## Ledger

Append one entry per task session, newest last. Template:

### GT-00 — IN_PROGRESS — 2026-09-27
- Revision / worktree: `tours/implementation` @ `2275e920c1b62a8def0028a3e232418819ad558c`; clean at task start; unrelated uncommitted files left untouched: none.
- Files changed: `docs/guided-tours/EXECUTION_STATUS.md`; git-ignored harness copy created at `scratch/tour-harness/`.
- Deliberate test changes: none.
- Commands and results:
  - `git merge-base --is-ancestor 2275e920 HEAD && ls docs/GUIDED_TOURS_REFINEMENT_PLAN.md docs/guided-tours/EXECUTOR_PROMPT.md` → exit 0; required planning revision and files present.
  - `git checkout -b tours/implementation` → exit 0.
  - `git diff --stat f7cff98 -- components/tours components/estimator/CostEstimateTutorial.tsx components/estimator/SavedCostingsTutorial.tsx components/rates/RateBookTutorial.tsx components/production components/stock components/dispatches components/payroll hooks/use-guided-tour.ts hooks/use-mobile-tour.ts hooks/use-tour-invitation.ts lib/tours lib/*-tour.ts lib/i18n/*tutorial*.ts lib/i18n/tour-invitations.ts lib/mobile-tour-positioning.ts lib/tutorial-target.ts lib/tutorial-viewport-lock.ts app/actions/tour-preferences.ts app/globals.css` → exit 0, no output; no drift.
  - `test -d node_modules` → exit 0; dependencies already present, so `npm ci` was not required. `git status --short package-lock.json` produced no output.
  - `node scripts/performance/isolated-command.mjs node node_modules/typescript/bin/tsc --noEmit --incremental false` → exit 0.
  - `node scripts/performance/isolated-command.mjs npx eslint --max-warnings=0 .` → exit 0, zero warnings.
  - `node scripts/performance/isolated-command.mjs npx vitest run` → exit 0; 227 files passed, 1,949 tests passed, 1 skipped.
  - `node scripts/performance/isolated-command.mjs npx vitest run $(grep -lE "Tutorial|-tour|Tour[A-Z]|TourInvitation|guided-tour|data-[a-z-]*tour" __tests__/*.ts __tests__/*.tsx)` → exit 0; 41 files passed, 604 tests passed.
  - Playwright/Chromium discovery (`test` of documented defaults, `npm root -g`, `command -v`, `require.resolve`, bounded `find /usr /opt`) → neither Playwright nor a Chromium executable found.
- Harness: copied the harness to `scratch/tour-harness/`; scenarios and all four viewports UNVERIFIED because Playwright and Chromium are unavailable. `batch.sh`, `summarize.py`, screenshot review, reduced-motion behavior, focus/scroll/server-call observations, and `baseline-summary.txt` are UNVERIFIED / not produced.
- Evidence types: automated checks done; harness UNVERIFIED; owner QA, review, and native review not required for GT-00.
- Definition of done: branch/revision/worktree/drift recorded — done; type check/lint/full Vitest/tour subset recorded — done; harness batch and baseline summary — not done (UNVERIFIED); tracked-file boundary — done.
- Remaining issues: the required browser harness cannot run in this environment without external Playwright and Chromium installations or valid `PLAYWRIGHT_ROOT` / `CHROMIUM_PATH` values.
- Escalations:
  - **ESCALATION — GT-00**
  - **Blocking condition:** The required harness cannot run because neither Playwright nor Chromium is installed or discoverable.
  - **Specification:** GT-00 "Failure and escalation conditions": "Harness cannot run (no Playwright/Chromium) → mark harness checks UNVERIFIED for the whole program and escalate; the owner decides whether to proceed with owner QA runs only."
  - **Source evidence:** `docs/guided-tours/tasks/GT-00-baseline.md`; documented defaults `/opt/node22/lib/node_modules/playwright` and `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` do not exist; `require.resolve('playwright')`, browser `command -v` checks, and bounded searches under `/usr` and `/opt` found nothing.
  - **Expected:** Playwright resolvable through `PLAYWRIGHT_ROOT` and an executable Chromium at `CHROMIUM_PATH`, allowing `./batch.sh`, `python3 summarize.py`, screenshots, and baseline summary evidence.
  - **Actual:** Both dependencies are absent, so every harness scenario and viewport remains UNVERIFIED.
  - **Tried:** Checked documented defaults, global npm root, Node module resolution, browser commands, and bounded filesystem locations; copied the harness but did not add dependencies or alter `package.json`.
  - **Why this exceeds my discretion:** The packet forbids adding Playwright to project dependencies and requires the owner to decide whether work may proceed using owner QA only.
  - **Smallest decision needed:** Should the program proceed without harness evidence using owner QA runs only, or will Playwright and Chromium be provided with their paths?
  - **Worktree state:** only `docs/guided-tours/EXECUTION_STATUS.md` is tracked and modified; `scratch/tour-harness/` is git-ignored; all automated baseline checks pass; harness verification is outstanding.
- Next action: stop before GT-01 and await the owner's decision or valid `PLAYWRIGHT_ROOT` and `CHROMIUM_PATH` values.

```
### GT-xx — <status> — <date>
- Revision / worktree: <branch> @ <sha>; unrelated uncommitted files left untouched: <list or none>
- Files changed: <list>
- Deliberate test changes: <test file: assertion changed and why>
- Commands and results:
  - <command> → <exit code / totals>
- Harness: scenarios and viewports run; summarize.py excerpt; screenshots kept at <scratch path>
- Evidence types: automated / harness / owner QA / review / native review (say which were done; UNVERIFIED for any required check not run)
- Definition of done: <each item: done / not done>
- Remaining issues: <list or none>
- Escalations: <packet reference or none>
- Next action: <exact next step or next task id>
```
