# Guided tours: execution status

Implementation state only. Planning is complete (see [PLANNING_CHECKLIST.md](PLANNING_CHECKLIST.md)); **GT-00, GT-01 and GT-02 are complete.** A task is complete only when its row says PASSED and its ledger entry has the evidence. Only PASSED satisfies a dependency.

States: `NOT_STARTED` · `IN_PROGRESS` · `REVIEW_REQUIRED` · `PASSED` · `FAILED` · `BLOCKED`.

## Task board

| # | Task | Status | Revision at start | Last updated | Ledger |
| --- | --- | --- | --- | --- | --- |
| 1 | GT-00 Baseline and harness | PASSED | 2275e920 | 2026-09-27 | GT-00 targeted recovery entry below |
| 2 | GT-01 Runtime foundation | PASSED | b1ee267c | 2026-09-27 | GT-01 PASSED recovery entry below |
| 3 | GT-02 Invitation and persistence | PASSED | d7a16a4f | 2026-09-27 | GT-02 PASSED entry below |
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

**Exact next action:** Start GT-03 from its packet, `docs/guided-tours/tasks/GT-03-saved-costings.md`, then read only its listed sources and Saved Costings spec sections. GT-02 is PASSED with the authorized Estimator legacy-write cleanup included; its full migration stays in GT-05. GT-03 must stop at REVIEW_REQUIRED for the separate GT-04 reviewer/owner gate. No push or PR authorized.

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

Owner, 2026-09-27: answered “Authorized” to the GT-02 escalation requesting removal of only the Estimator legacy dismissal write/retry path and directly affected test updates. Legacy preference reads remain supported; the full Estimator migration remains in GT-05. No data-safety criterion was waived.

Owner, 2026-09-27: approved a harness-only readiness/sampling correction and a targeted refresh of the five named Estimator baseline comparisons against both GT-00 and GT-01. Original evidence and the other 47 baseline rows remain unchanged. Exact equality remains the criterion; no application behavior, summary calculations or assertions were relaxed.

Owner, 2026-09-27: approved the scratch-only visible-launcher selector correction for GT-00 and instructed rerunning only `rates gu 390x844`, preserving the other 51 completed runs. This supersedes the previous escalation's proposed complete-batch rerun; application code and acceptance criteria remain unchanged.

## Open issues

No open GT-02 escalation. The owner authorized the narrow Estimator cleanup; all six required invitation cases now pass, including the only-`recordTourEventAction` tour-call check. The historical scope-conflict packet and failed preflight evidence remain below. Owner QA, separate reviewer and native-language review remain for the later gates.

No open GT-01 escalation. The owner-approved settling sampler produced exact GT-00/GT-01 comparisons for the five affected Estimator cases; all 52 accepted summaries match. See the PASSED recovery entry. Historical blocked entries are retained.

No open GT-00 blocker. The launcher escalation was resolved by the owner-approved scratch correction and targeted rerun; see the PASSED recovery entry. The earlier failed entry is historical evidence. Existing tour geometry and legacy stub calls remain recorded as the pre-implementation baseline.

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

### GT-00 — BLOCKED — 2026-09-27
- Revision / worktree: `tours/implementation` @ `2275e920c1b62a8def0028a3e232418819ad558c`; isolated worktree `/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas`, clean at task start. Original checkout `/Users/rajpatel/Projects/textile Saas` remains on its existing main revision with unrelated untracked `docs/guided-tours/PLANNING_CHECKLIST.md` left untouched; it differs from the merged file, so isolation preserves it.
- Files changed: tracked: `docs/guided-tours/EXECUTION_STATUS.md` only. Ignored: harness copy, macOS timeout helper, logs, browser records/screenshots and contact-sheet helper/artifacts under `scratch/tour-harness/`. No application, test, config, dependency, lockfile or tracked harness source changes. No commits, pushes or PRs.
- Deliberate test changes: none.
- Commands and results:
  - Original prerequisite command → exit 128 (`2275e920` was unavailable); owner approved updating the checkout.
  - `git fetch origin main` → exit 0 after filesystem escalation; fetched `2275e920`.
  - Managed isolated worktree created from `origin/main`; prerequisite `git merge-base --is-ancestor 2275e920 HEAD && ls docs/GUIDED_TOURS_REFINEMENT_PLAN.md docs/guided-tours/EXECUTOR_PROMPT.md` → exit 0, both files present.
  - `git checkout -b tours/implementation` → exit 0.
  - `git rev-parse --abbrev-ref HEAD`, `git rev-parse HEAD`, `git status --short` → exit 0; branch/revision above, clean.
- Automated baseline (all exit 0, logs in `scratch/tour-harness/`):
  - Specified `git diff --stat f7cff98 -- <GT-00 paths>` → empty; no drift in the listed source files.
  - `npm ci` with Node v24.11.1 / npm 11.6.2 → 1,078 packages installed; `git status --short package-lock.json` empty. No dependency or lockfile changes.
  - `node scripts/performance/isolated-command.mjs node node_modules/typescript/bin/tsc --noEmit --incremental false` → PASS (`typecheck.log`).
  - `node scripts/performance/isolated-command.mjs npm run lint` → PASS, zero warnings (`lint.log`).
  - `node scripts/performance/isolated-command.mjs npx vitest run` → 227 files, 1,949 passed, 1 skipped (`vitest-full.log`).
  - `node scripts/performance/isolated-command.mjs npx vitest run $(rg -l 'Tutorial|-tour|Tour[A-Z]|TourInvitation|guided-tour|data-[a-z-]*tour' __tests__/*.ts __tests__/*.tsx)` → 41 files, 604 passed (`vitest-tours.log`). `rg` selects the same pattern/file set as the plan's `grep` command.
- Harness: copied to `scratch/tour-harness/`. Vite v8.0.16 started via `node scripts/performance/isolated-command.mjs node node_modules/vite/bin/vite.js --config scratch/tour-harness/vite.config.mjs --host 127.0.0.1` (log `vite.log`).
  - Existing Playwright 1.60.0: `PLAYWRIGHT_ROOT=/Users/rajpatel/.npm/_npx/5e2e484947874241/node_modules/`.
  - Existing Chromium: `CHROMIUM_PATH=/Users/rajpatel/Library/Caches/ms-playwright/chromium-1234/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`.
  - macOS has no `timeout`/`gtimeout`; an ignored `scratch/tour-harness/bin/timeout` Python stdlib helper provides the batch's 170-second timeout and exit 124 without installing dependencies or changing tracked harness source.
  - Isolated `run-tour.mjs production en 1440x900 scratch/tour-harness/smoke` → exit 0, 12 steps, only 3 `recordTourEventAction` calls, no navigation. Screenshot `smoke/production-en-1440x900/03.png` visually inspected.
  - From `scratch/tour-harness`, `node ../../scripts/performance/isolated-command.mjs env PLAYWRIGHT_ROOT=<path above> CHROMIUM_PATH=<path above> PATH="$PWD/bin:$PATH" ./batch.sh` → exit 1: `FAIL rates gu 390x844`, `1 run(s) failed` (`batch.log`). All 52 runs attempted; 51 records, 410 recorded steps and 513 screenshots. The failed run has only `out/rates-gu-390x844/00-page.png` and no `record.json`.
  - `node ../../scripts/performance/isolated-command.mjs python3 summarize.py > baseline-summary.txt` → exit 1; full output pasted below. An incomplete run cannot pass unnoticed.
  - Fresh-browser diagnostic retry: `node ../../scripts/performance/isolated-command.mjs env PLAYWRIGHT_ROOT=<path above> CHROMIUM_PATH=<path above> node run-tour.mjs rates gu 390x844 retry` → exit 1. `locator.scrollIntoViewIfNeeded: Timeout 29989.862ms exceeded`; repeated `element is not visible`; location `scratch/tour-harness/run-tour.mjs:26:14`. Error saved to `rates-gu-retry.log`, screenshot to `retry/rates-gu-390x844/00-page.png`. No second retry or launcher-selector change made.
  - Labels scenario: same isolated environment + `node probe-labels.mjs` → exit 0, `ok 26`; 13 routes × gu/hi (`labels-probe.log`, `labels-out.json`).
  - Reduced-motion scenario: same isolated environment + `REDUCED_MOTION=1 node run-tour.mjs production en 1024x768 reduced-motion` → exit 0, 12 steps (`reduced-motion.log`, `reduced-motion/production-en-1024x768/`). The stock runner does not measure animation duration, so this run alone does not verify instant scrolling/absence of transitions.
  - All browser invocations used the existing installation paths above; no project dependency added. The Playwright skill was read; its timeout guard says to classify a timed-out run as blocked and retry at most once with a fresh session. The repository's harness workflow takes precedence over its generic CLI/output-directory defaults.
  - Vite stopped after evidence collection: confirmed port 5199 listener PID 8199; `kill -TERM 8199` → exit 0; server command terminated with exit 143 (intentional shutdown).
- Baseline observations (OBSERVED harness, unchanged source):
  - Geometry issues include panel/target overlap, target clipping/offscreen, rail intersections, missing highlights and a scrolling Workers description; full details below. These are baseline defects, not acceptance of the later tasks' criteria.
  - Completed runs recorded 141 `recordTourEventAction`, 4 `getEstimatorSecondaryData`, 8 `dismissCostEstimateTutorial`, 3 `getCostRateUsage`, and 3 `dismissRatebookTutorial` stub calls. All are intercepted by the harness, with no real backend execution. Zero recorded navigations. Only non-stub console messages are the documented missing-favicon 404. Do not claim the current tours already meet plan §10.4's only-recordTourEventAction criterion.
  - Estimator page-load secondary read located at `app/(dashboard)/owner/estimator/EstimatorClient.tsx:3913–3954`; legacy dismissal located at `components/estimator/CostEstimateTutorial.tsx:102–117`. No source was changed.
  - Screenshots visually inspected: four-viewport contact sheets for production, fabric-stock, yarn-stock, dispatch, payroll, machines, workers, assignments, estimator and free-estimator; plus `out/quotes-en-1440x900/02.png`, `out/free-costings-en-1024x768/01.png`, `out/rates-en-1024x768/06.png`, `out/rates-gu-390x844/00-page.png`, `out/production-gu-390x844/07.png`, and smoke production step 3. Full-size screenshots remain in the run folders. Contact sheets and their source-image manifests remain under `scratch/tour-harness/contact-sheets/`; `contact-sheets.py` uses already-installed Pillow and changes no project dependency.
- Evidence types: repository state and automated checks verified. OBSERVED (harness): 51 completed batch runs, smoke, label probe and reduced-motion run. Rate Book Gujarati phone tour and full-program harness acceptance UNVERIFIED. Animation-duration, real-app, real-device, screen-reader and native-language correctness are not established; owner QA/review/native review remain for later gates.
- Definition of done:
  - Branch, revision, worktree state and drift check recorded: DONE.
  - tsc, lint, full Vitest and tour-subset results recorded: DONE; all pass.
  - Harness batch ran, summary saved and pasted: evidence recorded, but acceptance NOT DONE because one run is incomplete (batch and summary exit 1).
  - No tracked file changed except `EXECUTION_STATUS.md`: DONE; final status/stat/full diff and whitespace check reviewed.
- Deliberate test changes: none; no tests weakened or removed.
- Remaining issues: one reproducible harness launcher failure; baseline geometry and legacy stub calls listed above. GT-01, GT-02 and GT-03 remain NOT_STARTED.
- Escalations: GT-00 packet below.
- Next action: obtain the owner/senior decision in the escalation packet. If the scratch launcher correction is approved, change only the selector described below, restart the isolated Vite harness with the recorded paths, rerun the full batch and summary, and record new evidence. Do not mark GT-00 PASSED or create its commit before all required checks pass; do not start GT-01.

#### GT-00 baseline-summary.txt (verbatim; exit 1)

```text
assignments-en-1024x768 steps=7 panelCornerChanges=3 serverCalls=3 nav=0 s1 overlap=65410
assignments-en-1440x900 steps=7 panelCornerChanges=2 serverCalls=3 nav=0 s1 overlap=25584
assignments-gu-390x844 steps=7 panelCornerChanges=0 serverCalls=3 nav=0 no geometry issues
assignments-hi-1280x800 steps=7 panelCornerChanges=2 serverCalls=3 nav=0 s1 overlap=20661
dispatch-en-1024x768 steps=11 panelCornerChanges=4 serverCalls=3 nav=0 no geometry issues
dispatch-en-1440x900 steps=11 panelCornerChanges=4 serverCalls=3 nav=0 s1 rail-rect-intersects(check screenshot); s2 rail-rect-intersects(check screenshot); s3 rail-rect-intersects(check screenshot); s4 rail-rect-intersects(check screenshot); s5 rail-rect-intersects(check screenshot); s6 rail-rect-intersects(check screenshot); s7 rail-rect-intersects(check screenshot); s8 rail-rect-intersects(check screenshot); s9 rail-rect-intersects(check screenshot); s10 rail-rect-intersects(check screenshot); s11 rail-rect-intersects(check screenshot)
dispatch-gu-390x844 steps=11 panelCornerChanges=0 serverCalls=3 nav=0 no geometry issues
dispatch-hi-1280x800 steps=11 panelCornerChanges=4 serverCalls=3 nav=0 no geometry issues
estimator-en-1024x768 steps=10 panelCornerChanges=1 serverCalls=4 nav=0 s2 overlap=31374; s3 target-clipped; s4 target-clipped; s6 target-clipped; s7 overlap=52089; s8 overlap=52089; s9 overlap=52089; s10 TARGET-OFFSCREEN y=-666
estimator-en-1440x900 steps=10 panelCornerChanges=1 serverCalls=4 nav=0 s2 overlap=2460; s2 rail-rect-intersects(check screenshot); s3 target-clipped; s4 target-clipped; s7 rail-rect-intersects(check screenshot); s8 rail-rect-intersects(check screenshot); s9 rail-rect-intersects(check screenshot); s10 target-clipped
estimator-gu-390x844 steps=10 panelCornerChanges=0 serverCalls=4 nav=0 s8 NO-HIGHLIGHT; s9 NO-HIGHLIGHT
estimator-hi-1280x800 steps=10 panelCornerChanges=1 serverCalls=4 nav=0 s2 overlap=10769; s3 target-clipped; s4 target-clipped; s6 target-clipped; s7 overlap=13770; s8 overlap=13770; s9 overlap=13770
fabric-stock-en-1024x768 steps=7 panelCornerChanges=1 serverCalls=3 nav=0 s3 overlap=45260
fabric-stock-en-1440x900 steps=7 panelCornerChanges=1 serverCalls=3 nav=0 s1 rail-rect-intersects(check screenshot); s2 rail-rect-intersects(check screenshot); s3 rail-rect-intersects(check screenshot); s4 rail-rect-intersects(check screenshot); s5 rail-rect-intersects(check screenshot); s6 rail-rect-intersects(check screenshot); s7 rail-rect-intersects(check screenshot)
fabric-stock-gu-390x844 steps=7 panelCornerChanges=0 serverCalls=3 nav=0 no geometry issues
fabric-stock-hi-1280x800 steps=7 panelCornerChanges=1 serverCalls=3 nav=0 no geometry issues
free-costings-en-1024x768 steps=4 panelCornerChanges=2 serverCalls=2 nav=0 s1 overlap=70000
free-costings-en-1440x900 steps=4 panelCornerChanges=1 serverCalls=2 nav=0 s4 rail-rect-intersects(check screenshot)
free-costings-gu-390x844 steps=4 panelCornerChanges=0 serverCalls=2 nav=0 no geometry issues
free-costings-hi-1280x800 steps=4 panelCornerChanges=2 serverCalls=2 nav=0 s1 overlap=11500
free-estimator-en-1024x768 steps=9 panelCornerChanges=1 serverCalls=3 nav=0 s2 target-clipped; s3 target-clipped; s4 target-clipped; s6 target-clipped; s7 overlap=52089; s8 overlap=48330; s9 target-clipped
free-estimator-en-1440x900 steps=9 panelCornerChanges=1 serverCalls=3 nav=0 s2 target-clipped; s3 target-clipped; s4 target-clipped; s7 rail-rect-intersects(check screenshot); s8 rail-rect-intersects(check screenshot); s9 target-clipped
free-estimator-gu-390x844 steps=9 panelCornerChanges=0 serverCalls=3 nav=0 s8 NO-HIGHLIGHT
free-estimator-hi-1280x800 steps=9 panelCornerChanges=1 serverCalls=3 nav=0 s2 target-clipped; s3 target-clipped; s4 target-clipped; s6 target-clipped; s7 overlap=13770; s8 overlap=12699; s9 overlap=5520; s9 target-clipped
machines-en-1024x768 steps=6 panelCornerChanges=3 serverCalls=3 nav=0 no geometry issues
machines-en-1440x900 steps=6 panelCornerChanges=2 serverCalls=3 nav=0 s2 rail-rect-intersects(check screenshot)
machines-gu-390x844 steps=6 panelCornerChanges=0 serverCalls=3 nav=0 no geometry issues
machines-hi-1280x800 steps=6 panelCornerChanges=2 serverCalls=3 nav=0 no geometry issues
payroll-en-1024x768 steps=10 panelCornerChanges=2 serverCalls=3 nav=0 s1 overlap=620; s3 overlap=7440; s4 overlap=10850
payroll-en-1440x900 steps=10 panelCornerChanges=2 serverCalls=3 nav=0 s1 rail-rect-intersects(check screenshot); s2 rail-rect-intersects(check screenshot); s3 rail-rect-intersects(check screenshot); s4 rail-rect-intersects(check screenshot); s5 rail-rect-intersects(check screenshot); s6 rail-rect-intersects(check screenshot); s7 rail-rect-intersects(check screenshot); s8 rail-rect-intersects(check screenshot); s9 rail-rect-intersects(check screenshot); s10 rail-rect-intersects(check screenshot)
payroll-gu-390x844 steps=10 panelCornerChanges=0 serverCalls=3 nav=0 no geometry issues
payroll-hi-1280x800 steps=10 panelCornerChanges=3 serverCalls=3 nav=0 no geometry issues
production-en-1024x768 steps=12 panelCornerChanges=1 serverCalls=3 nav=0 no geometry issues
production-en-1440x900 steps=12 panelCornerChanges=3 serverCalls=3 nav=0 s1 rail-rect-intersects(check screenshot); s2 rail-rect-intersects(check screenshot); s3 rail-rect-intersects(check screenshot); s4 rail-rect-intersects(check screenshot); s5 rail-rect-intersects(check screenshot); s6 rail-rect-intersects(check screenshot); s7 rail-rect-intersects(check screenshot); s8 rail-rect-intersects(check screenshot); s9 rail-rect-intersects(check screenshot); s10 rail-rect-intersects(check screenshot); s11 rail-rect-intersects(check screenshot); s12 rail-rect-intersects(check screenshot)
production-gu-390x844 steps=12 panelCornerChanges=0 serverCalls=3 nav=0 no geometry issues
production-hi-1280x800 steps=12 panelCornerChanges=1 serverCalls=3 nav=0 no geometry issues
quotes-en-1024x768 steps=7 panelCornerChanges=3 serverCalls=3 nav=0 s2 overlap=22348
quotes-en-1440x900 steps=7 panelCornerChanges=1 serverCalls=3 nav=0 s2 overlap=51512; s2 rail-rect-intersects(check screenshot); s3 rail-rect-intersects(check screenshot); s7 rail-rect-intersects(check screenshot)
quotes-gu-390x844 steps=7 panelCornerChanges=0 serverCalls=3 nav=0 no geometry issues
quotes-hi-1280x800 steps=7 panelCornerChanges=2 serverCalls=3 nav=0 s1 overlap=555; s2 overlap=25164
rates-en-1024x768 steps=6 panelCornerChanges=1 serverCalls=5 nav=0 s6 NO-HIGHLIGHT
rates-en-1440x900 steps=6 panelCornerChanges=1 serverCalls=5 nav=0 s3 overlap=322; s4 overlap=368; s5 overlap=2576
rates-gu-390x844 INCOMPLETE: no record.json (crashed or timed out)
rates-hi-1280x800 steps=6 panelCornerChanges=1 serverCalls=5 nav=0 s2 overlap=663
workers-en-1024x768 steps=7 panelCornerChanges=2 serverCalls=3 nav=0 s1 overlap=39990
workers-en-1440x900 steps=7 panelCornerChanges=2 serverCalls=3 nav=0 s2 rail-rect-intersects(check screenshot); s3 rail-rect-intersects(check screenshot)
workers-gu-390x844 steps=7 panelCornerChanges=0 serverCalls=3 nav=0 s1 desc-scrolls
workers-hi-1280x800 steps=7 panelCornerChanges=2 serverCalls=3 nav=0 s1 overlap=5529
yarn-stock-en-1024x768 steps=8 panelCornerChanges=1 serverCalls=3 nav=0 s2 overlap=23560
yarn-stock-en-1440x900 steps=8 panelCornerChanges=1 serverCalls=3 nav=0 s1 rail-rect-intersects(check screenshot); s2 rail-rect-intersects(check screenshot); s3 rail-rect-intersects(check screenshot); s4 rail-rect-intersects(check screenshot); s5 rail-rect-intersects(check screenshot); s6 rail-rect-intersects(check screenshot); s7 rail-rect-intersects(check screenshot); s8 rail-rect-intersects(check screenshot)
yarn-stock-gu-390x844 steps=8 panelCornerChanges=0 serverCalls=3 nav=0 no geometry issues
yarn-stock-hi-1280x800 steps=8 panelCornerChanges=1 serverCalls=3 nav=0 s2 overlap=23560
```

#### ESCALATION — GT-00 (resolved by approved targeted recovery below)

- Blocking condition: the required Rate Book / Gujarati / 390×844 harness run cannot start the tour because the runner's first matching launcher is not visible; it failed in the batch and again in a fresh browser.
- Specification: GT-00 Required implementation §5: "start Vite, run `./batch.sh` and `python3 summarize.py`"; Verification: "the harness summary lists every scenario in `main.tsx`." EXECUTOR_PROMPT §3: "A required check that did not run is UNVERIFIED, and the task cannot pass with it." GT-00's harness failure rule requires escalation; Playwright and Chromium are present here, so the blocker is selector behavior, not missing binaries.
- Source evidence: `scratch/tour-harness/run-tour.mjs:23` uses `page.locator(launcher).first()`; line 26 scrolls/clicks that match. `scratch/tour-harness/rates-gu-retry.log` reports a 29,989.862 ms scroll timeout and repeated `element is not visible`; batch exit 1 reports `FAIL rates gu 390x844`; summary exit 1 reports the missing record. Screenshot `scratch/tour-harness/out/rates-gu-390x844/00-page.png` visibly shows a separate phone guide launcher. No drift from `f7cff98` in the required paths.
- Expected: all 52 tour/viewport runs produce complete records, plus the labels scenario; batch and summary exit 0 before proceeding.
- Actual: 51/52 batch records (410 steps) complete; the Gujarati Rate Book phone run is INCOMPLETE. All automated baseline checks pass; the labels probe passes. The full harness baseline remains UNVERIFIED.
- Tried: used existing Playwright 1.60.0 and Chromium, ran the isolated Vite harness, provided a scratch-only macOS timeout equivalent, ran the complete batch, made one fresh-browser retry with preserved stderr, and inspected the failure screenshot and runner source. Application code and tracked harness source were left untouched.
- Why this exceeds my discretion: accepting the partial matrix would violate EXECUTOR_PROMPT §3. GT-00's specified local discretion covers launching Vite and locating Playwright/Chromium, not changing which launcher the baseline script chooses. The proposed correction is small, but I have not treated that unverified validation-path change as permission to pass the gate.
- Smallest decision needed: approve changing only `scratch/tour-harness/run-tour.mjs:23` from `const button = page.locator(launcher).first()` to `const button = page.locator(launcher).filter({ visible: true }).first()` and rerunning the entire GT-00 harness baseline? This is a proposed correction, not implemented or verified; no acceptance criteria or application behavior would be changed.
- Worktree state: `tours/implementation` @ `2275e920c1b62a8def0028a3e232418819ad558c`; only tracked change is this uncommitted ledger. All scratch evidence retained, Vite stopped. Original checkout's untracked planning checklist preserved. No commits/pushes/PRs; tsc, lint, full tests and tour subset pass. GT-01–GT-03 NOT_STARTED.

### GT-00 — PASSED — 2026-09-27 — approved targeted recovery
- Revision / worktree: `tours/implementation` @ `2275e920c1b62a8def0028a3e232418819ad558c`; existing ledger and scratch evidence retained; original checkout's unrelated checklist untouched.
- Owner instruction: apply the approved selector correction and rerun only the failed Gujarati phone Rate Book scenario; do not repeat all 52 runs. Finish GT-00.
- Files changed: scratch runner line 23 now uses `page.locator(launcher).filter({ visible: true }).first()`; this ledger records approval and targeted recovery. No application/test/dependency/lockfile changes.
- Deliberate test changes: no unit/source-contract test changes; the owner-approved scratch harness selection chooses the first visible launcher, preserving the scenario and assertions.
- Preserved evidence: prior summary copied to `scratch/tour-harness/baseline-summary-incomplete.txt`; failed screenshot copied to `rates-gu-before-selector-fix.png`; SHA-256 and modification time of each of the 51 completed records saved in `preserved-51-records.json`.
- Commands and results:
  - `git rev-parse --abbrev-ref HEAD`, `git rev-parse HEAD`, `git status --short` → branch/revision unchanged from the preceding session; only the existing execution-ledger edit tracked.
  - Started Vite with the same isolated command and existing browser paths recorded above; server log `scratch/tour-harness/vite-targeted-retry.log`. Vite emitted CSS import-order warnings from unchanged `app/globals.css`; no source/CSS changes made.
  - From `scratch/tour-harness`: `node ../../scripts/performance/isolated-command.mjs env PLAYWRIGHT_ROOT=/Users/rajpatel/.npm/_npx/5e2e484947874241/node_modules/ 'CHROMIUM_PATH=/Users/rajpatel/Library/Caches/ms-playwright/chromium-1234/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' node run-tour.mjs rates gu 390x844` → exit 0; all 6 steps (`1/6` through `6/6`), final record and screenshots saved to `out/rates-gu-390x844/`; log `rates-gu-visible-launcher.log`.
  - `node ../../scripts/performance/isolated-command.mjs python3 summarize.py > baseline-summary.txt` → exit 0; 52 complete scenario/viewport records, 416 total steps. Full combined summary pasted below.
  - Read-only SHA-256 and modification-time comparison against `preserved-51-records.json` → all 51 original records unchanged. Only the failed Rate Book scenario was rerun. `./batch.sh` was NOT rerun; the historical batch exit 1 remains recorded, and the owner-approved targeted rerun closes its sole missing record.
  - Prior tsc, zero-warning `npm run lint`, full Vitest (227 files, 1,949 passed, 1 skipped), and tour subset (41 files, 604 passed) remain valid for unchanged application, test and dependency files. Not rerun for this scratch-only selector/ledger change.
  - `git diff --check` → exit 0; `git diff --exit-code -- package.json package-lock.json` → exit 0. Final full tracked diff reviewed; only this ledger is tracked.
  - Confirmed Vite listener PID 12282, then `kill -TERM 12282` → stopped the task's local harness after successful evidence collection.
- Harness: OBSERVED (harness), targeted run completed. Visually inspected `out/rates-gu-390x844/01.png`, `03.png` and `06.png`; step 6 has the existing missing-highlight baseline issue, now recorded. No recorded navigation. Stub calls: 3 `recordTourEventAction`, 1 `getCostRateUsage`, 1 `dismissRatebookTutorial`; no real backend execution. Missing-resource 404 messages remain in the log. Existing tour geometry and legacy calls are baseline findings, not claims that later implementation requirements are already satisfied.
- Evidence types: automated baseline and full scenario-record coverage verified, with the owner-approved targeted rerun and all prior successful records retained. No GT-00-required check remains UNVERIFIED. Real-app/real-device, screen-reader, animation timing and native-language correctness are not established by this harness baseline and remain for later task/review gates.
- Definition of done: branch/revision/worktree/drift recorded; automated baseline recorded and passing; all 52 harness records present, combined summary saved/pasted and exit 0; only `EXECUTION_STATUS.md` tracked. All GT-00 items DONE with the owner-approved targeted recovery.
- Remaining issues: no GT-00 blocker. Existing baseline geometry/legacy calls retained for later implementation tasks.
- Escalations: prior GT-00 launcher escalation RESOLVED by owner approval and passing targeted rerun.
- Commit: task is PASSED and ready for the explicitly requested `feat(tours): GT-00 Validate the baseline, assumptions and harness` commit; no push or PR authorized.
- Next action/checkpoint: commit this completed GT-00 ledger on `tours/implementation`, then the next eligible task is GT-01. Read its packet and cited files/sections before changing application code. GT-01–GT-03 remain NOT_STARTED at this checkpoint. Keep `scratch/tour-harness/run-tour.mjs`'s approved visible-launcher correction and the existing `PLAYWRIGHT_ROOT`, `CHROMIUM_PATH`, and macOS timeout helper; the local Vite server is stopped.

#### GT-00 completed baseline-summary.txt (51 retained records + one approved targeted rerun; exit 0)

```text
assignments-en-1024x768 steps=7 panelCornerChanges=3 serverCalls=3 nav=0 s1 overlap=65410
assignments-en-1440x900 steps=7 panelCornerChanges=2 serverCalls=3 nav=0 s1 overlap=25584
assignments-gu-390x844 steps=7 panelCornerChanges=0 serverCalls=3 nav=0 no geometry issues
assignments-hi-1280x800 steps=7 panelCornerChanges=2 serverCalls=3 nav=0 s1 overlap=20661
dispatch-en-1024x768 steps=11 panelCornerChanges=4 serverCalls=3 nav=0 no geometry issues
dispatch-en-1440x900 steps=11 panelCornerChanges=4 serverCalls=3 nav=0 s1 rail-rect-intersects(check screenshot); s2 rail-rect-intersects(check screenshot); s3 rail-rect-intersects(check screenshot); s4 rail-rect-intersects(check screenshot); s5 rail-rect-intersects(check screenshot); s6 rail-rect-intersects(check screenshot); s7 rail-rect-intersects(check screenshot); s8 rail-rect-intersects(check screenshot); s9 rail-rect-intersects(check screenshot); s10 rail-rect-intersects(check screenshot); s11 rail-rect-intersects(check screenshot)
dispatch-gu-390x844 steps=11 panelCornerChanges=0 serverCalls=3 nav=0 no geometry issues
dispatch-hi-1280x800 steps=11 panelCornerChanges=4 serverCalls=3 nav=0 no geometry issues
estimator-en-1024x768 steps=10 panelCornerChanges=1 serverCalls=4 nav=0 s2 overlap=31374; s3 target-clipped; s4 target-clipped; s6 target-clipped; s7 overlap=52089; s8 overlap=52089; s9 overlap=52089; s10 TARGET-OFFSCREEN y=-666
estimator-en-1440x900 steps=10 panelCornerChanges=1 serverCalls=4 nav=0 s2 overlap=2460; s2 rail-rect-intersects(check screenshot); s3 target-clipped; s4 target-clipped; s7 rail-rect-intersects(check screenshot); s8 rail-rect-intersects(check screenshot); s9 rail-rect-intersects(check screenshot); s10 target-clipped
estimator-gu-390x844 steps=10 panelCornerChanges=0 serverCalls=4 nav=0 s8 NO-HIGHLIGHT; s9 NO-HIGHLIGHT
estimator-hi-1280x800 steps=10 panelCornerChanges=1 serverCalls=4 nav=0 s2 overlap=10769; s3 target-clipped; s4 target-clipped; s6 target-clipped; s7 overlap=13770; s8 overlap=13770; s9 overlap=13770
fabric-stock-en-1024x768 steps=7 panelCornerChanges=1 serverCalls=3 nav=0 s3 overlap=45260
fabric-stock-en-1440x900 steps=7 panelCornerChanges=1 serverCalls=3 nav=0 s1 rail-rect-intersects(check screenshot); s2 rail-rect-intersects(check screenshot); s3 rail-rect-intersects(check screenshot); s4 rail-rect-intersects(check screenshot); s5 rail-rect-intersects(check screenshot); s6 rail-rect-intersects(check screenshot); s7 rail-rect-intersects(check screenshot)
fabric-stock-gu-390x844 steps=7 panelCornerChanges=0 serverCalls=3 nav=0 no geometry issues
fabric-stock-hi-1280x800 steps=7 panelCornerChanges=1 serverCalls=3 nav=0 no geometry issues
free-costings-en-1024x768 steps=4 panelCornerChanges=2 serverCalls=2 nav=0 s1 overlap=70000
free-costings-en-1440x900 steps=4 panelCornerChanges=1 serverCalls=2 nav=0 s4 rail-rect-intersects(check screenshot)
free-costings-gu-390x844 steps=4 panelCornerChanges=0 serverCalls=2 nav=0 no geometry issues
free-costings-hi-1280x800 steps=4 panelCornerChanges=2 serverCalls=2 nav=0 s1 overlap=11500
free-estimator-en-1024x768 steps=9 panelCornerChanges=1 serverCalls=3 nav=0 s2 target-clipped; s3 target-clipped; s4 target-clipped; s6 target-clipped; s7 overlap=52089; s8 overlap=48330; s9 target-clipped
free-estimator-en-1440x900 steps=9 panelCornerChanges=1 serverCalls=3 nav=0 s2 target-clipped; s3 target-clipped; s4 target-clipped; s7 rail-rect-intersects(check screenshot); s8 rail-rect-intersects(check screenshot); s9 target-clipped
free-estimator-gu-390x844 steps=9 panelCornerChanges=0 serverCalls=3 nav=0 s8 NO-HIGHLIGHT
free-estimator-hi-1280x800 steps=9 panelCornerChanges=1 serverCalls=3 nav=0 s2 target-clipped; s3 target-clipped; s4 target-clipped; s6 target-clipped; s7 overlap=13770; s8 overlap=12699; s9 overlap=5520; s9 target-clipped
machines-en-1024x768 steps=6 panelCornerChanges=3 serverCalls=3 nav=0 no geometry issues
machines-en-1440x900 steps=6 panelCornerChanges=2 serverCalls=3 nav=0 s2 rail-rect-intersects(check screenshot)
machines-gu-390x844 steps=6 panelCornerChanges=0 serverCalls=3 nav=0 no geometry issues
machines-hi-1280x800 steps=6 panelCornerChanges=2 serverCalls=3 nav=0 no geometry issues
payroll-en-1024x768 steps=10 panelCornerChanges=2 serverCalls=3 nav=0 s1 overlap=620; s3 overlap=7440; s4 overlap=10850
payroll-en-1440x900 steps=10 panelCornerChanges=2 serverCalls=3 nav=0 s1 rail-rect-intersects(check screenshot); s2 rail-rect-intersects(check screenshot); s3 rail-rect-intersects(check screenshot); s4 rail-rect-intersects(check screenshot); s5 rail-rect-intersects(check screenshot); s6 rail-rect-intersects(check screenshot); s7 rail-rect-intersects(check screenshot); s8 rail-rect-intersects(check screenshot); s9 rail-rect-intersects(check screenshot); s10 rail-rect-intersects(check screenshot)
payroll-gu-390x844 steps=10 panelCornerChanges=0 serverCalls=3 nav=0 no geometry issues
payroll-hi-1280x800 steps=10 panelCornerChanges=3 serverCalls=3 nav=0 no geometry issues
production-en-1024x768 steps=12 panelCornerChanges=1 serverCalls=3 nav=0 no geometry issues
production-en-1440x900 steps=12 panelCornerChanges=3 serverCalls=3 nav=0 s1 rail-rect-intersects(check screenshot); s2 rail-rect-intersects(check screenshot); s3 rail-rect-intersects(check screenshot); s4 rail-rect-intersects(check screenshot); s5 rail-rect-intersects(check screenshot); s6 rail-rect-intersects(check screenshot); s7 rail-rect-intersects(check screenshot); s8 rail-rect-intersects(check screenshot); s9 rail-rect-intersects(check screenshot); s10 rail-rect-intersects(check screenshot); s11 rail-rect-intersects(check screenshot); s12 rail-rect-intersects(check screenshot)
production-gu-390x844 steps=12 panelCornerChanges=0 serverCalls=3 nav=0 no geometry issues
production-hi-1280x800 steps=12 panelCornerChanges=1 serverCalls=3 nav=0 no geometry issues
quotes-en-1024x768 steps=7 panelCornerChanges=3 serverCalls=3 nav=0 s2 overlap=22348
quotes-en-1440x900 steps=7 panelCornerChanges=1 serverCalls=3 nav=0 s2 overlap=51512; s2 rail-rect-intersects(check screenshot); s3 rail-rect-intersects(check screenshot); s7 rail-rect-intersects(check screenshot)
quotes-gu-390x844 steps=7 panelCornerChanges=0 serverCalls=3 nav=0 no geometry issues
quotes-hi-1280x800 steps=7 panelCornerChanges=2 serverCalls=3 nav=0 s1 overlap=555; s2 overlap=25164
rates-en-1024x768 steps=6 panelCornerChanges=1 serverCalls=5 nav=0 s6 NO-HIGHLIGHT
rates-en-1440x900 steps=6 panelCornerChanges=1 serverCalls=5 nav=0 s3 overlap=322; s4 overlap=368; s5 overlap=2576
rates-gu-390x844 steps=6 panelCornerChanges=0 serverCalls=5 nav=0 s6 NO-HIGHLIGHT
rates-hi-1280x800 steps=6 panelCornerChanges=1 serverCalls=5 nav=0 s2 overlap=663
workers-en-1024x768 steps=7 panelCornerChanges=2 serverCalls=3 nav=0 s1 overlap=39990
workers-en-1440x900 steps=7 panelCornerChanges=2 serverCalls=3 nav=0 s2 rail-rect-intersects(check screenshot); s3 rail-rect-intersects(check screenshot)
workers-gu-390x844 steps=7 panelCornerChanges=0 serverCalls=3 nav=0 s1 desc-scrolls
workers-hi-1280x800 steps=7 panelCornerChanges=2 serverCalls=3 nav=0 s1 overlap=5529
yarn-stock-en-1024x768 steps=8 panelCornerChanges=1 serverCalls=3 nav=0 s2 overlap=23560
yarn-stock-en-1440x900 steps=8 panelCornerChanges=1 serverCalls=3 nav=0 s1 rail-rect-intersects(check screenshot); s2 rail-rect-intersects(check screenshot); s3 rail-rect-intersects(check screenshot); s4 rail-rect-intersects(check screenshot); s5 rail-rect-intersects(check screenshot); s6 rail-rect-intersects(check screenshot); s7 rail-rect-intersects(check screenshot); s8 rail-rect-intersects(check screenshot)
yarn-stock-gu-390x844 steps=8 panelCornerChanges=0 serverCalls=3 nav=0 no geometry issues
yarn-stock-hi-1280x800 steps=8 panelCornerChanges=1 serverCalls=3 nav=0 s2 overlap=23560
```

### GT-01 — IN_PROGRESS — 2026-09-27
- Revision / worktree: `tours/implementation` @ `b1ee267c86a29179083c58224e3a851b4e58b0f2`, clean at start; original checkout's unrelated checklist remains untouched.
- Files changed: this ledger; implementation pending in the packet's allowed surface.
- Deliberate test changes: pending; only the mobile settle-timer assertion may change, as specified.
- Commands and results: branch/revision/status read successfully; GT-00 PASSED verified; required plan sections, sources and existing tests read. No source drift since GT-00.
- Harness: GT-00 records and corrected visible-launcher runner retained. Foundation checks and existing-tour regression UNVERIFIED until run.
- Evidence types: implementation/type/lint/full-suite and harness verification pending.
- Definition of done: all items pending.
- Remaining issues: none established.
- Escalations: none.
- Next action: implement the specified pure helpers and shared copy, then the step runtime, panel/composition, tests and foundation harness; verify before committing.


### GT-01 — IN_PROGRESS — implementation and verification checkpoint — 2026-09-27
- Revision / worktree: `tours/implementation` @ `b1ee267c86a29179083c58224e3a851b4e58b0f2`, `/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas`. GT-01 changes are uncommitted. The unrelated original-checkout planning checklist is untouched. Nothing pushed; no PR.
- Files changed:
  - New runtime helpers: `lib/tours/{placement,target-readiness,tour-scroll,tour-text,active-tour,sample-ids}.ts`; approved shared copy: `lib/i18n/tour-common.ts`; new components: `components/tours/{GuidedTour,TourPanel,TourSpotlight}.tsx`.
  - Allowed shared changes: `hooks/use-guided-tour.ts`, `hooks/use-mobile-tour.ts`, `lib/mobile-tour-positioning.ts`, and additive `TourStepSpec` in `lib/tours/tour-types.ts`. No existing tour components, wrappers, copy files, live pages, server code, global CSS, dependencies or lockfile changed.
  - Eight new packet-listed test files; one permitted existing test edit below.
  - Tracked harness `README.md`, `main.tsx`, `run-tour.mjs`, `summarize.py`; this ledger. Ignored scratch contains evidence and diagnostic probes/control copies.
- Deliberate test changes: `__tests__/mobile-tour-positioning.test.ts`'s deferred-layout case now advances animation frames instead of the removed 350ms settle timer. A single-frame helper was added; the assertions still require a null measurement before visibility, the correct measured rect after layout, and exactly one scroll. No other existing test changed. Eight new files add 49 tests for placement, target resolution/stability/cancellation, scrolling/restoration, tokens, active guard, sample IDs, approved copy parity/native script, panel SSR and spotlight geometry.
- Implementation review: two-frame stability with a 1,500ms budget; 400ms preparing text; fresh preparation for revisits and one recovery; listeners only while tracking a ready target; actual scroll-container restore; retained placement while preparing; panel/spotlight motion and reduced-motion suppression; Back removal focuses Next; completion uses only existing `persistTourCompleted`; no business action, draft, Free allowance, navigation or refresh paths added. Shared strings match plan §9.3 exactly.
- Commands and results (all verification children run through `node scripts/performance/isolated-command.mjs`, or `node ../../scripts/performance/isolated-command.mjs` from the scratch harness):
  - Initial `npx tsc --noEmit --incremental false` → exit 0. Focused `npx vitest run` over the eight new tests plus guided-tour-focus, mobile-tour-positioning, tutorial-target and tutorial-viewport-lock → 12 files / 80 tests passed (`scratch/tour-harness/gt01-focused.log`).
  - Initial `npm run lint` → one unnecessary useMemo dependency warning; corrected locally. No assertion weakened.
  - Final `npx tsc --noEmit --incremental false` → exit 0 (`gt01-types.log`); `npm run lint` → exit 0, zero warnings (`gt01-lint.log`); `npx vitest run` → exit 0, 235 files, 1,998 passed, one existing finance-test skip (`gt01-full-tests.log`, final run started 19:41:07, duration 106.52s). Earlier complete runs also passed with the same totals. Final application edit was reduced-motion suppression in the new spotlight; subsequent edits only improved scratch/recorded harness capture and documentation.
  - Main local harness: isolated `node node_modules/vite/bin/vite.js --config scratch/tour-harness/vite.config.mjs --host 127.0.0.1` → localhost:5199. All real server modules/browser services remain stubbed. Existing PostCSS import-order notices and missing-favicon 404 are the harness's known notices.
  - Browser paths passed after the wrapper via `env PLAYWRIGHT_ROOT=/Users/rajpatel/.npm/_npx/5e2e484947874241/node_modules/ CHROMIUM_PATH="/Users/rajpatel/Library/Caches/ms-playwright/chromium-1234/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"`.
  - `node run-tour.mjs foundation en 1440x900 gt01-foundation`, `... foundation en 1024x768 gt01-foundation`, `... foundation gu 390x844 gt01-foundation`, and `env REDUCED_MOTION=1 ... foundation en 1024x768 gt01-foundation-reduced` → all exit 0, six steps each, no recorded issues, zero server calls and zero navigation. Separate output roots preserve GT-00.
  - `node gt01-runtime-probe.mjs` → final exit 0 at 1024×768 and 390×844: More detail resets, 400ms recovery message, one recovery then unavailable, navigation remains enabled, revisit recovers, Exit restores focus, guard releases for replay, Done closes, page inertness restored, no server calls/navigation. Its first scratch creation command had a duplicate path prefix (corrected before execution); a later probe timeout was fixed by waiting for the requested step ID as well as ready, rather than accepting the prior step's ready state. These were probe fixes, not relaxed runtime assertions.
  - `node gt01-motion-probe.mjs` → initially caught a 120ms hidden-outline fade under reduced motion; new spotlight fixed, final exit 0: ready and preparing both have zero transition durations and zero animations (`gt01-motion-probe.json`).
  - Visual review caught the fake harness sidebar covering foundation boxes 1/5 and the phone scroller covering part of box 2. Corrected only the foundation fixture (no fake sidebar in that scenario; phone centre box moved clear of the scroller), then reran all four checks. The runner now waits for the foundation's intentional transition to finish before screenshots after its Back/Next keyboard probe. Final screenshots reviewed.
  - Isolated `env TOUR_OUT_DIR=gt01-regression ... PATH="$PWD/bin:$PATH" ./batch.sh` → exit 0, 52 complete records / 416 steps; `python3 summarize.py gt01-regression` → exit 0. `diff -u baseline-summary.txt gt01-regression-summary.txt` → exit 1: six differing summaries, listed in `gt01-regression-diff.txt`. No records overwritten in `out/`.
  - Targeted retry only: `node run-tour.mjs <scenario> <language> <size> gt01-regression-retry` for estimator en1440×900, en1024×768, hi1280×800; free-estimator en1440×900, hi1280×800; rates en1024×768 → all exit 0. `python3 summarize.py gt01-regression-retry` → exit 0. Rate Book matches GT-00 on retry; all five Estimator summaries still differ. Original regression records retained alongside retries. No second 52-case batch.
  - `git diff --check` → clean; explicit allowed-surface audit → all 28 changed/new tracked paths allowed; scratch and tracked `main.tsx`, `run-tour.mjs`, `summarize.py` match. Full changed-file diff reviewed.
- Harness evidence:
  - Final foundation screenshots in `scratch/tour-harness/gt01-foundation/{foundation-en-1440x900,foundation-en-1024x768,foundation-gu-390x844}/` and `scratch/tour-harness/gt01-foundation-reduced/foundation-en-1024x768/`: each contains `00-page.png`, `01.png`, `02.png`, `03.png`, `04.png`, `05.png`, `06.png`, `99-after.png`, `record.json`. Contact sheets are review aids; the numbered screenshots are authoritative after the final transition-wait correction.
  - Every step ready, outlines fully on screen, zero panel/outline overlap; container step scrolls its 300px container without moving the window; Exit restores both window and container positions and launcher focus; focus stays inside the panel; Back removal focuses Next; reduced motion issues no smooth scroll.
  - Regression screenshots/records under `gt01-regression/`; six targeted records/screenshots under `gt01-regression-retry/`; original GT-00 under `out/` unchanged. All output roots are under `scratch/tour-harness/`.
- Evidence types: automated checks and stubbed harness done. Exact legacy summary equality FAILED, not waived. Cause of the Estimator variance remains UNVERIFIED pending the baseline control below. Owner QA, independent review, native-language review, real devices and screen-reader speech are UNVERIFIED (reserved for the later gates, not claimed by this local harness).
- Definition of done: allowed implementation DONE; new/full tests, types, lint DONE; four foundation scenarios DONE; existing-tour summary equality NOT DONE; commands/test update/screenshots documented DONE. GT-01 cannot be PASSED yet.
- Remaining issues: five Estimator summary mismatches. For example paid en1440×900 step 10: GT-00 `target-clipped`, first regression `TARGET-OFFSCREEN y=-770`, fresh retry `TARGET-OFFSCREEN y=-299`. `components/estimator/CostEstimateTutorial.tsx` is unchanged and owns its desktop positioning/timers (lines 468, 560–584), independently of `useGuidedTourModal`; existing sampler reads at 900ms. Timing is suspected, not accepted as a baseline waiver.
- Baseline-control checkpoint: extracted the GT-00 (`b1ee267c`) versions of both shared hooks, mobile positioning and its unchanged target helper into `scratch/tour-harness/gt00-control-source/`, and the original committed harness main into `control-main.tsx`. `control-vite.config.mjs` routes these exact source copies on localhost:5200 with the same server stubs; no checkout/reset/stash or protected source edits. `control-run-tour.mjs` only changes the URL to `/control.html` on port 5200. First cold navigation timed out while Vite optimized dependencies. One fresh retry is running: paid estimator en1440×900 and Free estimator hi1280×800 → `gt00-control/`; expected summary `gt00-control-summary.txt`. Finish that one retry, then record the result and escalation as required; do not retry indefinitely or normalize baseline differences.
- Escalations: pending control result; no authority to relax exact equality or change protected tours assumed.
- Next action: collect the running baseline control, write the §6 escalation if equality remains unresolved, stop both local harness servers, preserve all files, and stop before GT-02. Commit GT-01 only after it is PASSED, using the owner's specified message.


### GT-01 — BLOCKED — baseline control and escalation — 2026-09-27
- Baseline control finished after one fresh retry following the cold Vite navigation timeout. The isolated `control-run-tour.mjs` runs for paid Estimator en1440×900 (10 steps) and Free Estimator hi1280×800 (9 steps) both exited 0; `python3 summarize.py gt00-control` exited 0. Both summaries differ from GT-00's original saved summary despite loading the committed GT-00 shared hooks/mobile runtime and original harness main. Evidence: `scratch/tour-harness/gt00-control-summary.txt` and `gt00-control/{estimator-en-1440x900,free-estimator-hi-1280x800}/record.json` plus numbered screenshots. This demonstrates non-reproducibility of these baseline measurements; it does not waive GT-01's acceptance criterion or prove every implementation path regression-free.
- GT-00 paid en1440×900 originally reports step 10 `target-clipped`. The old-runtime control instead reports step 5 `target-clipped` and no issue on step 10. The old-runtime Free hi1280×800 control reports step 5 `target-clipped` and no step-9 overlap; the original baseline reports step-9 overlap=5520. Full control output follows:

```text
estimator-en-1440x900 steps=10 panelCornerChanges=1 serverCalls=4 nav=0 s2 overlap=2460; s2 rail-rect-intersects(check screenshot); s3 target-clipped; s4 target-clipped; s5 target-clipped; s7 rail-rect-intersects(check screenshot); s8 rail-rect-intersects(check screenshot); s9 rail-rect-intersects(check screenshot)
free-estimator-hi-1280x800 steps=9 panelCornerChanges=1 serverCalls=3 nav=0 s2 target-clipped; s3 target-clipped; s4 target-clipped; s5 target-clipped; s6 target-clipped; s7 overlap=13770; s8 overlap=12699; s9 target-clipped
```

- No acceptance criteria, baselines, protected application files or assertions were changed to hide the difference. Rate Book en1024×768 matches on its single targeted retry. Five cases remain unresolved: `estimator-en-1440x900`, `estimator-en-1024x768`, `estimator-hi-1280x800`, `free-estimator-en-1440x900`, `free-estimator-hi-1280x800`.
- All GT-01 implementation checks in the preceding checkpoint remain passing; exact regression equality is FAILED. The precise mechanism of the legacy timing variance remains UNVERIFIED. Owner QA/native review/independent review remain UNVERIFIED for the later gates.
- Both task-owned local Vite servers (ports 5199 and 5200) stopped with SIGTERM after the comparisons. No new application edits, commits, pushes or PRs. GT-02 and GT-03 remain NOT_STARTED.

#### ESCALATION — GT-01

Blocking condition: The required exact GT-00 summary comparison fails for five Estimator desktop cases, and replaying committed GT-00 runtime code also changes their recorded geometry.

Specification: `tasks/GT-01-runtime-foundation.md`, Verification: “summarize.py output must equal the GT-00 baseline summary”; Protected surface: “Every existing tour component, wrapper and copy file: unchanged behavior and markup.” EXECUTOR_PROMPT §1 forbids rewriting acceptance criteria or accepting regressions to get green.

Source evidence: `scratch/tour-harness/gt01-regression-diff.txt`, `gt01-regression-retry-summary.txt`, `gt00-control-summary.txt`; `components/estimator/CostEstimateTutorial.tsx:468` and `:560`–`:584` retain their original scroll/timer implementation. Example screenshots: `scratch/tour-harness/out/estimator-en-1440x900/10.png`, `gt01-regression/estimator-en-1440x900/10.png`, `gt01-regression-retry/estimator-en-1440x900/10.png`, `gt00-control/estimator-en-1440x900/10.png`. All screenshot paths after the first are under the same `scratch/tour-harness/` root.

Expected: 52 regression summaries exactly equal the preserved GT-00 summary, without modifying protected existing tours.

Actual: All 52 runs completed, but six initial summaries differed. Rate Book matched on its targeted retry; five Estimator variants still differed. Two representative runs using the committed GT-00 runtime also failed to reproduce the old summary. New foundation geometry/focus/scroll/reduced-motion checks pass in all four required configurations.

Tried: One complete GT-01 batch, one fresh targeted retry of each of the six mismatches after final code checks finished, source/diff inspection confirming existing tour components are untouched, screenshot comparison, and a scratch-only original-runtime control for paid/Free Estimator (one cold-start timeout followed by one successful fresh retry). Original evidence and every retry retained. No repeated full batch, legacy component fix, baseline overwrite or weakened assertion.

Why this exceeds my discretion: Passing now would require treating unequal summaries as equal, replacing the fixed baseline without authorization, or changing protected legacy tour behavior. The executor expressly forbids those actions. The control evidence justifies a harness investigation, not a unilateral acceptance waiver.

Smallest decision needed: May I make a harness-only readiness/sampling fix and regenerate only the five affected Estimator baseline comparisons using the same corrected harness against GT-00 and GT-01, keeping all original evidence and the other 47 baseline cases unchanged?

Worktree state: `tours/implementation` @ `b1ee267c`; 28 allowed changed/new tracked paths, all uncommitted. Type check and zero-warning lint passed; full suite 235 files / 1,998 passed / one existing skip; four foundation runs and final interaction/reduced-motion probes passed. Exact legacy summary parity unresolved. Both harness servers stopped. No push or PR; GT-02 not started.


### GT-01 — IN_PROGRESS — approved harness recovery — 2026-09-27
- Owner authorization: “yes do whatever you deem necessary and get gt-01 passed”, in response to the escalation's specific harness-only readiness fix and targeted five-case baseline refresh. The decision resolves the authority blocker; exact comparison is still required.
- Revision/worktree unchanged: `tours/implementation` @ `b1ee267c`; all prior changes and evidence retained. No application changes planned for this recovery.
- Next action: add an opt-in bounded settled-geometry sampler; run the same sampler against the exact GT-00 control and GT-01 for the five named Estimator desktop cases. Keep the original baseline, original GT-01 batch and other 47 case comparisons. No second full batch.


### GT-01 — PASSED — approved recovery and final verification — 2026-09-27
- Revision / worktree: `tours/implementation` @ `b1ee267c` before the GT-01 task commit; `/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas`. Original checkout's unrelated planning checklist remains untouched. GT-00 remains PASSED. GT-02 and GT-03 are NOT_STARTED.
- Files changed: the same 28 allowed files listed in the implementation checkpoint. Recovery changed only `docs/guided-tours/harness/run-tour.mjs`, its README and this ledger, plus ignored scratch runner/control/evidence files. No application change during recovery. No existing tour component, wrapper, copy, business action, live page, dependency or lockfile changed.
- Deliberate test changes: only the previously documented `mobile-tour-positioning.test.ts` frame-based update replacing the removed timer assertion, retaining the null/rect/single-scroll assertions. Eight new test files provide 49 new tests. No test was weakened or deleted during recovery.
- Approval and resolution: owner approved the exact decision requested by the preceding escalation. Added opt-in `SETTLED_SAMPLING=1`: following the existing 900ms wait, observe for at least 1,500ms and require unchanged panel/outline geometry, scroll positions and text for 500ms with no finite animation running; fail explicitly after 8,000ms. Fonts are awaited. Each step records its settling duration. Normal motion, styles, target layout and issue calculations remain unchanged. The old fixed-delay evidence remains preserved, not silently replaced.
- Commands and results:
  - Isolated Vite harnesses on localhost:5199 (GT-01) and :5200 (GT-00 control) started successfully. The control's hooks, mobile positioning, target helper and original main were byte-compared with `git show b1ee267c:<path>`: all exact. Browser/server services remain stubbed; no live data touched.
  - From `scratch/tour-harness`, `node ../../scripts/performance/isolated-command.mjs env SETTLED_SAMPLING=1 PLAYWRIGHT_ROOT=/Users/rajpatel/.npm/_npx/5e2e484947874241/node_modules/ CHROMIUM_PATH="/Users/rajpatel/Library/Caches/ms-playwright/chromium-1234/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" node <runner> <scenario> <language> <size> <output>`: both `control-run-tour.mjs` → `gt00-settled` and `run-tour.mjs` → `gt01-settled` ran the five cases below, all exit 0, no retries/timeouts. First pair run directly; the remaining four pairs ran sequentially through the isolated `targeted-settled.mjs` driver, exit 0 (`gt01-settled-comparison.log`). No full browser batch rerun during this recovery.
  - `python3 summarize.py gt00-settled` and `python3 summarize.py gt01-settled` (children of the isolated driver) → exit 0, exact five-row equality. Five cases also match every recorded step's panel/highlight rectangles, overlap, clipping flags, description scrolling, title/body/progress, scroll position, focus containment, and stubbed server calls.
  - `node ../../scripts/performance/isolated-command.mjs python3 finalize-comparison.py` → exit 0: **52 exact summary matches / 416 steps**, with the five approved refreshed rows, 47 original GT-00 baseline rows preserved, and Rate Book using its previously successful targeted retry. `diff -u gt00-accepted-summary.txt gt01-accepted-summary.txt` → exit 0, empty diff. The manifest `gt01-accepted-comparison.json` records each selected evidence path/hash and the original baseline hash. Original `out/`, `baseline-summary.txt`, `gt01-regression/`, `gt01-regression-retry/` and earlier controls remain intact.
  - Final application type check remains PASS: isolated `npx tsc --noEmit --incremental false`, exit 0 (`gt01-types.log`). Application code did not change after this check.
  - Final application full suite remains PASS: isolated `npx vitest run`, exit 0, **235 files / 1,998 passed / one existing live-Supabase test skipped** (`gt01-full-tests.log`). No application or test changes during recovery, so this suite was not repeated.
  - After the harness edit, `node scripts/performance/isolated-command.mjs npm run lint` → exit 0, **zero warnings** (`gt01-lint-recovery.log`).
  - Exact allowed-surface audit → all 28 paths allowed. `git diff --check` → clean. Tracked and scratch `main.tsx`, `run-tour.mjs`, `summarize.py` match. Recovery diff reviewed in full; earlier application diff review retained.
  - Task-owned Vite PIDs 20033/20043 received SIGTERM; both sessions exited 143 as expected. No harness/browser job remains running.
- Harness and visual evidence:
  - Foundation's four required runs and interaction/reduced-motion probes remain PASS as recorded in the implementation checkpoint: 24 ready steps, no overlap/offscreen outline, correct focus/scroll restoration, no smooth scroll under reduced motion, zero new-runtime server calls/navigation.
  - Refreshed cases: `estimator-en-1440x900` (10 steps), `estimator-en-1024x768` (10), `estimator-hi-1280x800` (10), `free-estimator-en-1440x900` (9), `free-estimator-hi-1280x800` (9). In both `scratch/tour-harness/gt00-settled/` and `gt01-settled/`, each directory holds `00-page.png`, numbered `01.png` through `10.png` or `09.png`, `99-after.png` and `record.json`.
  - Side-by-side screenshot review completed for all five cases: paid steps 2/6/10 and Free steps 3/6/9, plus paid en1440 step 10 at full size. Review sheets: `scratch/tour-harness/<case>-settled-comparison.png`. Matched legacy overlap/clipping remains visible; these are preserved baseline findings for later migration tasks, not claimed fixed by GT-01.
- Evidence types: automated checks, stubbed browser harness, screenshot review and implementation diff review DONE. No required GT-01 check remains UNVERIFIED. Owner QA, independent gate review, native-language review, real devices and screen-reader speech remain UNVERIFIED for the later gates; they are not claimed by this task. The gated live-Supabase test remains intentionally skipped.
- Definition of done: allowed implementation DONE; new/full tests, types and zero-warning lint DONE; all four foundation runs DONE; exact existing-tour summary parity with the owner's five-case refresh DONE; ledger, commands, screenshots and deliberate test update DONE.
- Remaining issues: no GT-01 blocker. Existing legacy geometry/stub-call findings remain documented. No production/QA data, business logic or entitlement changes.
- Escalations: the GT-01 sampling escalation is RESOLVED by explicit owner approval and exact comparison evidence; historical packet retained above.
- Next action: commit GT-01 with `feat(tours): GT-01 Shared runtime and presentation foundation`, without pushing or opening a PR. Next eligible task is GT-02, starting with its packet and Read first list.

Refreshed exact summaries (identical for GT-00 and GT-01):

```text
estimator-en-1024x768 steps=10 panelCornerChanges=1 serverCalls=4 nav=0 s2 overlap=31374; s3 target-clipped; s4 target-clipped; s6 target-clipped; s7 overlap=52089; s8 overlap=52089; s9 overlap=52089
estimator-en-1440x900 steps=10 panelCornerChanges=1 serverCalls=4 nav=0 s2 overlap=2460; s2 rail-rect-intersects(check screenshot); s3 target-clipped; s4 target-clipped; s7 rail-rect-intersects(check screenshot); s8 rail-rect-intersects(check screenshot); s9 rail-rect-intersects(check screenshot)
estimator-hi-1280x800 steps=10 panelCornerChanges=1 serverCalls=4 nav=0 s2 overlap=10769; s3 target-clipped; s4 target-clipped; s6 target-clipped; s7 overlap=13770; s8 overlap=13770; s9 overlap=13770
free-estimator-en-1440x900 steps=9 panelCornerChanges=1 serverCalls=3 nav=0 s2 target-clipped; s3 target-clipped; s4 target-clipped; s7 rail-rect-intersects(check screenshot); s8 rail-rect-intersects(check screenshot); s9 overlap=35144
free-estimator-hi-1280x800 steps=9 panelCornerChanges=1 serverCalls=3 nav=0 s2 target-clipped; s3 target-clipped; s4 target-clipped; s6 target-clipped; s7 overlap=13770; s8 overlap=12699; s9 overlap=39192
```


### GT-02 — IN_PROGRESS — preflight — 2026-09-27
- Revision / worktree: `tours/implementation` @ `d7a16a4fa3344c72e561daf6343babd0881a2332`; clean at task start. GT-00 and GT-01 PASSED. Original checkout's unrelated planning checklist untouched.
- Required reads completed: CLAUDE.md, executor, plan §0/§1 and GT-02-cited sections, queue/status, task packet, listed source/tests, each page's guide.benefit and Daily Sheet title. Supabase skill read for the preference action; live query guidance is superseded by the explicit no-live-data rule. Official updateUser docs opened; changelog markdown fetch was unsupported. No Supabase operation performed.
- Files changed: this ledger only; no application/test change yet.
- Commands and results: git branch/revision/status confirm clean expected branch; rg and source reads confirm the legacy Estimator close handler unconditionally invokes syncDismissal, which calls dismissCostEstimateTutorial. That component is outside GT-02's allowed surface, while verification permits only recordTourEventAction.
- Verification: GT-02 implementation/type/lint/tests/harness remain UNVERIFIED. Investigating this specific pre-existing conflict with one isolated first-step launch/Exit probe before making code changes.
- Next action: run the stubbed Estimator exit probe; if the forbidden legacy call is observed, write the required §6 escalation and stop.


### GT-02 — BLOCKED — Estimator exit scope conflict — 2026-09-27
- Revision / worktree: `tours/implementation` @ `d7a16a4fa3344c72e561daf6343babd0881a2332`. Only this tracked ledger changed. Ignored scratch contains the one diagnostic script/log/record and two screenshots. No application or test changes; nothing committed, pushed or opened as a PR. Original checkout's unrelated work untouched.
- Deliberate test changes: none.
- Commands and results:
  - `git branch --show-current`, `git rev-parse HEAD`, `git status --short` → expected branch/revision, clean start.
  - Required source/spec/test reads and targeted `rg` → the existing close handler calls `syncDismissal`; the legacy action updates its account flag and invokes `revalidatePath` for Estimator routes. Plan §7.3 assigns removal of the legacy actions to their feature tasks.
  - Isolated Vite harness via `node scripts/performance/isolated-command.mjs node node_modules/vite/bin/vite.js --config scratch/tour-harness/vite.config.mjs --host 127.0.0.1` → localhost:5199, all server modules and browser services stubbed.
  - From scratch: `node ../../scripts/performance/isolated-command.mjs env PLAYWRIGHT_ROOT=/Users/rajpatel/.npm/_npx/5e2e484947874241/node_modules/ CHROMIUM_PATH="/Users/rajpatel/Library/Caches/ms-playwright/chromium-1234/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" node gt02-estimator-exit-probe.mjs` → **exit 1**, the required only-`recordTourEventAction` allowlist fails. One case, no retries and no complete tour/full batch.
- Harness: Estimator en1440×900; launch first step, then Escape. Calls after launch: `recordTourEventAction`, **`dismissCostEstimateTutorial`**. `getEstimatorSecondaryData` was already present before launch and is recorded separately, not blamed on the tour. No navigation recorded. The actual legacy action was stubbed, so the real route refresh is CODE-VERIFIED only, not exercised against live data.
- Evidence: `scratch/tour-harness/gt02-preflight.log`; `gt02-preflight/estimator-en-1440x900/{record.json,call-analysis.json,01-started.png,02-exited.png}`. Exit screenshot reviewed; it shows the legacy preference-sync failure notice from the recording stub.
- Evidence types: source inspection and one stubbed browser reproduction DONE. GT-02 implementation, focused/full suite, type check, lint and the six required post-change invitation checks **UNVERIFIED** because implementation stopped at the confirmed scope conflict. Prior GT-01 passes are not claimed as GT-02 validation.
- Definition of done: GT-02 implementation items NOT DONE; Estimator allowlist check FAILED; no acceptance waiver or out-of-scope fix attempted.
- Remaining issues / escalation: packet below. Task-owned harness server stopped after evidence collection. Next action: owner scope decision; then resume GT-02, preserving the evidence.

#### ESCALATION — GT-02

Blocking condition: GT-02 requires the Estimator launch/Exit path to call only `recordTourEventAction`, but its existing legacy exit handler calls `dismissCostEstimateTutorial` and cannot be changed within GT-02's allowed surface.

Specification: `tasks/GT-02-invitation-persistence.md:58`: “server calls are only `recordTourEventAction`”; lines 20–30 limit changes to shared invitation/preference code and the Dispatch guideCard prop. Plan §7.2: “Exit records nothing beyond `started`.” Plan §7.3 leaves legacy action removal to the feature tasks; GT-05 contains the Estimator migration. DS-05 also prohibits tour-triggered refreshes.

Source evidence: `components/estimator/CostEstimateTutorial.tsx:271`–`:288` writes the legacy local marker and invokes `syncDismissal`; `:102`–`:116` calls the legacy action; `:118`–`:127` retries it on later loads. `app/(dashboard)/owner/estimator/tutorial-actions.ts:19`–`:20` revalidates `/owner/estimator` and `/free`. The isolated first-step/Escape probe above reproduces the legacy call.

Expected: After GT-02, starting and exiting Estimator records only the allowed preference event, leaves a compact launcher and causes no refresh.

Actual: On the unchanged preflight baseline, launch then Escape makes an additional `dismissCostEstimateTutorial` call. Fixing shared `TourInvitation` or `app/actions/tour-preferences.ts` cannot remove the independent legacy close/retry path. The legacy action's real implementation also revalidates routes; it was not run against Supabase.

Tried: Read the precise task/plan contracts, traced the close/retry/action path, inspected preserved GT-01 evidence, then reproduced only the specified first-step/Exit sequence in the existing stub harness. Distinguished the unrelated pre-launch secondary-data read from tour calls. No application modifications, acceptance changes or repeated suite/batch runs.

Why this exceeds my discretion: EXECUTOR_PROMPT §1 forbids expanding the task surface or rewriting acceptance criteria. Removing the legacy path touches a protected Estimator component (and potentially its directly affected tests); ignoring its call would weaken the mandatory allowlist.

Smallest decision needed: Authorize GT-02 to remove only the Estimator's legacy dismissal write/retry path and update directly affected assertions now, while preserving legacy preference reads and leaving the full Estimator migration in GT-05? This is the recommended narrow fix; it avoids waiving the data-safety check.

Worktree state: only `docs/guided-tours/EXECUTION_STATUS.md` modified plus ignored scratch evidence. GT-00/GT-01 remain PASSED. GT-02 implementation and final checks UNVERIFIED. No commit/push/PR; GT-03 NOT_STARTED.


### GT-02 — IN_PROGRESS — authorized implementation — 2026-09-27
- Owner answered “Authorized” to the precise narrow Estimator cleanup request. Scope now includes removing its legacy dismissal write/retry path and directly affected assertions, preserving legacy reads and leaving the full migration in GT-05. The preceding escalation is resolved as an authority question; implementation and verification remain pending.
- Starting from `d7a16a4f`, with only the preceding ledger/evidence modifications. Next: shared invitation/persistence/copy/contracts, authorized Estimator cleanup, focused checks, full types/lint/tests and the six specified invitation harness cases. No full 52-case batch required by GT-02.


### GT-02 — PASSED — 2026-09-27
- Revision / worktree: `tours/implementation` based on `d7a16a4fa3344c72e561daf6343babd0881a2332`; isolated worktree `/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas`. Resumed with only this task's ledger and scratch evidence. Original checkout's unrelated checklist left untouched. Task commit authorized by the owner's COMMITS instruction; no push or PR.
- Files changed (19 paths):
  - Shared invitation component and hook: `components/tours/TourInvitation.tsx`, `hooks/use-tour-invitation.ts`.
  - Preferences, definitions and copy: `lib/tours/tour-preferences.ts`, `lib/tours/tour-registry.ts`, `lib/tours/tour-types.ts`, `app/actions/tour-preferences.ts`, `lib/i18n/tour-invitations.ts`.
  - `app/globals.css`: only the 36-line halo block deleted. Deleted `lib/tours/session-coordinator.ts` and its specified test.
  - `components/dispatches/DispatchGuidedTour.tsx`: removed `guideCard` and the resulting unused translation import/binding (semantically neutral lint cleanup).
  - Owner-authorized `components/estimator/CostEstimateTutorial.tsx`: removed legacy local-marker writes, dismissal action, mount/online/manual retry path and its failure notice; forwarded the existing account dismissal flag to shared invitation preferences. Shared legacy account/local reads remain. No step, anchor, placement, calculation or entitlement changes; legacy server-action file itself remains for later migration.
  - Tests: `__tests__/tour-invitation-lifecycle.test.ts`, `tour-preferences-and-actions.test.ts`, `tour-i18n-parity.test.ts`, `tour-quota-and-data-safety.test.ts`, `guided-tour-left-rails.test.ts`; new `tour-data-safety-contract.test.ts`; deleted `tour-session-coordinator.test.ts`.
  - This ledger. Only ignored scratch contains probe scripts, logs, six browser records, screenshots and contact sheets. No dependency, lockfile, migration, environment or tracked harness change.
- Implementation decisions within the packet:
  - `firstShown` records an impression once without deciding presentation. Dismissed, started or completed account/local/legacy state yields replay; decisions remain sticky and content-version changes never re-invite.
  - Full invitation shows approved title/benefit, Start guide and ghost Not now. Not now switches immediately and focuses the compact launcher. Start records started; Exit adds no preference event. The start-aligned variant remains supported.
  - Completion writes its content version locally first, then remotely; the third helper argument defaults to the registry version so unchanged feature callers remain compatible. Action accepts omitted versions and validates supplied versions with the specified regex and 16-character limit. It retains owner/Free auth and only updates user metadata; all modern preference route revalidation and legacy-flag writes are removed.
  - Daily Sheet is registered for Base owners at v1, as this packet explicitly requires. All other entries remain v1 until their feature tasks. Benefits in all 36 language/page combinations and the new Daily Sheet name match the approved page-spec rows; Saved Costings gu/hi use the glossary.
- Deliberate test changes (none weakened to hide a failure):
  - Lifecycle: replaced obsolete halo and first-impression-suppresses assertions with invite/replay rendering in en/gu/hi, Not now, legacy start alignment, halo/coordinator absence, once-only impression, immediate decision/focus and synchronous launch coalescing contracts. Shared rail/accessibility checks retained; browser probe verifies actual focus and 44px sizes.
  - Preferences/actions: replaced obsolete getTourStatus, route-refresh and legacy-write expectations with getTourPresentation and modern-only/no-refresh behavior. Covers all 12 tours, both legacy account flags and local keys, sticky account/local decisions, versions/no re-invitation, malformed/unavailable storage, auth/write failure, local-first persistence, impression deduplication and optional/invalid/boundary completion versions.
  - i18n parity: retained all-language/script checks, replaced emphasis expectations with its absence, and added Daily Sheet eligibility/version, exact page-spec benefits and glossary/name checks.
  - Quota/data safety: added the real `freeMeter`, `/api/free/calculate` and `complete_free_saved_costing` forbidden tokens, preserving existing assertions.
  - Left rails: retained all placement assertions and added the specified absence of Dispatch `guideCard`.
  - Deleted six session-coordinator tests together with that module, explicitly required by this packet; no failing-test deletion outside that retirement.
  - New 19-test data-safety contract explicitly covers every shared tour library file, the six shared components/hooks, and the authorized Estimator component. Guards business-action imports, fetch, quota/business tokens, route invalidation and business-row access; checks the Estimator legacy write/retry removal and preserved account read.
  - `__tests__/tour-no-autostart.test.ts` remains byte-for-byte unchanged and passes all five tests. Legacy Estimator server-action tests remain unchanged and pass; no other test files changed.
- Commands and results (all checks isolated; all exit 0 except the preserved, corrected harness attempt noted below):
  - `node scripts/performance/isolated-command.mjs npx vitest run __tests__/tour-invitation-lifecycle.test.ts __tests__/tour-preferences-and-actions.test.ts __tests__/tour-i18n-parity.test.ts __tests__/tour-no-autostart.test.ts __tests__/tour-quota-and-data-safety.test.ts __tests__/guided-tour-left-rails.test.ts __tests__/tour-data-safety-contract.test.ts` → 7 files, **97 passed** (`scratch/tour-harness/gt02-focused.log`).
  - Initial full verification: isolated `npx tsc --noEmit --incremental false`, `npm run lint`, `npx vitest run` → all exit 0; lint zero warnings; 235 files, 2,040 passed, 1 skipped (`gt02-types.log`, `gt02-lint.log`, `gt02-tests.log`).
  - Browser found Start guide at 38.5px because the existing rem sizing used the app's 14px root. Corrected only that button to an explicit 44px minimum. Final checks on the corrected tree:
    - `node scripts/performance/isolated-command.mjs npx tsc --noEmit --incremental false` → **PASS**, exit 0 (`gt02-final-types.log`).
    - `node scripts/performance/isolated-command.mjs npm run lint` → **PASS**, exit 0, zero warnings (`gt02-final-lint.log`).
    - `node scripts/performance/isolated-command.mjs npx vitest run` → **235 files, 2,040 passed, 1 skipped**, exit 0, 22.44s (`gt02-final-tests.log`). The unchanged skipped finance test requires live Supabase; it was intentionally not enabled.
  - Reviewed full changed-file diffs and allowed surface; `git diff --check` → clean. `git diff --exit-code HEAD -- __tests__/tour-no-autostart.test.ts` → exit 0, unchanged. No other application paths changed.
- Harness commands and results:
  - Started only the stub harness with `node scripts/performance/isolated-command.mjs node node_modules/vite/bin/vite.js --config scratch/tour-harness/vite.config.mjs --host 127.0.0.1` (`gt02-vite-implementation.log`). No Next dev/build/start or live service run.
  - Existing external `PLAYWRIGHT_ROOT=/Users/rajpatel/.npm/_npx/5e2e484947874241/node_modules/` and `CHROMIUM_PATH=/Users/rajpatel/Library/Caches/ms-playwright/chromium-1234/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`; no dependency installed or added.
  - Initial scratch invocation of isolated `env PLAYWRIGHT_ROOT=<above> CHROMIUM_PATH=<above> node gt02-invitation-probe.mjs` → exit 1 on the first Dispatch desktop case, `take-tour too short`; preserved `gt02-invitations.log` and `gt02-invitations/dispatch-en-1440x900/{record.json,failure.png}`. Fixed the actual button, without relaxing assertions. No timeout retry involved.
  - Final command from repository root: `node scripts/performance/isolated-command.mjs env PLAYWRIGHT_ROOT=<above> CHROMIUM_PATH=<above> node scratch/tour-harness/gt02-invitation-probe.mjs` → **exit 0**, all six cases passed (`gt02-invitations-final.log`). Its relative output directory was moved into ignored scratch after completion; no output artifact is included in the commit.
  - Isolated Python/Pillow contact-sheet generation → exit 0; six passing records checked, 54 screenshots preserved.
  - Final server shutdown: identified owned port-5199 listener PID 22680 with `lsof`; `kill -TERM 22680` → exit 0; Vite session exited 143 intentionally. No task-owned harness left running.
- Harness evidence / result:
  - `dispatch`, `quotes`, `estimator`, each en1440×900 and gu390×844: **PASS**. Fresh card has approved Start guide/Not now text and both targets measure at least 44px. A shown-only reload keeps the invitation and does not repeat its impression. Not now focuses the compact launcher immediately; reload retains replay. Both replay-start/Exit and fresh-start/Exit retain replay on reload; Exit writes neither dismissed nor completed.
  - Each case's three interaction groups (dismiss, replay launch/Exit, fresh launch/Exit) records exactly one `recordTourEventAction` and no other tour-caused server call; no navigation or page errors. Estimator's unrelated `getEstimatorSecondaryData` mount read is preserved in the raw before/after phases and predates tour launch. Its legacy dismissal call is gone.
  - Records and all nine phase screenshots per case: `scratch/tour-harness/gt02-invitations-final/<scenario>-<lang>-<size>/`. Labels: `01-fresh`, `02-shown-reload`, `03-dismissed`, `04-dismissed-reload`, `05-replay-active`, `05-replay-exited`, `06-fresh-start-active`, `06-fresh-start-exited`, `07-started-reload`.
  - Visually inspected the fresh and dismissed states for all six cases using `contact-en.png` and `contact-gu.png` in that directory. Invitation copy/buttons fit and replay occupies one compact rail row; desktop Dispatch uses the harness's existing placeholder page. This spot check does not claim that every legacy tour geometry defect is fixed.
  - No full 52-case baseline batch rerun: GT-02 specifies these six lifecycle cases. The generic full-tour summarize.py is not applicable to this invitation-phase probe; its six `record.json` files and six PASS lines are the task summary.
- Evidence types: automated checks, source/diff review and required stubbed browser cases **DONE**. No required GT-02 check remains UNVERIFIED. Live data/test, real-device/owner QA, separate reviewer and native-language review **UNVERIFIED**; they remain outside this task's checks or for the specified later gates. Copy matching verifies transcription, not native-language judgment.
- Definition of done:
  - §7 invitation states/events implemented with required three-page/two-viewport checks: DONE.
  - No route revalidation in modern tour preferences; data-safety contract: DONE.
  - Halo/session coordinator/CSS/tests retired: DONE.
  - Approved invitation copy for every tour in all three languages: DONE.
  - Full suite, types and zero-warning lint on final code; deliberate test updates and evidence recorded: DONE.
- Remaining issues: none blocking GT-02. Existing feature migrations and gate review remain in queue; Estimator's full migration stays GT-05.
- Escalations: GT-02 preflight scope conflict resolved by explicit owner authorization and the verified narrow cleanup. Historical packet retained; no acceptance waiver.
- Next action: GT-03, `docs/guided-tours/tasks/GT-03-saved-costings.md`; read its packet and listed references before edits. Stop GT-03 at REVIEW_REQUIRED and do not self-pass GT-04/G1. No push or PR.
