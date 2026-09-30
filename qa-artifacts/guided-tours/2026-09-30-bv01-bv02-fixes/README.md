# BV-01 and BV-02: fixes and verification evidence

Working branch `tours/bv01-bv02-fixes`, created from `tours/implementation` at `9ae694bb4068963141dadfe1dfb0c4df3fafeb2f` (the reviewed handoff snapshot). Handoff: [`../2026-09-30-independent-review/README.md`](../2026-09-30-independent-review/README.md). Synthetic isolated fixtures only: no live, QA or production database, no production-configured build/dev, no GT-16/GT-17 work, and the approved PI-04 Daily Sheet deferral and U-06 copy are unchanged.

**Status: fixed and re-verified in the synthetic browser fixture. Independent re-review and every human/live gate remain UNVERIFIED** (owner QA, native Gujarati/Hindi, screen reader, real devices, authenticated shell, live preference persistence). The reviewer's FAIL verdict is not overwritten by this bundle.

## Round 2 (owner-requested follow-up): GT-05 at 768×1024 and GT-15 step 1 at ≤1280

Both observations from round 1 are fixed and re-verified in the fixture; evidence is in `evidence-round2/` with `manifest-round2.json` (round-1 `evidence/` and `manifest.json` are untouched). Independent re-review and every human/live gate remain UNVERIFIED.

| | GT-05 at tablet portrait (768–1023 px) | GT-15 step 1 at ≤1280 |
| --- | --- | --- |
| Reproduced first | Base en/gu 768×1024: `est-warp` 4,048 px², `est-weft` 1,656, `est-handoff` 15,224 (en) / 19,904 (gu). Settled 500 ms and 2 s probe frames: `est-warp` and `est-weft` overlap persistently, `est-handoff` does not | Round-1 evidence: panel below the control row covering the Workers column and the sample worker row (no outline overlap) |
| Root cause | The fixed 248 px sidebar leaves a 448 px column, so the 360 px panel cannot sit beside a Quick card. The cards are 594 and 631 px tall and the tracker centres them, leaving no room above or below either, so the placer fell back to a corner over the card. `est-handoff` only overlapped while the outline was still animating at the runner's 900 ms sample | Every anchor above the rows makes the placer put the panel directly below it, on top of the rows. Only an anchor that includes the rows lets the panel land in the board's empty lower area |
| Fix | Tour-only CSS for 768–1023 px (`CostEstimateTourRuntime.tsx`): cards narrow by 120 px and right-align (start at 404 px), so the panel sits on their left over the sidebar; the Live cost sheet moves into the same right-hand column, `left: 420px; right: 20px`. The 16 px offset from the cards is deliberate: from the sheet to the name field the outline starts 415 px from the left, clear of the panel's right edge (at most 407 px). A first version at 404 px failed the runner at 768×600 in 4 of 5 repeats (792 px²) | `assignments.columns` moved from the control row to the Workers/Machines columns grid, and that grid is `flex-none` (content-height) only while a sample step runs (`tourSampleActive`). The outline frames the sample worker and loom; the panel lands below them. Phones keep the mobile board card. The live handoff keeps the scrolling `flex-1` board |
| Tests (failing first) | New `__tests__/estimator-tour-tablet-column.test.ts` (4 tests) | `__tests__/configuration-tour.test.ts`: the anchor-site test now pins the grid, the sample-only `flex-none`, the unmarked control row and the phone card |

Round-2 results (classes as above; each group's source state is stated because the sheet offset changed once):

| Group | Source state | Runs / steps or frames | Result |
| --- | --- | --- | --- |
| GT-05 768×1024 before the fix | snapshot + round 1 | 2 / 20 | FAIL ×2 (as above) |
| Reviewer's complete archived matrices (`final-archived`) | tablet sheet 404/36 | 33 / 276 | PASS ×17, BASELINE_ANALYTICS_ONLY ×16, zero FAIL |
| All extra cases (`final-extras`, incl. new round-2 sizes) | tablet sheet 404/36 | 72 / 625 | PASS ×43, BASELINE_ANALYTICS_ONLY ×29, zero FAIL |
| Back/Next probes (`final-transitions`) | tablet sheet 404/36 | 32 probes | 0 issues (25 Estimator, 7 Assignments) |
| 768×600 before the 16 px offset | tablet sheet 404/36 | 7 runs | 5 FAIL (792 px² at `est-handoff`), 2 PASS |
| **After the offset** (`after-shift-*`): tablet band cases | 420/20 | 15 / 148 | PASS ×15 (en/gu 768×1024, 820×1180, 1023, 1000×800, 900×1200, 768×600, Free, Lite Hindi, reduced motion, Detailed Done/Exit at 9) |
| After the offset: probes | 420/20 | 11 probes | 0 issues (Base/Free en/gu at 768 and 820, 768×600, Lite Hindi, landscape touch 844×390) |
| After the offset: 768×600 repeats | 420/20 | 8 dedicated + 1 in the case run | 9 of 9 PASS |
| After the offset: tablet repeat rounds | 420/20 | 3 rounds × 4 cases | 12 of 12 PASS |
| Unit/contract tests | final | 238 files, 2,004 passed, 1 existing live-only skip | `tsc` exit 0; changed files lint clean |

The offset is scoped to `768–1023.98 px`, so phones, ≥1024 px and all of Assignments are outside it; their round-2 results above were produced at the immediately preceding state, whose only difference is that one CSS line. That is a scoping argument, not a rerun, and is stated as such. Visual checks: contact sheets for Base English and Gujarati at 768×1024 and English at 768×600 (final tablet runs), the Assignments step-1 screenshots at English 1024×768 and Hindi 1280×800, and the earlier round-2 sheets.

Remaining after round 2: real tablets, native-language, screen reader and owner QA are UNVERIFIED; the tablet layout (cards 120 px narrower, sheet offset right) is tour-only and should be looked at on a real tablet. The runner samples at a fixed 900 ms, so any outline animation that is still in flight then can cross a panel by a few pixels at a viewport not covered here; the settled-frame probes are the evidence for those cases.

## Findings, root causes, fixes

| | BV-01 (GT-05, Cost Estimator) | BV-02 (GT-15, Machine Assignments MA-1) |
| --- | --- | --- |
| Reproduced first | Gujarati 390×844, Base, Lite, Free: `est-save: unavailable` + `outline not fully on screen`, other nine steps ready (the helper's three cases, unchanged runner and guard) | Eight cases (en 1024×768 and hi 1280×800; empty, populated, reduced motion, Night/focus): `ma-purpose` overlap 10,070 px² (en 1024) and 5,724 px² (hi 1280), byte-identical to the archived numbers |
| Root cause | On phones `app/mobile.css` (unlayered) sets `max-height: calc(var(--mobile-viewport-height) - safe-top)` on every `sheet-content`, overriding the Live cost sheet's layered Tailwind `max-h-[min(84dvh,44rem)]`. Measured: the sheet is 786 px tall, `scrollHeight == clientHeight` (785), so it never overflows. The shared mobile tracker (`lib/mobile-tour-positioning.ts`) reserves room only in a scrollport that already overflows (`findTourScrollContainer`), so it padded the page body, which cannot move a fixed sheet. The Save block (y 567–828) sat entirely under the 327 px panel (y 509–836) and the tracker's band ended at y 493, so the clipped target was empty for 1.5 s: unavailable | The `ma-purpose` anchor is the whole board (732–775 px wide, 577–609 px tall). At ≤1280 wide it fills the content column, so the shared placer (`placeTourPanel`) finds no valid right/left/below/above candidate and falls back to the least-overlapping corner, over the board. At 1440 wide a position left of the board is valid (panel at x = 101), and phones use the docked bottom sheet, so neither overlapped |
| Fix | Phone-only rule in the Estimator tour's own runtime style block (`components/estimator/CostEstimateTourRuntime.tsx`): `@media (max-width: 767.98px) { #mobile-live-estimate-panel { padding-bottom: 100dvh } }`. The sheet becomes a real scrollport, the tracker applies its own measured reserve (panel height + 100 px) and scrolls Save above the docked panel. The rule exists only while the tour runtime is mounted; the ≥768 px column layout is untouched | Page spec §E fallback: `ma-purpose` now anchors to `[data-tour-anchor="assignments.columns"]`. Desktop: the board's two-column control row (worker search + machine-type filters), the only single element spanning both columns directly above the Workers/Machines headings. Phones: the same attribute on the mobile board card, so phones resolve exactly the element they used before |
| Protected surface | Costing math, reducer, autosave, Free meter, save handlers, factory wizard, Quick/Detailed behaviour, restore closure, approved copy and translations: not touched | Assign/replace/undo/remove, server validation, drag linking, picker, filters, shifts, URL state, handoff and restore logic, approved copy: not touched. `[data-configuration-tour="board"]` stays on both boards |

Changed application files: `components/estimator/CostEstimateTourRuntime.tsx`, `lib/configuration-tour.ts`, `app/(dashboard)/owner/production/BaseAssignmentWorkspace.tsx` (two attributes). Tests: new `__tests__/estimator-tour-phone-live-sheet.test.ts` (4 tests), and in `__tests__/configuration-tour.test.ts` one deliberate replacement (the old test asserted `assignments.columns` was absent) plus one new source-contract test. Docs: `docs/guided-tours/harness/README.md`, `docs/guided-tours/EXECUTION_STATUS.md`.

## Results (this bundle; details in `evidence/classification/*.json`)

Classes come from [`classify.mjs`](classify.mjs); a raw exit code is never used as acceptance. `PASS`: no runner issue. `BASELINE_ANALYTICS_ONLY`: the only runner issue is `navigation/API request`, and every `/api/` request is the documented mount request the network guard blocks (`POST /api/analytics/plan-events` with `production_viewed` on Assignments, `estimator_opened` on the Estimator, `GET /api/free/status` on Free), exactly one per run. Anything else is `FAIL` or `HARNESS_FAILURE`. The classifier was first run on the preserved pre-fix runs and reports every one as `FAIL` with the original defect text.

| Group | Runs / steps | Result |
| --- | --- | --- |
| Pre-fix BV-01 (`baseline-prefix-bv01`) | 3 / 30 | FAIL ×3 (`est-save`) |
| Pre-fix BV-02 (`baseline-prefix-bv02`) | 8 / 56 | FAIL ×8 (overlap 10,070 / 5,724) |
| Post-fix reproduction (`postfix-bv01`, `postfix-bv02`) | 3 / 30 and 8 / 56 | PASS ×3; BASELINE_ANALYTICS_ONLY ×8; zero overlap, every step ready |
| Reviewer's complete archived matrices on the final code (`final-archived`) | 33 / 276 (GT-05 17 runs, GT-15 16 runs) | PASS ×17, BASELINE_ANALYTICS_ONLY ×16; zero FAIL. All 16 GT-15 runs completed, including the two the reviewer lost to fixture heap exhaustion |
| Extra coverage (`extras`, `detailed-localized`) | 48 / 407 | see below |
| Back/Next transition probes (`transitions-v2-final`) | 18 probes / 1,323 frames | 0 issues; 180 settled focus-step frames checked against the real target element |
| Unit/contract tests | 237 files, 2,000 passed, 1 existing live-only skip | `tsc --noEmit` exit 0; all changed files lint clean |

Extra coverage: phones 360×640, 375×667, 390×844 (en, hi, gu), 430×932 in Base/Lite/Free, phone reduced motion, Exit at step 9 with the sheet open, Detailed restoration on phones (Gujarati and Hindi labels), desktop 1366×768, 1536×864, 1920×1080, 1280×720, 1024×600, Gujarati/Hindi at 1024 and 1280, tablet and Night/focus variants for Assignments. Result: every GT-15 case has zero overlap and all seven steps ready (19 runs BASELINE_ANALYTICS_ONLY plus the archived set). Every GT-05 phone case passes. `extras` also contains three items that are not passes and are explained below.

## Not defects of these fixes: preserved and adjudicated

- **Unstyled invalid runs** (`invalid-environment-unstyled`, 4 runs): the handoff README starts Vite from the repository root, but the harness PostCSS config uses `@tailwindcss/postcss` with `base: '../..'`, which resolves against the working directory. Started from the root, Tailwind generated no utilities (served CSS had zero `.flex`, `.fixed`, `.hidden`), so every panel was off screen and every step was flagged. This is an environment error, not the application defect, and it does not reproduce BV-01. Started with the scratch harness folder as the working directory, the reviewer's failure reproduces exactly. Corrected in `docs/guided-tours/harness/README.md`.
- **Baseline mount analytics**: `estimator_opened`, `production_viewed`, `GET /api/free/status`; intercepted by the guard, retained raw, one per run, no tour-induced request.
- **One invalid probe of mine**: `extras/x05-base-gu-390x844-detailed-done` used the English tab label `Detailed` under the Gujarati UI and found no tab (`HARNESS_FAILURE`, no record). It is preserved; the localized reruns in `detailed-localized` pass and show Detailed before, Quick during and Detailed after the tour, inputs unchanged.
- **First transition probes** (`transitions-v1-strict-actual-target`, `transitions-v1b-either-axis-clip`): v1 flagged the Gujarati phone board step and the landscape phone for panel/actual-target overlap on targets taller than the screen, which sit partly under the docked panel by design (TC-4); v1b's clipping test wrongly also exempted full-width targets, skipping the real-target check for the BV-01 steps. v2 counts vertical clipping only, so the portrait-phone Live cost and Save steps are checked against the real element. All three runs are kept.
- The review's transparent-rail paint flags (GT-10/GT-11) belong to other tours and were not re-run. The fixture heap exhaustion and connection-refused failures did not recur; the fixture server was started with a larger Node heap (`NODE_OPTIONS=--max-old-space-size=8192`, supplied after the wrapper), a server resource setting only, with no assertion or timeout changed. The original failures stay preserved in the handoff bundle.

## Observed, not fixed (outside the two authorized findings)

1. **RESOLVED IN ROUND 2 (see above).** Cost Estimator at tablet portrait 768×1024 (English and Gujarati, Base): panel/outline overlap at `est-warp` (4,048 px²), `est-weft` (1,656) and `est-handoff` (15,224–23,014 px²). It reproduces identically with the snapshot's runtime restored (`control-768-without-fix`, 2 runs) and the phone rule cannot match at 768 px, so it is pre-existing. 768×1024 is not in the required matrix. A reviewer or owner should decide whether it is a new finding.
2. **Landscape phone (844×390, touch)**: the 261 px Save block cannot fit above the 179 px panel, so it is top-aligned and clipped by design; the outline still covers the "Actions" header and Save Costing and the panel does not overlap the outline. Informational.
3. **RESOLVED IN ROUND 2 (see above).** GT-15 step 1 trade-off at ≤1280: with the spec's fallback the panel sits directly below the outlined control row and covers the Workers column, including the sample worker row. That is not an overlap with the outline, which is what MA-1 measures, but the outline (search/filter row) says less about the step's purpose than the board card header would. Alternatives were considered (card header, Workers/Machines headings); all place the panel over the same rows, and a single element for the headings does not exist without restructuring the drag-linked grid, outside the allowed surface. Owner/reviewer may want a different anchor.
4. **Repository lint**: `npm run lint` exits 1 solely because of 6 errors and 1 warning in the reviewer's archived helper `evidence/provenance-final/weavly-review-copy.cjs`, unmodified in the handoff commit. All files changed here are clean; the archived helper was left untouched as preserved evidence.

## Reproduce

```bash
# once: prepare a copy of the harness under scratch/ (fails if it exists)
node scripts/performance/isolated-command.mjs node qa-artifacts/guided-tours/2026-09-30-independent-review/reproduce.mjs prepare
# fixture server: the working directory MUST be the scratch harness folder
(cd scratch/tour-fix-review && node ../../scripts/performance/isolated-command.mjs env NODE_OPTIONS=--max-old-space-size=8192 node ../../node_modules/vite/bin/vite.js --config vite.config.mjs --host 127.0.0.1)
# in another terminal (existing Playwright and Chromium; do not install anything)
PW=".../node_modules/"; CH=".../Google Chrome for Testing"   # this machine: codex runtime playwright 1.62.1 + ms-playwright chromium-1234
node scripts/performance/isolated-command.mjs env PLAYWRIGHT_ROOT="$PW" CHROMIUM_PATH="$CH" node qa-artifacts/guided-tours/2026-09-30-bv01-bv02-fixes/run-matrix.mjs <label> gt05,gt15,extra [id-regex]
node qa-artifacts/guided-tours/2026-09-30-bv01-bv02-fixes/classify.mjs scratch/tour-fix-review-results/<label>-<timestamp>
node scripts/performance/isolated-command.mjs env PLAYWRIGHT_ROOT="$PW" CHROMIUM_PATH="$CH" node qa-artifacts/guided-tours/2026-09-30-bv01-bv02-fixes/run-transitions.mjs <label>
python3 qa-artifacts/guided-tours/2026-09-30-bv01-bv02-fixes/contact-sheet.py <run-dir> <out.png>
```

Files: `run-matrix.mjs` (unchanged runner, review guard, wrapper, 170 s bound, refuses if the scratch runner differs from the tracked one), `classify.mjs`, `transition-probe.mjs` + `run-transitions.mjs`, `extra-jobs.json`, `contact-sheet.py`, `package-evidence.py`, `manifest.json` (SHA-256 of every copied file and of the 5,012 screenshots kept only in git-ignored `scratch/tour-fix-review-results/`), `evidence/`.
