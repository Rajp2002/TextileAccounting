# Sprint 17 — Costing, comparison, and quotation workflow hardening

**Date:** 2026-08-03 IST
**Scope:** Cost assumptions, comparison, saving semantics, quotation ledger state, historical truth, and customer output boundaries

## Disposition

The Sprint 17 code controls and automated regression evidence are complete.
An authenticated runtime retest was attempted against the local app, but the
configured QA sign-in returned invalid credentials on both attempts. This pack
does not claim an authenticated runtime pass or change the pilot readiness
disposition.

## Implemented controls

- **17.1 — Price movement:** Comparison shows old and new values side by side,
  uses `New − Old` for numeric deltas, and gives a plain-language suggested
  price sentence. The comparison includes rate, waste, width, margin,
  commission, and transport inputs.
- **17.2 — Waste source of truth:** The estimator distinguishes default weft
  waste, applied weft waste, and effective waste after construction
  adjustments. The formula input is labelled; row overrides appear beside the
  row and in the cost breakdown. An explicit `0%` remains visible.
- **17.3 — Save semantics:** Recipe saving, costing-snapshot saving, and
  deliberate new-version creation are separate actions. Save feedback includes
  the version, timestamp, rate basis, and whether the result is a recipe or a
  snapshot, with the changed-input summary retained for comparison.
- **17.4 — Quotation ledger:** Quotations retain a visible identifier,
  customer, created date, validity, amount/price basis, and state. Marking a
  quotation sent preserves the first sent timestamp, reports the next allowed
  action, and survives reload/reopen.
- **17.5 — Historical truth:** Saved costing and quotation snapshots use their
  persisted canonical data rather than current Rate Book/default values. Rate
  updates affect new estimates only; archive/restore and reopening preserve
  the saved record.
- **17.6 — Customer boundary:** Internal cost sheets can show overhead, margin,
  and assumptions, while trader-facing quotation output omits internal
  economics and keeps the boundary labelled consistently in the UI and PDF.

## Verification

The implementation passed the repository verification gates on 2026-08-03:

- `npm test`: 138 test files passed; 882 tests passed and 1 test was skipped.
- `npx vitest run __tests__/sprint17-costing-quotation-hardening.test.ts`:
  7 tests passed.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed, including its pre-build test run, production
  compilation, static-page generation, and route finalization.
- `git diff --check`: passed before this documentation update and is rerun
  for the final commit.

The regression suite covers normal costing, rate-change comparison,
construction-adjusted and explicit-zero waste, commission edge cases,
duplicate-looking saves, archive/restore boundaries, quotation reopening, and
the internal/customer print boundary.

## Runtime evidence still required

1. Repeat the costing and quotation walkthrough with valid isolated QA owner
   credentials and the target database migration applied.
2. Confirm the saved snapshot, quotation state transition, sent timestamp,
   history after reload, and rate-basis explanation in an authenticated browser
   session.
3. Capture redacted evidence for the normal, rate-change, and edge-case
   waste/commission scenarios and reconcile each displayed amount to an
   independent calculation.

Until those checks are recorded, this is **code complete / authenticated
runtime evidence pending**, not a blanket pilot-readiness approval.
