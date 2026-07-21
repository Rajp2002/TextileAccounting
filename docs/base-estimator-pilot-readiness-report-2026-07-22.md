# Base Estimator Pilot Readiness Report

Date: 2026-07-22 IST  
Scope: standalone Weavly Estimator/Base tier, evaluated as a weaving-factory owner using costing, saved qualities, yarn rates, customer output, subscription access, and data exit.

## Decision

| Release mode | Status | Meaning |
| --- | --- | --- |
| Controlled factory pilot | **Conditional Go** | Use one named factory, owner-led onboarding, no live payment dependency, daily support, and the controls below. |
| Unassisted/self-serve pilot | **No-Go** | Fresh signup/email-confirmation authentication was not proven without admin intervention. |
| Paid production | **No-Go** | Atomic rate propagation, physical production PDF proof, exact-release billing/observability, and operations evidence remain open. |

The costing core is materially safer and suitable for a tightly controlled owner pilot. It is not yet honest to call the standalone plan fully production-ready.

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

## Verification evidence

- Main commits: `6b62762` and `31cac88`.
- Final deployment: `dpl_5gKkpg8GgyXRDxCnSeUEUJ3igDyQ`, READY on `https://textile-accounting.vercel.app`.
- Migration: `20260721183000_base_estimator_go_readiness.sql`, applied to linked production; local/remote history aligned.
- Local gates: ESLint pass; TypeScript pass; 110 test files with 745 passed and one intentional skip; optimized Next 16.2.11 build pass with 45 static pages.
- Dependency audit: zero high runtime advisories; two moderate runtime advisories remain in Next's bundled PostCSS path with no non-breaking available fix. Remaining high findings are dev-tool dependency paths requiring breaking forced downgrades.
- Deployed Base run: `BASEGO-1784662022802-4412AD` on the canonical production application; final Rate Book showed ₹120/kg for warp and weft.
- Cleanup: the main fixture and failed-signup QA tenant both reconciled their organizations, profiles, subscriptions where applicable, and Auth users to zero.
- Database lint: repaired Base lockdown error; five unrelated legacy/Premium function errors remain documented.

## Conditions for the controlled pilot

1. Provision and confirm the pilot owner's account before the session; do not rely on self-serve signup yet.
2. Do not use live billing for access. Apply the approved pilot entitlement and reconcile it after the session.
3. Have the owner verify the first estimate against an independent factory costing sheet before using it commercially.
4. Inspect the first downloaded internal and customer PDFs in a physical browser; stop if blank or if customer output exposes internal economics.
5. Treat a rate update warning as requiring reconciliation; do not assume all saved qualities changed until the Rate Book and selected quality agree.
6. Export organization data after the session and verify the file is readable.
7. Keep exact `BASEGO-*` cleanup and zero-residue reconciliation as a release control.

## Smallest path to full Go

1. Move Rate Book propagation into one database transaction/RPC and inject failures to prove rollback.
2. Fix/prove self-serve signup and email-confirmation recovery in production.
3. Download, render, and privacy-inspect both PDF modes from the exact production release.
4. Run the approved Razorpay TEST lifecycle and redacted Sentry/release-attribution check on the exact release.
5. Complete exact QA cleanup and a current deployment/rollback or forward-fix operations check.

Until those items close, the correct status is **Conditional Go for a controlled Base factory pilot; No-Go for paid or unassisted production**.
