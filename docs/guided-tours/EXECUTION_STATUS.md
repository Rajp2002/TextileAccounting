# Guided tours: execution status

Implementation state only. Planning is complete (see [PLANNING_CHECKLIST.md](PLANNING_CHECKLIST.md)); **no implementation work has been done.** A task is complete only when its row says PASSED and its ledger entry has the evidence. Only PASSED satisfies a dependency.

States: `NOT_STARTED` · `IN_PROGRESS` · `REVIEW_REQUIRED` · `PASSED` · `FAILED` · `BLOCKED`.

## Task board

| # | Task | Status | Revision at start | Last updated | Ledger |
| --- | --- | --- | --- | --- | --- |
| 1 | GT-00 Baseline and harness | PASSED | 2275e920 | 2026-09-27 | GT-00 targeted recovery entry below |
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

**Exact next action:** GT-00 is PASSED. Next eligible task: read `tasks/GT-01-runtime-foundation.md` and only its Read first files/sections, then start GT-01 on `tours/implementation`. Keep using the corrected scratch harness; do not overwrite it with the original hidden-launcher selector. Preserve the completed baseline records; no need to repeat the GT-00 batch.

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

Owner, 2026-09-27: approved the scratch-only visible-launcher selector correction for GT-00 and instructed rerunning only `rates gu 390x844`, preserving the other 51 completed runs. This supersedes the previous escalation's proposed complete-batch rerun; application code and acceptance criteria remain unchanged.

## Open issues

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
