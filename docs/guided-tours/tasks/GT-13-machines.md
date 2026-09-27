# GT-13 — Machines tour

## Task ID and purpose

GT-13. Move the Machines tour to `GuidedTour` with the 6-step content, corrected copy and a live handoff to "Add machine".

## Dependencies and entry conditions

- GT-12 PASSED.

## Read first

1. Page spec [`pages/machines.md`](../pages/machines.md).
2. Source: `components/tours/MachinesTutorial.tsx`, `lib/machines-tour.ts`, `lib/i18n/machines-tutorial.ts`, `app/(dashboard)/owner/production/registers/MachinesRegister.tsx`, `components/machines/MachinesPageHeader.tsx`, `MachineCard.tsx`, `MachineEditor.tsx`.
3. Tests: `machines-tour.test.ts`, `machines-tour-preview.test.tsx`, `machines-register-tour-help.test.tsx`, `machine-register-refinement.test.ts`, `guided-tour-left-rails.test.ts`.

## Allowed change surface

`MachinesRegister.tsx` (tour mount, handoff anchors), `MachinesPageHeader.tsx` (anchor), delete `components/tours/MachinesTutorial.tsx` when unused, `lib/machines-tour.ts`, `lib/i18n/machines-tutorial.ts`, locales (tokens needing phrases), registry `machines` → `v2`, listed tests, contract test, harness.

## Protected surface

Machine add/edit/save, availability, readiness computation, filters and URL sync, editor dirty-check.

## Required implementation

Per spec §D–§F; keep the existing sample injection and guards; `label` merged into `details`; rail link label "1. Production".

## Locked decisions

Page spec.

## Permitted local discretion

Wrapper structure (a small `MachinesGuidedTour` is fine).

## Verification

- Tests: steps, anchors, copy parity/limits/script, no "Overview & Looms", tokens, guards unchanged.
- Full suite, tsc, lint green.
- Harness `machines` at four viewports + reduced motion (no overlap; handoff on Add machine).

## Definition of done

- [ ] MC-1..MC-3 fixed. Tests/tsc/lint green; harness met; ledger updated.

## Failure and escalation conditions

Escalate if the right-rail links (steps 4–5) cannot be made visible below 1280px and the TC-8 fallback would apply on every phone (decide whether to re-anchor to the in-card links).

## Checkpoint

GT-13 PASSED. Next: **GT-14**.
