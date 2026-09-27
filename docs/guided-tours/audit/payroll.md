# Audit: Payroll (/owner/payroll)

Read-only subagent report, 2026-09-27. Key claims were spot-checked against source by the planning session before use; the refinement plan and page specs say which findings were adopted. Labels: CV = CODE-VERIFIED, INF = INFERRED.

---

# Weavly /owner/payroll: Base payroll page and guided tour audit

This was a read-only audit. I ran no commands that change state and did not run npm, vitest, next or network commands. Paths are relative to `/home/user/TextileAccounting`. **CV** means CODE-VERIFIED. **INF** means INFERRED: it needs a browser check or reasoning beyond the code shown.

---

## 1. Page workflow (Base owner)

**Route and gating (CV).**
- `app/(dashboard)/owner/payroll/layout.tsx:5` wraps the page in `AccessGate requiredCapability="production"`.
- `page.tsx:8-11` calls `requireRole(['owner'])` and `loadBaseProductionInitialData(org, getSuratTodayString())`. It renders `<PayrollGuidedTour variant="base">` around `<BaseProductionClient view="payroll">`.

**Purpose (CV).** Turn production metres and dated salaries into per-worker payables. Recover advances and deductions (capped). Record payments made outside Weavly. Close the period. Keep an auditable history. `BaseProductionClient.tsx:429` (sr-only) says "Review earnings and settle worker pay for each period."

**Prerequisites**
- Workers with `pay_type` (`piece_rate` / `fixed_monthly`) and salary history. The worker card shows this at `BaseProductionClient.tsx:721`.
- Production entries with machine breakdown and saved rates. These feed readiness (`BasePayrollReadinessPanel.tsx:21-45`).
- Advances and deductions, both stored in `base_worker_advances`. Deductions are tagged `[Deduction: …]` at `actions.ts:976-989`.
- Cycle rule from `initialData.payrollCycleConfig`, defaulting to monthly (`BaseProductionClient.tsx:168-170`). It is edited only in Settings (`components/settings/payroll/PayrollCycleSettingsCard.tsx:289`). The payroll page has no link to it (CV, grep).
- Recovery cap is `BASE_PAYROLL_DEDUCTION_PERCENT = 50` (`lib/base-production-core.ts:7`).

**Main regions, all in `BaseProductionClient.tsx` (CV)**

| Region | Lines | Contents |
|---|---|---|
| Left rail (`PayrollGuidedTour.tsx:37-120`) | | Guide card, "More payroll help", "How pay is calculated" dialog |
| Period rail | 444-489 | Status badge (Open / In progress · x/y / Ready to complete / Settled); chevron Previous/Next (466-472); date range; contextual primary button: Settle payroll / Continue settlement / Complete payroll / View settled payroll (476-485) |
| Summary card | 538-602 | Total Payroll, Paid so far, Remaining to settle, Settlement Progress |
| Worker pay header | 675-688 | Page-level payment-mode Select "Paid by cash / Bank transfer / UPI / Cheque"; "Manage workers" |
| Readiness | 690 | `BasePayrollReadinessPanel` |
| Filters | 692-693 | Find worker; Payment status (All / Ready to pay / Needs review / Paid / No earnings) |
| Worker cards | 701-781 | Gross, Recovery, Net pay; recovery narrative; deduction badges; actions |
| Records entry | 787-792 | "Payroll records" (switches `payrollTab` to `history` → `BasePayrollRecords`, 491-493) |

**Controls that open something (CV)**
- **Guide card button** (`TourInvitation.tsx:108-123`, `data-tour-control="take-tour"|"quiet-tour"`, `data-testid="tour-guide-payroll"`) opens the core tour.
- **"More payroll help"** (`PayrollGuidedTour.tsx:50-62`, `data-tour-control="payroll-help"`) opens the help track.
- **"How pay is calculated"** opens a Dialog (`PayrollGuidedTour.tsx:66-116`).
- **Primary rail button** opens `BasePayrollSettlementWorkspace`, a full-screen Dialog (`BaseProductionClient.tsx:476`, `880-900`).
- **"Manage workers"** and the per-card gear icon navigate to `/owner/workers?returnTo=/owner/payroll[&worker=]` (`337-344`, `686`, `726`).
- **Readiness "Review"** is a Link to `/owner/production?date&shift&entry&returnTo=/owner/payroll` (`BasePayrollReadinessPanel.tsx:71`; `lib/base-production-navigation.ts:55`).
- **Card "Add advance"** opens the "Record worker advance" dialog (`773`, `795-825`).
- **Card "Add deduction"** opens the "Record worker deduction" dialog (`774`, `827-868`).
- **Card "Mark paid" / "Review before paying"** (disabled while issues exist) opens `ConfirmActionDialog` with confirm label "Mark as paid" (`775`, `870-878`).
- **Settlement workspace (`BasePayrollSettlementWorkspace.tsx`)**
  - Filters All / Piece Rate / Fixed Salary, search, "Outstanding only" (546-602).
  - Row buttons:
    - "Mark Paid" / "Needs review" opens the Mark paid dialog: Payment method, Payment date, Note (optional), **Confirm Payment** (745-757, 878-970).
    - "Resolve" is local state only (736-743, 274-280).
    - "Paid · Cash" opens Payment details (722-730, 973-1034). That leads to **Reopen Payment** (1020-1029) and a reopen-confirm dialog (1037-1097).
    - The chevron "Toggle calculation breakdown" expands the row (760-800).
  - Footer "Complete Payroll" opens a confirm dialog (859-870, 1100-1156).
  - "View in records" / "View Settled Records" (471-483, 848-857).
- **Records (`BasePayrollRecords.tsx`)**
  - Pay period Select (237-246) and search (252).
  - **Export CSV** (257; `downloadText` at 65-74) and **Export PDF** (258; dynamic import at 176-192).
  - Workers/Machines tabs (271-356) with row expanders.
  - **"Resolve mistaken payment record"** (305) opens the "Reverse a mistaken payment record?" dialog with **Record reversal** (196-203).
  - Empty-state "Open current payroll" (220).

**Primary workflow**
1. Pick the period with the chevrons.
2. Check readiness and fix issues through Review.
3. Check each worker card and the recovery narrative.
4. Add advances or deductions as needed.
5. Open Settle payroll, expand rows, Resolve ₹0 workers, then Mark Paid → Confirm Payment.
6. When everyone is paid or resolved, Complete Payroll → confirm. The badge becomes Settled.
7. Go to Payroll records to trace results, export CSV/PDF, or correct a payment (Record reversal, or Reopen Payment from the workspace).

**Consequential actions (CV)**
- `settleBaseWorkerPayroll` (card ConfirmActionDialog at `BaseProductionClient.tsx:394-406`; workspace at `228-234`).
- `completeBasePayrollPeriod` (`330-409`).
- `reverseBasePayrollSettlement` (records `105-116`; workspace Reopen `283-327`).
- `createBaseWorkerAdvance` / `createBaseWorkerDeduction` (`353-392`).
- Resolve is persisted only when the period is completed (`373`).
- Exports are downloads only; they change no data.
- `reopenBasePayrollPeriod` exists at `actions.ts:1075` but no UI calls it (CV, grep).

**Empty states (CV)**
- "No workers yet" with Manage workers (`697`).
- "No matching workers" with Clear filters (`699`).
- Readiness shows "No production has been recorded since the latest settlement." / "Up to date" (`ReadinessPanel:39,44`).
- Workspace shows "No workers found" (`608-616`).
- Records shows "No settled pay periods yet" (`214-221`).
- **Gap:** records search has no no-results state; the tabs just render empty (`277-355`).

---

## 2. Tour implementation

**Entry points (CV)**
- Core track: guide card `onLaunch={() => launch('core')}` (`PayrollGuidedTour.tsx:46`), through `useTourInvitation.handleLaunch`, which also calls `persistTourStarted` (`hooks/use-tour-invitation.ts:150-157`).
- Help track: `onClick={() => launch('help')}` (`PayrollGuidedTour.tsx:54`). This does not record "started".
- `launch()` saves the focus target and scroll position before calling `setStep` (`30-35`).

**Steps (`lib/payroll-tour.ts:4-7`)**
- Base core, 10 steps: period, readiness, earnings, recovery, obligations, paymentDetails, confirm, paid, complete, finish.
- Base help, 7 steps: advance, deduction, records, machineRecord, export, correction, finish.
- Full core (9) and full help (8) are listed in §5 as dead code.

**Where targets resolve (CV):** every step resolves in the sample replica, none in the live page.
- The selector is `[data-payroll-tour="${step}"]` (`payroll-tour.ts:29`), found by `findTourTarget`, which accepts visible elements only (`lib/tutorial-target.ts:1-15`).
- The only `data-payroll-tour` in the repo is `PayrollTourPreview.tsx:68` (grep).
- The live page sits in `<div hidden={step !== null}>` (`PayrollGuidedTour.tsx:121`). The preview renders beside it (`122-125`).
- Preview surface comes from `payrollTourSurface` (`payroll-tour.ts:14-19`):
  - Dialog surfaces use a non-modal Radix `Dialog open modal={false}`. Close, escape and outside-click are all prevented (`PayrollTourPreview.tsx:69-79`). Base dialog steps: obligations, paymentDetails, confirm, paid, complete (settlement), advance, deduction, correction.
  - Page surfaces render the plain `<section>`: period, readiness, earnings, recovery, records, machineRecord, export, finish.

**Panel and highlight (CV)**
- Portal to `document.body` with `z-[100]`. The backdrop has an evenodd `clip-path` hole plus a saffron highlight ring (`PayrollTutorial.tsx:52-55`).
- Panel is 320px, top-right by default. It flips left or bottom unless the target is inside `[data-payroll-tour-preview="true"]` (`hooks/use-guided-tour.ts:141-147`).
- Placement re-measures for 1.5 s and on resize/scroll, and calls `scrollIntoView` once per target (`133-155`).
- Header shows "sample" line, section counter `n/sections` (`payrollTourSection`, `payroll-tour.ts:20-28`), title, body, progress bar and `i/N`.
- Controls: Skip / Back (disabled on step 1) / Next→Finish (`PayrollTutorial.tsx:64-69`).

**Keyboard, focus and scroll (CV, `use-guided-tour.ts:59-113`)**
- Every body child except the portal becomes `inert`, and a MutationObserver keeps it that way.
- The viewport is locked.
- Pointer and click events outside the panel are blocked in the capture phase.
- Escape closes. ArrowRight or Enter (when not on a button) goes next; ArrowLeft goes back. Tab cycles the panel buttons. Focus is trapped.
- On close: inert states are restored, the page scrolls to the saved position, and focus goes to the launching control (`focusReturn: 'return-focus-at-close'`, `PayrollTutorial.tsx:47`).

**Mobile (CV)**
- `useMobileTour` media query: `(max-width:767px), (max-height:500px) and (pointer:coarse)` (`hooks/use-mobile-tour.ts:15`).
- CSS pins the panel to the bottom at 46dvh (`app/globals.css:1434-1459`).
- `trackMobileTourTarget` pads the scroller and scrolls the target above the panel (`lib/mobile-tour-positioning.ts:17-60`).
- INF: in dialog-surface steps the preview dialog is `position:fixed` and centred, so scrolling cannot move it. The 46dvh panel may cover the lower part of the sample dialog on short phones.

**Completion (CV)**
- Only the last core step persists: `if (track === 'core') void persistTourCompleted('payroll', userId)` (`PayrollTutorial.tsx:39`).
- The help track never completes the tour.
- Skip or Escape records nothing (`close`, `36`).

**Step copy, EN (`lib/i18n/payroll-tutorial.ts`)**

| Step | Title | Body gist |
|---|---|---|
| period (15-18) | Know what this period owes | Choose dates; statuses Open / In Progress / Ready to Complete / Settled; paying a worker ≠ completing the period |
| readiness (19-22) | Resolve readiness issues first | Review opens the Production entry; salaries use salary history |
| earnings (23-26) | Check how gross pay was earned | "In Settle Payroll, expand a worker: 1,000 m × ₹2/m = ₹2,000"; salary ₹18,000 × 30/30 |
| recovery (27-30) | Apply the Base recovery rule | min(debt, 50% gross) example; excess carries forward |
| obligations (31-34) | Resolve a genuine zero-earning worker | Resolve records no payment; completion saves it |
| paymentDetails (35-38) | Record how and when you paid | Mark as paid; method, **date**, note; no money moves |
| confirm (39-42) | Review before marking paid | Check worker, **period**, gross, recovery, net |
| paid (43-46) | Check the saved payment result | Open the paid record; don't re-record |
| complete (47-50) | Close the period separately | Complete Payroll → Settled |
| finish (51-54) | Review your real payroll next | Finish restores period, search and scroll; points to More payroll help |
| advance (79-82) | Record an advance | Worker, amount, optional description |
| deduction (83-86) | Record a deduction | "Add deduction"… "it is not **Full's** immediate pay adjustment" |
| records (87-90) | Trace a recorded payment | Open Payroll records, pick a settled period, expand a worker |
| machineRecord (91-94) | Review records by machine | Grouped by machine, worker, costing, rate |
| export (95-98) | Export a payroll report | Full period regardless of search; reversed rows in CSV, excluded from PDF |
| correction (99-102) | Correct a mistaken payment record | Needs a reason; does not reverse cash |

---

## 3. Sample-vs-real drift (CV unless noted)

1. **Period.** The preview shows text buttons "Previous" / "Next", "In Progress · 1/3" and a "Settle Payroll" action (`Preview:29,35`).
   - The live page uses chevron icons with aria-labels (`466-472`).
   - The live badge reads "In progress · x/y" (`460`).
   - When the period is in progress the live button reads **"Continue settlement"** (`483`), not "Settle Payroll".
   - The copy says "Choose the dates", but the live control only steps between cycles.
2. **Readiness.** The preview shows "Review" and "Mark as paid" buttons (`Preview:37`). Live, Review is a per-issue link, and the card button reads "Review before paying" (disabled) or "Mark paid" (`775`).
3. **Earnings.** The preview and copy show "1,000 m × ₹2/m = ₹2,000". The live breakdown shows only "Production earnings (X m) ₹…", with no rate × metres line (`Workspace:795-800`). Salary lines do match: live `788` and card `739`.
4. **Payment labels are inconsistent.**
   - Preview: "Mark as paid" everywhere (`Preview:37,45,50`).
   - Live workspace row: "Mark Paid" (`756`); confirm button: **"Confirm Payment"** (`964`).
   - Live card: "Mark paid" (`775`); card ConfirmActionDialog confirm label: "Mark as paid" (`875`).
5. **Payment date.** It is taught in the preview and copy (`Preview:32`, EN 37). The live dialog collects it (`Workspace:147,921-931`), but it is **never sent**: `settleBaseWorkerPayroll` has no date parameter (`Workspace:228-234`; `actions.ts:999-1017`, `BaseSettlementSchema` at 107-120).
6. **Confirm step.** The copy says to check the "period", but the live workspace pay dialog shows net, gross and recovery with no dates (`Workspace:880-901`). Only the card ConfirmActionDialog shows dates (`874`).
7. **Dialog titles.** Preview: "Settle Payroll". Live: "Settle payroll" (`Workspace:423`). The live pay dialog is nested inside the workspace dialog; the preview shows a single dialog.
8. **Card-level payment path is not taught.** The card "Mark paid" → ConfirmActionDialog path, which has no date or note, and the page-level payment-mode Select (`682-685`) are not in the tour.
9. **Correction.** The preview shows only the records dialog (`Preview:58`), which matches live `197-201`.
   - The tour never names the entry button "Resolve mistaken payment record" (`Records:305`).
   - It omits the second path, workspace "Reopen Payment", which has different wording: "Reason for reopening" and "I confirm that this payment was not made or was recorded by mistake." (`Workspace:1020-1097`).
10. **Advance and deduction.** Fields match (live `801-866`). Minor differences:
    - The preview defaults the reason to "Other"; live defaults to "Mistake / Damage" (`130`).
    - The advance copy never names the "Add advance" button.
    - The live deduction dialog says "It will be deducted during payroll settlement" (`831`). In fact deductions join advance debt under the 50% cap (`actions.ts:981-989`). The tour copy is the accurate one here, so this is a product copy defect.
11. **Records.** The copy says "select a settled period". Periods actually appear after the first payment, not only once settled (`Records:219`, `242`).
12. **Full-only flows with no Base UI.** whatsapp, slip, receipt, csv (history), rules, adjustment, finalSettlement and statutory deductions (`Preview:36,42,46-49,59-65`). A grep of live Base payroll components for WhatsApp, payslip, Final Settlement, Statutory, Inam, Edit rules and Pay window returns nothing.

---

## 4. Data safety

- **The preview cannot mutate data (CV).**
  - `PayrollTourPreview.tsx` imports only UI, i18n and `lib/payroll-tour` (`3-9`).
  - Every button and input is `disabled` (`20-21`, `49-58`).
  - No `onClick`, form or link. The test enforces this (`payroll-tour-preview.test.tsx:17-32`).
  - `makePayrollTourExample` returns fresh display-only objects (`payroll-tour.ts:32-37`).
- **The tutorial cannot trigger business actions (CV).** `PayrollTutorial.tsx` imports only `persistTourCompleted`. All pointer events outside the panel are cancelled (`use-guided-tour.ts:75-99`) and the page is inert. No settlement, payment, reversal, export or advance/deduction action is reachable.
- **Server writes by the tour (CV).**
  - `recordTourEventAction` updates `auth.user_metadata.tour_preferences` (`app/actions/tour-preferences.ts:12-66`).
  - It also calls **`revalidatePath('/owner/payroll')`** for payroll events (`~71-72`), for shown, started and completed.
  - INF: the refresh re-runs the loader and hands `BaseProductionClient` new `initialData` while the page is hidden.
    - `useState` values survive: period, search, filter, tab.
    - Workspace `localPayables` re-sync from the new props (`Workspace:106-110`).
    - The same file notes that the stock tour avoids this refresh for exactly this reason (`tour-preferences.ts` comment).
- **While hidden (CV):**
  - The live tree stays mounted under `display:none`, so state and unsaved drafts are preserved.
  - Radix dialogs portal outside the hidden div, but the modal dialogs block access to the rail, so the tour cannot launch while one is open (INF).
  - The rail aside stays visible but inert.
- **Restoration (CV):** scroll is restored to the position saved at launch (`PayrollGuidedTour.tsx:32`; `use-guided-tour.ts:109`). Focus returns to the launcher.

---

## 5. Defects and gaps

**Blocker**
- None found in the tour. It is isolated and non-mutating (CV).

**Major**

1. *Product, amplified by the tour.* The period selector does not change the payables shown.
   - `payables` are computed with `periodEnd: today` (`loaders.ts:559`) and filtered without reference to `activePeriod` (`BaseProductionClient.tsx:279-283`).
   - The text "Outstanding earnings through {activePeriod end}" (`679`) is therefore wrong for non-current periods.
   - The workspace completes the *selected* period using those today-based payables (`Workspace:335-374`).
   - The `complete_base_payroll_period` RPC sums settlements by `period_end = p_period_end` and does not check that obligations are resolved (`supabase/migrations/20260913180000_base_payroll_period_settlement.sql`, function body).
   - INF: totals can mismatch the snapshot, and a period can be completed from a non-current view.
   - The tour's "Choose the dates… what this period owes" teaches a model the code does not implement.
2. *Product.* Payment date is shown and taught but discarded (§3.5). Its default `new Date().toISOString().slice(0,10)` is a UTC date (`Workspace:147,751`), not the Surat helpers in `lib/time.ts`.
3. *Tour copy.* Base-visible deduction copy refers to the retired "Full" tier: EN `payroll-tutorial.ts:85`, GU `203` ("ફુલનું"), HI `321` ("फुल का").
4. *Tour vs product.* The readiness copy promises Review "opens the affected Production entry". The link goes to `/owner/production?…` without `tab=production` (`ReadinessPanel:71`).
   - Only `tab=production` redirects to the daily sheet (`production/page.tsx:16-22`).
   - `activeTab` is `'jobs'` unless the path ends in `/daily-sheet` (`BaseProductionClient.tsx:151`).
   - The `entry` parameter is consumed only by `BaseDailyProductionSheet` (`:135,633`).
   - INF: it lands on the Production overview, not the entry.
5. *Tour.* The earnings breakdown shown in the preview does not exist live (§3.3). The mix of payment-button names and the two payment paths go unexplained (§3.4, §3.8).

**Minor**

6. The correction step does not name the entry control and ignores Reopen Payment. "Resolve" means two things: resolving a ₹0 worker and "Resolve mistaken payment record" (§3.9).
7. The confirm step says to check the period, but the pay dialog shows none (§3.6).
8. Status casing drift: "In Progress" / "Ready to Complete" vs live "In progress" / "Ready to complete".
9. The section-1 label "Period and rules" appears for Base, which has no rules step (`payroll-tutorial.ts:373`). Base core has 5 visible sections: 0, 1, 2, 4, 6.
10. The help track ends on the core `finish` copy, which advertises "More payroll help" and "open the payment review" (`53`). The preview `finish` repeats the panel body (`Preview:66`).
11. Neither the help track nor Skip leaves a trace. The help track records no started or completed event (`PayrollTutorial.tsx:39`; `PayrollGuidedTour.tsx:54`).
12. INF, desktop: collision avoidance is turned off for preview targets (`use-guided-tour.ts:144-146`). The top-right panel may overlap the centred sample dialog at roughly 768–1100px widths.
13. INF: the preview's own `mx-auto max-w-6xl` (`Preview:70`) is not the `.payroll-workspace-shell` width. At ≥1440px the fixed left rail (`globals.css:~985-1000`) might overlap it.
14. Product: no settings link to change the pay cycle. No UI calls `reopenBasePayrollPeriod`. Records search has no no-results state.

**Dead code: the `full` variant (CV)**
- The only caller passes `variant="base"` (`payroll/page.tsx:10`). No other `PayrollGuidedTour` usage exists (grep).
- Unreachable in production:
  - `payroll-tour.ts`: 1, 5, 7, 11-12, and the full branches at 15-17, 21, 23.
  - `PayrollTourPreview.tsx`: 31 ("Payment mode"), 36, 42, 46-50 (`!base` checkbox), 59-65, 76 ("Mark Paid" title).
  - `payroll-tutorial.ts`: EN 55-78 and 103-130, GU 173-196 and 221-248, HI 291-314 and 339-366, `helpDescription.full` 384/409/434, and roughly 19 full-only label rows (451, 458-460, 464, 466, 469-471, 481-490).
- Tests that keep it alive:
  - `payroll-tour.test.ts:9-21` (full length 9 and help list) and `:39`.
  - `payroll-tour-preview.test.tsx:17` (loops over full) and `:34-39` ("Full Suite settlement").
- Its content (WhatsApp, PDF Slip, statutory, Final Settlement) has no Base counterpart. The `premium` tier was retired in `20260924085030_retire_full_suite_tier.sql`.

---

## 6. Localization

**Coverage (CV)**
- `fields` is typed `Record<PayrollTourStep, …>` for en, gu and hi (`payroll-tutorial.ts:5-13`), so every step, including dead full steps, has all three languages.
- Buttons Skip / Back / Next / Finish / progress are inherited through `...configurationTutorialCopy[lang]` (`370,395,420`; source `configuration-tutorial.ts:20,46,72`).
- The tutorial panel and preview are marked `data-i18n-skip` (`PayrollTutorial.tsx:53`; `Preview:70,75`).

**Fallbacks and hard-coded English**

1. The preview helper is `tx = payrollPreviewLabels[lang][label] ?? translatePage(label)` (`Preview:14`). The comment at `payroll-tutorial.ts:446` promises explicit labels, yet these Base-reachable labels are missing from `previewLabelRows`: Previous, Next, Payroll, Gross earnings, Balance carried, Review, Outstanding, Cash, Paid, Worker, Amount, Description, Other, Notes, Payroll records, Machines, Reason for reversal, "I confirm this payment was not actually made.", Record reversal (CV). They fall back to the legacy phrase map or strict Base word translation (`lib/i18n/context.tsx:165-188`; `runtime.ts:1150-1175`). Some exist in `base-continuity-phrases.ts`.
2. The "How pay is calculated" rail dialog is hard-coded English (`PayrollGuidedTour.tsx:74,87,90,97-111`). The aside's aria-label "Payroll guides and tools" (`37`) is too. None of these phrases appear anywhere in `lib/i18n` (grep). They sit outside `data-i18n-skip`, so INF: the DOM localizer applies word-by-word translation.
3. Sample dates use English months: `'01–30 Sep 2026'` (`payroll-tour.ts:36`) and `' · 30 Sep 2026'` (`Preview:50`).
4. Live settlement strings have no exact phrase entries in any dictionary (CV, grep): "Settle payroll", "Continue settlement", "Complete Payroll", "Confirm Payment", "Reopen Payment", "Outstanding only", "Mark as paid", "Payment date", "Net Payable", "View in records". INF: they get word-level fallback. This means the translated tour labels (e.g. "પેરોલ સેટલ કરો") may not match what the live page shows.

**Terms (CV from copy)**

| Concept | GU | HI |
|---|---|---|
| payroll | પેરોલ | पेरोल |
| advance | એડવાન્સ | अग्रिम |
| deduction | કપાત | कटौती |
| recovery | વસૂલાત | वसूली |
| settle / settlement | સેટલ / સેટલમેન્ટ | निपटाएँ / निपटान |
| salary | પગાર | वेतन |
| piece rate (full-only) | પીસ રેટ | पीस रेट |
| debt | દેવું | ऋण |

INF on naturalness:
- Hindi "अग्रिम" and "ऋण" are formal for a Surat shop floor.
- `lib/terminology.ts:40-44,87` defines Upaad (advance) and Kapaat (deduction) plus Hisaab (payroll close); the payroll page and tour use none of them.
- Kharchi is defined there as supervisor float, and correctly does not appear in payroll.

Word collision: the GU/HI "Finish" button ("પૂર્ણ કરો" / "पूरा करें") is the same verb as "Complete Payroll" ("પેરોલ પૂર્ણ કરો" / "पेरोल पूरा करें").

---

## 7. Tests pinning the tour

- **`__tests__/payroll-tour.test.ts`**
  - Base core has 10 steps and full has 9, with ordering constraints (`8-18`).
  - Exact help lists for both variants (`19-22`).
  - Sample maths equals `calculateAdvanceRecovery` (`23-37`).
  - Every step × variant × track has non-empty copy; gu/hi text is in the right script; sections are monotonic; recovery copy contains "50%", "₹1,000" and "₹0"; all preview labels have gu/hi script (`38-59`).
  - Surface mapping (`60-68`).
  - `isTourEligible('payroll', …)`: base owner true; premium, lite and supervisor false (`69-74`).
- **`__tests__/payroll-tour-preview.test.tsx`**, using `renderToStaticMarkup` with `tx` mocked to identity:
  - Every variant/track/language/step has exactly one `data-payroll-tour`, no `<form>` or `<a>`, and all button/input/select elements disabled (`17-27`).
  - The preview source has no actions, supabase, navigation, loaders, whatsapp, fetch or onClick (`28-32`).
  - Full `finalSettlement` (`33-39`).
  - gu/hi Resolve / Resolved (₹0) / Complete Payroll labels (`40-50`).
  - Base paymentDetails labels (Payment method / Payment date / Note), obligations without "Mark as paid", complete with "3/3" (`51-62`).
  - Source-string checks: `launch('help')`, `launch('core')`, `returnFocus`, core-only `persistTourCompleted`, `focusReturn` and hook Escape/focus strings (`63-78`).
  - `<div hidden={step !== null}>{children}</div>` and returnScroll saved before setStep (`79-84`).
- **`__tests__/guided-tour-left-rails.test.ts:101-108`**: aside class string, `<TourInvitation`, `tourId="payroll"`, `align="full"`, and no `bg-saffron-soft/75`.
- **`__tests__/guided-tour-focus.test.ts:29-38`**: `return-focus-at-close` semantics, which Payroll uses.

**Not covered (CV by grep)**
- Payroll is absent from `tour-i18n-parity`, `tour-quota-and-data-safety` and `tour-no-autostart`.
- No test checks that preview labels match live labels, that the `full` variant is unreachable, or that the "How pay is calculated" strings are localized.
- There is no DOM or interaction test of `PayrollTutorial`.
- The identity `tx` mock hides the fallback-label problem (§6.1).

---

## What is missing (short list)
- Tour coverage of the card-level "Mark paid" path, the page-level payment-mode Select, and workspace "Reopen Payment".
- Persistence of the payment date, or removal of the field and of the tour's claim about it.
- Period-scoped payables, or copy that explains the "through today" model; plus a server-side check before Complete.
- A readiness Review link that actually opens the daily-sheet entry.
- Removal of the "Full" reference in the Base deduction copy; retirement of the `full` variant and its tests.
- Explicit gu/hi labels for the fallback preview labels and for the "How pay is calculated" rail dialog.
- A link from payroll to the pay-cycle settings; a no-results state for records search.
- A defined completion/analytics signal for the help track, and a separate finish copy for it.
