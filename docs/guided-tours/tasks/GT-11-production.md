# GT-11 — Production "Set up production" tour (Overview)

## Task ID and purpose

GT-11. Rebuild the Overview tour (7 steps) on `ReplicaGuidedTour`, add the yarn-stock prerequisite, drop the Daily Sheet and details content from it, and key the Overview labels the tour names.

## Dependencies and entry conditions

- GT-10 PASSED.

## Read first

1. Page spec [`pages/production.md`](../pages/production.md).
2. Plan D-10, EC-21, LR-03.
3. Source: `components/production/ProductionGuidedTour.tsx`, `ProductionTourPreview.tsx`, `components/tours/ProductionTutorial.tsx`, `lib/production-tour.ts`, `lib/i18n/production-tutorial.ts`, `BaseProductionClient.tsx` (rail 403-442), `BaseActiveQualities.tsx`, `BaseMachineBoard.tsx`.
4. Tests: `production-tour.test.ts`, `production-tour-preview.test.tsx`, `guided-tour-left-rails.test.ts`, `guided-tour-focus.test.ts`.

## Allowed change surface

`ProductionGuidedTour.tsx` (→ `ReplicaGuidedTour` on the Overview; on `/owner/production/daily-sheet` render `children` only, as today; remove the "Setup, history & corrections" button), `ProductionTourPreview.tsx` (overview surfaces and the two dialogs; **leave the Daily Sheet surfaces in place, unused, for GT-12 to move**), delete `components/tours/ProductionTutorial.tsx` when unused, `lib/production-tour.ts` (overview steps; keep daily step ids in the type until GT-12), `lib/i18n/production-tutorial.ts` (overview keys; daily keys stay until GT-12), `BaseProductionClient.tsx` / `BaseActiveQualities.tsx` / `BaseMachineBoard.tsx` (label keys for the §F tokens and the `production.activate` anchors only), locales `production.*`, registry `production` → `v2`, listed tests, contract test, harness.

## Protected surface

Activation, yarn gate, assign looms, operators, switch/deactivate, board filters; Daily Sheet (untouched in this task).

## Required implementation

Per spec §D–§F: seven steps, replica labels from live keys ("Machine Board", "Manage Operators for {loom}", "Cost"), no "Overview & Looms", copy, tokens, handoff.

## Locked decisions

Page spec; D-10.

## Permitted local discretion

Key names inside `production.*`; how unused daily surfaces are isolated until GT-12.

## Verification

- Tests: step list; no "Overview & Looms", "Loom Board", "Save machine production", "Production cost" in any language; `prereq` mentions yarn stock in all languages; tokens; replica pattern; live buttons use the new keys.
- Full suite, tsc, lint green.
- Harness `production` at four viewports + reduced motion (no overlap incl. 1024 step 8's old case; no rail paint at 1440; handoff on Activate Quality).

## Definition of done

- [ ] PD-1..PD-5 fixed; labels keyed; details track removed.
- [ ] Tests/tsc/lint green; harness met; ledger updated.

## Failure and escalation conditions

Escalate if keying "Manage Workers"/"Activate Quality" changes text in the Daily Sheet or Payroll views with a different meaning.

## Checkpoint

GT-11 PASSED. Next: **GT-12**.
