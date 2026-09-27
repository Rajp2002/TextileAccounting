# GT-12 — Daily Sheet "Record a shift" tour (new)

## Task ID and purpose

GT-12. Give the Daily Sheet its own guide slot and a 9-step replica tour, keyed labels, and a live handoff to the first reading, without touching device drafts.

## Dependencies and entry conditions

- GT-11 PASSED.
- U-06 resolved (owner, 2026-09-27): changing the date or shift keeps the owner on the Daily Sheet for the selected date; only today and past dates can be chosen; the purpose is correcting past entries. The tour teaches this (`shift.body`, `shift.detail`).

## Read first

1. Page spec [`pages/daily-sheet.md`](../pages/daily-sheet.md).
2. Plan D-10, DR-24, EC-21, DS-07.
3. Source: `BaseDailyProductionSheet.tsx` (right rail 655-750, sheet 750-900, dialogs 893-1100), `BaseProductionClient.tsx` (how the sheet is mounted, 151, 409), `components/production/ProductionTourPreview.tsx` (daily surfaces), `lib/base-production-draft.ts`, `app/globals.css` (`production-daily-sheet-workspace`).
4. Tests referencing the sheet's literals: `grep -l "Save shift\|Print sheet\|Worker review\|Edit saved log" __tests__/*`.

## Allowed change surface

New: `components/production/DailySheetGuidedTour.tsx`, `components/production/DailySheetTourPreview.tsx` (moved daily surfaces), `lib/daily-sheet-tour.ts`, `lib/i18n/daily-sheet-tutorial.ts`, tests `__tests__/daily-sheet-tour.test.ts`, `__tests__/daily-sheet-tour-preview.test.tsx`. Modified: `BaseDailyProductionSheet.tsx` (wrapper, guide slot, two anchors, label keys), `ProductionTourPreview.tsx` and `lib/production-tour.ts` / `lib/i18n/production-tutorial.ts` (remove the daily surfaces/ids/keys now moved), locales `dailySheet.*`, registry `daily-sheet` → `v2`, tests that assert the old literals (deliberate), contract test, harness (`daily-sheet` scenario rendering `BaseProductionClient` on the daily-sheet path with empty and one-machine data).

## Protected surface

Draft storage and restore, save/incomplete/correction/conflict flows, keyboard row navigation, print popup, settled-row locking.

## Required implementation

Per spec §D–§G: wrapper built on `ReplicaGuidedTour` (sheet content kept mounted and hidden), guide slot placement rule, nine steps, copy (with the U-06 variant), tokens and keys, handoff variants.

## Locked decisions

Page spec; D-10; the tour never writes `weavly:base-production:*`.

## Permitted local discretion

Exact placement of the guide slot within the right-rail pattern, as long as one instance is visible at 390, 1024, 1280 and 1440px.

## Verification

- Tests: steps; copy parity/limits/script; tokens; replica pattern (disabled, no handlers, no localStorage); source-contract that the tour files never reference `saveBaseDailyProductionBatch` or the draft key; the live buttons use the new keys.
- Full suite, tsc, lint green.
- PI-04 check (the harness cannot test it: its router stub ignores `replaceState`): ask the owner to try it on QA, or run `npm run dev` only with the owner's explicit permission for this check. Change the date to yesterday and back, and the shift to night: the page must stay on the Daily Sheet showing the chosen date and shift. If it switches to Overview, escalate PI-04 as a product fix; do not change the tour copy.
- Harness `daily-sheet` (empty and one-machine) at four viewports + reduced motion: guide slot visible at every width; no overlap; handoff on the first Metres input (one-machine) or Add worker (empty); a draft value typed before launching (via `PRE_CLICK` + typing hook, or a seeded localStorage draft) is unchanged after Exit.

## Definition of done

- [ ] DSH-1, DSH-2 fixed; DSH-3 (PI-04) checked as described under Verification, and escalated if the page leaves the Daily Sheet.
- [ ] Tests/tsc/lint green; harness met; ledger updated.

## Failure and escalation conditions

Escalate if hiding the sheet content unmounts it (drafts would reload), or if the guide slot cannot appear below 1280px without a layout change to the sheet.

## Checkpoint

GT-12 PASSED. Next: **GT-13**.
