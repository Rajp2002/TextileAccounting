# Sprint 11 — Base Documents, Export, and Billing Trust

Date: 2026-08-02 IST
Status: Production verified

## Objective

Make Base outputs reliable and commercially understandable while keeping internal economics private and distinguishing payment receipts from GST tax invoices.

## Delivered contract

- Internal Cost Sheet and Customer Quotation PDF/print artifacts use the same normalized costing snapshot and calculation result.
- Customer quotations expose organization/customer details, fabric, quantity, quoted price, validity, and notes only. They do not expose internal cost, margin, overhead, expected profit, or other internal economics.
- Customer quotations are explicitly document artifacts only and are not GST tax invoices. GST wording points to the separate final tax invoice when applicable.
- Export options validate and normalize organization, customer, quantity, validity, and notes. PDF, print, share, and organization JSON downloads use deterministic filenames.
- Browser download failures are visible as failures. A generated server export is not reported as a successful browser download when the local save operation fails.
- Organization JSON export covers the complete tenant-scoped dataset catalog, includes counts and export history, redacts nested sensitive fields, and records generated or failed export runs.
- Base billing explains activation, entitlement, renewal, expiry, payment receipts, and GST invoices in Base terms.
- The Vercel build gate keeps live Supabase integration checks opt-in (`RUN_LIVE_SUPABASE_TESTS=1`), so production builds do not depend on an unauthenticated network query. The live check remains available for deliberate QA runs.

## Database and migration decision

Sprint 11 adds no schema migration. The implementation reuses the existing `organization_export_runs`, billing, subscription, and invoice/receipt tables. The linked production Supabase migration history is aligned with the local repository through `20260802121858_sprint10_saved_costing_library_state.sql`; no migration should be applied for this sprint.

## Verification completed before release

- `npm test` — 133 test files passed; 859 tests passed; 1 skipped.
- `npx tsc --noEmit` — passed.
- Targeted ESLint for changed files — passed.
- `npm run build` — passed locally.
- Vercel `58.4.4` production prebuilt build — passed; 133 test files, 859 tests passed, 1 skipped, TypeScript, static generation, and serverless tracing completed successfully.
- `git diff --check` — passed.

## Release evidence

| Check | Evidence |
| --- | --- |
| Linked Supabase migration history | Local and linked remote history match through `20260802121858_sprint10_saved_costing_library_state.sql`; Sprint 11 added no migration and no schema push was required. |
| Merged `main` commit | Sprint 11 implementation merge `10d92fd`; Vercel build-gate fix merge `b9ec679` (final production source). |
| Production deployment | Vercel deployment `dpl_8pp2zc1CC5fKPN1KLboQNd6RLGav` is `READY` and aliased to [textile-accounting.vercel.app](https://textile-accounting.vercel.app). |
| Post-deploy smoke check | Production `/` and `/login` returned HTTP 200; deployment inspection reported Ready; the recent Vercel log scan returned one informational `GET /` entry and no errors. |

## Acceptance checks

1. Generate an internal cost sheet and customer quotation from the same costing snapshot.
2. Inspect the customer PDF/print artifact and confirm there is no internal cost, margin, overhead, or expected-profit leakage.
3. Confirm deterministic filenames and visible success/failure feedback for PDF and organization JSON downloads.
4. Confirm organization export history records generated and failed runs and the JSON contains the complete organization-scoped catalog.
5. Confirm Base billing copy distinguishes active, expired, renewal, payment receipt, and GST tax invoice states.
