# Guided tours: execution status

Implementation state only. Planning is complete (see [PLANNING_CHECKLIST.md](PLANNING_CHECKLIST.md)); **no implementation work has been done.** A task is complete only when its row says PASSED and its ledger entry has the evidence. Only PASSED satisfies a dependency.

States: `NOT_STARTED` · `IN_PROGRESS` · `REVIEW_REQUIRED` · `PASSED` · `FAILED` · `BLOCKED`.

## Task board

| # | Task | Status | Revision at start | Last updated | Ledger |
| --- | --- | --- | --- | --- | --- |
| 1 | GT-00 Baseline and harness | NOT_STARTED | — | — | — |
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
| 13 | GT-12 Daily Sheet | NOT_STARTED (needs owner answer U-06 before start) | — | — | — |
| 14 | GT-13 Machines | NOT_STARTED | — | — | — |
| 15 | GT-14 Workers | NOT_STARTED | — | — | — |
| 16 | GT-15 Machine Assignments | NOT_STARTED | — | — | — |
| 17 | GT-16 Retire legacy tour code | NOT_STARTED | — | — | — |
| 18 | GT-17 Final acceptance (G2) | NOT_STARTED | — | — | — |
| — | GT-B1 Stock audit tour | BLOCKED (PI-06, PI-07, owner decision) | — | — | — |

**Exact next action:** start GT-00 in an explicitly initiated execution session (see [EXECUTOR_PROMPT.md](EXECUTOR_PROMPT.md)).

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
| U-04 | Does the production database deduct yarn at production save (migration `20260920000000…`), not at dispatch? | — | — | — |
| U-06 | On QA, does changing date or shift on the Daily Sheet stay on the Daily Sheet? | — | — | — |
| GT-B1 | Which path should owners use for a routine count: Correct balance, or Audit → Adjust? | — | — | — |

## Approved deviations

None. A deviation is recorded here only with the approver's name and the plan/spec section it changes.

## Open issues

None yet.

## Ledger

Append one entry per task session, newest last. Template:

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
