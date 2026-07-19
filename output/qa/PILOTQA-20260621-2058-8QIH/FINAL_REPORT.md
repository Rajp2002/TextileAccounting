# PILOTQA-20260621-2058-8QIH Final Pre-Pilot Report

- Production URL: https://textile-accounting.vercel.app
- Guide: `/Users/rajpatel/Projects/textile Saas/docs/PRE_PILOT_COMPREHENSIVE_TESTING_GUIDE.md`
- Matrix: `TEST_MATRIX.md`
- Results ledger: `results.json`
- Final rendered count: 377 / 377 classified
- Current status counts: 368 pass, 0 fail, 6 blocked, 3 not_applicable, 0 code_verified, 0 not_run

## Current superseding checkpoint — 2026-07-14

The canonical `results.json`, `TEST_MATRIX.md`, and `docs/pilot-remediation/REMAINING_GATE_REPORT.md` supersede the original closeout narrative below. Current counts are **368 pass, 0 fail, 6 blocked, and 3 not applicable** across all 377 rows. Historical failure/blocker language below is retained only as provenance and must not be read as current status.

The limited-pilot verdict remains **No-Go pending two genuine gates only**: `TECH-011` recovery governance closure and `GOLDEN-A-03` independent real-fabric truth-sheet reconciliation. `UX-012` passed by explicit Founder acceptance and a readiness-policy decision that moves factory-operator/Gujarati review into the mandatory first-pilot-run controls. `OFF-001`, `SEC-011`, `SEC-018`, and `SIGNOFF-04` retain precise non-gating evidence debt. `WA-008` and `WA-010` are named post-pilot requirements and receive no PASS credit.

Focused preparation update: `TECH-011` now has a Free-plan-compatible daily encrypted Supabase CLI workflow, private 14-day off-Supabase artifact destination, fail-closed Storage guard, and ephemeral restore drill. Required GitHub settings are absent, so no real scheduled artifact or restore result exists. `UX-012` now has a complete 42-concept inventory, proposed glossary and dated supervisor decision/re-approval pack; no supervisor approval exists and no product wording changed. Both rows and the 367/0/7/3 counts remain unchanged. `GOLDEN-A-03` was intentionally left untouched.

Production closeout: exact commit `5a66eca6ab80fb9d0a00abe3c3cf00a44a0ee4d5` is READY on deployment `dpl_3yvQ3zWGTpEB6xw1EYgvwbvgRaLL` and aliased to the canonical URL. The Vercel gate passed 92 files / 654 tests, TypeScript, build, and Sentry release upload. Nine WhatsApp-dependent Edge functions are ACTIVE with the provider disabled; deployed supervisor proof produced truthful manual handoff, no access code, no delivery row, and zero fixture residue. Four public routes returned 200 with no error/5xx log entry in the post-deploy window.

## Verdict

No-Go for pilot.

The matrix is complete, but the product is not pilot-ready. The run still has 10 critical failures, 31 high failures, and 14 critical blocked golden-journey steps. Several successful happy paths exist, especially in market-run production and basic auth/onboarding, but critical data-integrity and security defects invalidate pilot sign-off.

`code_verified` means repository/source evidence supports the behavior, but no production runtime pass was captured for that item. It should not be treated as equivalent to `pass`.

## Clock correction note

The earlier local system-clock flaw was accounted for. After the MacBook clock was corrected to the correct IST date/time, production date alignment was verified and current-day market production saved successfully.

Two stale clock-era rows were corrected before this final report:

- `ORDER-003` is now `pass`: customer-order multi-loom production was accepted and reconciled to 230.75m.
- `MARKET-005` is now `pass`: market stock existed and an 80.00m sale to a saved party was executed.

The remaining No-Go verdict is independent of the clock issue.

## Critical failures

| ID | Area | Why it matters |
| --- | --- | --- |
| `PROD-016` | Production correction | Editing production to downtime leaves stale generated stock. |
| `PROD-028` | Production totals | Production logs reconcile, but downstream stock does not change exactly once. |
| `STOCK-015` | Stock | Order stock is overstated by stale corrected-production stock. |
| `SEC-002` | Security | Authenticated users can update sensitive profile authorization fields in production grants. |
| `SEC-003` | Security | Profile RLS does not protect role/org mutation adequately. |
| `SEC-004` | Security | Server authorization derives from mutable profile data. |
| `SEC-005` | Security | Supervisor can escalate to owner via mutable profile role/org path. |
| `GOLDEN-A-12` | Golden A | Correction updates production rows but not generated order stock. |
| `GOLDEN-A-14` | Golden A | Order-linked stock exists but is wrong: 230.75m production produced 256.00m stock. |
| `SIGNOFF-05` | Daily sign-off | Expected stock cannot be signed off. |

## High failures

High-severity failures remain in build/release hygiene, migration drift, WhatsApp fail-closed behavior, auth lockdown, estimator idempotency, order overproduction/cancel boundaries, duplicate sale submission, dispatch/receipt correctness, commercial filters, payroll privileged RPCs, kharchi/offline handling, dashboard truth, PWA/offline queueing, access-code hardening, golden journeys, and final sign-off.

High failure IDs:

`TECH-001`, `TECH-005`, `TECH-006`, `TECH-007`, `TECH-009`, `TECH-010`, `AUTH-016`, `EST-017`, `ORDER-005`, `ORDER-009`, `PROD-002`, `PROD-011`, `SALE-015`, `DISP-003`, `DISP-007`, `DISP-019`, `COMM-016`, `PAY-006`, `PAY-018`, `PAY-020`, `PAY-027`, `PAY-028`, `DASH-007`, `OFF-008`, `SEC-006`, `GOLDEN-A-11`, `GOLDEN-B-09`, `SIGNOFF-01`, `SIGNOFF-02`, `SIGNOFF-07`, `SIGNOFF-10`.

## Main finding clusters

1. Security must be fixed first.

   The profile role/org mutation path is critical. Owner/supervisor authorization cannot be trusted while authenticated users can mutate fields used to derive role and tenant authority.

2. Production correction is not transactionally safe.

   Production log replacement can update the production rows while leaving stale stock. This breaks order stock, daily expected stock, downstream sale/dispatch, and Golden Journey A.

3. Dispatch and receipt state is inconsistent.

   A second dispatch batch can fail on package-number uniqueness, and delivered/receipt fields can contradict each other. This breaks Golden Journey B and daily sign-off.

4. Offline and retry behavior is not pilot-ready.

   Kharchi offline queues to a missing table, production logging is not offline-queued, persisted local cache is not fully cleared on logout/account switch, and unknown timeout outcomes are not consistently distinguished from failure.

5. Technical gates are not release-safe.

   `npm ci` fails against the lockfile, audits report high-severity advisories, production migrations lag the repository, no CI/test script gate exists, and Sentry release/source maps were not uploaded.

## Skills developed/used

| Skill | Role in this run |
| --- | --- |
| `weavly-prepilot-runner` | Turned the guide into a structured ledger, enforced status vocabulary, evidence rules, batch updates, and rendered `TEST_MATRIX.md`. |
| `weavly-qa-account-setup` | Defined safe QA tenant/account strategy, run prefixing, isolated owner/supervisor setup, join-code verification, and credential handling. |
| `weavly-browser-login` | Provided secret-backed owner/supervisor login workflow for authenticated production browser QA without exposing credentials in prompts or files. |
| `weavly-business-reconciliation` | Defined invariant checks against tenant-scoped records for production, stock, sale, dispatch, receivable, payment, and payroll evidence. |

## Primary artifacts

- `TEST_MATRIX.md`: complete rendered matrix.
- `results.json`: machine-readable ledger.
- `logs/business-reconciliation.json`: core runtime business reconciliation evidence.
- `logs/clock-and-deployment-evidence.json`: clock/deployment/date evidence.
- `logs/prod-dashboard-ux-signoff-source-evidence-20260624.json`: final source-backed production/dashboard/UX/signoff evidence.
- `updates-clock-stale-row-cleanup-20260624.json`: cleanup that corrected stale clock-era matrix rows.

## Recommended fix order

1. Lock down profile authorization fields and remove dangerous grants/policies.
2. Make production correction atomic across production logs and generated stock.
3. Fix dispatch package numbering and receipt-state consistency.
4. Remove or harden legacy privileged RPCs for payroll, production, and direct market-run sale paths.
5. Add idempotency keys to sale/dispatch/estimator/market-run creation paths.
6. Fix offline queues and cache clearing, or explicitly de-scope offline production/kharchi from pilot.
7. Repair release gates: lockfile, audit, migration drift, CI test script, Sentry release/source maps.
