# Golden end-to-end acceptance journeys

Reviewed: 2026-07-15 IST

## Evidence policy

A source test proves a contract in the repository; it does not prove a deployed browser, database, provider, or mobile outcome. The classifications below therefore distinguish automated source coverage, prior runtime evidence, and current blockers. Existing evidence was inspected under `output/qa/`, `docs/pilot-remediation/`, `outputs/estimator-production-readiness/`, and `__tests__/`. No journey was rerun against production in this analysis-only review.

## Proposed release-protection set

| ID | Journey | Current implementation/evidence | Automation level | Current classification | Deployment-gate decision | Missing proof or action |
|---|---|---|---|---|---|---|
| GJ-01 | Fresh owner signup, organization creation, onboarding, refresh and re-login | Auth actions, owner onboarding, organization/profile creation; browser/runtime evidence in `output/qa/AMY_QA_20260603_0218/` and pilot QA packs | Source tests plus prior browser evidence | PASS on prior evidenced build; current auth-performance branch not rerun | Gate every release at smoke depth; run full data creation before pilot/release candidate | Reconcile current uncommitted auth work, then rerun on QA without production mutation |
| GJ-02 | Supervisor joins by code; owner/supervisor/wrong-role route boundaries | Role layouts, `requireRole`, proxy routing, access-code hardening; owner/supervisor denial screenshots and security records | Source/security tests plus prior browser evidence | PASS on prior evidenced build | Mandatory security gate | Include direct-link, expired session, revoke/refresh, wrong-role and reusable join-code semantics |
| GJ-03 | Cross-tenant denial for reads, writes and RPCs | RLS policies, tenant checks, JWT/profile boundary, formal security scans | Extensive migration/source tests and prior QA reconciliation | PASS on prior evidenced build | Mandatory security gate | Run with two isolated QA tenants after any RLS/RPC change; source inspection alone is insufficient |
| GJ-04 | Master setup: machine, worker, godown, party and saved quality; refresh/re-login | Owner CRUD routes/actions and setup screens; onboarding/setup runtime screenshots | Mixed source tests and prior browser evidence | PASS, but terminology approval is BLOCKED | Mandatory pilot setup gate | `UX-012` requires a dated factory reviewer sign-off for labels/terms |
| GJ-05 | Estimator calculation against an independent known fabric, including full cost stack | Decimal engine, server snapshot validation, formula unit cases, cost-analysis UI | Strong unit/source tests; no independent factory truth sheet | BLOCKED (`GOLDEN-A-03`) | Hard pilot gate; do not change formulas first | Obtain one signed/dated independent real-fabric worksheet and reconcile inputs, intermediate costs and final rate |
| GJ-06 | Save quality, restore it, save quote, refresh/re-login, accept and convert quote to order | Saved qualities, quote client request key, immutable snapshots, atomic conversion; browser evidence | Unit/source tests plus prior runtime evidence | PASS on prior evidenced build | Mandatory commercial gate | Add an explicit duplicate-click/replayed-request check to the automated QA ledger |
| GJ-07 | Estimator to party order and estimator to market run | Fast order and market-run actions; snapshot tests and estimator readiness evidence | Source tests; browser coverage is uneven | PARTIAL | Gate before relying on each entry path in pilot | Prove lost-response retry and one logical result; market-run path needs durable request identity/transaction review |
| GJ-08 | Loom/shift assignment, supervisor day shift production log, refresh/re-login | Assignment RPCs, production unique grain/transaction, mobile supervisor workflow | Source/migration tests plus runtime production evidence | PASS on prior evidenced build | Mandatory operational gate | Keep duplicate-click and unknown-outcome reconciliation assertions in every affected release |
| GJ-09 | Supervisor night shift, day-only factory behavior, correction and unknown-outcome retry | Shift UX, suspicious meter confirmation, transactional replacement/correction, OFF-009/OFF-010 evidence | Source tests plus constrained/delayed runtime evidence | PASS on prior evidenced build | Mandatory operational gate | First live shift still requires independent register reconciliation (`SIGNOFF-04`) |
| GJ-10 | Production to generated stock; manual stock lot; partial sale with exact remaining quantity | Production-stock atomic RPC; manual lot action; sale/dispatch keyed RPC; QA business reconciliation | Strong source tests and prior runtime stock/sale evidence | PARTIAL | Mandatory inventory gate | Generated stock and sale are strong; manual lot + opening movement must be made one transaction before treating failure injection as PASS |
| GJ-11 | Dispatch, owner receipt confirmation, shortage/extra variance and receivable creation | Transactional dispatch/receivable, receipt state machine and discrepancy records; runtime evidence | Source/migration tests plus prior browser/database reconciliation | PASS for active owner flow | Mandatory commercial gate | Public tracking variant is NOT APPLICABLE while `/track` is archived; do not count source as an active journey |
| GJ-12 | Receivable collection, duplicate retry, refresh/re-login and balance reconciliation | Required payment key, row lock, allocation/receipt command; commercial payment runtime evidence | Source tests plus prior browser/database reconciliation | PASS on prior evidenced build | Mandatory money gate | Retain exact ledger/receivable invariants and same-key replay check |
| GJ-13 | Advance creation, supervisor kharchi/float, payroll calculation, settlement, advance deduction and controlled reversal | Payroll settlement/reversal is transactional; kharchi+float is atomic; direct advance/refill lacks durable request identity | Strong source tests and prior payroll evidence; duplicate retry gaps not runtime-proven | PARTIAL | Mandatory money gate | Add stable request keys for advance, kharchi and refill; prove no double money movement after lost response |
| GJ-14 | Subscription/entitlement denial, checkout, captured payment, webhook replay and referral lifecycle | Tier RLS/triggers, Razorpay canonical fetch, activation/event claims, referral/refund idempotency | Strong source/migration tests; hosted checkout stopped before successful payment | BLOCKED for paying release; limited non-paying pilot can be N/A | Hard gate before charging customers | Complete one Test Mode hosted payment, webhook delivery/replay, entitlement refresh/re-login and refund/reversal proof |
| GJ-15 | Operational recovery: scheduled encrypted backup, disposable restore, tenant/domain reconciliation and recovery cleanup | Workflows, scripts and runbook exist; scheduled run failed after dump creation and produced no artifact | Workflow/source checks; no successful retained-artifact restore proof | BLOCKED (`TECH-011`) | Hard pilot gate | Complete one later scheduled artifact restore in disposable infrastructure and record hashes, RTO, reconciliation and cleanup |

## Supporting smoke checks

These should stay in the wider regression pack but need not each become a full release-blocking end-to-end journey:

- Owner and supervisor mobile viewport/navigation smoke, loading states, touch targets, weak-network feedback, PWA update prompt and session recovery.
- Factory Today exception cards and direct links.
- PDF generation for quote/payslip after authorization; duplicate downloads are harmless.
- Sentry error capture/redaction and release metadata. Direct live payload inspection remains `SEC-011` assurance work.
- Physical device PWA install/reopen (`OFF-001`) is useful but not a core limited-pilot gate.
- Legal/privacy wording (`SEC-018`) is a professional review dependency before public reliance, not a code journey.

## Recommended automation shape

1. **Pull request:** deterministic formula/unit tests, source/RLS contracts, lint, type check, build, and a small unauthenticated route smoke.
2. **QA deployment:** GJ-01 through GJ-13 with isolated prefixed tenants; include wrong-role, cross-tenant, duplicate-key, refresh and re-login assertions.
3. **Paying-release candidate:** GJ-14 in Razorpay Test Mode with provider webhook replay.
4. **Operational schedule:** GJ-15 from a retained scheduled backup, not an ad-hoc local dump.
5. **First pilot shift:** reconcile GJ-09/GJ-10 outputs against an independent supervisor register and preserve the signed result.

Do not make all 367 existing ledger rows into slow browser blockers. The 15 journeys above protect the highest-consequence chains, while targeted unit, SQL contract and component tests continue to cover branches cheaply.
