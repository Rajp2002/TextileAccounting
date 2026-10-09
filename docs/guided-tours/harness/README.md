# Tour harness

A throwaway browser harness that renders Weavly's real tour components without signing in, so tours can be stepped through in Chromium and measured. It produced the OBSERVED findings in [`docs/GUIDED_TOURS_REFINEMENT_PLAN.md`](../../GUIDED_TOURS_REFINEMENT_PLAN.md) §1.4 and is the browser evidence tool for every task gate.

It is **not** the app. It has no auth, no real data, no real sidebar content and no mobile bottom navigation. Every module whose first statement is `'use server'` is replaced by a stub that records the call in `window.__serverCalls` and returns `{ success: false }`. Real-app behavior is checked by the owner on QA at gates G1 and G2.

## Files

| File | Purpose |
| --- | --- |
| `vite.config.mjs` | Vite root; `@/` alias to the repo; stubs for `next/*`, `server-only` and the Supabase browser client; the server-action stub plugin |
| `postcss.config.mjs` | Tailwind v4 PostCSS with the repo as the source base |
| `index.html`, `main.tsx` | Mounts `I18nProvider` + a copy of the owner-shell classes (`data-owner-shell`, `mobile-workspace-content`, `dashboard-main`) + one scenario, chosen by `?s=<scenario>&lang=<en\|gu\|hi>&fresh=1` |
| `stubs/` | Minimal `next/navigation`, `next/link`, `next/dynamic`, `next/image`, `next/cache`, `next/headers`, Supabase client |
| `run-tour.mjs` | Opens a scenario, clicks the guide launcher, presses Next through every step, records geometry, focus, scroll, server calls and a screenshot per step into `out/<scenario>-<lang>-<size>/` (characters other than letters, digits and `-` in the scenario become `_`, so `quotes?tier=lite` writes `out/quotes_tier_lite-…`) |
| `summarize.py` | Prints per-run issues: panel/outline overlap, target off screen or clipped, description scrolling, server calls; lists runs that crashed or timed out as INCOMPLETE and exits 1 if any run is incomplete or recorded an error |
| `batch.sh` | All scenarios × the four standard viewports; exits 1 and lists the runs that failed or timed out |
| `labels.json`, `probe-labels.mjs` | The label probe behind `audit/label-probe.md` |

## Set up (once per session)

The harness must run from the git-ignored `scratch/` folder so nothing it creates is tracked.

```bash
# from the repository root, with dependencies installed (see CLAUDE.md; this container needed `npx -y npm@11.6.2 ci`)
mkdir -p scratch/tour-harness && cp -R docs/guided-tours/harness/. scratch/tour-harness/
cd scratch/tour-harness
node ../../scripts/performance/isolated-command.mjs npx vite --config vite.config.mjs # serves http://localhost:5199; leave running (background it)
```

Playwright is **not** a project dependency. The scripts load a global Playwright installation:

- `PLAYWRIGHT_ROOT` (default `/opt/node22/lib/node_modules/`): a directory whose `node_modules` resolution finds `playwright`.
- `CHROMIUM_PATH` (default `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`); set it to an empty string to use Playwright's bundled browser.

Both defaults match the cloud container used for planning. On another machine, set them. Do not add Playwright to `package.json` (task packets forbid dependency changes).

## Run

```bash
node run-tour.mjs <scenario> <en|gu|hi> <width>x<height> [outDir]
node run-tour.mjs 'quotes?tier=lite' en 1440x900              # variant: the part after ? becomes URL parameters; quote it
REDUCED_MOTION=1 node run-tour.mjs <scenario> en 1024x768      # reduced-motion check
./batch.sh; python3 summarize.py                               # everything, then the issue list; each exits 1 if a run failed, timed out or has no record
node probe-labels.mjs                                          # writes labels-out.json
```

Scenarios in `main.tsx` today: `foundation`, `production`, `fabric-stock`, `yarn-stock`, `dispatch`, `payroll`, `payroll-records` (several months of settled payments; add `&empty=1` for none), `machines`, `workers`, `workers-salary`, `assignments`, `estimator`, `free-estimator`, `rates`, `quotes`, `quotes-compare`, `free-costings`, `labels`.

The one `404` console error in every run is the missing favicon; ignore it.

## Keeping it working as tasks change the code

- `run-tour.mjs` finds the panel by `.guided-tour-panel`, the outline by `.guided-tour-highlight`, and Next by `[data-tour-control="next"]`. Since the side rails were removed (2026-10-09), every tour opens from the page header's Guide: the runner clicks `[data-tour-control="guide"]`, then the launcher inside the modal (`take-tour`/`quiet-tour`, or a walkthrough topic such as `compare-tour` or `payroll-help`). After Exit, focus returns to the Guide button. Older notes below about rail paint and rail intersection describe the previous layout. GT-01 keeps these class names and attributes (EC-08, EC-09). GT-01 also updates `run-tour.mjs` to read the step from `data-tour-step`/`data-tour-status` instead of the progress bar, and GT-02 adds the new launcher attribute values if they change.
- When a task adds a scenario (new tour, Free/paid variant, empty/populated data), it adds it to `main.tsx` **in `scratch/`** and copies the updated file back into `docs/guided-tours/harness/` so the next session has it.
- Classes used only by harness files are not generated by Tailwind (it skips git-ignored files). Style harness-only elements inline or in `index.html`.

## Known limits of the evidence

- **Rail overlap cannot be measured by hit-testing**: during a tour the page is `inert`, and inert elements are skipped by `elementFromPoint`. `summarize.py` flags rect intersections; confirm them from screenshots.
- Live-page scenarios render with empty data, so they show demo or sample rows and empty states. Populated states need the owner's QA run.
- The harness does not load the real sidebar or `app/layout.tsx` fonts; text metrics are close but not identical.

## GT-01 foundation and preserved regression evidence

Run every verification command through `node ../../scripts/performance/isolated-command.mjs` from the scratch harness directory. The commands above show the child commands for brevity. The foundation fixture is independent of the fake sidebar so its top-left target and 300px scroll container remain visible. It uses only shared, approved copy and does not record completion.

```bash
node ../../scripts/performance/isolated-command.mjs node run-tour.mjs foundation en 1440x900 gt01-foundation
node ../../scripts/performance/isolated-command.mjs node run-tour.mjs foundation en 1024x768 gt01-foundation
node ../../scripts/performance/isolated-command.mjs node run-tour.mjs foundation gu 390x844 gt01-foundation
node ../../scripts/performance/isolated-command.mjs env REDUCED_MOTION=1 node run-tour.mjs foundation en 1024x768 gt01-foundation-reduced
node ../../scripts/performance/isolated-command.mjs env TOUR_OUT_DIR=gt01-regression ./batch.sh
node ../../scripts/performance/isolated-command.mjs python3 summarize.py gt01-regression
```

The isolation wrapper strips custom environment variables. On a machine whose browser paths differ from the defaults, insert `env PLAYWRIGHT_ROOT="$PLAYWRIGHT_ROOT" CHROMIUM_PATH="$CHROMIUM_PATH"` after the wrapper path and before the child command (combine these assignments with the existing `env` assignments above). Set those shell variables to the existing local installations first. `batch.sh` also needs a `timeout` executable on `PATH`; GT-00's local macOS helper is retained under `scratch/tour-harness/bin/`. Do not overwrite GT-00's `out/` or `baseline-summary.txt`. `TOUR_OUT_DIR` changes only the default output root; the explicit runner output argument takes precedence. `summarize.py` accepts that root as its optional first argument.

The foundation runner exits nonzero for missing/unavailable steps, panel/outline overlap, an offscreen outline, focus outside the panel, Back removal failing to focus Next, incorrect container/window scrolling or restoration, or smooth scrolling under reduced motion. Inspect its screenshots as well as its `record.json`.


### Approved Estimator comparison recovery

GT-01's original 900ms samples were not reproducible even with the committed GT-00 runtime. The owner approved refreshing only these five comparisons: paid Estimator en1440×900, en1024×768 and hi1280×800; Free Estimator en1440×900 and hi1280×800. Keep `out/`, `baseline-summary.txt`, the original GT-01 regression and all other 47 comparisons.

For both the GT-00 control and GT-01, pass `env SETTLED_SAMPLING=1` after the isolation wrapper and use separate output roots. This opt-in mode keeps normal motion and observes fonts, panel/outline geometry, scroll positions and finite animations. After the usual initial wait it requires at least 1,500ms of observation and 500ms of unchanged geometry with no finite animation running. It fails after 8,000ms instead of recording a moving frame. Each step records its settling duration. It does not change styles, trigger layout events, move targets or suppress geometry issues. The summary format and issue calculations remain unchanged.


## GT-03 Saved Costings

Run `quotes`, `'quotes?tier=lite'`, `free-costings` and `quotes-compare` at en1440×900, hi1280×800, en1024×768 and gu390×844, plus each at en1024×768 with `REDUCED_MOTION=1`. Use the isolated wrapper and external browser paths above. `quotes-compare` selects its own walkthrough launcher. The runner requires exact step counts, ready targets, no panel/outline overlap, outlines on screen, panel focus, no sample Close controls, the paid first-step panel on the right at wide widths, preference-only server calls, no navigation, and the expected Done focus.

These scenarios set the browser pathname to `/owner/quotes` or `/free/costings` before rendering so the real route-dependent translation rules apply. The generic runner stubs the Free list API with an empty list. `search=<term>` seeds the actual search input and checks that its value survives the tour. For focused fixture probes, `populated=1` supplies synthetic paid records and exposes `window.__fixtureSavedCostings` for a stubbed Free list API; `error=1` sets the paid load-error state (Free probes respond with HTTP 500); `retained=1` renders the embedded Free listing above the paid page; and `embedded=1` suppresses the standalone Free rail/guide. These parameters never read a live account.

G1 evidence and the exact selected run paths are recorded in `EXECUTION_STATUS.md`; keep older failed/diagnostic runs alongside the accepted records instead of overwriting them.


## GT-07 Dispatches (browser execution deferred by owner)

The `dispatch` fixture now mounts the real `ChallansClient` under the replica wrapper, using only synthetic props and recording server stubs. Its pathname is `/owner/dispatches`. The runner fills the real search input before launch, retains the node reference, and checks one mount, zero unmounts and the same search value through all ten steps and Done. It asserts sample/live visibility, the single visible handoff anchor, disabled sample controls, no panel/outline or desktop dialog overlap, no rail intersection at steps 1 and 8, on-screen geometry, panel focus, Done focus, preference-only calls and no navigation. Reduced motion rejects smooth scroll calls.

Required later runs (use the isolation wrapper and external browser paths described above): `dispatch en 1440x900`, `dispatch hi 1280x800`, `dispatch en 1024x768`, `dispatch gu 390x844`, and `dispatch en 1024x768` with `REDUCED_MOTION=1`. Keep steps `01.png` and `08.png` at 1440×900 for rail paint review, plus `10.png` and `99-after.png` for the live handoff and final focus. Numeric assertions do not replace screenshot review.

Optional scoped variants: `'dispatch?noStock=1'` provides no stock qualities, `'dispatch?populated=1'` supplies one synthetic dispatch, and `'dispatch?pending=1'` seeds a synthetic retry request in this isolated browser session before mount. The pending case expects Done to return focus to the launcher because New dispatch is disabled. The tour never writes this fixture or invokes its retry. All GT-07 browser/geometry/reduced-motion/focus/state-preservation scenarios remain **UNVERIFIED** until a later verification chat executes them. No browser has been launched by the implementation worker.

## GT-06 Rate Book (browser verification deferred)

`rates` renders the existing empty-account demo; `rates-populated` supplies two synthetic real-shaped rates (one due for review, one current). Both use `/owner/rates` for real translation rules. No live account is used. Run both at en1440×900, hi1280×800, en1024×768 and gu390×844, plus reduced motion at en1024×768. Run `rates-populated` at those widths with `PRE_CLICK='#yarn-rates-search' PRE_TYPE='no-matching-yarn'` to check shadowed rows and exact search preservation after Exit and Done. Supply those variables through `env` **after** the isolation wrapper, as with the browser paths above.

The Rate Book runner asserts exactly six ordered steps, one visible launcher, ready target outlines with zero panel overlap, consistent row identity in steps 3–5, Sample eyebrows only for the demo, correct Add/search Done focus, preserved search and preference-only tour calls. The existing `getCostRateUsage` mount read is recorded before launch and may not increase during the tour. PRE_CLICK also performs an independent Exit probe before the full run and checks launcher focus and no completion write. Required recovery probes: `'rates?demoDeleted=1'` and `'rates-populated?archivedOnly=1'` assert unavailable row steps and the Add handoff. All normal/motion/filter/recovery cases, especially the below-1024 rail layout and Gujarati phone completion, remain **UNVERIFIED** until the later authorized browser session executes and visually reviews them.

## GT-05 Cost Estimator (browser verification deferred)

Run estimator (Base), 'estimator?tier=lite', and free-estimator at en1440×900, hi1280×800, en1024×768 and gu390×844, plus each at en1024×768 with REDUCED_MOTION=1. These fixtures now use their real owner/Free path for translation and supply modern account-preference metadata. No browser evidence is claimed by this implementation change.

PRE_CLICK clicks a visible selector before launching; to verify Detailed restoration, pass env PRE_CLICK='[role="tab"]:text-is("Detailed")' after the isolation wrapper. EXIT_AT=8 exits via Escape on that step instead of finishing. Run both Exit and Done from Detailed. Keep separate output roots. The wrapper strips environment overrides unless supplied with env after its path. The already-open Live cost state is covered by the restore-closure unit cases; its browser setup remains to be established during verification because the normal modal sheet can block the rail launcher.

Every request whose pathname begins /api/ is recorded as URL + method in record.json's apiRequests array. Estimator assertions require ten exact Quick steps (or EXIT_AT steps), ready/on-screen outlines, no panel/outline or desktop panel/sheet overlap, wide first-step placement on the right, panel focus, correct Live cost state, restored mode/open state/input values and non-tour local storage, correct Exit/Done focus, no navigation, no increased getEstimatorSecondaryData mount reads, preference-only tour calls and no /api/free/calculate request. Inspect screenshots as well. Required scenarios, including reduced motion and restoration, remain UNVERIFIED until actually run.

BV-01 (2026-09-30): at ≤767px the Live cost sheet fits the screen without scrolling, so the shared mobile tracker found no scrollport and step 9 (`est-save`) was unavailable in Gujarati. The Estimator runtime now reserves scroll room in `#mobile-live-estimate-panel` on phones only (`padding-bottom: 100dvh` in its runtime-only style block); the tracker then applies its own measured reserve and scrolls Save above the docked panel. Phone runs of steps 8 and 9 in all three plans, and Exit at step 9, are the regression checks.

Round 2 (2026-09-30): at tablet portrait (768–1023px) the fixed 248px sidebar leaves a 448px column, so the 360px panel cannot sit beside a Quick card, and with cards 594–631px tall and centred by the tracker there was no room above or below (overlap at `est-warp`, `est-weft`; `est-handoff` overlapped only mid-animation at the runner's 900 ms sample). For those widths only, the runtime reserves the reading column on the left over the sidebar: cards narrow by 120px and right-align (start at 404px = 248 sidebar + 36 gutter + 120), and the Live cost sheet moves into the same right-hand column so the outline never crosses the panel between steps. ≥1024px rules are unchanged. `768x1024`, `820x1180` and the 1023px edge are the regression checks.

### GT-08 Fabric Stock (browser runs deferred)

`fabric-stock` now mounts the real `QualityStockClient` using synthetic empty data. `fabric-stock?populated=1` adds one quality without opening stock; append `&allOpening=1` for an already opened quality. No live loader runs. The runner preserves a search value and DOM reference, checks the six steps, 100 → 600 → 590 balances, Pending state, disabled sample controls, live handoff, same mounted client/state, focus, geometry and the preference-only action allowlist. The plain audit workspace div remains so removing its guide does not change the content width.

Required deferred cases (all **UNVERIFIED** until actually run and screenshots reviewed):

- `fabric-stock en 1440x900` — rail paint and live Opening stock handoff.
- `fabric-stock hi 1280x800` — long copy and dialog placement.
- `fabric-stock en 1024x768` — FS-5 panel/outline overlap regression.
- `fabric-stock gu 390x844` — compact sheet, scrolling and handoff.
- `REDUCED_MOTION=1` with `fabric-stock en 1440x900` — no smooth tour scrolling.
- Yarn compatibility is now covered by the seven-step GT-09 matrix below; Fabric scenarios and assertions remain unchanged.

Also deferred: populated/all-opening Fabric variants, `EXIT_AT=3` for Escape restoration, Back transitions, detail expand/collapse, replay, open opening/correction/history dialog launch blocking, uncertain-save preservation, audit-page layout inspection, native-language review, owner QA and separate review. Run commands only through the isolation wrapper as above. `EXIT_AT` now also supports either stock tour. Browser fixtures/assertions being present does not verify these scenarios.


## GT-11 Production Overview (browser verification deferred)

`production` now renders the actual `BaseProductionClient` Overview with empty synthetic data and all server modules stubbed. `production?populated=1` supplies an active sample quality, loom and worker. Neither fixture runs a loader or accesses live data. The real responsive Activate Quality buttons provide the handoff anchor. Before launch, the runner enters a retained board search and selects Available; it records the input identity, filter state, mount/unmount counts and non-tour storage through all seven steps and Done.

Required later runs: `production en 1440x900`, `production hi 1280x800`, `production en 1024x768`, `production gu 390x844`, and `production en 1024x768` with `REDUCED_MOTION=1`. Repeat populated fixtures at the same widths. Supply environment flags after `node scripts/performance/isolated-command.mjs env …`; use the external browser paths documented above. `EXIT_AT=5` provides a separate Exit restoration/no-completion probe; default completes the handoff. Keep distinct output directories.

The runner asserts exact seven-step order, disabled sample controls, ready/on-screen target and panel, zero panel/outline or desktop dialog overlap, no wide rail intersection, panel focus, the same live input/filter/non-tour storage, one visible Activate Quality handoff anchor, Done focus (or launcher focus and restored scroll after Exit), preference-only tour calls, no tour API requests/navigation and no smooth scroll under reduced motion. Retain screenshots 01–07 and 99-after; visually review rail paint and sample dialog content as well as numeric results. Daily Sheet route children-only behavior has a render test; its dedicated guide remains GT-12.

All listed browser, populated/empty-state, reduced-motion, Exit/Done, replay and already-open live-dialog checks remain **UNVERIFIED** until a later authorized verification session runs and reviews them. Owner QA, independent review, real-device/accessibility and Gujarati/Hindi native review also remain **UNVERIFIED**. No browser/server was launched by the GT-11 implementation worker.


## GT-14 Workers — browser execution deferred / UNVERIFIED

`workers` follows the piece path. `workers-salary` launches the same real register and clicks the salary path inside TourPanel. Both fixtures support `?populated=1` and initial `search`, `shift`, `status`, `inactive`, `payType`, `worker`, `returnTo`, `add` parameters. These are synthetic props; every server action remains stubbed.

After copying the harness to scratch, the later browser verifier should run both paths at en 1440×900, hi 1280×800, en 1024×768 and gu 390×844, plus the same matrix with `REDUCED_MOTION=1`. Use the isolation wrapper and existing browser paths described above. Also run `workers-salary?populated=1&search=Retained&shift=night&status=all` to check filter/URL restoration. `add=worker` is a manual fixture for confirming the guide launcher is hidden when the live editor is open.

The runner checks the six approved steps, repeated pay-path toggles, readiness, Back traversal, piece reset after Exit and Done, path button `aria-pressed`, both fields in merged `wks-changes`, localized sample names, disabled preview controls, hidden preview close icon, shared sample banner, live Add worker handoff focus, restored filters/URL/non-tour storage, no business calls/navigation/API requests, and instant scroll under reduced motion. It rejects panel/outline or desktop editor overlap and Gujarati first-step description scrolling at 390×844. Review every screenshot as well; native copy has not been shortened.

No GT-14 browser/server run or screenshot is claimed by this implementation. All scenarios above, owner QA, native-language and independent reviewer acceptance remain **UNVERIFIED**.


### GT-09 Yarn Stock (browser runs deferred)

`yarn-stock` mounts the real `YarnStockClient` with a synthetic empty board. `yarn-stock?populated=1` supplies one yarn/fabric/costing; append `&unlinked=1` for missing costing links. All server modules remain recording stubs. The runner types an unsubmitted audit date, retains its DOM reference, and checks seven-step order, 100 → 120 → 100 kg balances, sample weights 100/20/98, production −20 kg, disabled sample controls, live section order, one sample banner, shared runtime geometry, same mounted client/date, live Opening weight handoff and Done focus, preference-only actions and no API/navigation. The date is not applied and no stock operation is invoked.

Required scenarios, each **UNVERIFIED**:

- `yarn-stock en 1440x900`: seven steps, no rail paint, live handoff and focus.
- `yarn-stock hi 1280x800`: long native copy and no panel/dialog/outline overlap.
- `yarn-stock en 1024x768`: YS-3 overlap regression.
- `yarn-stock gu 390x844`: compact panel, scrolling, dialogs and handoff.
- `REDUCED_MOTION=1` with `yarn-stock en 1440x900`: no smooth tour scrolling.

Also deferred: repeat with populated/unlinked data; use `EXIT_AT=2` and `EXIT_AT=6` for Escape at sample dialogs; inspect More detail on balance/usage/correction, Back/detail reset, replay, keyboard/focus trap, scroll restoration and screenshot rail paint. Verify launcher blocking under a real uncertain-save modal and disabled Opening weight fallback separately in the later authorized verification session. No harness was executed by GT-09 implementation; syntax checks do not verify any scenario, native-language quality, real-device behavior or owner/reviewer acceptance.

## GT-12 Daily Sheet prepared scenarios — execution deferred

`daily-sheet` renders the real BaseProductionClient on `/owner/production/daily-sheet` with empty data. `daily-sheet?populated=1` supplies one assigned machine, worker and active quality; the runner types `37.5` metres before launch and checks exact device draft bytes and the same input node throughout the tour and after Exit/Done. All server actions remain recording stubs. The inherited Overview wrapper is present to prove it contributes no Daily Sheet launcher.

Run both scenarios later at en 1440×900, hi 1280×800, en 1024×768 and gu 390×844, then repeat with `REDUCED_MOTION=1`. Repeat populated runs with `EXIT_AT=4` (and other steps as required) to check retained draft/scroll/focus. `PRE_TYPE` optionally overrides the retained reading. The prepared checks require nine ordered steps, a single guide above the sheet below 1280px or last in the right rail above it, disabled samples, no overlap, both live handoffs, unchanged node/draft/URL, and no business calls or API requests. Daily Sheet dialogs reuse the existing production preview placement attribute alongside their new daily context attribute.

These fixtures/assertions were only syntax-checked in GT-12. Every viewport, normal/reduced-motion, keyboard/focus/scroll, locked/conflict/storage-error variant, visual/native/reviewer/owner acceptance and actual draft retention scenario is **UNVERIFIED** until authorized browser execution. PI-04 remains a separately tracked product defect; this harness's stubbed navigation cannot verify it. Never interpret these prepared scenarios as a live navigation check or change the approved U-06 copy.

## GT-15 Machine Assignments — browser execution deferred / UNVERIFIED

The `assignments` fixture mounts the real operations client. Empty data is the default;
`assignments?populated=1&shift=night&availability=night` supplies synthetic live records
and exercises the first eligible worker handoff. `worker` and `machine` focus parameters
are forwarded, including unavailable IDs, to verify that the focus banner stays hidden
during the tour and returns afterward. All server actions remain stubs.

The later verifier must run empty and populated variants at en 1440×900, hi 1280×800,
en 1024×768 and gu 390×844, plus reduced motion. Use `EXIT_AT=5` for picker Exit,
`PRE_TYPE="Retained"` for retained-search entry,
and a separate phone run starting from the Machines toggle. Inspect every screenshot.
The runner checks seven steps, picker Back/Next restoration, disabled picker options,
hidden Close, inert page, hidden focus banner, sample/live data separation,
data-dependent handoff, restored filters/shift/mobile view/URL/non-tour storage,
replay and absence of business calls/navigation/API requests.

Anchor decision (2026-09-30, from browser evidence): the default
`[data-configuration-tour="board"]` anchor overlapped the panel at en 1024×768 and hi 1280×800
(BV-02: 10,070 and 5,724 px²), so the page-spec §E fallback is selected. `ma-purpose` anchors to
`[data-tour-anchor="assignments.columns"]`. First resolution (the board's control row) cleared the
outline but put the panel over the Workers column, so round 2 moved the attribute to the Workers/Machines
columns grid itself and made that grid content-height (`flex-none`) on sample steps only. The outline now
frames the sample worker and loom, and the panel lands in the board's empty lower area. On phones the same
attribute marks the mobile board card, the element phones already used. The runner still fails on any
panel/outline overlap, including the first board step; do not suppress it. Its overlap message still
mentions the "default board anchor"; that is only wording. Native review, owner QA and independent
reviewer acceptance remain **UNVERIFIED**.

Run the fixture server with the scratch harness folder as its working directory. The harness PostCSS
config uses `base: '../..'`, which `@tailwindcss/postcss` resolves against the current directory, so a
server started from the repository root generates no Tailwind utilities and every run looks unstyled
(panels off screen, all steps flagged). Check `curl` output of `/@fs/<repo>/app/globals.css` contains
`.flex {` before trusting a run.


### GT-10 Payroll (prepared; browser verification deferred)

`payroll` mounts the real Payroll client with synthetic empty data and exercises the eight core steps. `payroll-extra` uses the same fixture and launches the six-step optional walkthrough from `data-tour-control="payroll-help"`. Both preserve the live search node and value, compare non-tour storage, check inert sample controls, enforce zero business calls/navigation, check readiness/focus/outline/panel/dialog/rail geometry and verify the exact live handoff. The optional path also checks that no preference event or local tour record changed. `EXIT_AT` supports dismissal checks on either track.

Run both scenarios at 1440×900 English, 1280×800 Hindi, 1024×768 English, and 390×844 Gujarati; repeat with `REDUCED_MOTION=1`. Inspect screenshots, especially core steps 1/3/4 at 1024 and rail paint at 1440. These source changes and syntax checks are not a browser result. No GT-10 browser/server execution was authorized during implementation.
