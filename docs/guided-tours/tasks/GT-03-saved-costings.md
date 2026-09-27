# GT-03 — Reference tour: Saved Costings

## Task ID and purpose

GT-03. Rebuild the Saved Costings tour (Free, Lite, Base and the optional "Compare versions" walkthrough) on the GT-01/GT-02 foundation, end to end, as the reference every later tour copies. It proves: migrating a bespoke engine, tour-owned sample dialogs with the reserved column, placement beside dialogs, shadowed filters, plan variants, live handoff, label tokens, sample-record guards and correct persistence on Free. Ends in REVIEW_REQUIRED for gate G1.

## Dependencies and entry conditions

- GT-02 PASSED.

## Read first

1. Page spec [`pages/saved-costings.md`](../pages/saved-costings.md) (all of it; it is the contract).
2. Plan §5.3 (PS-SAMPLE, PS-SAMPLE-DIALOG, PS-HANDOFF), DR-15, LR-02, LR-03, DS-02, EC-10, EC-16, EC-19, EC-20.
3. Source: `components/estimator/SavedCostingsTutorial.tsx`, `lib/saved-costings-tour.ts`, `lib/i18n/saved-costings-tutorial.ts`, `app/(dashboard)/owner/quotes/QuotesClient.tsx` (tour branches ~780-815, ~1236-1240, ~1355-1445, dialogs ~515-770, ~1515-1660), `components/estimator/CostingExportDialog.tsx` (~369-440), `app/free/costings/SavedFreeCostings.tsx`, `app/free/costings/page.tsx`, `app/(dashboard)/owner/quotes/page.tsx`, `app/globals.css` `[data-costing-tour-dialog]` rules (~1484-1488).
4. Tests: `__tests__/saved-costings-tour.test.ts`, `guided-tour-fixes-and-demo-data.test.ts` (Saved Costings parts), `tour-no-autostart.test.ts`, `tour-quota-and-data-safety.test.ts`, `guided-tour-left-rails.test.ts`.

## Allowed change surface

- `components/estimator/SavedCostingsTutorial.tsx` (becomes launcher + thin wrapper around `GuidedTour`; runtime part lazy-loaded per EC-19, e.g. a new `components/estimator/SavedCostingsTourRuntime.tsx`)
- `lib/saved-costings-tour.ts`, `lib/i18n/saved-costings-tutorial.ts`
- `app/(dashboard)/owner/quotes/QuotesClient.tsx`: tour branches, count line during tour, demo guards (spec §I), proposed anchors, sample banner
- `components/estimator/CostingExportDialog.tsx`: wrap the two mode titles in `tx()`; context attribute if needed
- `app/free/costings/SavedFreeCostings.tsx`, `app/free/costings/page.tsx`, `app/(dashboard)/owner/quotes/page.tsx` (`embedded`, user props)
- `lib/i18n/locales/{en,gu,hi}.ts`: `tourControls.savedCostings.*` phrase entries from the spec's token table
- `app/globals.css`: replace the costing-dialog width rule with DR-15's reserved column for `[data-costing-tour-dialog="true"]`
- `lib/tours/tour-registry.ts`: `saved-costings` `contentVersion: 'v2'`
- Tests above (deliberate updates) and new tests below; `__tests__/tour-data-safety-contract.test.ts` (append files)
- `scratch/tour-harness/**`, `docs/guided-tours/harness/**` (new scenarios)

## Protected surface

- Library behavior outside the tour: search, filters, favourites, archive, compare, export, restore flows, detail loading.
- Demo-costing existence rules (D-18) except the guards; demo `Export` stays.
- `SavedQualityLibraryView` rendering outside the tour; the `tutorialPreview` safety in `CostingExportDialog` (print/PDF/share return early).
- Free route auth (`freeContext`), owner route auth.

## Required implementation

1. Step definitions as `TourStepSpec[]` for paid (Lite; Base adds `production`), Free and Compare, with ids, anchors, contexts and kinds exactly as spec §E. Keep `costingTourSurface` (update for the renamed/new ids) as the single derivation of dialogs/samples from `tourStep`.
2. Copy exactly as spec §F.1 in all three languages; tokens via `formatTourText` with the §F.2 resolvers; `{cost}`, `{price}`, `{profit}`, `{costChange}` computed from `makeSavedCostingTourExamples()` results.
3. Replace the bespoke engine with `GuidedTour`; the launcher is `TourInvitation` (GT-02) plus the "Compare versions" `railButton`; keep the rail help disclosure (remove its dead entries, fix `organize` grammar).
4. Page state during the tour (spec §E/§G): sample library replaces the list; count line shows the sample count; filters are shadowed on Free (demo card always first and visible); DR-09 banner replaces the amber banner.
5. DR-15 for the library, export and comparison dialogs while `tourStep` is set.
6. Proposed anchors: `costings.first-card`, `costings.new` (header and rail), `costings.compare`, `free-costings.sample-export`, `free-costings.first-card`, `free-costings.new`.
7. Guards (DS-02): demo branch `onOpen`, `onStartFrom`, `onSaveAsNewQuality` show the sample toast; use `isSampleRecordId`.
8. Free persistence: pass `userId`, `orgId`, `userMetadata={{ tour_preferences }}` from `app/free/costings/page.tsx` through `SavedFreeCostings`.
9. `embedded` prop on `SavedFreeCostings`; `owner/quotes/page.tsx` passes it; embedded renders no rail/guide.
10. Handoff variants `existing` / `empty` / `unavailable` from `savedCostingTourEnding`.
11. Lazy-load the runtime and step copy (EC-19); keep the launcher and invitation copy static.

## Locked decisions

Everything in the page spec, plus D-03, D-04, D-05, D-18, DR-*, TC-*.

## Permitted local discretion

Component split inside the allowed files; how `costingTourSurface` maps new ids; test fixture layout; how the sample count line is computed while touring.

## Verification

- Tests (update deliberately, list each in the ledger):
  - `saved-costings-tour.test.ts`: step lists per plan and walkthrough; anchors; copy parity, native script, DR-27/DR-28 limits in English; every `{c:*}` token resolves in all three languages through `formatTourText`; `{cost}`/`{price}`/`{profit}` equal `makeSavedCostingTourExamples()[0].result` values; handoff variants.
  - Demo guards: source-contract that the demo branch handlers call the sample toast and never `handleRestore`.
  - Free page passes `userId`; `embedded` suppresses the rail.
  - Data-safety contract: add the new/changed Saved Costings tour files.
  - `guided-tour-fixes-and-demo-data.test.ts`: replace the old dialog-centering assertions with DR-15 assertions.
- Full suite, tsc, lint green.
- Harness scenarios: `quotes` (Base), `'quotes?tier=lite'` (Lite; `run-tour.mjs` passes the part after `?` as URL parameters and `main.tsx` already reads `tier`; quote it in the shell), `free-costings`, and a new `quotes-compare` added to `main.tsx` (launches "Compare versions"); run each at the four standard viewports and once with `REDUCED_MOTION=1`. Required: no panel/outline overlap on any step (fixes SC-1: step `versions` at 1440 had 55,460 px² before); every outline on screen; server calls = `recordTourEventAction` only; focus returns to the launcher on Exit and to the handoff anchor on Done; filter shadowing: set a search term in the harness page before launching (have `main.tsx` read a `search` parameter and run `'quotes?search=…'`) and confirm the sample is visible during the tour and the search term is back afterwards.
- Evidence bundle for G1 in the ledger: diff stat, test results, harness summary and screenshot list (one per step for `quotes` 1440×900 en and `free-costings` 390×844 gu).

## Definition of done

- [ ] All spec §E steps, §F copy, §G variants and §I notes implemented.
- [ ] SC-1..SC-9 addressed or explicitly routed (SC-6/SC-4 fixed here; none deferred).
- [ ] Tests, tsc, lint green; harness requirements met at all runs.
- [ ] G1 evidence bundle recorded; status set to **REVIEW_REQUIRED** (not PASSED).

## Failure and escalation conditions

- Repair locally: anchor placement, copy wiring, test updates that follow the spec.
- Escalate: placement cannot avoid covering a sample dialog at 1024×768 even with DR-15 (send screenshot + fixture); a resolver's live label differs from the spec's Gujarati/Hindi value in a way that would change another page's text; `embedded` breaks the retained-grant listing.

## Checkpoint

Set GT-03 to REVIEW_REQUIRED with the evidence bundle. Next task: **GT-04** (the gate). No feature work starts until GT-04 is PASSED.
