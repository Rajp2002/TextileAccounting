# GT-12 — Daily Sheet "Record a shift" tour (new)

## Task ID and purpose

GT-12. Give the Daily Sheet its own guide slot and a 9-step replica tour, keyed labels, and a live handoff to the first reading, without touching device drafts.

## Dependencies and entry conditions

- GT-11 PASSED.
- **U-06 answered by the owner** (on QA: change the date or shift on the Daily Sheet; does the page stay on the Daily Sheet?). Record the answer. "Stays" → use `shift.body.works`; "jumps to Overview" → use `shift.body.today` and leave PI-04 escalated.

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
- Harness `daily-sheet` (empty and one-machine) at four viewports + reduced motion: guide slot visible at every width; no overlap; handoff on the first Metres input (one-machine) or Add worker (empty); a draft value typed before launching (via `PRE_CLICK` + typing hook, or a seeded localStorage draft) is unchanged after Exit.

## Definition of done

- [ ] DSH-1, DSH-2 fixed; DSH-3 handled per the U-06 answer.
- [ ] Tests/tsc/lint green; harness met; ledger updated with the U-06 answer.

## Failure and escalation conditions

Escalate if hiding the sheet content unmounts it (drafts would reload), or if the guide slot cannot appear below 1280px without a layout change to the sheet.

## Checkpoint

GT-12 PASSED. Next: **GT-13**.
