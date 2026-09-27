# Audit: Production, Machine Assignments, Machines, Workers

Read-only subagent report, 2026-09-27. Key claims were spot-checked against source by the planning session before use; the refinement plan and page specs say which findings were adopted. Labels: CV = CODE-VERIFIED, INF = INFERRED.

---

# Weavly Base plan audit: Production, Machine Assignments, Machines, Workers (pages and guided tours)

Read-only audit of `/home/user/TextileAccounting` at HEAD `f7cff980`. All paths are repo-relative and line numbers are file-local. **CV** = CODE-VERIFIED, **INF** = INFERRED (runtime behaviour not executed).

**Worst findings, in brief:**
- **Possible Blocker (INF):** changing Date or Shift on the Daily Sheet probably drops the user back on Overview (§1.5 P1).
- **Major (CV):** "View log" in Recent production never opens the Daily Sheet (§1.5 P2).
- **Major (CV):** a quality cannot be activated until every yarn in its costing has stock above 0 kg. No tour mentions this (§1.5 P3).
- **Major (CV):** the Production tour tells users to press buttons that do not exist under those names (§1.3).
- **Major (CV):** the Production tour cannot be started from the Daily Sheet (§1.5 P5).

## 0. Shared tour infrastructure (applies to all four tours)

**Launch and invitation**
- `TourInvitation` with `align="full"` always renders a "guide card": the tour name + " guide" and a "Start guide" button (`components/tours/TourInvitation.tsx:83-126`).
- There is no dismiss button and no auto-start. On the first eligible visit the button carries `data-tour-control="take-tour"`, otherwise `"quiet-tour"`.
- All four tours are `emphasis:'static'` (no halo), `allowedPlans:['base']`, owner only (`lib/tours/tour-registry.ts:19-43`). CV
- `handleLaunch` records "started" after `onLaunch` resolves (`hooks/use-tour-invitation.ts:347-358`).
- Completion is stored in localStorage `weavly:tour-prefs:v1:{userId}` and via the `recordTourEventAction` server action (`lib/tours/tour-preferences.ts:5,172-179`). The quota/data-safety test says that action only updates user metadata. CV

**While a tour is open** (`hooks/use-guided-tour.ts`)
- Every `document.body` child except the portal becomes `inert`, re-applied by a MutationObserver (64-73).
- Pointer, click and touch events outside the panel are blocked (75-79, 98-99).
- Keys: Esc closes; ←/→ and Enter (when not on a button) move steps; Tab cycles the panel's buttons; a focusin trap keeps focus in the panel (80-97).
- Page scrolling by the user is locked; only the description area scrolls (`lib/tutorial-viewport-lock.ts:12-40`).
- On close, inertness, scroll position and focus are restored (103-112). CV

**Placement and highlight**
- Desktop: the target is scrolled to centre once, then re-measured for 1.5 s and on resize/scroll. The panel flips left or bottom when it would cover the target, except for targets inside a preview (124-158).
- Highlight is a clip-path cut-out in the backdrop plus a saffron ring (e.g. `components/tours/ProductionTutorial.tsx:52-53`).
- Mobile (`max-width:767px` or a short coarse-pointer screen, `hooks/use-mobile-tour.ts:15`): the panel becomes a bottom sheet capped at 46dvh (`app/globals.css:1433-1458`).
- Mobile positioning reserves padding in the real scroll container, scrolls once, clips to nested scrollports, and stops after 1.5 s if the target is missing, without advancing (`lib/mobile-tour-positioning.ts`, local lines ~13-75).
- Preview dialogs are moved to `top:72px` with `max-height:54dvh−88px` on phones (`app/globals.css:1617-1629`). CV

---

## 1. Production — `/owner/production` (Overview) and `/owner/production/daily-sheet`

### 1.1 Page workflow (CV unless marked)

**Routing**
- `app/(dashboard)/owner/production/page.tsx:16-23` redirects `?tab=production` to `/daily-sheet`. It wraps `BaseProductionClient` in `ProductionGuidedTour` (30-32).
- `daily-sheet/page.tsx:3-5` calls `BaseProductionPage()` with **no** searchParams.
- The client decides which view to show from the path: `activeTab = pathname.endsWith('/daily-sheet') ? 'production' : 'jobs'` (`BaseProductionClient.tsx:151`).
- Sidebar entries are Production → "Overview" and "Daily Sheet" (`lib/disclosure-navigation.ts:24-25`; `locales/en.ts:3-4`).

**Prerequisites for a new owner**
1. A saved costing that is a costing record and not archived (`loaders.ts:171-175`).
2. **Positive Yarn Stock for every yarn in that costing's recipe.** This is a hard gate: `validate_quality_activation_yarn` and `activate_saved_costing_for_production` return `blocked` (`supabase/migrations/20260920000000_unified_inventory_audit_architecture.sql:113-192, 245-257`).
3. Active machines.
4. Active piece-rate workers whose shift availability matches.
5. Operator assignments, which are optional per machine.

**Overview regions and controls**
- Left rail: guide card, plus "Setup, history & corrections" `[data-tour-control="production-details"]` (`components/production/ProductionGuidedTour.tsx:32-67`).
- Header "Production"; a strip with Active Qualities / Machines Running / Workers Assigned / Looms Available (`BaseProductionClient.tsx:495-536`); the right-rail "Activate Quality" button (433-442).
- `BaseActiveQualities`:
  - "Activate Quality" button (406-412) opens the dialog "Activate Quality for Production" (545-631), which has search and per-costing "Activate".
  - If yarn is short, the dialog "Yarn required before production" opens (801-906), with "Add Stock" leading to an inline yarn receipt dialog (909+, `mutateYarnStock`).
  - Each quality card has "Assign Looms" (528-535), opening the dialog "Assign Looms to X" with checkboxes and "Assign N Loom(s)" (634-737).
  - Each card also has a ⋮ "Quality actions" menu: View in Costings / Production History / Deactivate Quality (459-490). Deactivate opens a confirm dialog (740-798).
- `BaseMachineBoard`:
  - Title "Machine Board", filters All/Running/Available, search (304-362).
  - Running cards have "Manage Workers", which opens the sheet "Manage Operators for X" (Day Shift/Night Shift, Unassign, Assign / Replace Operator, `Assign`; 631-796), and "Switch Quality", which opens a dialog (524-582).
  - Available cards have "Assign Quality", which opens "Start Quality" (585-628).
- Empty states:
  - "No Active Qualities" (BaseActiveQualities 416-426).
  - "Set up your machines" with "Add Machines" (BaseMachineBoard 373-390).
  - "No saved costings found…Cost Estimator" (568-573).
  - "No active machines found…Machines" (652-660).
  - "No active workers available for {shift} shift" (735-743).

**Daily Sheet (`BaseDailyProductionSheet.tsx`)**
- Right rail:
  - "Save shift" / "Save correction" (658-665).
  - Shift details: Date (max = today), Shift select, "Print sheet" which opens a popup (668-689, 620-631).
  - Shift progress: accounted/total, Pending, Production; the "Draft on device" chip (691-709).
  - "Worker review" button (711-730) and "Recent production" (734-747).
- Main area:
  - Saved banner: Finalized / "Saved · incomplete" / Saved, with "N corrections" or "Saved receipt" and "Edit saved log" (759-785).
  - "Machine sheet" card with "Discard draft" and "Show pending (N)" (804-821).
  - Rows with a Metres input (Enter/↓/↑ move between rows, 494-503), a status chip, "Not running"/"Undo", and "Assign a production job" (840-883).
  - A machine with no operator shows "Pending · assign a worker…" and "Assign worker in Machine Assignments" (829-834).
  - Mobile sticky save bar (971-990).
- Dialogs:
  - Worker review, with status Not entered / Produced / Zero output / Absent / no production (893-965).
  - "Save an incomplete shift?" with Keep entering / Save incomplete shift (1004-1016).
  - "Edit this saved production log?" with a reason of at least 3 characters, Keep locked / Unlock editing (1018-1060).
  - "Production audit trail" (1062-1100).
  - Recent production: search, "View log", "Show more" (`BaseProductionClient.tsx:633-672`).
- Empty states: "Add a worker to record production" with Add worker / Add machine (788-801); "No active machines are available for this shift" (887).

**Drafts and saving**
- Every edit writes `localStorage[weavly:base-production:v1:{org}:{actor}:{date}:{shift}]` (`lib/base-production-draft.ts:19-21`; sheet 463-474).
- On mount a draft is restored, or discarded if its requestId matches the saved batch. If the saved revision changed, the status becomes `conflict`, which disables inputs and shows an alert (396-409, 244, 754).
- If storage fails, the status is `error`: a beforeunload warning appears and date/shift/navigation changes ask for confirmation (159-191).
- "Discard draft" asks for confirmation, then reloads the saved shift (612-618).
- Save (516-598):
  - Blocked when there is a conflict or unmatched draft metres, when every sheet worker is settled, when a saved log is still locked, or when a reading is invalid.
  - Pending rows open the incomplete-shift dialog.
  - Otherwise it calls `saveBaseDailyProductionBatch` with `clientRequestId` for idempotency and `expectedUpdatedAt`; a `40001` error returns "…your local draft is retained" (`actions.ts:570-650`).
  - On success the draft is cleared, a new requestId is created and the page refreshes.
- Settled (paid) workers' rows are read-only (838, 851).

**Outputs:** a saved batch, metres stock (via triggers in `20260908171502_quality_metre_stock.sql:194-196`, INF), and worker earnings for Payroll.

### 1.2 Tour implementation

**Entry points** (`ProductionGuidedTour.tsx`)
- Guide card: `onLaunch` records return focus and scroll, then sets `productionTourSteps[0]` (41-45).
- Details button: sets `productionTourDetailSteps[0]` (48-57).
- The rail is **not rendered when `pathname === '/owner/production/daily-sheet'`** (25, 32).

**Replica, not the live page**
- Children are wrapped in `<div hidden={step !== null}>` (68).
- `ProductionTourPreview` renders a hand-built sample (props-free apart from `step`) with `data-production-sample`, `data-i18n-skip` and `lang`. Every button and input is `disabled`. Dialog steps use a non-modal Radix Dialog with `data-production-tour-preview` (`components/production/ProductionTourPreview.tsx:18-21, 58-65`).
- Targets are `[data-production-tour="{step}"]` (`lib/production-tour.ts:20`) and all resolve **only in the replica**. None of these attributes exist in the live components (grep: zero `data-production-tour` in `app/`).

**Two tracks** (`lib/production-tour.ts:2-3, 7-19`)
- Core, 12 steps: `overview, prerequisites, activate, allocate, operators, date, reading, pending, rollup, draft, save, finish`. Sections "Prepare" (first 5) and "Record".
- Details, 11 steps: `board, loomStates, switchQuality, deactivate, print, workerStatus, incomplete, history, saved, correction, audit`. Sections "Manage setup" (first 4) and "History & corrections".
- Which surface each step shows (overview replica, daily replica, or a dialog) comes from `productionTourSurface`.

**Completion and focus**
- Only core `finish` persists completion (`ProductionTutorial.tsx:35-40`). The details track never persists, and the details button never records "started".
- Focus strategy is `return-focus-or-launcher`; scroll returns to the position captured at launch (45).

**EN step titles** (bodies in `lib/i18n/production-tutorial.ts:7-98`)

| Step | Title | Body, in brief |
|---|---|---|
| overview | Turn shift output into stock and earnings | |
| prerequisites | Prepare missing records first | Cost Estimator/Saved Costings, Workers, Machines |
| activate | Choose the quality and wage | "Overview & Looms → Activate Quality", ₹2/m wage vs ₹40/m cost |
| allocate | Connect the quality to its looms | |
| operators | Connect an operator for each shift | Manage Workers → Day/Night → Assign |
| date | Choose the sheet to record | |
| reading | Enter this shift's output | 120 m; not cumulative; Enter/↓ |
| pending | Decide: pending or stopped? | |
| rollup | Check the worker's earnings | 120×₹2 = ₹240 |
| draft | A local draft is not a saved shift | |
| save | Submit the checked shift | "Save machine production", +120 m Fabric Stock |
| finish | Take the next real action | |
| board | Find a loom and check its setup | |
| loomStates | Understand loom availability | |
| switchQuality | Move a loom to another quality version | |
| deactivate | Deactivate a quality | |
| print | Collect readings on paper | "Print collection sheet" |
| workerStatus | Zero output and absence | |
| incomplete | Saving an incomplete shift | |
| history | Find recent production | View log |
| saved | Saved shifts and paid entries | "Edit production log" |
| correction | Give a correction reason | 120→125 m, +₹10 |
| audit | Review before and after | |

### 1.3 Sample vs real drift (all CV)

| Tour copy / replica | Real UI |
|---|---|
| "Overview & Looms" (copy 13, 33; preview 38, 45, 56) | Sidebar "Overview" (`disclosure-navigation.ts:24`); no in-page tabs exist |
| In-page tab buttons "Overview & Looms / Daily Sheet"; finish buttons incl. "Fabric Stock" (preview 38, 45, 56) | Navigation lives only in the sidebar; Stock → "Fabric" (`locales/en.ts:11`) |
| "Loom Board" (preview 41) | "Machine Board" (`BaseMachineBoard.tsx:306`) |
| "Manage Workers" sheet heading (preview 42) | Sheet title "Manage Operators for {loom}" (634-636) |
| "Production cost: ₹40/m" (preview 26) | "Cost: ₹…/m" (BaseActiveQualities 595) |
| "Daily machine production" (preview 45) | h1 "Daily sheet" (sheet 756) |
| "Print collection sheet" (copy 45; preview 47) | "Print sheet" (686) |
| "Worker payroll roll-up" (preview 50) | "Worker review" (722, 901) |
| "Save machine production" (copy 65, 69; preview 53) | "Save shift" / "Save correction" (664, 987) |
| Save sample shows "Fabric Stock +120 m · Gross earnings +₹240" (preview 53) | No such line on the real sheet |
| "Edit production log" (copy 81, 85; preview 55) | "Edit saved log" (780) |
| Audit shows a "Reason for correction:" label (preview 34) | Reason is shown unlabelled (1084) |
| Audit entry point not named | Opened via "N corrections" / "Saved receipt" (773-777) |
| Deactivate: no location given | Only via the ⋮ "Quality actions" menu (459-490) |
| "Assign Looms" alone | Board's per-loom "Assign Quality"/"Start Quality" is never mentioned |

### 1.4 Data safety

- The replica imports no actions, supabase, navigation or loaders. It has no `localStorage`, `window.open`/`print` or `onClick`, and every control is disabled (preview 5-11, 18-21; enforced by `__tests__/production-tour-preview.test.tsx:37-41`). CV
- The live page stays mounted but `hidden`. Search, filter and draft state are kept and nothing is submitted.
- The Daily Sheet (the only draft writer) is never mounted during the tour, because the tour only runs on Overview. Device drafts therefore cannot be touched. CV
- An open Radix modal on the live page blocks the launcher, so no live dialog can sit over the replica (INF).
- No sample IDs exist in the replica.

### 1.5 Defects and gaps

- **P1 — possible Blocker, product (INF):** changing Date or Shift calls `window.history.replaceState(null,'',baseProductionHref(...))`, which always builds `/owner/production?...` (`BaseDailyProductionSheet.tsx:178`; `lib/base-production-navigation.ts:52-56`).
  - Next's App Router syncs `replaceState` into `usePathname` (the documented behaviour since v14.1). `activeTab` would then flip to `'jobs'` (`BaseProductionClient.tsx:151`), unmounting the Daily Sheet and showing Overview.
  - Verify at runtime. If confirmed, owners cannot open past dates or the night shift.
- **P2 — Major, product (CV):** "View log" links to `baseProductionHref({date,shift,entry,worker})` (`BaseProductionClient.tsx:658`). There is no `tab=production`, so `page.tsx:16` does not redirect and the user lands on Overview. The tour's `history` step teaches this broken path.
  - Same root cause: Daily-sheet `returnTo` values (sheet 183; client 338) and the Payroll readiness "Review" link (`BasePayrollReadinessPanel.tsx:71`) also return to Overview.
- **P3 — Major, product and tour (CV):** the yarn-stock activation gate is not listed as a prerequisite in the copy (production-tutorial.ts:95-98) or the replica (preview 36). A new owner who follows the tour hits "Yarn required before production".
- **P4 — Major, product (CV):** when a costing's recipe is incomplete, the RPC returns `can_activate:false` with an `error` and `yarns:[]`.
  - The client ignores `error` (BaseActiveQualities 211-218).
  - `[].every(...)` is true, so the dialog says "All required yarns are now available!" and enables "Activate Quality" (875-903). Activation is then blocked again, in a loop.
- **P5 — Major, tour (CV):** there is no tour or guide on the Daily Sheet (ProductionGuidedTour 25, 32). The CSS treats this as intentional (`globals.css` Tier-3 comment "Routes without a guide…"), but 7 core and 7 detail steps teach a page they cannot be launched from.
- **P6 — Major, tour (CV):** the label drift in §1.3 means users are told to press "Save machine production", "Edit production log" and "Print collection sheet", none of which exist.
- **P7 — Minor, product (CV):** an active machine with no operator is always "pending" and has no Not running action (602-604, 829-834). Any partially staffed shift forces "Save an incomplete shift?" (538-541), which contradicts the `pending` copy.
- **P8 — Minor, product (CV):**
  - Assign Looms removals loop over `setBaseMachineJobContext` without checking results and still show a success toast (BaseActiveQualities 345-353).
  - `#machine-jobs` targets no element anywhere (sheet 190; BaseAssignmentWorkspace 732, 905).
  - "Production History" ignores the job id (BaseProductionClient 615).
  - The board's Manage Workers assign silently uses `replaceExisting:true` with no confirmation or Undo (BaseMachineBoard 247-253), unlike Assignments.
- **P9 — Minor, product (CV):** qualities, looms and operators always become effective "today" (BaseActiveQualities 336; BaseMachineBoard 223, 251). A new owner cannot backfill earlier shifts.
- **P10 — Minor (CV):** the page passes the entire `user.user_metadata` to a client component (page.tsx:30); the other pages pass only `tour_preferences`.

### 1.6 Localization

- The copy is complete in en/gu/hi: the `Record<Language,…>` type enforces every key, and it spreads `configurationTutorialCopy` for the navigation strings (production-tutorial.ts:4-6).
- gu/hi copy keeps English UI names embedded ("Overview & Looms → Activate Quality", "Weaver wage", "Draft saved on this device", "Save machine production", "Daily Sheet"). The gu/hi sidebar shows "ઝાંખી/अवलोकन" and "દૈનિક શીટ/दैनिक शीट" (`locales/gu.ts:3-4`, `hi.ts:3-4`). CV
- Real labels "Activate Quality", "Assign Looms", "Switch Quality", "Machine Board", "Weaver wage", "Worker review", "Show pending", "Not running", "Print sheet" and "Shift details" have **no** phrase-dictionary entries (grep of `lib/i18n` outside the tutorials). They rely on the word-by-word fallback (`lib/i18n/runtime.ts:1150-1175`); output quality INF.
- Terms are inconsistent:
  - The replica's sample worker is "નમૂના વણકર/नमूना बुनकर" (preview 22), while other tours use "કારીગર/कारीगर".
  - Wage is "મજૂરી/मजदूरी" here but "વેતન/वेतन" in Workers.
  - In English the UI mixes loom/machine and worker/operator ("Machines Running" vs "Looms Available"; the "Manage Workers" button opens a "Manage Operators" sheet). Metres are shown as "m".

### 1.7 Tests

- `__tests__/production-tour.test.ts`:
  - Pins the step arrays, sections and surfaces (9-23).
  - Checks copy completeness, at most 55 words, and Gujarati/Devanagari script (25-37).
  - Requires specific EN phrases, including **"Overview & Looms"** and "120 m to Fabric Stock", which locks in the drift (39-53).
  - Checks the example arithmetic (54-59) and eligibility (60-66).
- `__tests__/production-tour-preview.test.tsx`:
  - Exactly one target per step and language; no `<form>`/`<a>`; all controls disabled (16-22).
  - Content checks (23-36).
  - No writes, navigation or printing in the source (37-41).
  - Source contains the `hidden` wrapper and the details launcher (42-50).
  - Completion only at `finish`, plus the focus strategy (51-63).
- No test checks that tour labels match the real components, that the Daily Sheet has a tour, or that navigation lands on the right view.

---

## 2. Machine Assignments — `/owner/assignments` (plus legacy redirects)

### 2.1 Workflow (CV)

**Routing and legacy redirects**
- `assignments/page.tsx:9-15` checks `production_management` and renders `BaseProductionClient view="operations"`, which renders `BaseAssignmentWorkspace` (BaseProductionClient 604). Header "Worker–Machine Assignments" (427); the sidebar says "Machine Assignments".
- `/owner/operations` goes to `/owner/assignments`, carrying `worker`, `shift` and `machine` and dropping `add` (`lib/management-navigation.ts:5-10`; `operations/page.tsx:12`).
- `/owner/setup` goes to `/owner/workers`, or to `/owner/machines?register=base` when `section=machines` or `add=machine`. It carries `worker`, `add` and `returnTo` (`management-navigation.ts:5-14`; `setup/page.tsx:12`).
- Both legacy pages return `null` without the capability.

**Prerequisites:** active piece-rate workers available for the shift (fixed-monthly workers are excluded, 171-178) and active machines with a current active or planned job context. A machine without one shows "No production job" and the link "Set job in Production" (727-737).

**Regions** (`BaseAssignmentWorkspace.tsx`)
- Left rail (389-457): guide card, plus "Assignment help" (a dialog with 8 topics).
- Top bar: Day/Night toggle `[data-configuration-tour="shift"]` and the count (459-497).
- Desktop board `[data-configuration-tour="board"]` (499-744): search, machine-type chips (`MachineTypeFilters` 1015-1068), Workers and Machines columns joined by SVG connectors. Workers have "Assign" and a drag handle; machines have an unlink button.
- Mobile board with a Workers/Machines toggle (746-917); a linked worker shows "Change".
- Right actions rail (920-943): "Open Daily Sheet", "Add worker", "Add machine", "Manage workers", "Manage machines".
- Picker bottom sheet "Assign {worker}" with per-machine "Choose" or state text and a Close button (945-997).
- A focus banner appears for `?worker=` / `?machine=` (388).

**Flow**
1. Choose the shift.
2. Press Assign on a worker (or drag its connector), then Choose a machine. This saves immediately via `upsertBaseWorkerMachineAssignment`, effective today.
3. If the machine already has a worker, a `window.confirm` asks, then the save repeats with `replaceExisting` (272-302).
4. A success toast offers Undo, which removes the new link and restores the previous one (312-317, 328-364).
5. The unlink button calls `removeBaseWorkerMachineAssignment` (366-384).

The server re-checks the worker is active and available for the shift and that the machine has a job (`actions.ts:325-393`).

**Empty states:** "No workers match this view.", "No machines match this view.", "No active machines found." (picker), "This record is unavailable." **Next action:** Open Daily Sheet, which goes via `?tab=production` and redirects correctly (922).

### 2.2 Tour implementation (CV)

- **Launch:** `onLaunch` is ignored while `pendingKey` is set, but "started" is still recorded (398-402; use-tour-invitation 353-354).
- **Sample injection:** with a step active, `initialData = {...liveData, ...makeConfigurationTourExample(today, step)}`, using localized names (88-95).
  - Samples use non-UUID IDs `tour-configuration-*` (`lib/configuration-tour.ts:5-6, 26-41`).
  - At `jobRequired` there is no job context; at `connected` and `finish` a day assignment is added.
- **UI state forced by the step and restored automatically** (`configurationTourView` 16-23; workspace 108-113):
  - Shift is forced to Day, search `''`, type filters `[]`, show-inactive false.
  - The picker opens for the sample worker at `picker`.
  - The mobile view is `machines` for jobRequired/connected/finish and `workers` otherwise.
  - `?worker=`/`?machine=` focus filters are ignored.
  - At `connected`, a "saved-preview" card is injected (998-1005).
- **Protection:** the workspace is `inert` (387). The picker sheet is non-modal and ignores dismissal (945-946).

**Steps, targets and EN titles** (all targets resolve in the live DOM using the samples; `configuration-tour.ts:43-51`; copy `lib/i18n/configuration-tutorial.ts:24-30`)

| Step | Target | Title |
|---|---|---|
| purpose | `board` (desktop or mobile, whichever is visible) | Who works on which loom? |
| dayShift | `shift` | Choose the shift first |
| jobRequired | `job` link | Prepare the loom in Production |
| assign | `assign` | Choose the worker |
| picker | picker option `available` | Choose saves immediately |
| connected | `saved-preview` | Check the saved link |
| finish | `daily-sheet` | Continue to Daily Sheet |

- Five sections; completion is persisted at the last step (ConfigurationTutorial 32-37).
- Focus returns to the launcher; scroll returns to `tourReturnScroll`. Picker preview CSS is at `globals.css:1640-1647`.

### 2.3 Drift (CV)

- Help topic "Show inactive records" (copy line 40) describes a control that does not exist: `const [includeInactive] = useState(false)` has no setter (99).
- The `jobRequired` copy says "Use Set job in Production → Overview & Looms". The link does exist, but its `#machine-jobs` target does not, and "Overview & Looms" is not a sidebar label.
- The Undo in the injected saved card is only a sample (1004). The real Undo is a toast action and appears only when the assignment actually changed (311-317). The copy's "while available" hedge covers this.

### 2.4 Data safety (CV)

- `handleAssign`, `handleUndoAssignment` and `handleRemove` return early when `tourStep` is set (273, 332, 367). Drag start is blocked (242). Picker buttons are disabled (967).
- All links `preventDefault` and disable prefetch (730-731, 922-940).
- Sample IDs would also fail server `UuidSchema` validation (`actions.ts` BaseAssignmentSchema; test enforced).
- Live state (shift, search, filters, mobile view, picker) is never mutated, only shadowed. No drafts exist here.

### 2.5 Defects

- **Minor (CV):**
  - The replacement `window.confirm` is hard-coded English with raw `day`/`night` (293).
  - The dead selector `[data-configuration-tour-preview]` appears in ConfigurationTutorial 44 and `globals.css:1606-1637`, but no element sets it.
  - The focus banner still reads "Worker filter active" over the samples (388).
  - The header says "Worker–Machine Assignments" while navigation and the tour say "Machine Assignments".
- **Minor, product (CV):** links whose machine has no current job are dropped from `currentAssignments` (148-156). After a quality is deactivated (its copy says links "remain"), those links cannot be seen or unlinked here.

### 2.6 Localization

- Complete in en/gu/hi, with key parity tested.
- The gu/hi `jobRequired`, `picker` and `machines` help text keep "Overview & Looms → Activate Quality → Assign Looms" in English (lines 52, 60, 65, 78, 86, 91). `dailySheetLabel` is "Daily Sheet ખોલો".
- gu mixes "પ્રોડક્શન" and "ઉત્પાદન". Sample names are localized (95).

### 2.7 Tests

- `configuration-tour.test.ts`:
  - Steps and selectors (13-16).
  - Non-UUID, freshly generated samples (19-35); sample state per step (37-55).
  - Source-string guards, `inert`, completion (57-77).
  - Copy parity in all languages, **requiring "Overview & Looms"** (79-104).
  - Daily Sheet link params (106-113); eligibility (115-120).
- `configuration-tour-preview.test.tsx` (SSR): every step renders its target, the workspace is inert, sample names appear and real names do not, the picker option is disabled, and the saved/undo labels show (53-73). With no tour, the live render shows the night-shift handoff link and the help topics (75-86).
- `management-navigation.test.ts:47-58` pins the legacy redirects.
- `guided-tour-left-rails.test.ts:55-64` pins the rail and the invitation.

---

## 3. Machines — `/owner/machines`

### 3.1 Workflow (CV)

- `machines/page.tsx:5-11` renders `MachinesRegister` (inside `QueryProvider` + `AccessGate`). No prerequisites.
- **Regions:**
  - Header "Machines" with "Add machine" (`components/machines/MachinesPageHeader.tsx`).
  - Left rail guide `[data-machines-tour="launcher"]` (MachinesRegister 120-134).
  - Toolbar: search plus status select "All machines / Active machines / Needs setup", with the filters mirrored in the URL (56-75; `MachineToolbar.tsx:66-68`).
  - Grid of `MachineCard`s: display name (custom label, else name), type, readiness badge Active/Needs setup, Worker, Costing, "View assignment" linking to `/owner/assignments?machine=id`, and "Edit" (MachineCard 36-138).
  - Right rail: Add machine; "Activating your machine" with links to `/owner/production?tab=jobs` and `/owner/assignments`; a `<details>` help list with 4 items (164-218).
- **Add/Edit dialog** (`MachineEditor.tsx`, local lines ~105-125):
  - Name is optional on add; the server generates "Loom #N" (`actions.ts:229-290`).
  - Type: 7 options. Custom label is optional.
  - Edit adds the checkbox "Available for new assignments and daily context" and makes the name required.
  - "Save and return" appears when `returnTo` is set. Closing with unsaved changes asks to discard. There is no delete.
- **Readiness** = has a worker in any shift today **and** a current job context (`registers/loaders.ts:94-127`; `lib/machine-readiness.ts:39`). Availability (`is_active`) is ignored.
- **Empty states:** No machines yet / No active machines / No machines found (`MachineEmptyState`).

### 3.2 Tour

- **Launch:** `setTourStep('purpose')` (130).
- **Samples injected into the live page:**
  - The toolbar is shadowed to `''`/`'all'` with sample counts (138-147).
  - The grid is replaced by two localized samples with `tourPreview` (150-151; `lib/machines-tour.ts:15-22`, IDs `tour-machines-*`).
  - At `details`, a second, disabled `MachineEditor` preview opens (219).
- **Steps** (targets `machines-tour.ts:25-32`, all resolve; EN copy `lib/i18n/machines-tutorial.ts` local 23-28):

| Step | Target | Title |
|---|---|---|
| purpose | header | One record for each physical loom |
| details | preview fieldset | Identify the loom |
| label | ready card identity | Recognise the saved record |
| readiness | incomplete card | Registered does not mean ready |
| production | `production-next` | First, give the loom a quality |
| assignments | `assignments-next` | Then assign its worker |

- Six sections; completion at the last step. Focus returns to the launcher; scroll returns to the position when the tour opened.

### 3.3 Drift (CV)

- The `production` copy says Assign Looms selects "this loom and its start date". The Assign Looms dialog has no date control and uses today (BaseActiveQualities 336, 645-717).
- The help says "Active"; the real option is "Active machines".
- The link label "1. Production → Overview & Looms" is not a sidebar label.
- The tour never shows Edit or the availability checkbox (help text only).

### 3.4 Data safety (CV)

- Header, add, card edit and rail links are no-ops or `preventDefault` during the tour (116, 167, 180-192; MachineCard 118-119, 132).
- The preview editor's `fieldset disabled`, and submit and close both return early when `tourPreview` is set (local ~41-53, 77, 114).
- URL and filter state are never written.
- The real editor must be closed before the launcher is visible (`!isOpen`, 120), so unsaved input cannot be lost.
- The update action validates `machineId` as a UUID.

### 3.5 Defects

- **Minor, product (CV):** the card never shows availability (`is_active`) (MachineCard has no reference to it). An unavailable loom looks the same as an available one, and its readiness badge can still say Active.
- **Minor (CV):** the loader checks only the machines query error (`registers/loaders.ts:88`). A failed assignment, context or job query silently turns cards into "Needs setup".

### 3.6 Localization

- Complete; samples localized.
- `productionLink` stays English in gu/hi ("1. Production → Overview & Looms", i18n local 57, 83), and tests require it.
- Type labels pass through `tx()`.

### 3.7 Tests

- `machines-tour.test.ts`: examples, readiness, non-UUID (9-16); availability separate from readiness (17-22); preview only at `details` (23-27); copy completeness and scripts (28-40); **"Overview & Looms"** plus sample names in the copy (41-62); eligibility (63-69).
- `machines-tour-preview.test.tsx:22-40`: disabled editor preview; availability only when editing; real editor writable.
- `machines-register-tour-help.test.tsx:20-45`: rail links, help, and source guards.
- `guided-tour-left-rails.test.ts:89-99`.

---

## 4. Workers — `/owner/workers`

### 4.1 Workflow (CV)

- **Regions:**
  - Header "Workers" with "Add worker"; focus banner "Worker filter active" / "Clear filter".
  - Left rail guide.
  - Toolbar: search (name or role), shift filter All / Day / Night / Day & night, status filter Active (default) / All / Inactive, all mirrored in the URL (`WorkersRegister.tsx:69-122`; `WorkerToolbar.tsx:76-107`).
  - Two groups, "Piece Rate" and "Fixed Salary" (243-266).
  - Cards (`components/workers/WorkerCard.tsx`): name, shift or role subtitle, Active badge.
    - Piece-rate: "Machines N assigned" and "Wage source: Production quality".
    - Salaried: "Salary Configured/Not configured" and "Payroll Ready/Needs setup".
    - Actions: "View assignments" (`/owner/assignments?worker=`) or "View payroll", plus Edit (85-202).
  - Right rail: Add worker, and a `<details>` "Worker help" with 12 topics (275-300).
- **Add dialog** (`WorkerEditor.tsx:125-145`):
  - Name; pay type Piece rate / Fixed monthly salary.
  - Piece rate: shift availability.
  - Fixed: Role, Monthly salary, Joining date (required).
- **Edit:**
  - Pay type locked in the UI, and also by a DB trigger (`20260903162305_base_fixed_salary_payroll.sql:21`).
  - Fixed salary: "Salary change effective from" (earliest today) and "Last working day (optional)".
  - "Active worker" checkbox.
  - Server: a salaried worker cannot be made inactive without a last day; salaried edits need `expectedUpdatedAt` (`actions.ts:62-68, 700-747`).
  - Duplicate names are rejected. There is no delete.
- **Empty states:** "No workers yet" with Add worker; "No workers found" with Clear filters (`WorkerEmptyState`).
- **Next actions:** View assignments / View payroll; "Save and return" via `returnTo`.

### 4.2 Tour

- Launch is `setTourStep('purpose')` (212).
- The path is chosen with buttons inside the panel, **only at the `purpose` step** (`WorkersTutorial.tsx`, local lines 59-63).
- Two paths (`lib/workers-tour.ts:3-6`):
  - Piece: purpose → payType → availability → pieceReadiness → assignments → earnings → finish (7 steps).
  - Salary: purpose → payType → salary → joining → effective → lastDay → payroll → finish (8 steps).
- **Samples:** `makeWorkersTourExamples(today)` (IDs `tour-workers-*`, 23-28).
  - The groups are replaced by one piece and one salary sample; the toolbar is shadowed to `''`, all shifts, Active; help is hidden (219-242, 282).
  - A disabled `WorkerEditor` preview is keyed by `workersTourEditor`: piece, salary, or edit (salaried, editing) (14-20; register 301).
- All targets resolve (selectors 31-44). Completion is recorded on either path's `finish`.

**EN titles** (`lib/i18n/workers-tutorial.ts:27-49`)

| Step | Title | Body, in brief |
|---|---|---|
| purpose | Set up the right pay path | |
| payType | Choose the pay type carefully | cannot change later |
| availability | Make the worker available | |
| pieceReadiness | Use the quality's weaver wage | |
| assignments | Prepare a loom for this worker | |
| earnings | Output becomes earnings | ₹1.50×100 m = ₹150 |
| salary | Set the agreed salary | ₹18,000 |
| joining | Check when salary starts | 15/30 days = ₹9,000 |
| effective | Date salary changes | |
| lastDay | Record the last working day | |
| payroll | Review the salary obligation | |
| finish | Start with your real worker | |

### 4.3 Drift (CV)

- The `earnings` step highlights the whole piece group, but no earnings figure is shown anywhere; the numbers exist only in the copy.
- Otherwise labels match the real editor and cards: "Add worker", "Salary change effective from", "Last working day", "View payroll", "View assignments".
- Salaried subtitles show "Supervisor · Day & night" (WorkerCard 37-41), yet shift availability cannot be set for fixed-salary staff (WorkerEditor 140).

### 4.4 Data safety (CV)

- Card links and edit are guarded (WorkerCard 170-196). The editor preview uses `fieldset disabled` and a submit early return (88).
- Header add, rail add and filters are no-ops during the tour (191-229).
- The update action requires a UUID `workerId`.
- The launcher is hidden while the real editor is open (202).
- Nothing is written to the URL.

### 4.5 Defects

- **Minor (CV):**
  - Sample names "Sample worker"/"Sample staff" and role "Supervisor" are English in gu/hi (`workers-tour.ts:25-26`; register 41), unlike the Machines and Configuration samples.
  - `tourPath` persists between launches (39).
  - The loader ignores the assignments-query error (`registers/loaders.ts:38`).

### 4.6 Localization

- Complete, with the script range tested for every string.
- Wage vocabulary ("વેતન/वेतन") differs from Production ("મજૂરી/मजदूरी"). In Hindi "वेतन" also means salary.

### 4.7 Tests

- `workers-tour.test.ts`: examples (11-21); path→editor mapping (22-39); copy parity including ₹150 and ₹9,000 (40-58); arithmetic checked against the real pay functions (59-63); eligibility (64-70).
- `workers-tour-preview.test.tsx:22-58`: each path's form targets are mounted, disabled, without autofocus; real editor writable.
- `guided-tour-left-rails.test.ts:77-87`.

---

## 5. Test coverage gaps across the four tours

- `tour-quota-and-data-safety.test.ts:6-13` and `tour-no-autostart.test.ts` cover only the estimator, rate-book and saved-costings tours.
- No DOM or interaction tests exist. All tour tests are source-string or SSR renders.
- Nothing checks tour copy against real button labels. Several tests actively pin the drifted "Overview & Looms".

## Missing (short list)

- Daily Sheet tour or guide entry.
- Yarn Stock listed as a production prerequisite in tour copy and replica.
- A test that tour-copy labels match real UI labels ("Save shift", "Print sheet", "Edit saved log", "Machine Board", "Worker review", sidebar "Overview").
- Navigation that returns to `/owner/production/daily-sheet` (View log, returnTo, Payroll Review).
- A runtime check of the date/shift `replaceState` behaviour.
- A way to mark unstaffed looms "Not running".
- Any backdating of assignments or qualities.
- Availability shown on Machine cards.
- The real `validation.error` message in the yarn gate dialog.
- A "Show inactive" control, or removal of that help topic.
- Localized Workers tour samples.
- Data-safety and no-autostart tests for the Production, Assignments, Machines and Workers tours.
