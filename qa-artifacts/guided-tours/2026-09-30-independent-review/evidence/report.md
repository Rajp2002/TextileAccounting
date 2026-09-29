# Independent guided-tour review

Checkout: `/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas`
Branch `tours/implementation` at `c020b9b0548a4c9f0c2c0105afe3506d821bc7ce`. Synthetic isolated browser fixtures only; no live/QA/production access.

Current phase: **Independent review complete through GT-15**. Next: `Address recorded findings in their owning tasks only under separate implementation authorization; human gates remain UNVERIFIED`.
Integrated independent-review verdict: **FAIL**. Required acceptance gates remain unfulfilled.


G1 reviewer verdict: **PASS WITH CONDITIONS**. GT-04 remains IN_PROGRESS; this does not pass owner QA or authorize an implementation wave.

| Scope | Runs | Captured steps | Runner failures | Non-network failures | Raw classifications | Evidence |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| G1 | 25 | 135 | 0 | 0 | AUTOMATED_PASS: 25 | [g1-results.json](g1-results.json) |
| GT05 | 17 | 168 | 3 | 3 | FAIL: 17 | [gt05-results.json](gt05-results.json) |
| GT06 | 22 | 132 | 0 | 0 | FAIL: 22 | [gt06-results.json](gt06-results.json) |
| GT07 | 20 | 200 | 0 | 0 | AUTOMATED_PASS: 20 | [gt07-results.json](gt07-results.json) |
| GT08 | 12 | 66 | 0 | 0 | AUTOMATED_PASS: 12 | [gt08-results.json](gt08-results.json) |
| GT09 | 12 | 69 | 1 | 1 | AUTOMATED_PASS: 11, FAIL: 1 | [gt09-results.json](gt09-results.json) |
| GT10 | 14 | 84 | 3 | 3 | FAIL: 14 | [gt10-results.json](gt10-results.json) |
| GT11 | 12 | 78 | 3 | 3 | FAIL: 12 | [gt11-results.json](gt11-results.json) |
| GT12 | 12 | 106 | 0 | 0 | FAIL: 12 | [gt12-results.json](gt12-results.json) |
| GT13 | 12 | 66 | 0 | 0 | AUTOMATED_PASS: 12 | [gt13-results.json](gt13-results.json) |
| GT14 | 20 | 120 | 0 | 0 | AUTOMATED_PASS: 20 | [gt14-results.json](gt14-results.json) |
| GT15 | 16 | 94 | 16 | 9 | FAIL: 16 | [gt15-results.json](gt15-results.json) |

Completed main matrix runs: **194**; captured steps: **1318**. Supplemental probes and keyboard evidence are separate.

Runner failures retain every raw exit/error/assertion. Non-network failures exclude only the API guard assertion; numeric rail flags and the original launch timeout remain counted and are adjudicated in the per-task notes.

## Supplemental evidence

| Script group | Runs | Captured steps or frames | Evidence |
| --- | ---: | ---: | --- |
| g1-supplemental | 5 | 16 | [g1-supplemental-results.json](g1-supplemental-results.json) |
| gt09-retry | 1 | 7 | [gt09-retry-results.json](gt09-retry-results.json) |
| gt10-paint | 2 | 14 | [gt10-paint-results.json](gt10-paint-results.json) |
| gt11-paint | 1 | 7 | [gt11-paint-results.json](gt11-paint-results.json) |
| gt13-transition | 2 | 6 | [gt13-transition-results.json](gt13-transition-results.json) |
| gt14-transition | 4 | 12 | [gt14-transition-results.json](gt14-transition-results.json) |
| gt15-retry | 2 | 14 | [gt15-retry-results.json](gt15-retry-results.json) |
| gt15-transition | 3 | 9 | [gt15-transition-results.json](gt15-transition-results.json) |

Original failures and screenshots remain preserved. Supplemental retries or diagnostic frames do not replace main results. G1 keyboard-only evidence is separately recorded (four paths, 21 steps).

## Findings and review limits

- **BV-01 Major — GT-05 FAILED:** required Save anchor unavailable; no outline. [runs/gt05-0-gu-390x844/estimator-gu-390x844/09.png](runs/gt05-0-gu-390x844/estimator-gu-390x844/09.png).
- **BV-02 Major — GT-15 FAILED:** Step-1 panel overlaps the board; the required MA-1 no-overlap condition remains unmet and the conditional fallback was not selected. [runs/gt15-0-en-1024x768/assignments-en-1024x768/01.png](runs/gt15-0-en-1024x768/assignments-en-1024x768/01.png).

The owned fixture server exhausted Node heap memory before the final two original GT-15 runs loaded. Both connection-refused failures remain intact; two unchanged retries after restarting the identical fixture recovered 14 steps and are separately listed above. [Fixture incident](gt15-fixture-oom.json).

GT-05 raw failures include the intercepted baseline Estimator analytics mount request. Three Gujarati phone runs also reproduce BV-01, an application defect. GT-06 raw guard classifications remain FAIL for the intercepted baseline Rate Book mount analytics; all 22 UI assertion sets passed. BaseProduction fixtures also emit the unchanged baseline production_viewed mount event. Those blocked requests are preserved and are not described as network-clean runs. GT-10 numeric rail flags are retained and separately adjudicated using unchanged-runner screenshots and computed paint geometry; see its task note.

Owner QA, native Gujarati/Hindi review, screen reader, real devices, authenticated shell and live preference metadata persistence remain **UNVERIFIED**. Synthetic checks do not substitute for them. GT-16/GT-17 are NOT_STARTED; GT-B1 is BLOCKED by PI-06/PI-07. PI-04 remains the separately tracked owner-approved Daily Sheet deferral, with U-06 copy and navigation unchanged.

## Reviewer checks and evidence

- Typecheck PASS; lint PASS with zero warnings; full Vitest 236 files / 1,995 tests / one existing live-only skip; tour subset 52 files / 661 tests PASS. [Commands](commands/results.json).
- Initial subset import failures from duplicated evidence copies were retained, and those copies were preserved outside test discovery before the unchanged retry.
- Exact source copy audit: 849 matches, zero mismatches, zero unmatched; native review remains pending.
- [G1 reviewer verdict](g1-review.md); [final keyboard evidence](g1-keyboard-final/record.json). Two prior invalid reviewer probes remain preserved and explained.
- Per-run command logs, traffic, records, screenshots and derived contact sheets remain under this directory. No mandatory test, assertion, timeout, discovery configuration or application source was changed.

## Completed per-task adjudication

**GT-05: FAILED.** All 17 original runs and required English desktop/Gujarati phone captures reviewed. BV-01 Major reproduces unavailable Save step 9 in Gujarati phone Base/Lite/Free. Other UI assertions pass, including Detailed Done/Exit. Raw FAIL also retains unchanged intercepted estimator_opened mount analytics; no tour business-action increment. Existing costing/already-open sheet/live factory configuration remain UNVERIFIED. No fix applied.

**GT-06: IN_PROGRESS.** All 22 original runs exit 0 with no UI issues; all required English desktop/Gujarati phone captures reviewed. Empty/populated, retained nonmatching search Exit/Done, deleted-demo and archived-only recovery verified. Approved unavailable update/review/usage states continue and Done focuses Add Yarn Rate. Raw guard FAIL retains unchanged rate_book_viewed mount analytics; prelaunch usage getter is stubbed, with no tour business-action increment. Human/live gates and upstream dependencies remain unfulfilled.

**GT-07: IN_PROGRESS.** All 20 core/populated/pending-retry/no-stock standard and reduced-motion cases passed; no blocked traffic, only preference calls. Replica form/receipt/payment controls were inert, live search node/value retained, dialog contexts separated from outlines/panels, and Done used New dispatch or the launcher when the pending retry disables the target. Source, page copy and dispatch action-stub proof reviewed. No reproduced Major or Blocker in this task.

**GT-08: IN_PROGRESS.** Empty and populated all-opening-stock fixtures passed all four viewports plus reduced motion; Exit at the opening-stock sample passed in English desktop and Gujarati phone. Required history geometry and desktop rail paint were inspected; Opening stock is the live handoff. Live search/node/storage restored, replica fields/buttons disabled, no business action/API/navigation or blocked traffic. Exact page copy and scoped source reviewed. No reproduced Major or Blocker.

**GT-09: IN_PROGRESS.** Original batch: 11/12 passed; the empty Gujarati phone launch timed out at the unchanged 15-second panel wait before any tour-step capture. Its log/network/pre-launch screenshot remain preserved; no blocked traffic, pending lazy StockTourPreview request, root cause unresolved. One diagnostic retry imported the unchanged generic runner, assertions and timeouts: all seven steps PASS, no page error or failed request; retry records/contact sheets inspected. Populated-unlinked fixtures and both Exit cases passed. No reproduced Major/Blocker; do not erase the intermittent launch failure or claim all original runs passed. Opening weight handoff, audit-date node/value retention, replica safety, page copy and scoped source reviewed; only preference calls, no business API/navigation. Supplemental evidence: gt09-retry-results.json and runs/gt09-retry-gu-390x844/diagnostics.json.

**GT-10: IN_PROGRESS.** Payroll core and optional guides: 14 main runs / 84 steps plus two unchanged-runner paint probes / 14 steps. All required English desktop and Gujarati phone captures inspected. Raw guard FAIL retains one unchanged BaseProductionClient production_viewed mount POST per run; no tour-induced increment. Three main runs and both paint probes retain numeric aside/target intersections. Computed styles show transparent rail z30, dialogs z50, and no visible rail child crossing any of the six flagged targets; screenshots confirm no occlusion. Adjudicated as harness bounding-box false positives (gt10-paint-adjudication.json), without changing assertions. Preferences, live node identity, search/scroll restoration, optional guide non-completion, handoff/Exit focus and no money-handler calls verified in fixture scope. PI-01/02/03 behavior unchanged. Populated/blocked/completed live payroll and all human gates UNVERIFIED; no reproduced Major in modeled states.

**GT-11: IN_PROGRESS.** Production empty/populated: 12 main runs / 78 steps plus one unchanged-runner paint diagnostic / 7 steps. All English desktop and Gujarati phone captures inspected, including Exit. Raw guard FAIL retains one unchanged production_viewed mount POST per run with no tour increment. Three main runs retain pd-activate/pd-looms numeric aside intersections; transparent rail z30 with only a top child, dialogs z50, no visible child/target intersection, and unobstructed screenshots establish harness false positives (gt11-paint-adjudication.json). Seven-step order, prerequisite yarn stock, live labels, same mounted client/search node, retained Available filter/storage, disabled samples, scroll cleanup and Activate Quality Done focus/launcher Exit focus verified. No activation/allocation/operator handlers called. Native, authenticated-shell, live-dialog and real-device behavior UNVERIFIED; no reproduced Major in modeled states.

**GT-12: IN_PROGRESS.** Daily Sheet empty/populated: 12 runs / 106 steps; every UI assertion set passed and all required English desktop/Gujarati phone steps visually inspected, including Exit. Raw guard FAIL preserves one unchanged production_viewed mount POST per run; no tour increment. Nine-step order, single guide last in right rail at desktop/inline above sheet below 1280, disabled samples, handoff to Add worker or first Metres input, same live node, exact 37.5 draft value and device-storage bytes through all populated tours and both Exits, scroll/inert cleanup and launcher Exit focus verified. No save/correction/print handler called. PI-04 date/shift navigation cannot be verified by this router stub; owner-approved deferral and U-06 copy/navigation remain unchanged. Locked/conflict/storage-error live states, QA/native/screen-reader/real-device checks UNVERIFIED. No reproduced Major in modeled states.

**GT-13: IN_PROGRESS.** Machines empty/populated: 12 main runs / 66 steps AUTOMATED_PASS; two separate read-only Back/Next transition probes / 6 frames also pass. All required English desktop/Gujarati phone main, Exit and diagnostic captures inspected. Six steps, read-only editor/no Close, Back restore, disabled fields, inline Production/Assignments links ready below 1280, sample guards, retained search/Needs setup filter/URL/storage, Add machine Done focus and launcher Exit focus verified; no business handler or blocked network request. Original readiness screenshots are taken immediately after the runner Back/Next check, after its pre-Back geometry measurement: they retain transitioning old outlines and a fading desktop panel across the new card. Separate frames show correct outline and zero actual-target/panel overlap by 500ms and at 2000ms on desktop/phone; original captures preserved, exact frame-level transition duration UNVERIFIED. No persistent obstruction or reproduced Major in modeled states. Native, real-device, authenticated editor/dirty-check and human gates remain UNVERIFIED.

**GT-14: IN_PROGRESS.** All 20 main runs and 120 captured steps passed UI assertions with zero blocked requests. Piece-rate and salary paths covered empty and populated retained nonmatching search/Night/inactive filters at standard and reduced motion. Start and replay reset to piece-rate; Back retained the selected pay type. Search/filter DOM values, URL and local storage were preserved; sample choices were localized, read-only and disabled; earnings and salary proration examples matched source. Done focused Add Worker and Escape restored the launcher without completion. Every required English desktop and Gujarati phone screenshot across all four variants was inspected. The immediate post-Back step-2 screenshot captures an in-progress outline transition; four separate read-only probes (piece/salary, English desktop/Gujarati phone) passed 12 frames at 0/500/2000 ms, with the correct availability/salary outline by 500 and 2000 ms and no actual target/panel overlap in any frame. All four supplemental contact sheets were inspected. Exact frame-level transition duration and required human/native-language/screen-reader/real-device/live persistence evidence remain UNVERIFIED. Original main screenshots and assertions are unchanged; no reproduced Major defect.

**GT-15: FAILED.** GT-15 main matrix completed 16 attempts / 94 captured steps. Seven original main cases reproduce MA-1 step-1 board overlap at English 1024x768 and Hindi 1280x800, including empty/populated and reduced motion; a separately preserved unchanged Night/focus retry at 1024 also reproduces it. GT-15 must be FAILED under BV-02; the conditional columns fallback was not selected or tested and no anchor fix is authorized by this review. The owned fixture server exhausted Node heap memory before the last two original cases loaded; both zero-step connection-refused failures remain intact. The identical fixture was restarted, and two unchanged retries captured all 14 missing steps, with Gujarati state/focus checks passing apart from the baseline API guard. All 19 original English desktop/Gujarati phone contact sheets and three Gujarati retry sheets were visually inspected, plus representative 1024/1280 board screenshots. Samples, picker, Choose and Undo controls remained disabled and inert; no real business handler or navigation occurred. Derived day/sample views preserved and restored Night, nonmatching search, worker/machine focus URL and non-tour storage. Focus banner stayed hidden while touring. Done focused first live Assign or Add worker in the ordinary variants, and the replay launcher when the restored nonmatching search removed the worker. Exit at picker restored the page/launcher without completion; replay/Escape passed. All loaded original and retry runs retain one blocked unchanged production_viewed mount event, so raw FAIL classifications and API assertions are preserved. Separate read-only Back/Next probes at English 1440/1024 and Gujarati phone captured nine frames at 0/500/2000 ms; all three probe UI exits are 0 with no issues, while raw guard classifications remain FAIL for the mount event. All nine diagnostic screenshots were inspected. Immediate images retain moving outlines/fading panels, with brief saved-preview obstruction at 1024; computed rectangles and screenshots are sampled at slightly different moments. At 500 and 2000 ms, panel and outline are on screen, correctly aligned and separate from the saved-preview target in all three cases. Exact transition duration, native language, screen reader, real device, owner and live persistence evidence remain UNVERIFIED. Original runner, assertions, timeouts, screenshots and failures are unchanged.

## Source integrity

Application unchanged: **True**. HEAD/branch unchanged; only the authorized execution ledger differs from the initial source manifest. [Integrity proof](source-integrity.json).

The first final comparator omitted the starting manifest tombstones for eleven preexisting deleted files. That false change report and its helper are preserved; the final proof uses the identical starting schema. [Original comparison](integrity-first-attempt/source-integrity.json); [corrected helper provenance](provenance-integrity-repair/manifest.json).

Owned synthetic Vite harness stopped: **True**. [Shutdown evidence](owned-server-stop.json).

