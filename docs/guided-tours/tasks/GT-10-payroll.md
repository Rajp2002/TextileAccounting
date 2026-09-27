# GT-10 — Payroll tour and walkthrough

## Task ID and purpose

GT-10. Rebuild Payroll's core tour (8 steps) and the optional "Advances, records and corrections" walkthrough (6 steps) on `ReplicaGuidedTour`; remove the retired `full` variant; key the payroll labels the tour names; localize the "How pay is calculated" rail dialog.

## Dependencies and entry conditions

- GT-09 PASSED.

## Read first

1. Page spec [`pages/payroll.md`](../pages/payroll.md).
2. Plan D-17, LR-03, EC-21; PI-01, PI-02, PI-03 (what the tour must not teach).
3. Source: `components/payroll/PayrollGuidedTour.tsx`, `PayrollTourPreview.tsx`, `components/tours/PayrollTutorial.tsx`, `lib/payroll-tour.ts`, `lib/i18n/payroll-tutorial.ts`, `app/(dashboard)/owner/production/BaseProductionClient.tsx` (payroll view 409-490, 675-792), `BasePayrollSettlementWorkspace.tsx`, `BasePayrollRecords.tsx`.
4. Tests: `payroll-tour.test.ts`, `payroll-tour-preview.test.tsx`, `guided-tour-left-rails.test.ts`, `guided-tour-focus.test.ts`.

## Allowed change surface

`PayrollGuidedTour.tsx` (→ `ReplicaGuidedTour` + walkthrough launcher + localized "How pay is calculated"), `PayrollTourPreview.tsx`; delete `components/tours/PayrollTutorial.tsx` when unused; `lib/payroll-tour.ts` (remove `full`), `lib/i18n/payroll-tutorial.ts`; in `BaseProductionClient.tsx`, `BasePayrollSettlementWorkspace.tsx`, `BasePayrollRecords.tsx`: only the label substitutions for the spec's token table (and the sibling labels on the same buttons) and the two `data-tour-anchor` attributes; locales `payroll.*`; registry `payroll` → `v2`; listed tests; contract test; harness.

## Protected surface

All payroll calculations, settlement, completion, reversal, reopen, advances, deductions, exports, readiness logic; PI-01/PI-02/PI-03 behavior (not fixed here).

## Required implementation

Per spec §D–§F: steps, sample, copy, tokens, handoffs; walkthrough records nothing; dates in the replica through the page's date formatter; replica labels from the same keys as the live controls.

## Locked decisions

Page spec; D-17; no payment-date or period-scoped teaching (PI-01/02).

## Permitted local discretion

Key names inside the `payroll.*` namespace.

## Verification

- Tests: core and walkthrough step lists; no `full` exports remain; copy parity/limits/script; no "Full" in any language; recovery example equals `calculateAdvanceRecovery`; tokens resolve; replica pattern; label keys used by the live buttons (source-contract).
- Full suite, tsc, lint green.
- Harness `payroll` at four viewports + reduced motion, and a `payroll-extra` scenario launching the walkthrough. Required: PR-4 fixed (no overlap at 1024 steps 1/3/4; no rail paint at 1440); handoffs focus the live buttons.

## Definition of done

- [ ] PR-1..PR-5 fixed; `full` removed; labels keyed.
- [ ] Tests/tsc/lint green; harness met; ledger updated.

## Failure and escalation conditions

Escalate if keying a label would change text in another view that shares the component with a different meaning.

## Checkpoint

GT-10 PASSED. Next: **GT-11**.
