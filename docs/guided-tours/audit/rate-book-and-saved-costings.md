# Audit: Yarn Rate Book and Saved Costings

Read-only subagent report, 2026-09-27. Key claims were spot-checked against source by the planning session before use; the refinement plan and page specs say which findings were adopted. Labels: CV = CODE-VERIFIED, INF = INFERRED.

---

# Audit: Yarn Rate Book and Saved Costings, pages and guided tours

I only read files. I ran no npm, vitest or network commands. All paths are relative to `/home/user/TextileAccounting`.
**[CV]** means CODE-VERIFIED: I read it in the source. **[INF]** means INFERRED: my reasoning or a runtime effect I did not observe.

**Most important findings:**
1. **Sample IDs reach the server.** Outside the tour, the demo rate and demo costing use live handlers, so sample IDs can reach server actions. The server rejects them, but the user sees confusing errors (A3, B3).
2. **The two tours' anchors are unreliable.** Several steps have no spotlight on common screens or data states. A few steps describe controls the spotlight does not show (A4, B4).
3. **The tour panels on Saved Costings cover the sample dialogs.** This happens at every desktop width (B4).
4. **A retained Free grant duplicates the page.** `/owner/quotes` then renders two Saved Costings pages, rails and tours at once (B4).
5. **The panels break the design rules.** Both use `shadow-2xl`, amber borders and a saffron "Next" button.

---

## A. Yarn Rate Book (`/owner/rates`, Lite and Base)

### A1. Page workflow

**Purpose.** The page is the owner-maintained ₹/kg price list for Warp and Weft yarns. Saving a rate updates the matching layers in Saved Qualities for future estimates; costing snapshots are not rewritten. Sources: `app/(dashboard)/owner/rates/actions.ts:294-327` and `lib/i18n/rate-book-tutorial.ts:110-114` **[CV]**

**Prerequisites and plans.**
- The owner role is required: `requireRole(['owner'])` in `page.tsx:9` **[CV]**
- The `rate_book` capability is required at both ends:
  - `layout.tsx` uses `AccessGate requiredCapability="rate_book"`.
  - Server actions call `requireBaseTier`, which actually checks `rate_book` despite its name, at `actions.ts:54-58` **[CV]**
- `lib/subscription-access.ts:24-42` gives `rate_book` to Lite and Base only. There is no Free Rate Book **[CV]**
- `RatesClient` has no plan branches, so Lite and Base get the same page **[CV]**
- Yarns are also discovered automatically when a quality or costing is saved. See the empty-state text at `RatesClient.tsx:1801` **[CV]**

**Main regions (in `RatesClient.tsx`).**

| Region | Where | Visibility |
|---|---|---|
| Left rail: tour guide card and `RateBookHelp` | 1505-1522 | Hidden below 1024px (`globals.css:646-648`); inline from 1024px (`:734-738`); pinned left from 1440px |
| Page header with "Add Yarn Rate" | 1533-1557 | — |
| Delete-sample nudge shown after the tour | 1559-1591 | — |
| Pending, usage and conflict banners | 1593-1621 | — |
| Main card | from 1624 | — |
| • count line and "Archived rates" toggle | 1626-1643 | — |
| • Toolbar: search, All/Warp/Weft segment, "Needs Review" toggle, "Confirm All (N) as Current", Clear filters | 1646-1763 | — |
| • desktop table | 1820-1972 | `lg` and up |
| • mobile cards | 1973-2124 | below `lg` |
| Right rail: Add, `RateReviewRailWidget`, `RateBookReferenceCard` | 2293-2311 | Hidden below 1280px (`globals.css:715-721`) |
| Archive-policy rail | 2314 | — |
| Floating "N Rates Need Review" button | 851-878, 2319 | — |

**Controls that open overlays** (anchors are `data-ratebook-field`):

| Control | Opens | Lines |
|---|---|---|
| Add Yarn Rate (`addRateAction`; right-rail copy has no anchor) | Sheet editor (`rateDrawerFields`) | 1547, 2295 → 2179-2214 |
| Row "Edit rate" (`quickEditAction`) | `QuickRateEditPopover` (`quickEditPopover`); its "Advanced settings…" link opens the Sheet | 1914 / 2067; popover 290-518, 352, 505-513 |
| Qualities badge (inside the `linkedQualitiesPopover` cell) | `LinkedQualitiesPopover` | 194-267 |
| Row ⋯ menu | Advanced edit (Sheet), Activity (history Sheet 2235-2258), Archive/Restore (Dialog 2260-2272), Delete unused (Dialog 2274-2286) | 1936-1964, 2085-2118 |
| Rail "Review N Rates" or floating button | `DueForReviewDialog` | 520-668, 2129-2143 |
| "Review conflicts" | Conflicts Dialog, which also auto-opens on load when conflicts exist (`useState(initialConflicts.length > 0)`, 954) | 1619, 2145-2177 |

Two direct actions open nothing:
- The row confirm button (`quickReviewAction`) confirms immediately, with no dialog (1871, 1274-1305) **[CV]**
- The "Confirm current rate?" dialog at 2216-2233 is unreachable, because `setReviewRate` is never called with a rate **[CV]**

**Primary workflow.**
1. Find a yarn with search or filters.
2. Either:
   - choose Edit rate, enter the value and a source, then Save Rate (`handleQuickSave`, 1164-1233), or
   - open Advanced edit to set Effective from, Review date and Review every (30–365 days) and save (`handleSave`, 1103-1147).
3. Or confirm an unchanged price, per row or in bulk. The bulk path `handleConfirmAll` (1307-1346) acts on all due rates, including rows hidden by the current filters. It has no confirmation step **[CV]**
4. Result: a toast reports how many Saved Qualities were synced (1129-1133).
5. Next step: review a new estimate in Cost Estimate.

**Empty state.**
- If `initialRates` is empty and the demo has not been deleted, a hard-coded sample row `DEMO_YARN_RATE` is shown instead (92-113, 907-919) **[CV]**
- Otherwise `EmptyState` shows (1773-1815). It has no "Add" action unless filters are active **[CV]**

### A2. Tour implementation

**Entry points and why `TourInvitation` renders twice.**

| Instance | Where | Rendering |
|---|---|---|
| `RateBookTutorial.tsx:62` | Inside the exported `RateBookTutorialLauncher`. `RatesClient` mounts it in the page header inside `<div className="lg:hidden">` (1538-1545) | Default `align='start'`: the invitation (benefit, "Take a tour", "Dismiss") on the first eligible visit, otherwise the quiet "Tour" button (`TourInvitation.tsx:129-199`) |
| `RateBookTutorial.tsx:540` | Inside the tour component itself, which lives in `aside.rates-left-rail-desktop` | `align="full"`, which always renders the "Rate Book guide / Start guide" card (`TourInvitation.tsx:83-127`) |

Which one you see depends only on CSS: the header launcher below 1024px, the rail card from 1024px. Both stay mounted, which causes several problems **[CV]**:
- There are two `useTourInvitation` instances. On a first visit both call `persistTourImpression`, so the server action `recordTourEventAction` runs twice (`use-tour-invitation.ts:68-73`).
- The rail card is mounted only while `enabled` (`!isPending`, `RatesClient.tsx:1508`). When a save finishes it remounts and can record another impression.
- The launcher's `disabled` prop is accepted but ignored (`RateBookTutorial.tsx:56`).
- Neither launch path starts the tour directly. The header path raises `requestTrigger` (`RatesClient.tsx:936-938`) and the rail path sets `requested`. Both wait for `enabled` and a loaded language (`RateBookTutorial.tsx:128-132, 175-180`).

**Steps** (`lib/rate-book-tour.ts:5-12`). There are 6 steps, one per section, with no branches. All steps are always kept, even when their target is missing (comment at 3-4) **[CV]**

| # | Field | Target | Live or sample | Title |
|---|---|---|---|---|
| 1 | overview | Wrapper around the PageHeader (`RatesClient.tsx:1533`) | live | Maintain your own yarn prices |
| 2 | yarnSearch | Search box (1648); the card resolves to the Toolbar (1646) | live | Find one yarn to maintain |
| 3 | linkedQualitiesPopover | Usage cell: desktop `<td>` 1865 or mobile div 2016; the card is `tbody tr` | live row, or the sample row on an empty account | Check which qualities use it |
| 4 | quickEditAction | Row "Edit rate" button (1914/2067) | live or sample | Record the supplier's new price |
| 5 | reviewStatusBadge | Status cell (1861/2001) | live or sample | Separate price dates from review dates |
| 6 | immutabilityNotice | Principles card in the right rail (2308) | live; hidden below 1280px | Recheck the next estimate |

What each step body says (EN, `lib/i18n/rate-book-tutorial.ts:24-107`):
1. Keep supplier-checked ₹/kg prices, starting from a quote or invoice. This is not a market feed.
2. Search by name, source or fabric; otherwise use {addRate} with the quality's yarn name and Warp/Weft.
3. Open the qualities badge. The name must match, e.g. "Polyester 75D". Adding a rate does not link a recipe.
4. Example ₹200→₹220: {editRate}, enter 220, add a source note, {saveRate}. The +₹20 (+10%) is not a market trend.
5. In {advancedEdit}: {effectiveDate} vs {reviewDate}, and {reviewEvery} sets the reminder. Dates do not rewrite old costings.
6. Saving updates linked Saved Qualities, snapshots keep their numbers, then check a fresh estimate in Cost Estimator.

Help-only fields (`RATE_BOOK_HELP_FIELDS`, 14-21), shown in `RateBookHelp` (`RateBookTutorial.tsx:72-91`): directionFilter, quickReviewAction, rateAndTrend, rateDrawerFields, reviewRailWidget, activityAndArchive.

The `{token}` placeholders are resolved through `tx()` by `formatRateBookTourText` (`rate-book-tour.ts:23-43`).

**UI state.** The tour opens no drawer, popover or filter. The comment at `RateBookTutorial.tsx:173-174` says so, and `rate-book-tour-flow.test.tsx:29-38` pins it **[CV]**. It still leaves a lot of code for states it never enters **[CV]**:
- Sheet and popover step code: `inSheet`/`inPopover` (18-25, 182-183) and `sheetPanelStyle` (519-528).
- Inert exemptions for popovers and sheets (225-231).
- `isTutorialActive` guards in `RatesClient` (323-380, 1899, 2052, 2142, 2179-2190).

**Positioning and highlight.** The engine is bespoke. It does not use `hooks/use-guided-tour.ts`, which only the `components/tours/*` tours use **[CV]**
- `resolveStepElements` (27-47) finds the target and walks up to a card: sheet, popover, `tbody tr`, `[data-ratebook-section-card]`, card, table.
- The measure loop (287-517) runs `requestAnimationFrame` until the target is stable, then scrolls with `window.scrollBy`.
- It uses fixed timers: settle 550/350/500 ms, a 350 ms backup and a 1500 ms retry cap (312, 463-493).
- The panel docks top-right or bottom-right from fixed thresholds of 380px and 300px (351-366).
- Highlight: a clip-path backdrop, a saffron glow ring around the card, and a saffron field outline (552-595).
- Shared pieces it does use: `useTourViewportLock` (210) and `useMobileTour` (211).

**Keyboard, focus and scroll.**
- Every other `body` child gets `inert`; focus goes to the panel and is restored on close (215-240).
- Window keydown handles Escape, Enter, arrow keys and a Tab trap (242-285).
- The page's "/" search shortcut is disabled during the tour (`RatesClient.tsx:967`).
- The page scroll position is not restored on close: `close` (185-194) has no scroll restore **[CV]**

**Mobile.**
- The panel docks at the bottom with `max-height: 46dvh` (`globals.css:1436-1450`), and the card glow is suppressed (567).
- `RateBookTutorial` itself sits inside the aside that is `display:none` below 1024px. The portal still renders, but the "couldn't save preference / Retry" banner (532-537) never shows on phones **[CV]**

**Persistence.**
- Skip, Escape and Finish all call `close()` (185-194). It writes `localStorage` `weavly:ratebook-tutorial:v1:{org}:{user}` = `done` and calls `dismissRatebookTutorial()`, which sets `user_metadata.ratebook_tutorial_dismissed` (`tutorial-actions.ts:8-21`).
- After a successful sync the local key is deleted (141). Failures retry when the browser comes back online (161-166).
- Legacy migration: a stored `done` value triggers the sync (150-159).
- `persistTourCompleted('rate-book')` is never called, so "completed" and "dismissed" are indistinguishable (grep) **[CV]**
- The `accountDismissed` prop is stored in the `dismissed` ref (121) but never read **[CV]**
- The invitation's show/quiet state comes from `getTourStatus` (`lib/tours/tour-preferences.ts:63-131`, legacy handling at 83-91). `userMetadata` is never passed, so account-level state is ignored and only `localStorage` counts. On a new device the invitation shows again **[CV]**

### A3. Data safety

**The tour itself** **[CV]**:
- It makes no business writes, opens no editors, and does not change filters, search, selection or drafts. Its only callbacks are `onActiveChange` and `onTourFinish`; the latter only sets `showDeleteNudge` (`RatesClient.tsx:1513-1517`).
- Its server calls are `dismissRatebookTutorial` and `recordTourEventAction`. The latter records shown/started events and runs `revalidatePath('/owner/rates')` (`app/actions/tour-preferences.ts:86-87`), which triggers an RSC refresh **[INF]**
- It does change the page scroll position and does not restore it.

**The sample row outside the tour** **[CV]**. `DEMO_YARN_RATE` (`id 'demo-sample-yarn-rate'`) is a live row with real handlers:
- Guarded (in memory only): quick save (1165), row review (1275), confirm-all (1310-1316) and delete (1451).
- **Not guarded:** Advanced edit or "Advanced settings" (`handleSave`, 1103-1147), Activity (`openHistory`, 1361-1382) and Archive (`handleArchive`, 1384-1446). These send the demo ID to `saveCostRate`, `getCostRateHistory` and `archiveCostRate`. The server's UUID guard rejects them with "Rate identifier is invalid." (`actions.ts:61, 259, 392`). There is no data loss, but the user gets an error toast.
- The demo also inflates the counts: the "Needs Review" badge, the Confirm All count, the rail widget and the floating button.
- It is labelled "Discovered from a saved quality or costing" (733), which is false.

### A4. Defects and gaps

| # | Severity | Kind | Finding |
|---|---|---|---|
| 1 | Major | Tour | **Step 6 has no spotlight below 1280px.** `immutabilityNotice` sits in `.rates-review-rail-desktop` (`display:none`, `globals.css:715-721`). **[CV]** |
| 2 | Major | Tour | **Steps 3–5 have no target when no rows are visible** (empty list, archived-only, or filtered). For archived rows `quickEditAction` is absent (1887). **[CV]** |
| 3 | Major | Tour | **Step 3 promises a badge that often isn't there.** It says "Open the qualities badge", but the badge renders only when `fabric_names` exist (269-280). The usage load overwrites the demo's `fabric_names` with `[]` (1022), so the sample shows "Surat Central Market" and the English note "Tour sample entry for learning the rate catalog" (105) instead. **[CV]** |
| 4 | Minor | Tour | **Step 5 targets the status badge but describes the Advanced-edit date fields**, which are never shown. The ₹200→₹220 example in step 4 does not match the visible sample (₹285 vs ₹280). **[CV]** |
| 5 | Major | Tour | **The first action for a new owner, Add Yarn Rate, is never spotlighted.** The anchor `addRateAction` is unused, and neither are Needs Review, Confirm or Rate Review. **[CV]** |
| 6 | Minor | Tour | **Progress is shown three times:** "Section N of 6" (622), "N/6" (660) and a progress bar (638), while each section holds one step. The section label also repeats the title. **[CV]** |
| 7 | Minor | Tour | **Dead code and copy.** Nine unused copy fields (activeRatesCount, lastReviewedDate, needsReviewFilter, confirmAll, archivedToggle, yarnRow, yarnNameCell, quickEditPopover, addRateAction); several of them market-toned ("Market Verification Cadence", "market trend") and contradicting "not a market feed". `replay` is unused. The sheet and popover branches are dead. The state object is mutated at 377-378. **[CV]** |
| 8 | Minor | Tour | **Style conflicts with the rules:** `shadow-2xl`, `border-amber-200/90` (605); a saffron glow (569-573); a saffron "Next" button (686); an amber gradient progress bar (640); `h-8` controls (651/668/686, only overridden to 44px on mobile); an amber sync banner (533). **[CV]** |
| 9 | Minor | Tour | **Fixed timers, and scroll is not restored.** See A2. **[CV]** |
| 10 | Minor | Tour | **Possible hydration mismatches.** `useTourInvitation` reads `localStorage` in its initial state (41-50), and so does the demo-row initializer (907-919). **[INF]** |
| 11 | Major | Product | **Sample-row actions fail** with "Rate identifier is invalid." (A3). The "sample was added so you could explore" nudge (1568) is misleading: the row exists whenever the list is empty, independent of the tour. **[CV]** |
| 12 | Major | Product | **"Confirm All (N) as Current" has no confirmation** and includes rates hidden by filters (1737-1748, 1307). The row confirm is also one click. The confirm dialog is dead (2216). **[CV]** |
| 13 | Minor | Product | **The Conflicts dialog opens on page entry** (954). **[CV]** |
| 14 | Minor | Product | **Row actions use a ⋯ menu** (1936, 2085), against the "explicit row actions" rule. **[CV]** |
| 15 | Minor | Product | **Hard-coded English:** "Needs Review" (1723), All/Warp/Weft (86-90, 1704), the popover and dialog strings (226-262, 545-661), "Effective" (1863). **[CV]** |
| 16 | Minor | Product | **The demo key `weavly:demo-yarn-rate-deleted` is not scoped** by user or org. **[CV]** |

### A5. Localization

- en, hi and gu have the same keys. `rateBookTutorialCopy[language] ?? .en` is the fallback (`RateBookTutorial.tsx:74, 111`) **[CV]**
- **Action names stay English inside Hindi and Gujarati sentences.** The action tokens go through `tx()`. My searches of `lib/i18n` found no phrase-dictionary entry for "Advanced edit", "Review date", "Review every", "Save Rate" or "Restore rate", so these stay English **[INF: phrase-dictionary coverage]**
- **The Hindi progress label is awkward:** `sectionProgress` "अनुभाग {current} का {total}" (126).
- **Terms for yarn and the Rate Book are inconsistent:**
  - Page title: hi "सूत रेट बुक", gu "સૂત ભાવ બુક" (`locales/*.ts:310`).
  - Tour copy mixes यार्न and धागा (hi), and યાર્ન and દોરો (gu).
  - The invitation uses "रेट बुक" / "રેટ બુક".
- **Hindi hard-codes a translated button name.** It spells out "सभी को वर्तमान के रूप में पुष्टि करें" (167, 195). The real button renders `tx(`Confirm All (${n}) as Current`)`, a dynamic string that is probably untranslated **[INF]**
- **The final step names the estimator differently:** "Cost Estimator" here, where Saved Costings says "Cost Estimate".
- The Gujarati `reviewStatusBadge` title contains a `{reviewDate}` token (299) that English does not have.

### A6. Tests that pin Rate Book tour code or copy **[CV]**

**`__tests__/rate-book-tutorial.test.ts`**
- Copy: 6 sections per language, key parity with at least 20 fields, `isRatebookTutorialField`.
- Anchors: the 15 `data-ratebook-field` values, `hideOverlay={isTutorialActive}`.
- Placement and styling strings: `clipPath`, `panelPlacement`, the keyboard key strings, rail CSS regexes, exactly one `<RateBookTutorial`, the popover and inert exemption strings, the placement threshold strings, `sm:w-[260px]`, the `closest()` priority order, typography classes, the dead sheet-step classes ("step 14").
- It also checks `dismissRatebookTutorial` against mocks.

**`__tests__/rate-book-tour-flow.test.tsx`**
- The exact six-step order.
- No step filtering, and no editor or filter callbacks.
- `onTourFinish` is called only in `handleNext`.
- English copy phrases.
- Every language resolves its tokens.
- `RateBookHelp` renders (via `renderToStaticMarkup`).
- `formatRateBookTourText` goes through `tx`.

**`__tests__/guided-tour-fixes-and-demo-data.test.ts`**
- The scroll, settle and backup timer strings.
- `DEMO_YARN_RATE` field values and pre-population.
- The nudge strings.

**Other tests**
- `__tests__/guided-tour-left-rails.test.ts`: aside and `tourId` strings. It does not run the no-amber check on the Rate Book.
- `__tests__/tour-no-autostart.test.ts`: no auto-start; `tourId="rate-book"`.
- `__tests__/tour-quota-and-data-safety.test.ts`: it looks for writes to `.from('yarn_rates' | 'quotes' | 'orders')`. The real writes go through RPCs, `cost_rate_history` and `estimator_quotes`, so this check is weak.
- `__tests__/tour-preferences-and-actions.test.ts`: the legacy `ratebook_tutorial_dismissed` flag and the local "done" marker.
- `__tests__/rate-review-rail.test.ts`: the `principles` copy.

---

## B. Saved Costings

Paid route: `/owner/quotes` (`QuotesClient.tsx`). Free route: `/free/costings` (`SavedFreeCostings.tsx`).

### B1. Page workflow

**Purpose.** Saved Costings is a library of immutable costing snapshots. You can find them, inspect the breakdown and economics, reuse one in the estimator, export or print a document, compare two versions, and (Base only) hand a version to production.

**Plans.**
- Free: `saved_costings` capability, fixed snapshots only.
- Lite: adds versions, compare, favourites, archive and reuse.
- Base: adds the "Activate for Production" link and the `production` tour step, via `canUseProductionPipeline = hasCapability(...,'production')` (`owner/quotes/page.tsx:34`, `QuotesClient.tsx:585-594, 612-621`) **[CV]**
- With a previous Free grant, `/owner/quotes` renders `<SavedFreeCostings/>` above `QuotesClient` (`page.tsx:36-38`) **[CV]**

**Paid regions (`QuotesClient.tsx`).**

| Region | Lines |
|---|---|
| Left rail with the tour | 1236-1238 |
| Header, "New Costing" → `/owner/estimator` | 1242-1253 |
| Nudge | 1254-1286 |
| Toolbar `data-costing-tour="filters"`: search `#saved-costings-search`, a Filters `<details>` popover (sort, margin), Compare/Done, Favourites, Archived, the comparison status bar, the count line | 1287-1362 |
| Library of quality cards (`SavedQualityLibraryView`, 375-775) | — |
| Right rails | 1507-1517 |

Overlays in the paid page:
- Card click or chevron opens the detail Dialog (520-768). It contains:
  - the breakdown (`data-costing-tour="breakdown"`, 601),
  - reuse buttons: Use, Duplicate, Export, Save as separate quality, Activate for Production, Archive (`reuse`, 607-627),
  - economics (`economics`, 644),
  - version history with View breakdown, star and archive per version (`versions`, 663-763).
- Other overlays:
  - `CostingExportDialog` (1520-1540).
  - Archive `ConfirmActionDialog` (1542-1552).
  - Compare Dialog `data-costing-tour="comparison"` with `<details data-costing-tour="comparison-details">` (1554-1658).
  - "Replace estimator draft?" (1660-1709).

**Primary workflow.** Search or filter, open a quality, choose View breakdown on a version, read the economics, then pick one:
- **Use** writes an estimator draft to `localStorage` and routes to `/owner/estimator` (1098-1142).
- **Duplicate** or **Save as separate quality**: these are identical calls, `handleRestore(quote,'duplicate')` (1431-1432, 1488-1489) **[CV]**
- **Export**, **compare** (Compare, select 2 versions, Compare Costings) or **archive/favourite** (`updateSavedCostingLibraryState`, 1169-1197).

**Paid empty state.**
- If there are no quotes and no templates, a persistent sample library (the tour examples) is shown (811, 1380-1442).
- Otherwise `EmptyState` shows (1445-1470).

**Free (`SavedFreeCostings.tsx`).**
- Header "New Costing" → `/free` (214).
- Toolbar `data-costing-tour="search-and-filters"`: search, sort, margin (254-309).
- A demo card `data-costing-tour="free-sample"` with Export and delete (355-444).
- Snapshot cards with Export and a details Dialog (537-636), whose "View breakdown / Export" button opens the export (597).
- "Load more" pagination (526-533).
- Data comes from `fetch('/api/free/costings')` (83-105).

### B2. Tour implementation

**Entry points.** Everything lives in `SavedCostingsTutorial.tsx`:
- `TourInvitation` with `align="full"`, so always the guide card (164-176). It launches step 1.
- A "Compare versions · Sample walkthrough" rail button, paid only (179-183).
- A help `<details>` (184-189).
- Paid passes `userId` and `orgId` (`QuotesClient.tsx:1237`). **Free passes neither** (`SavedFreeCostings.tsx:207`) **[CV]**

**Step lists** (`lib/saved-costings-tour.ts:4-15`):
- Paid: find, versions, economics, reuse, internal, [production, Base only], finish.
- Free: snapshots, freeSelect, internal, finish.
- Comparison: compareSelect, comparison, comparisonDetails, finish.

Surfaces are derived by `costingTourSurface` (20-25): page, library dialog, export dialog or comparison dialog.

Help fields:
- Paid: filters, breakdown, organize, separateQuality, customer, share.
- Free: freeHelp, customer, share.

Dead entries: `select`, `searchAndFilters`, `search` and `freeFilters` have selectors and copy (27-28) but appear in no step list **[CV]**

**Targets.** All tour data is the injected sample `makeSavedCostingTourExamples` (v2 and v1, "Tour sample", ids `tour-preview-v2` and `tour-preview-v1`, 26-55). Exceptions are `snapshots` and `finish`.

| Step | Selector | Surface and what the user sees | Title (EN) |
|---|---|---|---|
| find | `[data-costing-tour="sample"]` (1365) | Sample card plus the amber "Tour sample" banner | Keep the numbers behind a price |
| versions | `versions` (663) | Dialog opened with no version chosen (431), so it shows "Choose a costing version…" | Choose the version you mean |
| economics | `economics` (644) | v2 selected | Read v2 before reusing it |
| reuse | `reuse` (607) | Handlers are no-ops (1374-1376) | Reuse or start a new quality? |
| internal | `export-modes` (`CostingExportDialog.tsx:413`) | `tutorialPreview`; print, PDF and share return early (211, 258, 320) | Choose who may see the document |
| production | `production` Link (615) | Library dialog | Hand this version to production |
| compareSelect | `versions` | `comparisonMode` with both versions checked (1371-1372) | Select two versions of one costing |
| comparison / comparisonDetails | 1555 / 1587 | details opened (1587) | Explain what changed / Find the reason for a change |
| snapshots | `[data-free-costing]` (the whole Free workspace, 210) | live | Your Free snapshots |
| freeSelect | `free-sample` demo card (357) | — | Inspect a completed calculation |
| finish | none; falls back to the launcher button (73-77) | Varies with the saved-costing count: existing / empty / unavailable | Review one of your saved costings / Save your first costing / Return to your saved list |

EN copy is at `lib/i18n/saved-costings-tutorial.ts:8-32`.

**State changes and restore.** The page renders `tourStep ? sampleLibrary : ...` (1364). Dialogs are driven by `tourStep` and made non-modal and non-dismissible (520-527, 1554-1555, 1519). Closing the tour (`step = null`) derives everything back. On close it restores inertness, scroll position (133) and focus, with a 300 ms fallback (136) **[CV]**

**Mechanics.** Again bespoke; it duplicates what `hooks/use-guided-tour.ts` `useGuidedTourModal` provides:
- A `MutationObserver` keeps new `body` children inert (87-96).
- Pointer events and clicks are blocked in the capture phase (98-101, 122-123).
- Focus is forced back to the panel (102-104).
- Keyboard: Escape, Enter, arrows and a Tab trap (105-121).
- Viewport lock (97).
- Desktop measuring calls `scrollIntoView({block:'start'})` on each new target and runs `requestAnimationFrame` for a fixed 1800 ms (140-159).
- The panel jumps to the bottom if the target is in the top-right corner (161).
- Mobile uses the shared `useMobileTour` and `lib/mobile-tour-positioning.ts`.
- The Skip, Back, Next and Finish labels are borrowed from the Rate Book copy (43).

**Persistence.**
- Only Finish of the core tour calls `persistTourCompleted('saved-costings', userId)`, and only if `userId` is set (61-69).
- Skip and Escape persist nothing.
- The comparison tour never completes.
- Free has no `userId`, so nothing is stored locally or as completed. `getTourStatus` then always says "first visit", and `persistTourImpression` calls the server on every mount (`use-tour-invitation.ts:68-73`) **[CV]**
- There is no legacy key.
- The quiet-button fallback `[data-costing-tour="launcher"]` (31) never exists, because `align="full"` never renders that button.

### B3. Data safety

**During the tour** **[CV]**:
- The sample library has no-op handlers (1368-1377). Export is `tutorialPreview`. Navigation to the production link is blocked by the capture-phase click blocking.
- `searchQuery`, `filterStatus`, `showArchived`, `marginFilter`, favourites, `comparisonMode`, `selectedCostingIds` and `openQualityKey` are never changed. The tour only swaps what is rendered. The same holds for the Free page's search, margin and sort.
- Server calls: `recordTourEventAction` for shown/started/completed, which revalidates `/owner/quotes` and `/free/costings` (`app/actions/tour-preferences.ts:88-90`).

**The demo costing outside the tour** **[CV]**. `lib/saved-costings-tour.ts:26` says the sample IDs "must never be passed to persistence actions". The demo path hands the tour examples live handlers (1413-1441):
- "Use" goes through `handleRestore` → `restoreQuoteToEstimator` and writes a real local estimator draft (1131) with `sourceQuoteId: 'tour-preview-v2'` (1118). It can replace a real draft after confirmation.
- In the estimator, "Save New Version" then sends `sourceQuoteId: 'tour-preview-v2'` to `saveEstimatorQuoteV3` (`EstimatorClient.tsx:3823, 4808`, then `actions.ts:1532/1566` `p_source_quote_id`). A database rejection is **[INF]**
- The Export paths call no server action, because `record_kind` is 'costing'. But they produce real PDFs:
  - paid: the user's `organizationName` on the "Tour sample" figures (1433, 1520-1539),
  - Free: `documentReference='tour-preview-v2'` (415, 654-671).
- Favourite, archive and audit on the demo are guarded by toasts (1434-1437).
- `toggleCostingSelection` and `ensureQuoteDetail` accept the examples but return early (1062, 1082) **[CV]**

### B4. Defects and gaps

| # | Severity | Kind | Finding |
|---|---|---|---|
| 1 | Major | Tour | **The tour panel covers the sample dialogs at every desktop width.** `[data-costing-tour-dialog]` reserves `100vw - 330px` (`globals.css:1485-1487`), but the dialog is centred (`dialog.tsx:70`), so only about 165px is left on each side. The panel needs 276px (`right-4`, `w-[260px]`, 196). The library dialog is also shifted right by up to 124px (528). By this arithmetic about 110–225px of the dialogs sit under the panel. **[CV arithmetic / INF visual]** |
| 2 | Major | Tour | **The Free `freeSelect` step can lose its target.** The demo card is filtered by the user's existing search or margin filter (162-176), and the tour does not neutralise the filters. **[CV]** |
| 3 | Major | Tour | **The Free `snapshots` step spotlights the entire workspace**, which is effectively no spotlight. **[CV]** |
| 4 | Minor | Tour | **The copy's promises don't match the page.** `freeSelect` tells the user to choose "View breakdown / Export" on the card, but the card button says "Export" (419). Every finish body says "Finish closes the tour samples and restores your page", yet on empty accounts the sample persists and the nudge "Explore exports with this sample costing" appears (1254-1286). Its test asserts that no persistent demo is promised (`saved-costings-tour.test.ts:52-54`). **[CV]** |
| 5 | Minor | Tour | **The count line disagrees with the tour list.** During the tour it shows the user's real "N qualities" above the one-sample list; "1 sample quality" appears only when there are no quotes (1357-1360). **[CV]** |
| 6 | Minor | Tour | **The sample label is shown twice:** the banner "Tour sample · Nothing is saved or sent" (1366) and the panel eyebrow (197). The same banner appears in demo mode (1414), where "Use" does save a draft and Export can produce a PDF, so "nothing is saved" is untrue there. **[CV]** |
| 7 | Minor | Tour | **Dead steps and wrong fallback.** `select`, `searchAndFilters`, `search` and `freeFilters` are unused; the latter three have weak copy ("Here you can…", `i18n:28-30`). The launcher fallback is dead. `replay` is unused. **[CV]** |
| 8 | Minor | Tour | **Style conflicts with the rules:** `shadow-2xl`, `border-amber-200/90`, a saffron "Next" (`bg-saffron text-white`, 203), an amber progress bar (198), amber banners and nudges (`QuotesClient` 1257-1283, 1366, 1414; Free 222-249, 363-439); 36px buttons. **[CV]** |
| 9 | Minor | Tour | **Fixed 1800ms and 300ms timers. No copy fallback:** `savedCostingsTutorialCopy[language]` has no `?? .en` (42). **[CV]** |
| 10 | Major | Product | **A retained Free grant duplicates the page.** `/owner/quotes` renders two headers, two `aside.saved-costings-left-rail` and two tours. From 1440px both rails are `position:fixed` in the same place (`globals.css:981-1001`), so they overlap. The ids `saved-costings-search`, `-sort` and `-margin` are duplicated (`QuotesClient` 1293/1308/1312; Free 262/276/292). The Free "New Costing" button routes a paid user to `/free`. **[CV]** |
| 11 | Major | Product | **Demo-sample IDs escape into estimator drafts, and real PDFs can be made from sample figures** (B3). **[CV]** |
| 12 | Minor | Product | **"Duplicate" and "Save as separate quality" do the same thing** (B1). Quality cards open on a row click (460-464). **[CV]** |
| 13 | Minor | Product | **Hard-coded English:** "Tour sample" (789, and `saved-costings-tour.ts:44`), "1 sample quality" / "0 qualities" (1359), "Sample customer" (1519), "Filters", "Compare"/"Done", "Favourites" (1303-1331), "Saved Costing history" (664), "Activate for Production" (593/620), "Search saved records…" (1296), and the Free aria-label "Open … details" (435). None of these is in the phrase dictionaries I searched. **[CV/INF]** |
| 14 | Minor | Product | **Demo keys are not scoped:** `weavly:owner-demo-costing-deleted` (790) and `weavly:free-demo-costing-deleted` (Free 53). **[CV]** |

### B5. Localization

- en, hi and gu have matching keys; test parity exists **[CV]**
- **The Finish button and the copy disagree.** Hindi and Gujarati bodies say the English word "Finish", while the button shows "समाप्त" / "પૂર્ણ" (from the borrowed Rate Book controls).
- **Many UI labels stay English in hi/gu copy:** View breakdown, Duplicate, Favourites, Archive snapshot, Check saved numbers, Compare Costings, Old/New/Change, Assign Looms, Print, Generate PDF, Load more. The UI itself translates Compare Costings as "कॉस्टिंग की तुलना करें" (`locales/hi.ts:302`), so the tour and the UI name it differently **[CV]**
- **Three names for the feature in each language:**
  - hi: page "सेव की गई कॉस्टिंग" (`locales/hi.ts:299`), tour "सेव की गई लागतें", invitation "सहेजी गई लागतें" (`tour-invitations.ts:119`).
  - gu: "સાચવેલી કોસ્ટિંગ", "સાચવેલી ખર્ચ ગણતરીઓ", "સેવ કરેલ કોસ્ટિંગ".
- **English grammar slip:** `organize` reads "Check saved numbers, on older records that offer it, checks…" (`i18n:20`) **[CV]**

### B6. Tests that pin Saved Costings tour code or copy **[CV]**

**`__tests__/saved-costings-tour.test.ts`**
- Step lists for paid, Free and comparison; surfaces; examples are comparable and use `tour-preview-` ids.
- Endings, and the "no persistent demo" wording.
- Production and reuse copy; locale parity and token resolution.
- Page pins: the no-op handlers, the nudge condition, and the `persistTourCompleted` and Escape strings.

**`__tests__/guided-tour-fixes-and-demo-data.test.ts`**
- The inline dialog `left` calc and the removed CSS rule.
- The demo-costing key and nudge strings.
- The `tourExamples.find` fallback, and the ids `tour-preview-v2` / `tour-preview-v1`.

**Other tests**
- `__tests__/guided-tour-left-rails.test.ts`: aside class strings, `align="full"`, no amber in the invitation props.
- `__tests__/tour-no-autostart.test.ts`: the tour does not auto-start.
- `__tests__/tour-quota-and-data-safety.test.ts`: checks that the tutorial has no `fetch(` and no writes to the `quotes` table. The real table is `estimator_quotes`, so this check is weak.
- `__tests__/tour-i18n-parity.test.ts`: invitation copy parity; static emphasis.
- `__tests__/tour-invitation-lifecycle.test.ts`: 44px targets, impression, dismiss.
- `__tests__/tour-preferences-and-actions.test.ts`: saved-costings started and completed.
- `__tests__/tutorial-target.test.ts`: target helpers.

---

## What is missing

- The Rate Book tour has no step for adding the first rate, and it has an anchor fallback only for its final step below 1280px.
- Neither tour resets or accounts for user filters (the pattern the Machines and Configuration tours use), so targets vanish.
- The demo rate is not guarded in Advanced edit, Activity and Archive. The demo costing is not guarded in Use, Duplicate and Export.
- There is no Rate Book completion event, and account-level preferences (`userMetadata`) are never passed to `TourInvitation` on either page. On the Free page, `userId` is missing too.
- There is no confirmation for bulk "Confirm All", and there is a dead "Confirm current rate?" dialog.
- There is no de-duplication when a retained Free grant renders two Saved Costings pages.
- There is no shared engine: both tours re-implement `useGuidedTourModal` and skip `hooks/use-guided-tour.ts`.
- There is no DOM or interaction test of spotlight targets, empty or filtered states, or panel overlap. The current tests only assert on source text.
