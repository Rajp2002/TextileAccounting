# Sprint 8 — Costing Trust Foundation

Date: August 2, 2026
Priority: P0
Status: Release-ready

## Objective

Make every price-changing assumption explicit before Rajesh saves or quotes, while preserving Base standalone costing semantics.

## Delivered contract

- Quick and Detailed Costing share one canonical `CostingResultSnapshot`.
- Direct overhead requires an explicit positive ₹/m input; no example or monthly rate is silently auto-filled.
- Monthly overhead is calculated from saved monthly expenses divided by actual monthly output.
- The assumptions summary shows overhead source, active rate, reference rate, per-metre impact, quote impact, commission, transport, margin, and quantity.
- Full Suite Quick Costing includes Party / Customer.
- Quantity is explicit: it affects order totals, not the per-metre price. Base standalone costings may omit it; quotations and party orders may not.
- Server actions persist the canonical result snapshot and derive the adjacent scalar price fields from that same result.

## Verification

- `npm test`
- `npx tsc --noEmit`
- Targeted estimator ESLint checks
- `git diff --check`

## Database note

Sprint 8 introduces no schema change or new migration. Production already contains the repository migration history through `20260801174038_sprint1_save_trust_v2`; no migration is applicable to this release.
