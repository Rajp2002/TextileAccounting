# Weavly Lite + Base QA evidence

Updated: August 30, 2026

## Automated evidence

| Area | Evidence | Result |
| --- | --- | --- |
| Lite regression | `npm test -- --reporter=dot` | 169 test files passed; 1,044 tests passed; 1 skipped |
| Base regression | `__tests__/base-production-core.test.ts`, `__tests__/base-estimator-go-readiness.test.ts` | Production-core calculations, job progress, machine allocations, worker pay, advances, settlement periods, and costing boundaries passed |
| Entitlement isolation | `__tests__/estimator-only-experience.test.ts`, `__tests__/p1-billing-gates.test.ts`, `__tests__/estimator-first-billing-rollout.test.ts` | Lite costing surfaces remain available; production and legacy operational surfaces use explicit capability boundaries |
| Backend enforcement | `supabase/migrations/20260831150000_lite_base_plan_restructure.sql` plus the Base Production Core migrations | `base_production` is enforced by server actions, private/public RLS predicates, and Base Production Core RPC guards |
| Billing and upgrade safety | `__tests__/p1-billing-orders.test.ts`, `__tests__/sprint4-billing-trust.test.ts`, `__tests__/premium-base-experience-switch.test.ts` | GST-inclusive Lite/Base pricing, server-owned order context, idempotent activation, renewal history, and legacy compatibility passed |
| Expiry edge case | `__tests__/base-estimator-go-readiness.test.ts` | A paid Base period that ends resolves to Lite costing access while production remains unavailable |
| Static/type/build validation | `npx tsc --noEmit`, `git diff --check`, `npm run build` | Passed; production build completed successfully |

## Boundary scenarios covered in code

- A Lite account can use the full estimator, saved costings, qualities, Rate Book,
  costing tools, hosted account data, and exports.
- A Base account inherits those capabilities and gains the current Base Production
  Core workflow.
- A Lite account can see a focused “Take your costing into production” upgrade
  path, but cannot create or mutate Base production records.
- Direct production URLs and production server actions are checked against the
  centralized capability map; the database repeats the check through RLS and RPC
  guards.
- A Lite-to-Base upgrade uses the existing organization and records. The payment
  activation changes entitlement and does not copy or recreate costing, quality,
  Rate Book, or account rows.
- Base expiry retains historical production records and falls back to Lite
  costing access. A later Base renewal restores the production capability.
- Failed, cancelled, paused, duplicate, and out-of-order billing events remain
  subject to the existing payment reconciliation and idempotency checks.

## Deployment-only checks still required

The local Supabase database was not running in this workspace, so
`SUPABASE_TELEMETRY_DISABLED=1 supabase db lint --local` could not connect to
Postgres. Before applying the migration to a shared or production project:

1. Run the migration against a disposable Supabase branch/database and run
   `supabase db lint` there.
2. Review the migration's existing-account classification query against the
   production account list. Accounts with an explicit production promise but no
   `product_experience = 'base'` marker or Base Production Core row need a manual
   entitlement decision before rollout.
3. Verify Razorpay live/test configuration, canonical catalog IDs, webhook
   signatures, and one Lite and one Base end-to-end payment in the selected
   environment.
4. Run the authenticated browser matrix: Lite costing regression, Base
   costing-plus-production regression, direct production URL/API rejection for
   Lite, upgrade data preservation, expiry downgrade, and renewal restoration.

No live database migration or live Razorpay payment was executed by this local
repository change.
