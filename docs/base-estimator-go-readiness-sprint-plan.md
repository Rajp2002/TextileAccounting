# Base Estimator Go-Readiness Sprint Plan

## Pilot blocker sprint — 2026-07-24

### Objective and decision rule

Move the current Base release from **No-Go** to **Go for a controlled owner-led pilot**. A Go is issued only after every product-controlled P0/P1 below is fixed and the exact candidate passes the release gates. Deployment and human-only evidence are not represented as complete by local implementation.

### Sprint shape

This is a three-day release sprint with one stabilization day available if a gate fails.

| Order | Work item | Owner | Acceptance criteria | Pilot effect |
| --- | --- | --- | --- | --- |
| 1 | `BASE-PILOT-SEC-01` Export-audit RPC boundary | Engineering | `log_export_event` has a fixed `search_path`, is not executable by `public`, `anon`, or `authenticated`, remains callable by the server-side service role, and records the explicit authenticated actor. Migration and regression tests pass. | P0 blocker |
| 2 | `BASE-PILOT-DEP-01` Runtime dependency advisories | Engineering | `npm audit --omit=dev --audit-level=high` exits zero without a forced framework downgrade; lint, tests, typecheck, and build still pass. | P0 blocker |
| 3 | `BASE-PILOT-EXP-01` Verifiable downloads | Engineering + QA | PDF and organization-export downloads use one testable browser helper, retain a deterministic filename, delay URL revocation until after the browser consumes it, and show success/failure feedback. Customer-output privacy tests remain green. | P0 blocker |
| 4 | `BASE-PILOT-TSC-01` Independent type gate | Engineering | `npx tsc --noEmit` exits zero; the non-finite export fixture preserves the production `EstimatorV3Totals` contract. | P1 blocker |
| 5 | `BASE-PILOT-UX-01` Base standalone language | Product + Engineering | Applied saved-quality action says “Start From,” duplicate-name guidance uses the same language, landing copy says “saved costing history,” and referral copy describes annual billing accurately. | P1 blocker |
| 6 | `BASE-PILOT-QA-01` Candidate verification | QA | Focused tests, full lint/typecheck/test/build, runtime audit, migration validation, and a fresh Base browser smoke pass. Downloaded JSON and both rendered PDFs are physically inspected on the deployed candidate. | Go gate |

### Day-by-day execution

1. **Day 1 — close security and build blockers:** implement the RPC migration, dependency overrides/lockfile update, TypeScript correction, and focused security/dependency tests.
2. **Day 2 — close user-facing blockers:** consolidate browser downloads, add accessible completion feedback and download-unit tests, and align Base/referral/landing language.
3. **Day 3 — candidate validation:** run every local gate, apply the reviewed migration to the pilot environment, deploy the exact candidate, and run the prefixed Base owner journey including file inspection and cleanup.
4. **Stabilization day, only if needed:** fix failed gates, rerun the full set, and do not promote partial evidence.

### Go checklist

- No open product-controlled P0/P1 Base blocker.
- Runtime high-advisory audit exits zero; no `--force` downgrade is accepted.
- Lint, independent TypeScript, full Vitest, and optimized production build all exit zero.
- Local and target migration histories align after reviewed apply.
- A fresh Base owner can configure costs, calculate, save/reopen/version, update rates atomically, export internal/customer PDFs, and export readable organization JSON.
- The customer PDF contains no production cost, overhead, break-even, margin, or expected-profit data.
- No cross-tenant RPC call can forge an export audit row.
- Candidate commit/deployment, console state, artifacts, and zero-residue fixture cleanup are recorded.

### Explicit non-code closure dependencies

- Production deployment and migration apply require the normal reviewed release path; local source completion alone is `fixed_pending_runtime_proof`.
- The first pilot estimate must be reconciled by the factory owner against an independent costing sheet.
- The first deployed internal PDF, customer PDF, and organization JSON must be opened and inspected in a physical browser.
- Current-release Sentry attribution is captured when an authentic error occurs; QA must not manufacture a production incident.

Until the Go checklist is complete on the deployed candidate, the release status remains **No-Go**.

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

## Execution closeout — 2026-07-22

| Item | Result | Evidence / residual condition |
| --- | --- | --- |
| BE-GO-01 | Pass | Production Base tenant showed ₹26.50/m production cost consistently in the Estimator and Saved Costings, with the cost breakdown preserved. |
| BE-GO-02 | Code and local render pass; production download proof inconclusive | Export state/canvas/print fixes are deployed and the production dialog opened with the privacy modes intact. The in-app download observer timed out without a console error, so a physical-browser downloaded-file inspection remains required. |
| BE-GO-03 | Pass | Migration `20260721183000` is applied and aligned; revision identity is serialized and the deployed first snapshot displayed `v1` plus date. |
| BE-GO-04 | Pass | Application and database entitlement semantics are aligned and regression covered. |
| BE-GO-05 | Pass after deployed-pilot correction | Base route/action/RLS gates are deployed. A production run found pre-seeded ₹0/kg placeholders; commit `31cac88` promoted both saved-quality rates to ₹120/kg on final production deployment `dpl_5gKkpg8GgyXRDxCnSeUEUJ3igDyQ`. |
| BE-GO-06 | Pass | Migration `20260721203000` moves Rate Book, history, optional factory-default, and matching saved-quality writes into one tenant-scoped transaction. Production failure injection left zero rate rows and zero history delta; the success path committed all four surfaces together. |
| BE-GO-07 | Pass for repaired function | The reviewed migration fixed `lockdown_tenant`; five unrelated Premium/legacy function lint errors remain. |
| BE-GO-08 | Code pass; commercial lifecycle not rerun | Official Razorpay CDN loading is deployed and the rewriting proxy is retired. No real-money checkout was performed. Existing TEST lifecycle evidence remains the provider baseline. |
| BE-GO-09 | Pass | Client/server checks and forward `NOT VALID` database constraints reject invalid economics without rewriting legacy rows. |
| BE-GO-10 | Pass | Owner-only post-expiry export route is live; the production Base run completed the export preparation cycle without console errors. |
| BE-GO-11 | Partial | Billing debug logging was removed, but current-release production Sentry payload inspection was not available. |
| BE-GO-12 | Code/test pass | Saved Costings responsive wrapping and Base terminology are deployed; physical multi-device retest remains an operating check. |
| BE-GO-13 | Conditional | No high runtime advisory remains. Two unavoidable Next/PostCSS runtime moderates and dev-tool advisories are recorded; migration alignment and build pass, while current-release restore/rollback attribution was not repeated. |

Release outcome after the follow-up sprint: **Base factory pilot — Go**. Razorpay TEST mode is the approved pilot payment boundary; live provider activation is intentionally deferred until incorporation. Paid live commercial launch remains conditional on those business credentials and the operating checks in the readiness report.

## Pilot usability follow-up — 2026-07-22

| Requested change | Result | Verification |
| --- | --- | --- |
| Atomic rate updates | Pass | Production RPC rollback/commit proof on `BASEGO-1784707134907-67E9DE`; exact cleanup reconciled to zero. |
| Costing-only Base workflow | Pass | Base exposes Save Costing and Export Cost Sheet as the commercial actions; Party Order, Market Run, and applied-production panels remain Premium-only. |
| Factory-default onboarding | Pass | First-run wizard collected warping, sizing, processing, finishing, commission, transport, warp crimp, yarn waste, and overhead; persisted values reappeared in Settings. |
| Weft density | Pass | At 1600px the ten weft formula fields rendered as two rows of five. |
| Scenario testing | Pass | Scenario Analysis and custom target-price UI were removed; break-even remains available as a concise result. |

Implementation commit: `dfd49b3`. Production migration history is aligned through `20260721203000`.
