# GT-02 — Invitation, persistence and data-safety contracts

## Task ID and purpose

GT-02. Give every page's guide slot the intended lifecycle (guide card until the owner decides, then a compact launcher; "Not now"), stop tour events from refreshing pages, record completion with a content version, remove the halo, correct the shared invitation copy, and add the data-safety contract test that every later task extends.

## Dependencies and entry conditions

- GT-01 PASSED.

## Read first

1. Plan §7 (all), §6 (DS-01, DS-05, DS-06), §8 EC-01, EC-02, EC-12, EC-13, EC-14, §9.2, §9.3, D-07, D-08, D-14.
2. Source: `components/tours/TourInvitation.tsx`, `hooks/use-tour-invitation.ts`, `lib/tours/tour-preferences.ts`, `lib/tours/tour-registry.ts`, `lib/tours/tour-types.ts`, `lib/tours/session-coordinator.ts`, `app/actions/tour-preferences.ts`, `lib/i18n/tour-invitations.ts`, `app/globals.css` (`tour-halo-*`, ~1567-1600), `components/ui/rail.ts`.
3. Tests: `__tests__/tour-invitation-lifecycle.test.ts`, `tour-i18n-parity.test.ts`, `tour-preferences-and-actions.test.ts`, `tour-session-coordinator.test.ts`, `tour-no-autostart.test.ts`, `tour-quota-and-data-safety.test.ts`, `guided-tour-left-rails.test.ts`.
4. Each page spec's `guide.benefit` row (§F) and the Daily Sheet `guide.title`.

## Allowed change surface

- `components/tours/TourInvitation.tsx`, `hooks/use-tour-invitation.ts`
- `lib/tours/tour-preferences.ts`, `lib/tours/tour-registry.ts`, `lib/tours/tour-types.ts`
- `app/actions/tour-preferences.ts`
- `lib/i18n/tour-invitations.ts`
- Delete: `lib/tours/session-coordinator.ts`, `__tests__/tour-session-coordinator.test.ts`, the `tour-halo-*` CSS in `app/globals.css`
- `components/dispatches/DispatchGuidedTour.tsx`: only to delete its `guideCard={…}` prop (line ~30), the one remaining caller. The shared title `tourCommonCopy.guideTitle` renders the same text in all three languages ("Dispatch guide", "ડિસ્પેચ માર્ગદર્શિકા", "डिस्पैच मार्गदर्शिका"), so nothing visible changes.
- Tests listed in Read first (deliberate updates only), plus new `__tests__/tour-data-safety-contract.test.ts`

## Protected surface

- Page components and wrappers (they keep passing the same props; the new behavior comes from the shared component). The one exception is the `guideCard` removal in `DispatchGuidedTour.tsx` listed above.
- Legacy reads: `cost_estimate_tutorial_dismissed`, `ratebook_tutorial_dismissed` and the two legacy localStorage keys must still produce `replay`.
- `recordTourEventAction`'s auth (`requireRole(['owner'], { allowFreeAccount: true })`) and the rule that it writes only `user_metadata`.
- `__tests__/tour-no-autostart.test.ts` must pass unchanged.

## Required implementation

1. **Types and registry (EC-01, EC-02):** add `'daily-sheet'` to `TourId`; add `completedVersion?: string`; remove `TourEmphasis`/`emphasis`; registry entry for `daily-sheet` (`allowedPlans: ['base']`, `allowedRoles: ['owner']`, `contentVersion: 'v1'`, `copyKeys` following the pattern). Other entries keep `contentVersion: 'v1'` until their feature task sets `'v2'`.
2. **`getTourPresentation` (EC-14, §7.1):** `'invite'` unless any of `dismissed`, `firstStarted`, `completed` is true in account metadata, local mirror or legacy flags; then `'replay'`. `firstShown` no longer affects it. Keep `getTourStatus` only if other code still uses it; otherwise replace its callers.
3. **Events (§7.2):** `persistTourCompleted(tourId, userId, contentVersion)` writes `completed` and `completedVersion` (local mirror first, then the action). The action accepts an optional `contentVersion` string (max 16 chars, `/^v\d+$/`) and stores it on `completed`.
4. **No refresh (DS-05):** delete every `revalidatePath` import and call from `app/actions/tour-preferences.ts` (and nowhere else in this task).
5. **`TourInvitation` (EC-12):** with `align="full"`: `invite` → guide card (existing layout) with title `tourCommonCopy.guideTitle` (name from `tourNames`), benefit, "Start guide" (`data-tour-control="take-tour"`) and "Not now" (`Button variant="ghost"`, `data-tour-control="dismiss"`, min height 44px); `replay` → compact launcher (`railButton`, Compass icon, label "{name} guide", `aria-label` `launcherAria`, `data-tour-control="quiet-tour"`). "Not now" records `dismissed`, switches to `replay` immediately and focuses the compact launcher. Starting records `started`. Remove the halo code path, `isHaloActive`, and the `guideCard` prop (and its one caller's use of it in `DispatchGuidedTour.tsx`). The `align="start"` invitation variant stays for any caller that still uses it until GT-06 removes the last one.
6. **Invitation copy:** in `lib/i18n/tour-invitations.ts` set every `benefits[tourId]` to the page specs' `guide.benefit` (all three languages), add `daily-sheet` name/benefit, set `tourNames['saved-costings']` to the glossary term (§9.2) in gu/hi, add nothing else. This fixes the Yarn Stock invitation (YS-1/SD-01) now.
7. **Data-safety contract test (DS-01, DS-05, DS-06):** new `__tests__/tour-data-safety-contract.test.ts` with an explicit list of tour files (start with the shared ones: `components/tours/GuidedTour.tsx`, `TourPanel.tsx`, `TourSpotlight.tsx`, `TourInvitation.tsx`, `hooks/use-guided-tour.ts`, `hooks/use-tour-invitation.ts`, `lib/tours/*.ts`). For each: no import from any `app/**/actions.ts` or `app/**/*-actions.ts` except `@/app/actions/tour-preferences`; no `fetch(`; no occurrence of `freeMeter`, `/api/free/calculate`, `complete_free_saved_costing`, `saveEstimatorQuoteV3`, `saveBaseDailyProductionBatch`, `mutateYarnStock`, `mutate_delivery_challan`, `settleBaseWorkerPayroll`. Plus: `app/actions/tour-preferences.ts` contains no `revalidatePath`. Each feature task appends its files.

## Locked decisions

D-07, D-08, D-14, §7 as written. "Not now" wording from §9.3. No re-invitation when content changes.

## Permitted local discretion

Hook internals; how the compact launcher receives focus after "Not now" (a ref is fine); test structure.

## Verification

- Updated tests (deliberate, listed in the ledger): lifecycle (new states, "Not now", no halo, 44px targets), i18n parity (new keys, benefits, no `emphasis` assertions), preferences (presentation rules incl. legacy, `completedVersion`, no `revalidatePath`), left rails (still `align="full"`).
- New contract test passes.
- Full suite, tsc, lint green.
- Harness at 1440×900 en and 390×844 gu for `dispatch`, `quotes` and `estimator`: fresh load shows the guide card with "Not now"; pressing "Not now" shows the compact launcher with focus on it; reload (keep localStorage: run without `fresh=1`) still shows the compact launcher; starting then exiting a tour shows the compact launcher; server calls are only `recordTourEventAction`.

## Definition of done

- [ ] §7 states and events behave as specified on every page (harness spot check on three pages).
- [ ] No `revalidatePath` in tour preference code; contract test in place.
- [ ] Halo, session coordinator and their CSS/tests removed.
- [ ] Invitation copy updated for every tour in three languages.
- [ ] Full suite, tsc, lint green; ledger updated with the deliberate test changes.

## Failure and escalation conditions

- Repair locally: test fixture updates that follow directly from the specified behavior.
- Escalate: any page breaks because it relied on `revalidatePath` after a tour event (describe the page and what went stale); a test asserts behavior that contradicts §7 in a way that is not about tours.

## Checkpoint

GT-02 PASSED with evidence. Next eligible task: **GT-03**.
