# Audit: Fabric Stock, Yarn Stock, Stock Audit, Dispatches

Read-only subagent report, 2026-09-27. Key claims were spot-checked against source by the planning session before use; the refinement plan and page specs say which findings were adopted. Labels: CV = CODE-VERIFIED, INF = INFERRED.

---

# Audit: Fabric Stock, Yarn Stock, Stock Audit, and Dispatches pages and their tours (Base plan)

I only read files. Nothing was run or changed. **CV** = CODE-VERIFIED (read in source). **INF** = INFERRED (reasoned from code, not run).

## 0. How the three tours work (shared by all pages)

**Wrappers and where steps point**
- `components/stock/StockGuidedTour.tsx:10-43` and `components/dispatches/DispatchGuidedTour.tsx:11-45` both work the same way:
  - A left-rail `<aside>` holds a `TourInvitation`.
  - The live page is wrapped in `<div hidden={step !== null}>`.
  - While a step is set, the wrapper renders a sample replica (`StockTourPreview` or `DispatchTourPreview`) plus the tutorial panel. CV
- Every tour step points at `[data-stock-tour="…"]` or `[data-dispatch-tour="…"]`:
  - `lib/stock-tour.ts:18` and `lib/dispatch-tour.ts:29` define the selectors.
  - `lib/tutorial-target.ts:13-15` resolves them and skips hidden elements.
- **No live component has any of these anchors.** A grep of `QualityStockClient`, `YarnStockClient`, `InventoryAuditClient`, `ChallansClient`, `ChallanDraftEditor` and `ChallanPrint` found zero `data-stock-tour`, `data-dispatch-tour` or `data-tour` attributes. Every step resolves only in the replica. CV

**While the tour is open** (`hooks/use-guided-tour.ts`)
- Every `document.body` child except the portal is made inert (64-73).
- Pointer and click events outside the panel are blocked in capture phase (75-79, 98-99).
- Keys: Escape closes; ArrowRight and Enter (when not on a button) go next; ArrowLeft goes back; Tab cycles the panel's buttons (83-97).
- The viewport is locked. On close, scroll position and focus on the launcher are restored (103-112). CV

**Positioning**
- Desktop (`use-guided-tour.ts:124-158`): the target is scrolled to centre and re-measured for 1.5 s. The panel is fixed top-right. It moves left or bottom only when the target is outside the preview dialog (144-146). A clip-path cutout and a saffron ring mark the target. CV
- Mobile (`hooks/use-mobile-tour.ts:15`): below 767 px, or short coarse-pointer screens, the panel becomes a bottom sheet (`app/globals.css:1435-1460`, `max-height: 46dvh`). `lib/mobile-tour-positioning.ts` pads the scroll container and scrolls the target above the sheet. CV

**Completion**
- `persistTourCompleted` fires only on Finish (`StockTutorial.tsx:54-59`, `DispatchTutorial.tsx:36-42`). Skip or Escape records nothing.
- `persistTourStarted` fires on launch (`hooks/use-tour-invitation.ts:147-158`).
- State is written to localStorage `weavly:tour-prefs:v1:<userId>` (`lib/tours/tour-preferences.ts:4-6`) and to auth `user_metadata` through `app/actions/tour-preferences.ts:61-63`. CV
- Because `align="full"` is set, `TourInvitation` always renders the "guide card" (`components/tours/TourInvitation.tsx:83-126`). The invitation variant with a **Dismiss** button (163-172) can never appear on these pages. Completion has no visible effect beyond the `data-tour-control` value. CV

---

## 1. Fabric Stock — `/owner/stock`

### 1.1 Page workflow
- **Loading and access.**
  - `page.tsx:8-15` requires the owner role and calls `getQualityStockBoard` (RPC `get_quality_stock_board`, `actions.ts:17-32`).
  - `layout.tsx:15` uses an `AccessGate` with the `production` capability.
  - The non-Base legacy tab nav is `StockNavigation.tsx`. Base uses the sidebar disclosure (`lib/disclosure-navigation.ts:40-47`). CV
- **Prerequisites.** Qualities appear when production is saved. The empty state (`QualityStockClient.tsx:188-196`) links only to `/owner/production`. Opening stock can be typed for any quality name through the datalist (`472-483`). CV
- **Regions.**
  - Header with **Audit Inventory** (a link to `/owner/stock/audit`, 128-133), **Refresh** (134-137) and **Opening stock** (138-141).
  - Available-stock card (149-164).
  - "Stock by quality" with search (167-186).
  - Quality cards (199-258): a "Pending" badge when opening is not recorded (209-214); **Opening stock** or **Correct balance** (224-231); an extra **Correct balance** while opening is pending (232-241); and **Movement history** (242-255).
  - A movement-history pill rendered twice, in mobile and desktop rails (94-120, 264-271). CV
- **Dialogs.**
  - Movement-history Dialog (274-455): quality filter select `#history-quality` (322-335), Refresh, list with a Production link (402-409), **Load older movements** (429-441), Close.
  - Opening/Correction Dialog (458-533): quality, metres, reason, Save stock. CV
- **Main flow.**
  1. Opening stock, which adds metres once.
  2. Correct balance, which sets an absolute total (`recordQualityStockAdjustment`, `actions.ts:34-51`).
  3. Retry of an uncertain save reuses the same UUID (77-90). The RPC sets `opening_recorded=true` for both kinds (`supabase/migrations/20260908171502_quality_metre_stock.sql:234`).
  4. Read the history. CV
- **Outputs.** Balances used by the dispatch quality picker. Movement links go to Production. CV

### 1.2 Tour
- **Entry.** Left-rail guide card (`StockGuidedTour.tsx:21-36`).
- **Steps.** `balance, tracking, openingPending, opening, correction, counted, finish` (`lib/stock-tour.ts:1`).
- **Sections.** Four (`stock-tour.ts:6-10`; the yarn and fabric branches are identical, lines 8-9).
- **Surfaces.** `opening` and `correction`/`counted` render inside a non-modal preview Dialog (`FabricStockTourPreview.tsx:36-45`). The others are page cards (25-35). The `counted` target is nested inside the `correction` target (41).
- **Dead step names.** `stockTourSurface` lists step names that do not exist, such as `openingQuality`, `costing` and `linkSave` (`stock-tour.ts:12-15`). CV
- Every target is in the replica. CV
- **Optional help.** One collapsible "help" button per step (`StockTutorial.tsx:15-21`, 79), text in `fabricStockTutorialHelp` (`lib/i18n/stock-tutorial.ts:113-143`). CV
- **Step copy (EN, `stock-tutorial.ts:12-39`):**

| Step | Title | Body |
|---|---|---|
| balance | Available fabric, by quality | 500+200−100=600; a draft does not deduct stock |
| tracking | Check when stock tracking began | "Read Stock started on your page…" |
| openingPending | Verify what belongs in opening | 650−150=500; "Check Dispatch → Earlier dispatch records → Pending Dispatches" |
| opening | Record the verified 500 m | Adds once; preview saves nothing |
| correction | A correction sets today's total | Closes opening stock |
| counted | 600 m → 590 m: a −10 m movement | Enter 590, not −10 |
| finish | Trace the balance, then act | Read Balance after; next action |

### 1.3 Sample vs real drift
- **Tracking start is not shown on the live page. Major, CV.**
  - The `tracking` step says "Read Stock started on your page". Its help mentions "Historical production excluded" and "Historical metres without a quality" (`stock-tutorial.ts:16-19, 119-122`).
  - `QualityStockBoard.cutover` exists (`lib/quality-stock.ts:23`), and the keys `qualityStock.started`, `cutover`, `historical`, `unallocated` and `correctionNote` exist (`lib/i18n/locales/en.ts:182-186`).
  - `QualityStockClient` never renders them (no "cutover" match in the file). The replica invents "Stock started: 1 September 2026 · sample" (`FabricStockTourPreview.tsx:26`, `stock-tutorial.ts:211`).
- **Tour points to a screen that no longer exists. Major, CV.**
  - `openingPending` sends users to "Dispatch → Earlier dispatch records → Pending Dispatches" (`stock-tutorial.ts:22`, also in gu/hi).
  - `ChallansClient` has no such link; the `challan.legacy` key is unused. No such route exists under `app/(dashboard)/owner/`.
- **Opening-pending card.** The replica shows one action button (27). The live card shows both Opening stock and Correct balance (224-241). The "Opening stock not recorded" text is a hard-coded "Pending" badge with a tooltip live (212). Minor, CV.
- **Balance card.** The replica labels the balance per quality (`Available · Sample fabric`, 25). The live card is a total across all qualities (155-161). Minor.
- **History.** The replica shows history inline (28-35). Live it is a Dialog opened from a pill; the replica has no pill, no search and no Audit Inventory button. Minor.
- **Button name.** Correction help says "Refresh stock" (`stock-tutorial.ts:133`); the live button is "Refresh" (`en.ts:177`). Minor.
- **Movement kinds.** The DB writes fabric kinds `audit_adjustment` and `production_reversal` (`supabase/migrations/20260920000000_unified_inventory_audit_architecture.sql:11, 530, 922`). The `StockMovement` type omits them (`lib/quality-stock.ts:16`), and `tx(row.kind)` (`QualityStockClient.tsx:392`) falls back to the raw key through `t()` (`lib/i18n/context.tsx:454`). Users would see the text "qualityStock.audit_adjustment". The tour never mentions audit adjustments. Major, CV.

### 1.4 Data safety
- The previews import no actions and contain only disabled controls (`FabricStockTourPreview.tsx:18-19`; test `stock-tour.test.tsx:126-134`). The only server call from the tour is `recordTourEventAction`. CV
- The live page stays mounted while hidden, so filters, the open form and the pending `request` survive. CV
- **Live refresh while hidden.** The focus/visibility listener calls `router.refresh()` (53-58), and new `initialData` resets `data` and `qualityId` (50). This also happens without the tour. CV
- **Possible filter reset on tour launch or finish. INF.** `supabase.auth.updateUser` inside a server action (`app/actions/tour-preferences.ts:61`) likely writes auth cookies. That would re-render the route and reset the history filter even though the comment at 69-71 tries to avoid it. Minor.

### 1.5 Defects and gaps
- **Major (tour):** the stale `tracking` and `openingPending` content above.
- **Major (product):** raw-key labels for audit and reversal movements.
- **Minor (product):** Close on the form (524) is allowed with an unconfirmed `request`. The UUID is dropped silently, although the copy advises "Close and refresh".
- **Minor (product):** `aria-controls="stock-history"` points at a `DialogTitle` id (98, 284). The pill is duplicated.

### 1.6 Localization
- The root has `data-i18n-skip="true"` (123), so the DOM phrase translator is bypassed (`context.tsx:45`). Hard-coded English stays English in gu/hi. CV:
  - "Audit Inventory" (131)
  - "logged entry/entries · View ledger" (115)
  - "quality … tracked in stock" (160)
  - "Pending" (212)
  - The history dialog description (288)
  - "movement/movements" (338)
  - The empty-history explanation (352)
- The left-rail aria-label "Fabric Stock guides and tools" is hard-coded (`StockGuidedTour.tsx:21`).
- **Terms, CV:**
  - hi/gu `qualityStock` uses Hinglish "सेव"/"સેવ" while yarn uses "सहेजें"/"સાચવો".
  - Fabric "Correct balance" is gu "સ્ટોક સુધારો" / hi "स्टॉक सुधारें"; yarn uses "બેલેન્સ સુધારો" / "शेष सुधारें".
  - "Pending Dispatches" stays English inside the gu/hi tour copy (`stock-tutorial.ts:57, 92`).

### 1.7 Tests
`__tests__/stock-tour.test.tsx`:
- One target per step, controls disabled, no `<form>` or `<a>` (24-29).
- Section ordering and gu/hi script checks (30-44).
- Eligibility is Base owner only (40-43).
- Example arithmetic (46-51).
- Pins EN copy substrings, **including the stale "Dispatch → Earlier dispatch records → Pending Dispatches"** (59).
- Per-language preview values (67-96).
- Help substrings (97-107).
- Collapsed help and `aria-valuemax="7"` (108-124).
- Wrapper source contract `<div className="stock-workspace-shell" hidden={step !== null}>` and the preview import bans (126-134).
- `__tests__/guided-tour-left-rails.test.ts:111-120` pins the rail class, `tourId={kind}` and `align="full"`.
- No test checks that tour copy matches live labels or that the live page renders `cutover`.

---

## 2. Yarn Stock — `/owner/stock/yarn`

### 2.1 Page workflow
- **Loading.** `yarn/page.tsx:7-14` calls `getYarnStockBoard` (RPC `get_yarn_stock_board`, `yarn-actions.ts:14-25`). Writes go through `mutateYarnStock` (RPC `mutate_yarn_stock`, 26-38). CV
- **Regions (`YarnStockClient.tsx`).**
  - Header: **Audit Inventory** link (106-111), Refresh, **Opening weight**, **Add yarn** (112; current view only).
  - Amber start help while tracking has not started (117).
  - Total card with "Tracking started" (118).
  - Audit date section: date, **View date**, **Export balances CSV** (119).
  - Yarn cards: **Add yarn**, **Correct balance**, **Movement history** (120-121).
  - "Yarn used by each fabric" with **Link costing** per quality (122).
  - Movement history with yarn filter, a "View dispatch" link to `/owner/dispatches/{id}/print` (132) and Load more (123-141).
  - One Dialog serving opening, receipt, correction and recipe (142-150). CV
- **Prerequisites.**
  - A saved costing with yarn weights. With none, the Dialog links to `/owner/estimator` but labels the link "Saved costing" (144).
  - Production deducts yarn: `production_consumption` in `private.reconcile_quality_stock` (`20260920000000…sql:446`). CV
- **Main flow.**
  1. Opening weight per yarn.
  2. Add yarn for receipts.
  3. Link costing, pinning kg per 100 m.
  4. Production deducts yarn.
  5. Correct balance.
  6. Optional dated view and CSV (93-97).
- **Uncertain saves.** The request is kept in sessionStorage scoped by org (27, 31-49, 84-85). Editing is locked until a retry (148). CV

### 2.2 Tour
- **Steps.** `balance, yarn, opening, receipt, link, movement, correction, finish` (`stock-tour.ts:2`); four sections.
- **Surfaces.** `opening`, `receipt`, `link` and `correction` are dialogs (`YarnStockTourPreview.tsx:57-60`). The rest are page cards (49-56). All targets are in the replica. CV
- **Help.** For every step except `balance` (`stock-tutorial.ts:354-384`).
- **Step copy (EN, 241-272):**
  - Track unused yarn
  - Count the physically available yarn (120−20=100)
  - Start with opening weight
  - Add only the new receipt (100+20)
  - Link the right fabric costing
  - Record production to deduct yarn (200 m×10/100)
  - Correct the unused count (98, not −2)
  - Check history, then prepare production

### 2.3 Drift
- **Balance-card text.** The replica shows `text.help` (49). The live page never renders `help`; it shows `startHelp` (117). Minor, CV.
- **Order.** Replica: balance, yarn, movement, formulas/audit date (49-56). Live: audit date comes before the cards; formulas come before history. The replica has no Audit Inventory, Refresh, header Opening/Add buttons or the start banner. Minor.
- **Recovery link.** The replica recovery reads "Saved costing → Cost Estimate" (37). The live link text is "Saved costing" but goes to the estimator (144). Minor.
- **Invitation copy is stale. Major, CV.** It says "…audit **dispatch deductions**" (`lib/i18n/tour-invitations.ts:27`; gu 62, hi 97). Yarn is deducted at production.
- **Left-over revalidation.** `yarn-actions.ts:36` still revalidates `/owner/dispatches`, and `challan-actions.ts:114` revalidates `/owner/stock/yarn`. Harmless. CV

### 2.4 Data safety
- The preview has no handlers or storage (test 126-134). The live pending request stays in sessionStorage and state. CV
- `load()` runs on focus while hidden (62-68) and keeps the filter. Safe. CV

### 2.5 Defects
- **Major (tour):** the stale invitation benefit.
- **Minor (product):** the "Audit Inventory" button leads to a page whose guide is the *Fabric* tour; see section 3.

### 2.6 Localization
- `yarnStockText` has complete en/gu/hi (`lib/i18n/yarn-stock.ts`).
- Hard-coded "Audit Inventory" (109) and "kg" units.
- "quality" is translated as "ગુણવત્તા"/"गुणवत्ता" in `noCostings` (34, 55) but "ક્વોલિટી"/"क्वालिटी" elsewhere.
- Weft is "વાણો" here but "ભરણ" in the estimator (`gu.ts:1266`); yarn is "યાર્ન" here vs "સૂત" there.
- The tour's gu/hi "ઇન્વેન્ટરી ઓડિટ"/"इन्वेंटरी ऑडिट" does not match the English live button.
- The preview's sample labels live inline in the component (`YarnStockTourPreview.tsx:16-20`). CV

### 2.7 Tests
`stock-tour.test.tsx`:
- Yarn arithmetic (136-150).
- Targets per language (151-174).
- Collapsed help and `aria-valuemax="8"` (175-195).
- Unused/embodied preview strings (196-208).
- Copy substrings, e.g. "Clear the date and choose View date" (209-220).
- `__tests__/tour-i18n-parity.test.ts` checks the invitation copy exists but not its accuracy.

---

## 3. Stock audit — `/owner/stock/audit`

### 3.1 Page workflow
- **Route.** `audit/page.tsx:8-21` wraps `InventoryAuditClient` in `StockGuidedTour kind="fabric-stock"`. CV
- **How users reach it** (grep, CV):
  - Only the hard-coded "Audit Inventory" buttons at `QualityStockClient.tsx:129` and `YarnStockClient.tsx:107`.
  - There is no sidebar entry; the stock disclosure children are fabric and yarn only (`lib/stock-navigation.ts:1-4`).
  - `resolveStockKind` maps `/owner/stock/audit` to `'fabric'` (`stock-navigation.ts:9`). As a result the sidebar highlights Fabric, the document title becomes "Fabric Stock | Weavly" (`StockPageTitle.tsx:9-10`), and the segment `loading.tsx:8-11` shows "Fabric Stock". CV
- **Regions (`InventoryAuditClient.tsx`).**
  - Header: Back to `/owner/stock` (211-215); title with a Finalized or "Draft / Working" badge (217-226); Audit Date input (234-240); **Export CSV** (243-251); **Finalize Audit**, shown only after an audit exists (253-262).
  - Four KPI cards: fabric on hand, loose yarn, embodied yarn, total represented (267-329).
  - Legacy-fabric notice (332-342).
  - Tabs (345-363):
    - Material Position table with **Breakdown** drill-down (366-520).
    - Fabric tab with **Record/Edit Count** and **Adjust** (523-621).
    - Yarn tab, same controls (624-720).
    - Reconciliation list (723-777).
  - Dialogs: Record Physical Count (781-840), Apply Audit Adjustment (843-884), Finalize (887-918). CV
- **Flow.**
  1. The first count creates or reuses a draft through `create_inventory_audit_draft` (129-135, `audit/actions.ts:37-65`).
  2. Record the count (`record_inventory_audit_count`).
  3. Adjust, which writes an `audit_adjustment` movement (`apply_inventory_audit_adjustment`, `actions.ts:99-129`).
  4. Finalize, which freezes the snapshot. CV

### 3.2 Tour on this page
- The full Fabric Stock tour runs here: opening stock, Correct balance, tracking. The live audit page is hidden behind the Fabric sample titled "Fabric Stock".
- No step covers audit date, record count, variance, Adjust, finalize, embodied yarn or CSV. Finishing the tour here marks `fabric-stock` completed (`StockTutorial.tsx:56`), and a first visit here records the fabric impression. **Major (tour), CV.**
- The tour teaches Correct balance for count differences, while this page offers a separate Record Count → Adjust path. The Adjust path does not set `opening_recorded`: the fabric branch at `20260920000000…sql:905-925` only updates `meters`. The two ways of correcting a count are not reconciled in any copy. CV

### 3.3 Data safety
The page is hidden and stays mounted, so dialog state is kept. The tour calls no audit actions. CV

### 3.4 Defects (product)
- **Major, CV: changing the date mixes two audits.** `handleDateChange` passes the new date together with the *old* `auditId` (89-99). The RPC loads lines by `p_audit_id` first (`supabase/migrations/20260926132159_repair_inventory_audit_board.sql:148-149`). The board shows date B's system values with audit A's lines. Counts then save against audit A (127), whose system quantity the server derives "as of" A's date (`audit/actions.ts:77-78`).
- **Major: the displayed adjustment can differ from the applied one.** CV: the dialog shows `line.variance`, taken against the audit-date system quantity (602, 858), but the RPC applies `p_physical_count − current meters` (`20260920000000…sql:909-915`). INF: after later production or dispatch, the delta applied differs from the one shown. The toast reports the real value (178).
- **Minor:** after finalizing, the date picker is disabled (238), so there is no in-page way to start or view another date's audit. INF.
- **Minor:** "No variances recorded. All verified physical counts match system stock." appears even when no counts exist (732-735).
- **Minor:** audit actions use `requireRole` only; lock and capability checks are left to the RPCs (`audit/actions.ts:20, 41, 71, 103, 135`). CV

### 3.5 Localization
- The whole client, its toasts, aria-labels ("Back to stock", 211) and `owner-route-loading.tsx:30` are English only.
- There is no `useTranslation`, and none of these strings is in `base-plan-phrases`, the legacy maps or the locales (grep). Numbers are fixed to `en-IN` (276). CV

### 3.6 Tests
- No UI or tour test.
- `__tests__/db/inventory-audit.dbtest.ts` exercises the actions against a replayed schema. It is not matched by the default vitest include (`vitest.config` has no custom include), so it does not run in `npm test` (INF).

---

## 4. Dispatches — `/owner/dispatches` and `/[id]/print`

### 4.1 Page workflow
- **Loading.** `page.tsx:9-28` loads `listChallans()` and `getQualityStockBoard()` for the quality picker. Metadata is the hard-coded "Delivery challans | Weavly" (8). CV
- **Regions (`ChallansClient.tsx`).**
  - Title (284-286). The intro is screen-reader only (287).
  - **New dispatch**, shown both inline and in the action rail (288-294).
  - Active/History tabs (296-311).
  - Search plus **Search** button (312-343).
  - Row cards: number, customer, quality, metres, date, delivery and payment badges, balance, due label, difference warning (368-430).
  - EmptyState with New dispatch on the Active tab (432-440). Load more appears when the count is a multiple of 50 (441-445). CV
- **Draft Dialog** (447-484) using `ChallanDraftEditor`:
  1. Quality select showing "m available" and the selling rate, plus payment due date and terms (243-311).
  2. Sender and customer: date, names, addresses, delivery address, all required (20-27, 312-322).
  3. Lot/taka rows with Enter navigation, a duplicate-lot check, a row cap of 500 and "incomplete rows" (323-451).
  4. Optional references (452-467).
  - A live preview pane (469-621). **Save draft** (643-652). CV
- **There is no party master. CV.**
  - Customer and sender are free text entered for every challan; `blank()` sets only the date (`ChallansClient.tsx:55-60`).
  - The draft help says "Enter customer details afresh" (`en.ts:92`).
  - There is no customer datalist.
- **Detail panel** (485-963).
  - Refresh, and **Preview / Print / Save PDF**, a new-tab link (550-567).
  - Metres, Financial and Terms cards (572-681).
  - Toolbar (684-798): for a draft, **Edit draft** and **Confirm dispatch has left**. After issue: **Received as sent** (a one-click save, 716-727); **Record / correct receipt**; **Review difference** (when acknowledged ≠ sent); **Record payment**; **Add charge / credit adjustment**; **Change payment terms**; **Record credit refund** (when the balance is below 0); **Reverse erroneous dispatch** (when sent and there are no money events).
  - Customer and document details disclosure (801-854).
  - Transaction history with **Reverse entry** per money event (857-961).
  - Operation Dialog with the relevant fields (964-1130). CV
- **What the RPC does** (`supabase/migrations/20260926132412_restore_challan_auto_archive.sql`, the latest `mutate_delivery_challan`):
  - Confirm deducts fabric metres and allocates production lots FIFO.
  - It **does not deduct yarn** (no "yarn" in the file).
  - Settled or reversed challans are auto-archived (162). CV
- **Print** (`[id]/print/page.tsx`, `ChallanPrint.tsx`):
  - Three A4 copies with a DRAFT, ISSUED or REVERSED stamp (43-47).
  - **Print / Save as PDF** calls `window.print()` (`PrintButton.tsx:7`).
  - There is no link back to the dispatch page (the page opens in a new tab). CV
- **Retries.** A pending retry is kept in sessionStorage `weavly-challan-pending`, not scoped by org (141-161). While a retry is pending, New dispatch and the rows are disabled, and the only way out is **Retry saved request** (353-357); there is no discard.
  - CV: the key is not org-scoped, unlike yarn (`YarnStockClient.tsx:27`).
  - INF: a user who signs in to another org in the same browser tab could replay the other org's draft.

### 4.2 Tour
- **Entry.** Rail guide card titled from `challan.guideTitle` (`DispatchGuidedTour.tsx:22-37`).
- **Steps.** `overview, quality, parties, lots, saveDraft, confirm, receipt, difference, payment, balance, finish` (`lib/dispatch-tour.ts:2`).
- **Sections.** Six (19-22).
- **Help.** 22 topics under "More help for this step" (4-16; `DispatchTutorial.tsx:62-68`).
- **Surfaces.**
  - Dialog: quality, parties, lots, saveDraft, confirm, receipt, payment (`DispatchTourPreview.tsx:33-39`).
  - Card: overview, difference, balance, finish.
  - All targets are in the replica. CV
- **Step copy (EN, `lib/i18n/dispatch-tutorial.ts:7-99`):**

| Step | Title and gist |
|---|---|
| overview | Goods, receipt and money — three tracks |
| quality | Choose a ready fabric quality — Yarn Stock → Link costing first |
| parties | Customer details and agreed price (₹40) |
| lots | Two lots make 100 metres (₹4,000) |
| saveDraft | Save and review without moving stock |
| confirm | Confirm only when goods leave — "…also deducts yarn using the linked costing weights" |
| receipt | Record what the customer acknowledges (98 m) |
| difference | 100 sent, 98 accepted: no stock return (₹3,920) |
| payment | Record money actually received (₹2,000) |
| balance | Check what remains due (₹1,920) |
| finish | Return to your next real action |

### 4.3 Drift
- **Yarn deduction is described backwards. Blocker (tour), CV.**
  - `confirm` says dispatch deducts yarn, and the `yarn` help says "…100 m sent deducts 10 kg; production itself does not deduct yarn" (53-56; gu 147-151; hi 242-246).
  - The current RPCs do the opposite: production deducts yarn and confirm does not.
  - This contradicts the Yarn tour ("A later dispatch does not deduct this yarn again", `stock-tutorial.ts:263`).
- **"Earlier dispatch records" is a retired feature. Major, CV.** The `legacy` help topic (98) describes it; there is no UI or route for it.
- **"parties" has no counterpart.** The step name and preview group the selling rate with sender and customer (`DispatchTourPreview.tsx:22`). Live, the rate sits in section 1 next to quality and terms; there is no party entity. Minor.
- **Receipt dialog.** The preview puts **Received as sent** inside the receipt dialog and omits the reason field (26). Live, it is a toolbar button (716-727), and the reason is required when correcting (1065-1072). Minor.
- **Dialog titles.** Preview titles use tour titles (37); live titles use the action labels (973-979). Minor.
- **Payment method.** The preview's method is blank; live defaults to `bank` (249-250). Minor.
- **Overview.** The preview shows `intro`; live it is screen-reader only. Minor.

### 4.4 Data safety
- The preview has no handlers, links, print calls or storage (`DispatchTourPreview.tsx:9`; test `dispatch-tour-preview.test.tsx:100-104`). The tour cannot confirm, pay or print. CV
- The live draft, `selected`, `operation` and `pending` state survive while hidden. Timers and focus listeners only refresh `today` (112-121). CV
- A modal draft or operation Dialog blocks the rail launcher (INF, Radix modal).

### 4.5 Defects
- **Blocker (tour):** yarn copy. The test at `dispatch-tour.test.ts:36` pins it.
- **Major (tour):** `legacy`.
- **Major (product):**
  - Sender and customer details must be retyped for every challan.
  - A pending retry has no discard and is not scoped by org.
- **Minor (product):**
  - One-click "Received as sent" with no confirmation.
  - The "Amount (negative for credit adjustment)" label is reused for payments (`en.ts:115`).
  - The draft date uses a browser-local `toLocaleDateString` (58, 249) instead of the Surat helpers in `lib/time.ts`.
  - Event timestamps use the browser default locale (879).

### 4.6 Localization
- `challan.*` is complete in en/gu/hi.
- Hard-coded English inside a skip root (280):
  - `ChallansClient.tsx`: "Metres Breakdown" (577), "Financial Summary" (613), "Payment Terms" (653), "Lot Breakdown (n lots)" (840), "Lot n" (848), the "Rs" prefix (620-643, 883).
  - `ChallanDraftEditor.tsx`: "{n} rows" (330), "Rs" / "/ m" (584, 589, 630).
  - All of `ChallanPrint.tsx` and `PrintButton.tsx`.
  - The rail aria-label "Dispatch guides and tools" (`DispatchGuidedTour.tsx:22`).
- **Tour vs UI mismatches:**
  - gu/hi copy quotes English UI labels ("Active", "History", "Search", "Load more", "New dispatch": gu 105/109/117, hi 200/204/212). The UI shows સક્રિય / ઇતિહાસ / શોધો / વધુ જુઓ / નવો ડિસ્પેચ.
  - gu spells receipt "પ્રાપ્તી" in the tour vs "પ્રાપ્તિ" in the UI.
  - gu `legacy` is "અગાઉના ડિસ્પેચ" vs the UI's "જૂના ડિસ્પેચ રેકોર્ડ".
  - The gu invitation uses "રસીદ" for receipt.

**Term map (UI):**

| Term | EN | GU | HI |
|---|---|---|---|
| Stock | Stock | સ્ટોક | स्टॉक |
| Balance (stock) | Balance after | પછીનો સ્ટોક (fabric) / નોંધ પછી બેલેન્સ (yarn) | बाद का स्टॉक / प्रविष्टि के बाद शेष |
| Balance (money) | Remaining balance | બાકી રકમ | बाकी राशि |
| Dispatch | Dispatch | ડિસ્પેચ | डिस्पैच |
| Challan | Challan | ચલણ | चालान |
| Party | "Customer" (no party entity) | ગ્રાહક | ग्राहक |
| Lot | Lot / taka | લોટ / તાકા | लॉट / ताका |
| Receipt (dispatch) | Receipt | પ્રાપ્તિ | प्राप्ति |
| Receipt (yarn) | Add yarn | આવક | आवक |

### 4.7 Tests
- `dispatch-tour.test.ts`: 11 steps, sections, surfaces, localized copy with script checks. It pins `confirm` containing "linked costing weights" (36) and `legacy` containing "may be unavailable for your plan" (46). Topic count is 33; example arithmetic includes `yarnDeduction` (53); eligibility.
- `dispatch-tour-preview.test.tsx`: one target per step per language, disabled controls, quantities, no writes or prints, and the wrapper contract `<div hidden={step !== null}>` (105-110).
- `dispatch-tutorial-panel.test.tsx`: help is opt-in, `aria-valuemax="11"`, and skip/back/next controls exist.
- `guided-tour-left-rails.test.ts:122-130`: the rail classes.
- There is no test for `ChallansClient`, `ChallanDraftEditor` or `ChallanPrint`, and none linking tour labels to live labels.

---

## What is missing
- Tour anchors on the live pages. All steps point only at replicas.
- Any display of the fabric tracking start (`cutover`) on `QualityStockClient`.
- A tour for the Stock Audit page, and an entry for it in navigation or the page title.
- Labels for the `audit_adjustment` and `production_reversal` fabric movements.
- Dispatch and yarn tour copy that matches the current deduct-yarn-at-production rule, including the invitation benefit.
- Removal of the "Earlier dispatch records / Pending Dispatches" references and the tests that pin them.
- Localization of the audit page, print page, detail-card headings and "Audit Inventory".
- A saved sender or customer (party) default for challans.
- A way to discard a pending challan retry, and an org-scoped storage key for it.
- Tests that check tour copy against live labels.
