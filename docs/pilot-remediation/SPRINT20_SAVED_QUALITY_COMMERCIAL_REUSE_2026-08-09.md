# Sprint 20 — Saved-quality commercial reuse

Date: 2026-08-09
Scope: Weavly Estimator / paid Base Plan owner workflow

## Sprint goal

Make reopening a Saved Quality deterministic for the Base owner’s repeat-costing job. A July re-costing should use the current Rate Book yarn rows while preserving the saved costing context unless the owner intentionally edits it.

## Product decision

Implement **full costing reuse** for Base Saved Qualities:

- current Saved Quality recipe and current yarn-rate rows are applied;
- the latest linked costing snapshot restores overhead inputs and method, commercial values, quantity, loom-capacity inputs, and optional-section on/off states;
- historical costing snapshots remain immutable;
- Full Suite keeps its existing quality-versus-quotation behavior.

This contract is the best fit for Base because the product’s highest-value job is explaining a repeat costing as “the same May costing with the July yarn-rate change.” Recipe-only reuse would force the owner to re-enter the very assumptions needed to make that comparison trustworthy.

## Work plan and acceptance criteria

| Workstream | Acceptance criteria | Status |
| --- | --- | --- |
| Persisted reuse source | Base Saved Quality loading exposes the latest linked costing inputs without mutating historical records | Done |
| Reopen behavior | Current recipe/rates combine with saved overhead, commission, transport, margin, quantity, and section state | Done |
| Hidden-state safety | A reopened costing does not leave a non-zero commission/transport value hidden behind an off section when the saved costing had the section enabled | Done by state restoration; manual mismatches remain explicitly warned |
| Save review | Save-quality, version, and unusual-value reviews list every included costing assumption and the full-reuse contract | Done |
| Regression coverage | Tests cover commercial/overhead restoration, explicit null quantity, section flags, and UI/server wiring | Done |
| Production proof | Deployed Base QA confirms rate-change reuse and review summary in the live app | Pending release authorization/deployment |

## Verification scenarios

1. Save Quality A with non-zero commission, transport, quantity, direct/monthly overhead, and selected optional sections.
2. Change a yarn rate in the Rate Book; confirm the Saved Quality’s current yarn row changes while the original costing snapshot stays unchanged.
3. Reopen Quality A; confirm the current yarn rate is applied and the saved costing context is restored visibly.
4. Save a new costing version; confirm the review lists overhead, commission, transport, margin, quantity, and on/off sections before save.
5. Reopen a legacy quality with no linked snapshot; confirm the UI states that current factory defaults are being used instead of implying historical commercial reuse.

## Out of scope

- changing estimator formulas;
- rewriting historical snapshots;
- adding CRM/customer master data;
- changing Full Suite quotation semantics;
- production deployment without release authorization.
