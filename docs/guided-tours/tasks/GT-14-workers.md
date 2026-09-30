# GT-14 — Workers tour

## Task ID and purpose

GT-14. Move the Workers tour to `GuidedTour` with the pay-path choice in the panel (`TourPanel` `extra` slot), 6 steps per path, localized samples, keyed editor labels and a live handoff to "Add worker".

## Dependencies and entry conditions

- GT-13 PASSED.

## Read first

1. Page spec [`pages/workers.md`](../pages/workers.md).
2. Source: `components/tours/WorkersTutorial.tsx`, `lib/workers-tour.ts`, `lib/i18n/workers-tutorial.ts`, `app/(dashboard)/owner/production/registers/WorkersRegister.tsx`, `components/workers/WorkerEditor.tsx`, `WorkerCard.tsx`.
3. Tests: `workers-tour.test.ts`, `workers-tour-preview.test.tsx`, `worker-register-refinement.test.ts`, `worker-pay-basis.test.tsx`, `guided-tour-left-rails.test.ts`.

## Allowed change surface

`WorkersRegister.tsx` (tour mount, path reset, localized samples, handoff anchors), `WorkerEditor.tsx` (label keys for the labels the preview shows), delete `components/tours/WorkersTutorial.tsx` when unused, `lib/workers-tour.ts`, `lib/i18n/workers-tutorial.ts`, locales, registry `workers` → `v2`, listed tests, contract test, harness.

Owner-approved addition (2026-09-28): `components/workers/WorkersPageHeader.tsx` may only put `data-tour-anchor="workers.add"` directly on the shared WorkerAddButton and key its Add worker label; `components/workers/WorkerCard.tsx` may only key View payroll. Use the existing approved §F copy and the same keys for live labels and tour tokens. Keep callbacks, hrefs, validation, form semantics and all business behavior unchanged. The actual WorkerEditor source path is `app/(dashboard)/owner/production/registers/WorkerEditor.tsx`; this is the existing editor named by the packet, not a new component.

## Protected surface

Worker create/update validation, pay-type lock, salary history, inactive rules, filters and URL sync.

## Required implementation

Per spec §D–§F; path buttons with `aria-pressed`; `tourPath` reset to piece on launch; merged `wks-changes`; examples (₹150, ₹9,000) checked against the pay functions (existing tests).

## Locked decisions

Page spec.

## Permitted local discretion

How the path state is held.

## Verification

- Tests: both paths' steps; copy parity/limits/script; localized sample names; examples; editor labels keyed.
- Full suite, tsc, lint green.
- Harness `workers` (piece) and `workers-salary` (clicks the salary path button) at four viewports + reduced motion (WK-3 fixed: no overlap at 1024/1280; Gujarati step 1 body fits without scrolling at 390×844 or the copy is shortened).

## Definition of done

- [ ] WK-1..WK-4 fixed. Tests/tsc/lint green; harness met; ledger updated.

## Failure and escalation conditions

Escalate if keying editor labels changes validation messages or form semantics.

## Checkpoint

GT-14 PASSED. Next: **GT-15**.
