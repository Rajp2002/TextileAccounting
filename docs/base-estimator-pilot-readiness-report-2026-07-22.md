# Base Estimator Pilot Readiness Report

Date: 2026-07-22 IST  
Scope: standalone Weavly Estimator/Base tier, evaluated as a weaving-factory owner using costing, saved qualities, yarn rates, customer output, subscription access, and data exit.

## Decision

| Release mode | Status | Meaning |
| --- | --- | --- |
| Controlled factory pilot | **Go** | The Base costing workflow, first-run defaults, saved costings, and atomic rate propagation are ready for an owner-led pilot. |
| Self-serve pilot | **Go with first-user monitoring** | The product owner has successfully created multiple accounts. Keep the first external signup under observation because this release did not repeat email-provider delivery proof. |
| Live commercial launch | **Conditional Go** | Razorpay TEST mode is sufficient for the pilot. Live Razorpay activation waits for post-incorporation business details and is not a pilot blocker. |

The standalone estimator is ready for a real factory pilot. Its core financial writes now have a proven all-or-nothing boundary, and the Base interface is consistently framed as costing rather than production management.

## Owner workflow result

| Factory-owner activity | Result |
| --- | --- |
| Base authentication and Base-only navigation | Pass with provisioned QA owner |
| Configure direct factory overhead | Pass at ₹13.50/m |
| Enter warp/weft construction and calculate | Pass: 50D, 9,000 ends, 68 PPI, 150/152 cm, ₹120/kg, 1,000 m |
| Review financial result | Pass: production cost ₹26.50/m; commercial result shown separately |
| Save reusable quality | Pass |
| Save and reopen costing history | Pass: first snapshot shown as `v1` with date and ₹26.50/m |
| Rate Book access on Base | Pass |
| Atomic rate propagation | Pass: induced production failure left zero partial rows; success committed rate, history, default, and one saved quality together |
| First-run costing defaults | Pass: processing, finishing, commission, transport, warping, sizing, crimp, waste, and overhead persisted and reloaded |
| Costing-only product framing | Pass: no Base Party Order, Market Run, or applied-production action; Save Costing is primary |
| Weft input layout | Pass: ten inputs rendered as two rows of five at the 2XL breakpoint |
| Scenario testing | Removed as requested; break-even summary retained |
| Saved-quality rate discovery | Pass after production-found fix: both yarns promoted from ₹0 to ₹120/kg with saved-quality provenance |
| Customer/internal export dialog | Pass for mode/privacy UI; downloaded-file production inspection inconclusive |
| Organization data export | Pass for owner-only route and export preparation with no console error |
| New owner signup | Record created, but authentication was not proven without admin confirmation |

## Delivered remediation

- Correct production-cost semantics across Estimator, Saved Costings, history, sorting, and comparison.
- Immutable costing groups/versions with deterministic backfill and serialized next revisions.
- Base route, action, and RLS enforcement for Yarn Rate Book plus tenant-lock checks.
- Canonical subscription status/time evaluation shared by application and database policy.
- Official Razorpay checkout loader; the former script-rewriting proxy is retired with a tombstone.
- Server and database economics validation without destructive legacy rewrites.
- Complete/fail-closed organization export plus an owner-only post-expiry escape route.
- Responsive Saved Costings controls and clearer Base terminology.
- Production `lockdown_tenant` repair and execute restriction.
- Runtime dependency remediation: no high production advisory remains.
- Production-found zero-placeholder Yarn Rate Book reconciliation and an exact setup/cleanup fixture harness.
- Atomic `save_cost_rate_atomic` database boundary with advisory locking, tenant/Base/lockdown checks, transactional history/default/quality propagation, and rollback proof.
- First-run factory defaults for the main costing assumptions, with matching Settings controls for processing and finishing.
- Base-only Save Costing emphasis, production-language removal from Saved Costings, two-row weft layout, and Scenario Analysis removal.

## Verification evidence

- Main commits: `6b62762`, `31cac88`, and follow-up implementation `dfd49b3`.
- Final deployment: `dpl_5gKkpg8GgyXRDxCnSeUEUJ3igDyQ`, READY on `https://textile-accounting.vercel.app`.
- Migrations: `20260721183000_base_estimator_go_readiness.sql` and `20260721203000_atomic_base_rate_updates.sql`, applied to linked production; local/remote history aligned through `20260721203000`.
- Local gates: focused ESLint pass; TypeScript pass; 110 test files with 748 passed and one intentional skip; optimized Next 16.2.11 build pass with 45 static pages.
- Dependency audit: zero high runtime advisories; two moderate runtime advisories remain in Next's bundled PostCSS path with no non-breaking available fix. Remaining high findings are dev-tool dependency paths requiring breaking forced downgrades.
- Deployed Base run: `BASEGO-1784662022802-4412AD` on the canonical production application; final Rate Book showed ₹120/kg for warp and weft.
- Cleanup: the main fixture and failed-signup QA tenant both reconciled their organizations, profiles, subscriptions where applicable, and Auth users to zero.
- Database lint: repaired Base lockdown error; five unrelated legacy/Premium function errors remain documented.
- Follow-up browser run: isolated Base tenant `BASEGO-1784675775346-874401` completed first-run defaults, Base-only action/language inspection, Settings persistence, 1600px two-row weft proof, Scenario Analysis absence, and clean console; cleanup reconciled organization/profile/subscription/Auth to zero.
- Atomic production run: isolated tenant `BASEGO-1784707134907-67E9DE` proved rollback `{rateRows: 0, historyDelta: 0}` and commit `{rate: 321.25, historyRows: 1, profileDefault: 321.25, savedQualities: 1}`; cleanup reconciled organization/profile/subscription/Auth to zero.

## Conditions for the controlled pilot

1. Monitor the first external self-serve signup and confirmation email; retain the existing account-provisioning fallback for the pilot session.
2. Use Razorpay TEST mode or an approved pilot entitlement. Do not wait for live Razorpay business verification to begin the pilot.
3. Have the owner verify the first estimate against an independent factory costing sheet before using it commercially.
4. Inspect the first downloaded internal and customer PDFs in a physical browser; stop if blank or if customer output exposes internal economics.
5. Treat any failed rate update as a full rollback. There is no partial-success state; reconcile if the UI ever suggests otherwise.
6. Export organization data after the session and verify the file is readable.
7. Keep exact `BASEGO-*` cleanup and zero-residue reconciliation as a release control.

## Post-pilot production follow-ups

1. Activate live Razorpay only after incorporation details are available; retain the already-proven TEST lifecycle for pilot use.
2. Download, render, and privacy-inspect the first internal and customer PDFs in the pilot's physical browser.
3. Observe one external signup/email-confirmation cycle and retain redacted evidence.
4. Capture current-release Sentry/release attribution if an error occurs; do not manufacture a production failure.
5. Retire or repair the five unrelated Premium/legacy database lint findings before claiming a clean whole-database gate.

Current status: **Go for the Base factory pilot**. Live commercial billing remains intentionally conditional on incorporation and Razorpay production credentials.
