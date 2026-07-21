# Base Estimator Go-Readiness Sprint Plan

## Goal

Promote the standalone Base Estimator from the 2026-07-21 **No-Go** assessment to a factory-pilot **Go**, then to paid-production **Go**, without weakening tenant isolation or historical costing integrity.

## Release rules

- A factory-pilot Go requires every P0 owner-workflow and security defect below to be fixed, tested, deployed, and re-proven in a prefixed QA tenant.
- Paid-production Go additionally requires real target-environment Razorpay lifecycle proof, production observability attribution, dependency acceptance, and rollback/restore evidence.
- `code_verified` is not runtime `pass`. No release status is promoted from implementation intent alone.
- Production mutations are limited to reviewed forward migrations and exact prefixed QA data.

## Ordered work

### Sprint 1 — Financial truth and customer output

1. **BE-GO-01 — Cost semantics everywhere (P0)**
   - Display calculated production cost from the immutable recipe snapshot.
   - Label commission/transport-inclusive landed cost as commercial break-even/landed cost.
   - Make cards, history, sorting, movement, and comparison use the same definitions.
   - Add cross-screen invariant tests.

2. **BE-GO-02 — Customer/internal export reliability (P0)**
   - Render PDF content inside the A4 canvas.
   - Reset business/customer/date/notes/mode whenever the selected costing changes.
   - Preserve the customer privacy boundary.
   - Make print-window creation browser-safe and add visual/browser proof.

3. **BE-GO-03 — Immutable revision identity (P0)**
   - Assign one costing group and a monotonically increasing version to repeated saves of the same saved quality.
   - Backfill existing standalone snapshots deterministically without changing economics.
   - Show version plus date in comparison headings and accessible names.

### Sprint 2 — Entitlement and tenant safety

4. **BE-GO-04 — Canonical paid-through entitlement (P0)**
   - Align application and `org_has_subscription_tier` status/time semantics.
   - Include `current_start` in application evaluation.
   - Regression-test active, pending, paused, halted, cancelled, completed, failed, expired, future, trial, Base, and Premium cases.

5. **BE-GO-05 — Rate Book route/action/RLS boundary (P0)**
   - Add the Base route gate.
   - Require Base entitlement in every read and write action.
   - Require Base entitlement and unlocked organization in RLS.
   - Discover saved-quality yarn prices before zero-value defaults can mask them.

6. **BE-GO-06 — Atomic rate propagation (P1)**
   - Move rate, history, default-profile, and saved-quality propagation behind one database transaction/RPC.
   - Report conflicts explicitly and preserve optimistic concurrency.

7. **BE-GO-07 — Lockdown correctness (P0)**
   - Repair the incompatible worker/profile ID union in `lockdown_tenant`.
   - Re-lint linked database functions and prove locked-tenant writes fail closed.

### Sprint 3 — Billing, validation, privacy, and operations

8. **BE-GO-08 — Approved Razorpay loader and lifecycle (P0)**
   - Stop proxying or rewriting vendor checkout JavaScript.
   - Load the official Razorpay script directly with an explicit failure state.
   - Prove create, success, signature, webhook, replay, out-of-order, cancel, renew, fail, and expiry paths in the approved target/test environment.

9. **BE-GO-09 — Cost-profile validation (P1)**
   - Validate all numeric economics on client, server, and database boundaries.
   - Reject non-finite, negative, zero-output, invalid day/count, and unreasonable percentage values.

10. **BE-GO-10 — Export completeness and post-expiry access (P1)**
    - Fail the export if any requested dataset query fails.
    - Provide an owner-only export route reachable during the promised post-expiry window.

11. **BE-GO-11 — Credential/log redaction (P1)**
    - Ensure authentication arguments and sensitive values are never emitted to application, platform, or Sentry logs.
    - Add safe structured error logging and regression tests.

12. **BE-GO-12 — Responsive and terminology polish (P2)**
    - Fix the 768px Saved Costings control clipping.
    - Use “Saved Costings” and “customer quotation PDF” accurately for Base.
    - Re-test mobile, tablet, desktop, keyboard, and 200% zoom.

13. **BE-GO-13 — Dependency/database/recovery gates (P0/P1)**
    - Patch or formally accept every high runtime advisory with exploitability, owner, and deadline.
    - Resolve relevant linked database lint failures.
    - Prove release/Sentry attribution, migration alignment, rollback, and disposable restore.

## Required verification

1. Focused regression suite for every `BE-GO-*` item.
2. `npm run lint`, `npx tsc --noEmit`, full `npm test`, production `npm run build`, runtime and full dependency audits.
3. Supabase migration dry-run/list/lint, reviewed apply, and local/remote alignment.
4. Fresh prefixed Base owner: signup → billing gate → approved Base entitlement → factory cost setup → estimate → quality → rate update → two versions → comparison → internal PDF → customer PDF → export → logout.
5. Independent database reconciliation of production cost, commercial break-even, historical rate snapshots, versions, rate history, tenant scope, and cleanup.
6. Tablet/mobile/desktop screenshots, console check, rendered-PDF inspection, and production deployment/commit proof.

## Promotion checklist

- **Factory-pilot Go:** BE-GO-01 through BE-GO-07, BE-GO-09 through BE-GO-12 pass in production; no P0/P1 owner-flow failures remain.
- **Paid-production Go:** Factory-pilot Go plus BE-GO-08 and BE-GO-13 external lifecycle/operations proof.
- Any missing payment, restore, rollback, or Sentry proof keeps paid production at Conditional Go or No-Go even if the factory workflow passes.
