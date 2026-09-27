# Audit: Cost Estimator (/owner/estimator and /free)

Read-only subagent report, 2026-09-27. Key claims were spot-checked against source by the planning session before use; the refinement plan and page specs say which findings were adopted. Labels: CV = CODE-VERIFIED, INF = INFERRED.

---

# Cost Estimator page and guided tour: read-only audit

I only read files. Nothing was modified and no command was run.

**File abbreviations** (all paths are under `/home/user/TextileAccounting/`):
- **EC** = `app/(dashboard)/owner/estimator/EstimatorClient.tsx`
- **CET** = `components/estimator/CostEstimateTutorial.tsx`
- **ET** = `lib/estimator-tour.ts`
- **TUT** = `lib/i18n/cost-estimate-tutorial.ts` (field guide copy)
- **WF** = `lib/i18n/cost-estimate-workflow.ts` (copy for the main "core" tour). This file is outside your list, but CET imports it for all core step text.
- **TI** = `components/tours/TourInvitation.tsx`
- **UTI** = `hooks/use-tour-invitation.ts`
- **TP** = `lib/tours/tour-preferences.ts`

Every finding is marked **[CV]** (CODE-VERIFIED: read in source) or **[INF]** (INFERRED: plausible, not confirmed).

---

## 1. Page workflow

**Purpose [CV].** The page builds a per-metre production cost for a grey fabric from these parts:
- warp and weft yarn: consumption × rate, plus waste/crimp and GST
- weaving charge
- warping/sizing
- optional winding/processing/finishing
- overhead

It then derives the suggested price as (production + transport) ÷ (1 − commission% − margin%) (`lib/estimator.ts:26,869`). It also shows break-even price, and expected profit when a quantity is entered.

**Routes [CV].**
- `/owner/estimator`: `page.tsx:8-36` requires the owner role, is behind AccessGate `estimator` (`layout.tsx:4`), and passes `canUseProductionPipeline = hasCapability(tier,'production')` (`page.tsx:15`).
- `/free`: `app/free/page.tsx:5-7` → `FreeClient.tsx:10`. This renders the same EC with `freeMode={!paid}`, `disableAutosave`, `initialTemplates=[]` and `wizardDismissed`. It is upgraded in place through `FreeWorkspace.activatePaid`.

**Prerequisites [CV].**
- **Factory cost profile (paid).** `FactoryCostWizard` shows when `!state.isConfigured && !wizardDismissed` (EC:5104-5170). Its steps are intro → choice (direct ₹/m or monthly expenses) → capacity → expenses → defaults. `page.tsx:22-23` treats metadata `factory_cost_wizard_dismissed`/`factory_cost_configured` as configured.
  - The tour launcher only renders when `enabled={state.isConfigured && !saving}` (EC:5351), so there is no tour until the wizard is completed or dismissed.
- **Rate Book / saved qualities (paid).** These load asynchronously through `getEstimatorSecondaryData` (EC:3912-3953).
  - Picking a suggested yarn auto-fills denier and rate and flags them "unverified" (EC:3721-3743).
  - Stale default rates trigger a "Review overdue costing rates" dialog on save (EC:7100+).
- **Free.** There is no profile. `makeFreeEstimate()` sets overhead `direct` with a null rate, all optional sections off, and crimp 0 (`lib/free-estimator-defaults.ts:3-6`). Quota comes from `/api/free/status`.

**Default view is Quick** (`entryMode` initial `'quick'`, EC:3572). `showAdvancedOverhead=true` also forces the Detailed view (EC:5953).

**Sections, in order.**
1. **Current quality card.** `section#active-quality[data-slot=card]` (EC:5706-5772) contains:
   - the Quick/Detailed tabs `[data-tutorial-section=1][data-estimator-field=entryMode]` (5729-5738)
   - the Saved qualities picker button `[data-testid=saved-quality-quick-picker][data-tutorial-section=10][data-estimator-field=savedQualities]` (5741-5766), hidden in Free
   - the validity status line
2. **Detailed view** (EC:5982-6995):
   1. Costing basics (tut. 2): name `qualityLabel`, Warp/Weft component counts (`warpComponentCount`/`weftComponentCount`, EC:868 via 6020), construction text, crimp, default waste.
   2. Warp rows (tut. 3): RowCard `[data-estimator-row]` with calc mode, name + suggestions, denier/beam ends or kg/100m, waste, rate, GST.
   3. Weft rows (tut. 4): cm/inch toggle, PPI, finished width, …
   4. Weaving (tut. 5): `weavingRateMode` ₹/m vs paisa/pick (2672).
   5. Warping & sizing (tut. 6): In-house/Outsourced (6432/6487).
   6. Factory expenses / overhead (tut. 7): Direct vs "Calculate from monthly expenses" (6560-6567), `overheadOverridePerM` (6581), "Monthly expenses" button (6627).
   7. Optional sections (no tutorial section, 6818).
   8. Cost Breakdown audit (no tutorial section, 6841).
   9. Quantity / margin / commission / transport (tut. 8, 6969-6994).
3. **Quick view** (`QuickCostingView`, EC:2776-3257) has similar cards but **no component-count fields**, and uses different labels: "Monthly expenses ÷ output", "Edit monthly overhead details" (3209, 3217).

**Modals, drawers and sheets [CV].**
- **Saved qualities "Change quality" Sheet** `#saved-qualities-sheet-panel`, containing `section#saved-qualities[data-estimator-field=savedQualityPicker]` (EC:5696-5951). It is forced closed in Free (`open={!freeMode && …}`, 5697).
- **Monthly expenses Dialog** `#monthly-expenses-dialog-panel`. It contains `monthlyExpensesBreakdown` and `monthlyProductionM` and a "Save baseline" button that calls `handleSaveProfile` (EC:6649-6795, 6789).
- **Live cost:** a floating button `[data-testid=mobile-live-estimate-shortcut][data-tour-floating]` with `liveCostShortcut`, shown on **all breakpoints** (EC:1476-1507). It opens the Sheet `#mobile-live-estimate-panel`, which contains `liveCostReadiness`, `liveCostMetrics`, `liveCostAssumptions` and `liveCostActions` (1510-1627). The legacy desktop cockpit is `className="hidden"` (5369-5372).
- **Other dialogs:** rename/archive quality menus (5929-5935), Save-as-quality, New Quality confirmation, warning acknowledgement, stale-rate, pending quality switch (7072), and `CostingExportDialog` (7086).

**Outputs [CV].**
- Live cost sheet: production cost/m, suggested price/m, actual margin, break-even, expected profit, and the collapsible "Pricing assumptions" (1632-1798).
- Per-section cost pills and the Cost Breakdown card.
- In Free, results appear only after a metered save (`hasValidCostResult = !!freeMeter.completed`, EC:4034-4060).

**Save paths [CV].**
- **Save Costing / Save New Version** (`topCostingActionLabel`, EC:4189-4191) → `saveEstimatorQuoteV3` → RPC `save_estimator_costing_revision_v2` (`actions.ts:1562`). This writes an immutable snapshot to `estimator_quotes`.
- **Save Quality & Create Costing** → `saveAsFabricTemplate` → `create_saved_quality_with_initial_costing_v1` (`actions.ts:886`). This saves the recipe plus v1.
- **Quality changed · Update Quality** → `updateFabricTemplate`. Recipe only.
- **Edit rates / rename / archive** → `updateTemplateRates` / `renameTemplate` / `archiveTemplate`.
- **Save baseline** → `upsertFactoryCostProfile`.
- **Free "Calculate & save · uses 1 costing"** → `freeMeter.submit` (EC:4733) → POST `/api/free/calculate` → RPC `complete_free_saved_costing` (`lib/free-service.ts:69-87`). This consumes quota. The fallback limit is 2 (`FreeUsageCard.tsx:48`).
- **Local draft autosave (paid only):** `useAutosave` with `enabled: !freeMode && !disableAutosave` (EC:3684-3691).

**Plan differences [CV].**
- **Free:** no saved qualities (toast at 4232), no factory defaults (4341), no autosave, metered results.
- **Lite:** full estimator.
- **Base:** Lite plus "Start Production" in the post-save panel and the tour's `nextProduction` copy.

**Empty / first-use state [CV].**
- Heading "New quality" with "New construction. Enter the required inputs below." (5724).
- Picker text "Tap to browse saved qualities library or save this recipe"; the Sheet shows `estimator.quality.emptySavedTitle` (5873).
- Live cost button shows "Complete inputs" with a missing-count badge.
- A draft Resume/Discard banner when a local draft exists (5184-5228).

**Where the owner goes next [CV].** The post-save panel "Saved to factory" (EC:5078-5088) offers:
- Create customer quotation
- Start Production (Base only)
- View saved costings (`/owner/quotes` or `/free/costings`)
- Start another quality

---

## 2. Tour implementation

**Launching [CV].**
- **Core tour:** `TourInvitation tourId="cost-estimate" align="full"` (CET:645-654). Its `onLaunch` does `setGuide('core'); setRequested(true)`.
  - With `align="full"`, TI always renders the guide card: "Cost Estimator guide / Start guide" (TI:83-126).
  - invitation vs quiet only changes `data-tour-control` (`take-tour`/`quiet-tour`) and the halo. The dismiss button is never shown.
- **Field guide:** a separate rail button, "Field-by-field help · Optional walkthrough" (`setGuide('fields')`, CET:655-673).
- **No autostart.** The `requestTrigger` prop exists (CET:95-100) but EC never passes it (EC:5349-5363).

**Start sequence [CV].**
1. The `requested` effect (CET:182-269) calls `onPrepare()`, which is EC `prepareTutorial` (EC:3584-3598). That snapshots the view, sets `entryMode='detailed'`, sets `showAdvancedOverhead=false`, and returns a restore closure.
2. After a fixed 150 ms timer it collects `[data-estimator-row]`, dispatches the `tutorial-expand-row` CustomEvent (RowCard listener handleTutorial at EC:2343-2354), and waits through a MutationObserver until every row's first `[aria-expanded]` is `"true"`.
3. It then builds steps and sets `index=0`.

**Core steps [CV].** `buildEstimatorCoreTour` (ET:10-25) returns these in order, mapped at CET:251-259 with `section = index`:

| # | Field (target) | Copy key |
|---|---|---|
| 1 | `liveCostShortcut` | `purpose` |
| 2 | `savedQualityPicker` (paid) / `qualityLabel` (Free) | `quality` / `qualityFree` |
| 3 | `warpComponentCount` | `warp` |
| 4 | `weftComponentCount` | `weft` |
| 5 | `weavingRateMode` | `manufacturing` |
| 6 | `overheadOverridePerM` (direct) / `monthlyOverhead` (monthly) | `overheadDirect` / `overheadMonthly` |
| 7 | `liveCostMetrics` | `review` / `reviewFree` |
| 8 | `liveCostActions` | `saveCosting` / `saveVersion` / `saveFree` |
| 9 | `liveCostActions` (paid only) | `recipe` |
| 10 | `savedQualities` (paid) / `qualityLabel` (Free) | `next` / `nextProduction` |

**Field guide steps [CV].** Built from `[data-tutorial-section]` headers sorted numerically (CET:200-248).
- Every visible `[data-estimator-field]` in each card is a step, including **every field of every yarn row**.
- Extra steps are spliced in: monthlyOverhead → +breakdown/production; liveCostShortcut → +4 steps inside the Live cost sheet; savedQualities → +picker.
- Free drops section 10.

**Target resolution [CV].** `resolveStepElements` (CET:21-59) calls `findTourTarget('[data-estimator-field="…"]')`, which returns the first visible match (`lib/tutorial-target.ts:13-15`). The card element is then:
- the modal panel element found by id, or
- `closest('[data-slot="card"]')`, or
- the floating shortcut wrapper.

**State the tour changes [CV].**
- Before start: `entryMode`, `showAdvancedOverhead`.
- Per step (CET:152-169): open/close the three modals through `setLiveEstimateOpen`, `setShowAdvancedOverhead` and `setShowQualityLibrary`. These are re-asserted on desktop at CET:391-401.
- Expands all rows.
- Sets root `paddingBottom:'40vh'` (CET:171-180).
- Scrolls the window (`scrollBy`, CET:527-577).
- On mobile, adds body/scroller padding and moves the floating shortcut's `bottom` (`lib/mobile-tour-positioning.ts:33-47`).
- While `isTutorialActive`, the modals become non-modal, lose their overlay and animation, and block close (EC:1510-1540, 5696-5704, 5774-5794, 6649-6678).
- **It never dispatches estimate inputs.**

**Restore on exit [CV].** `close()` (CET:271-288) collapses the rows, closes the three modals and calls the restore closure (EC:3589-3597: entryMode, overhead, live sheet, quality sheet, assumptions). It does **not** restore scroll; the shared hook does (`hooks/use-guided-tour.ts:109`).

**Positioning [CV].**
- Desktop uses CET's own code (367-630): frame-stability loop, rAF retries up to 1.5 s, `backupTimer` 350 ms, settle timers of 550/350/500/200 ms, a top-right/bottom-right panel using hard-coded 340/460 px thresholds, a clip-path backdrop and two orange highlight boxes.
- Mobile uses the shared `useMobileTour` → `trackMobileTourTarget`, with a bottom panel capped at 46dvh (`app/globals.css:1433-1459`).
- The shared `useGuidedTourModal`/`useGuidedTourPlacement` are **not used**; the seven `components/tours/*` tours do use them.

**Keyboard and focus [CV].** CET:308-365:
- Body siblings are made inert once at start.
- The panel is focused, and focus returns to the previously focused element on close.
- Escape closes. Enter and ArrowRight go to the next step, ArrowLeft goes back, with no Ctrl/Alt/Meta check.
- Tab wraps only at the first and last button.
- `useTourViewportLock` blocks wheel, touch and keyboard scrolling outside the description area.

**Persistence [CV].**
- Every `close()` path (Finish, Skip, Escape, and the field guide too) writes localStorage `weavly:cost-estimate-tutorial:v1:${orgId}:${userId}`='done' and calls `dismissCostEstimateTutorial` (`tutorial-actions.ts:8-22`: `updateUser({cost_estimate_tutorial_dismissed:true})` plus `revalidatePath('/owner/estimator','/free')`). On success the key is removed.
- A mount effect migrates a leftover 'done' key (CET:119-127).
- UTI persists 'shown' on first render (UTI:68-73) and 'started' after launch (UTI:153-154), stored in local `weavly:tour-prefs:v1:${userId}` and through `recordTourEventAction`, which also revalidates both paths (`app/actions/tour-preferences.ts:83-85`).
- `persistTourCompleted` is **never** called for cost-estimate, whereas the other tours call it.
- `accountDismissed` is stored in `dismissed` ref (CET:87) but **never read**.
- TI is not given `userMetadata`, so `getTourStatus` only sees localStorage (TP:186-254).

**Step copy (EN, WF) [CV].**
1. "Price a fabric with confidence": cost/m → price/margin → save; the tour opens Detailed temporarily and saves nothing.
2. "Start new or reuse a quality" (load a recipe after the tour; loading ≠ saving) / Free: "Name the fabric first" (no Saved Quality or Rate Book entry).
3. "Turn warp consumption into cost": Formula vs Manual kg; 2 kg/100m × ₹200/kg = ₹4/m; blank waste inherits the default, 0 means none.
4. "Use weft construction, not beam ends": PPI plus finished width.
5. "Include the process charges once": weaving unit; In-house vs Outsourced ₹/kg; avoid double counting.
6. "Use your known overhead rate" / "Allocate monthly expenses to output": ₹60,000 ÷ 30,000 m = ₹2/m.
7. "Check the price before saving": ₹100/m at 20% → ₹125/m / Free: results unlock after the metered save.
8. "Keep a fixed costing result" / "Keep the original; save another version" / "Calculate and save intentionally".
9. "Decide whether to reuse the recipe".
10. "Make your first estimate" / "Save before the production handoff" (Saved Costings → Activate for Production).

The field guide copy (TUT) is 43 short "Enter X" definitions.

---

## 3. Data safety

- **No business writes from the tour [CV].**
  - CET imports no estimator actions. `tutorial-actions.ts` only writes `user_metadata`.
  - The tour never calls `dispatch`, so `markUserEdit` is never set. The autosave guard (`hooks/useAutosave.ts:182`) and a draft built only from reducer/labels (EC:3955-3961, `buildCurrentDraft`) mean view flags (entryMode, modal state) never trigger a draft write.
  - Free autosave is disabled (`FreeClient.tsx:10`, EC:3685).
- **Free allowance [CV].** It is consumed only by `/api/free/calculate` through `freeMeter.submit`, which is called from `handleSaveQuote` (EC:4733) or `FreeTransactionRecovery onSubmit` (EC:5048). Both are user clicks.
  - `/api/free/status` (called on mount and on window focus, `use-free-meter.tsx:22-23`) only issues a signed token (`lib/free-service.ts:60`).
  - The tour does not touch the meter.
- **Clicking Save inside the spotlight [INF: safe].** The portal root is `fixed inset-0 z-[100]` without pointer-events-none (CET:674). Clicks inside the clip-path hole should land on that container, not on the Save button in the z-50 sheet.
  - However, sheets and dialogs opened *after* the tour starts are new body children and are **not inert** (the inert snapshot is taken once at CET:312-314, with no MutationObserver, unlike `use-guided-tour.ts:72-73`). Screen-reader access and focus are not fully sealed.
- **Blur/commit [CV].** `ComponentCountField` commits on blur (EC:897). The launcher click already blurs inputs, and the tour never focuses inputs.
- **Server revalidation side effect [INF].**
  - Starting the core tour ('started') and every exit (`dismissCostEstimateTutorial`) call `revalidatePath('/owner/estimator')`. The first visit also does this through 'shown'.
  - An RSC refresh gives `initialProfile` a new identity, which re-runs the effect at EC:3912-3953 (cached promise).
  - For paid orgs with no profile overhead items and with fixed workers, that effect repeats `rawDispatch MERGE_FIXED_WORKERS`, which replaces `fixed_worker_derived` overhead items with the DB values (EC reducer). This could discard user edits to those rows. The probability is low; this needs a runtime check.
- **Drafts / localStorage [CV].** The tour writes only the retry key, `weavly:tour-prefs:v1:*`, and sessionStorage `weavly:tour-session-animation:v1:*`.

---

## 4. Defects and gaps

**Major**
1. **Warp/weft steps spotlight the wrong card (tour) [CV].** Steps 3-4 target the component-count inputs in the Costing basics card (ET:16-17; EC:868, 6020). The copy explains row-level Formula/Manual kg/denier/beam ends/PPI/width, which live in the Warp and Weft cards (EC:6073+, 6189+).
2. **Process-charges step half-covered (tour) [CV].** It spotlights only `weavingRateMode` (EC:2672), but half the copy covers warping/sizing In-house/Outsourced (EC:6432/6487).
3. **Tour teaches a layout the user doesn't return to (tour + product) [CV].** The tour teaches Detailed (EC:3587), but users return to Quick (EC:3572/3592), which has no component-count fields; `cost-estimate-tutorial-ordering.test.ts:33-63` pins that.
   - The overhead copy uses Quick labels ("Monthly expenses ÷ output", "Edit monthly overhead details", EC:3209/3217) while spotlighting Detailed controls labelled "Calculate from monthly expenses" and "Monthly expenses" (EC:6565/6635).
   - EN section name "Factory overhead" vs UI title "Factory Expenses" (`en.ts:1283`).
4. **Final paid step anchored to the wrong feature (tour) [CV].** It targets the Saved **qualities** picker (EC:5741-5747) while the copy is about Saved **Costings**, Export and Activate for Production. This conflates recipes with snapshots, and ignores the direct "Start Production" button in the post-save panel (EC:5084).
5. **Panel may cover modal content on desktop (tour) [INF].** The fixed 400 px top-right panel has no collision handling for modal steps (placement is skipped: `!isModal &&`, CET:447). On ~1024-1280 px screens it likely overlaps the centered Live cost sheet (38rem), quality sheet (48rem) and monthly dialog (max-w-4xl) (EC:1540, 5794, 6678).
6. **Duplicated modal/placement logic (tour) [CV].** CET reimplements what `useGuidedTourModal`/`useGuidedTourPlacement` do and is missing:
   - scroll restore
   - inert handling for portals opened later
   - modifier-key guard
   - pointer blocking
7. **Hindi/Gujarati copy names English UI labels (localization) [CV]; runtime label match [INF].** WF hi/gu embed English labels such as Save Costing, Calculate & save · uses 1 costing, Save Quality & Create Costing, Edit monthly overhead details, Detailed, Finish, and Activate for Production.
   - Some of those buttons render localized: `saveQualityAndCosting` in `gu.ts:1179`; 'Save Costing' via `lib/i18n/base-plan-phrases.ts:96,747`, if applied on this route [INF].
   - Inside the tour itself, "Finish" appears in English in the copy while the button reads "पूरा करें"/"પૂર્ણ કરો" (TUT:224/423).
8. **Missing content (tour gap) [CV].** Not taught at all:
   - the Cost Breakdown audit card (EC:6841)
   - the margin/commission/transport/quantity inputs (only mentioned inside "review")
   - Rate Book yarn suggestions and "unverified" auto-fill
   - the stale-rate dialog
   - the draft Resume banner

**Minor**
- **Duplicate progress counters (tour) [CV].** The core track shows "Section n of N" and "n/N" with the same numbers (CET:251-252, 725, 741).
- **Copy overrides apply to both tracks (tour) [CV].** At CET:632-638, `liveCostShortcut` always shows the intro "purpose" text (even in the field guide, section 9) and `liveCostActions` always shows WF save copy. TUT entries for those keys are dead.
- **Dead code/props [CV]:**
  - TUT `partyName`, `tapeLengthM` (no anchors) and `replay`
  - `requestTrigger`
  - `accountDismissed`
  - `FreeMeterPanel`'s separate 5-step Free tour (`hooks/use-free-meter.tsx:56-72`, never imported)
- **Field guide is long and repetitive [CV].** It repeats identical copy for every warp/weft row (CET:237-247).
- **Fixed delays [CV]:**
  - 150 ms (CET:188/267)
  - 0/350 ms (580-593)
  - 200/350/500/550 ms (560-576)
  - 1.5 s rAF budget (407)
  - stability thresholds of 200/350 ms (430-435)
- **Start can stall [INF].** Rows captured at 150 ms may be detached if the Quick→Detailed remount commits later. `collect` then never completes and the tour silently fails to start (CET:196-198), most likely on mobile where rows start collapsed.
- **Mutates React state objects [CV].** `active.card = …; active.target = …` (CET:461-462).
- **Skip, Escape and Finish are recorded identically [CV].** No completion event is recorded.
- **Style conflicts with design rules [CV]:**
  - `shadow-2xl`, `rounded-2xl`, raw `orange-*` borders and badges with glow shadows (CET:686-736)
  - an orange→amber gradient progress bar (735)
  - an amber sync banner (641-643)
  - desktop `size="sm"` controls, 36 px tall (740-744)
- **Naming mismatch [CV].** "Cost Estimator guide" (`tour-invitations.ts:47`) vs page title "Cost estimate".
- **Awkward EN copy [CV].** `saveFree`: "Calculate & save · uses 1 costing consumes one monthly costing".
- **Quality step on an empty library [CV].** For new owners, step 2 spotlights an empty or loading library (EC:5836, 5867).

**Underlying product usability [CV]**
- Quick view has hard-coded English titles and labels (EC:2840, 2843, 2883, 3070, 3086, 3201), while Detailed uses `t()`.
- Hard-coded English also appears in the Live cost sheet ("Live cost", "Live cost estimate", "Actual margin"; 1492, 1543, 1576), "Change quality" (5797), the Monthly expenses dialog (6683) and "Denier — REQUIRED" (1217).
- Opening monthly details from Quick silently switches to Detailed (5953/5967).
- Live output exists only behind the "mobile" floating button on every breakpoint.
- Section step numbers differ between Quick (1-7) and Detailed (1-9), and both differ from the tour's section numbers.

---

## 5. Localization

- **Completeness [CV].** TUT hi/gu are typed `Record<TutorialField,…>` and WF is typed `Record<EstimatorCoreCopyKey,…>`. `cost-estimate-tutorial-i18n.test.ts` checks key parity and script. There are no missing keys or placeholders, but many embedded English labels (§4 item 7).
- **Terminology inconsistencies [CV]:**
  - **Weft (gu):** UI uses "ભરણ" (`gu.ts:1200` "ભરણ ઘટકો", weft title "ભરણ સૂત રચના (Weft)"); the tour uses "વાણા" (TUT:411/466, WF gu `weft`).
  - **Yarn:** UI uses "सूत"/"સૂત" (`current_yarn_rate`, hi/gu:309); the tour uses "यार्न"/"યાર્ન".
  - **Saved quality:** hi "सेव की गई क्वालिटी" (TUT) vs "सहेजी हुई क्वालिटी" (WF); gu "સેવ કરેલી" vs "સાચવેલી". UI `myQualities` is "सेव की गई फैब्रिक क्वालिटी" / "સાચવેલી ફેબ્રિક ક્વોલિટી".
  - **Waste:** "वेस्टेज"/"વેસ્ટેજ" (TUT) vs "बर्बादी"/"બગાડ" (WF).
  - **Tour vs tutorial:** "टूर" (WF, invitations) vs "ट्यूटोरियल" (TUT skip/hint/progress); the same split exists in gu.
  - **Commission (gu):** "દલાલી કમિશન" (TUT:579) vs "બ્રોકર કમિશન" (553).
  - **Live (gu):** spelled both "લાઇવ" and "લાઈવ" (TUT:566-567).
- **Key terms.**

| Concept | EN (UI / tour) | HI (UI / tour) | GU (UI / tour) |
|---|---|---|---|
| Warp | "Warp Yarn Composition" / "Warp yarn" | "ताना" / "ताना" | "તાણા" / "તાણા" |
| Weft | — | "बाना" / "बाना" | "ભરણ" / "વાણા" |
| Picks | "Picks (PPI)" | "पिक्स (PPI)" | "પિક્સ (PPI)" |
| Denier | UI label hard-coded English (EC:1217) | tour "डेनियर" | tour "ડેનિયર" |
| Overhead | "Factory Expenses" (UI) | "फैक्ट्री ओवरहेड" | "ફેક્ટરી ઓવરહેડ" |
| Live cost | "Live cost" (hard-coded EN in UI) | tour "लाइव लागत" | tour "લાઇવ ખર્ચ" |

- **Script checks.** The Devanagari/Gujarati test only needs one native-script character per string, so mixed English passes.

---

## 6. Tests that pin tour code or copy

- **`__tests__/estimator-core-tour.test.ts`**
  - Exact core step order for paid and Free.
  - `buildEstimatorCoreTour(...)[5]` equals `{field:'monthlyOverhead',copy:'overheadMonthly'}`.
  - Every WF key is reachable.
  - Worked-example tokens in all languages (₹4/m, ₹2/m, ₹125/m, …).
  - **English 'Save Quality & Create Costing' and 'Quality changed · Update Quality' inside hi/gu** (line 73-74), which locks the §4 item 7 issue.
  - Source literals: `setGuide('fields'); setRequested(true)`, `setSteps(guide === 'core' ? coreSteps : next)`, and no `.click(`.
- **`cost-estimate-tutorial-i18n.test.ts`:** key parity, 10 sections, script checks, unit tokens, field IDs.
- **`cost-estimate-tutorial-modal.test.ts`:** many literal strings in CET and EC, including:
  - element ids and `hideOverlay={isTutorialActive}`
  - the exact animation-disable class string
  - `'!isModal && targetRect.top < 340'`, `isMoving`/`stableFrames`/`backupTimer`, the scrollIntoView literal
  - the `onOpenChange` guard and the Enter back/skip literal
  - the monthly and savedQualityPicker insertions
- **`cost-estimate-tutorial-ordering.test.ts`:**
  - the `prepareTutorial` slice up to `const [mobileCostingShortcutVisible]`
  - YarnComponentCountFields only in Detailed (comment markers `{/* 1. Costing Basics */}` and `{/* 2. Warp Yarn Rows */}`)
  - the section 1/9/10 attribute regexes, the numeric sort literal and the `panelPlacement` state literal
- **`cost-estimate-tutorial-transitions.test.ts`:** the exact orange glow class, clip-path 500 ms, the `deltaY` clamp literals, a comment sentence, and `paddingBottom = '40vh'`.
- **`cost-estimate-tutorial-account.test.ts`:** `dismissCostEstimateTutorial` contract (allowFreeAccount, payload, both revalidations).
- **`free-plan-guided-tour.test.ts`:** `enabled={state.isConfigured && !saving}`, `freePlan={freeMode}`, the Free exclusion line, Free page/client `tutorialDismissed` props.
- **`estimator-left-rail.test.ts`** and **`guided-tour-left-rails.test.ts`:** exact `<aside\n                    className="estimator-left-rail space-y-3"`, `align="full"`, no 'amber' in TI props, `railButton`.
- **`tour-no-autostart.test.ts`:** `<TourInvitation`, `tourId="cost-estimate"`.
- **`tour-quota-and-data-safety.test.ts`:** token blacklist. The quota tokens it checks don't exist anywhere in the codebase and it never checks `/api/free/calculate` or `complete_free_saved_costing`, so it is weak.
- **`tour-preferences-and-actions.test.ts`** and **`tour-invitation-lifecycle.test.ts`:** legacy key `weavly:cost-estimate-tutorial:v1:org:user`, revalidate `/owner/estimator`.
- **`tour-i18n-parity.test.ts`:** cost-estimate is the only `halo` tour.
- **`desktop-dimensions-responsive.test.ts:42`:** `data-testid="mobile-live-estimate-shortcut"`.
- **Shared-lib contracts (relevant if migrating to the shared hooks):** `tutorial-target`, `tutorial-viewport-lock`, `mobile-tour-positioning`, `tour-session-coordinator`, `guided-tour-focus`.
- Overall, 40 test files read EC.

**Missing (short list):**
- one anchor per concept that matches the copy (warp/weft row cards; a separate warping/sizing step)
- a teaching view that matches the view the user returns to
- selling-price inputs and Cost Breakdown steps
- Rate Book/unverified yarn guidance
- separate completion vs skip tracking
- scroll restore and inert handling for late portals (use the shared hooks)
- consistent hi/gu terminology, with button names that match the UI
