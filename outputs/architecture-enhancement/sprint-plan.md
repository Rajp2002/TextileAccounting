# Weavly pilot-readiness sprint plan

Prepared: 2026-07-16 IST
Source: repository-grounded Narola proposal review

## Recommended delivery shape

Use four focused one-week sprints, followed by a separate paying-release sprint. This assumes one primary implementer using AI assistance, with the founder available for product decisions and a factory reviewer available during Sprint 0. If capacity is lower, keep the order and extend duration; do not combine the database-integrity stories into one large migration.

The first sprint is deliberately evidence- and operations-heavy. Weavly's remaining pilot risk is not primarily missing functionality: it is uncompleted recovery, formula and terminology proof.

## What to incorporate

### Incorporate before or during limited pilot

1. Complete retained-backup restoration proof.
2. Validate the estimator against an independent real-fabric worksheet.
3. Obtain dated owner/supervisor terminology acceptance.
4. Keep recovery private-key material outside repository scope.
5. Add a lean pull-request CI gate and compact golden-journey release ledger.
6. Make manual stock-lot creation atomic and replay-safe.
7. Make machine-operator assignment one atomic database command.
8. Add idempotency keys to owner Upaad, supervisor kharchi and float refill.
9. Add bounded operation IDs, safe Sentry context and user support codes.
10. Measure representative authenticated QA volume before optimizing.

### Incorporate before charging customers

1. Complete Razorpay hosted Test Mode capture, webhook replay, entitlement refresh/re-login and refund/reversal proof.
2. Make checkout-attempt creation retry-safe if Test Mode exposes duplicate provider-order or local-persistence problems.

### Incorporate after pilot only when evidence supports it

- Broader estimator side-by-side comparison.
- Narrow read-first platform support tooling.
- Public dispatch tracking reactivation.
- Small database outbox for critical live messaging.
- Gradual action-file/domain decomposition while touching proven problem areas.
- Yarn inventory or accounting integration driven by validated factory demand.

Do not schedule microservices, a NestJS rewrite, cloud migration, Kubernetes, full event sourcing, native mobile, full ERP/accounting, IoT or predictive analytics.

## Sprint 0 - Clear the pilot evidence gates

**Goal:** Convert the remaining formal pilot blockers into evidence-backed PASS results without changing formulas or product architecture speculatively. UX-012 is now Founder-approved PASS; factory-operator terminology review runs as a first-pilot-session control.

**Duration:** 3-5 working days plus any wait for the scheduled backup artifact or factory reviewer.

| Story | Recommendation | Estimate | Work | Acceptance criteria |
|---|---|---:|---|---|
| S0-01 Secure recovery identity | REC-000 | 0.5 day | Verify an approved external recovery-key copy without printing its contents; move the repository-root copy outside repository scope; add a narrow ignore rule only after recovery access is proven | Private identity is outside the repository, remains recoverable, appears in no Git diff/log/evidence and supported transient names are ignored |
| S0-02 Restore a retained scheduled backup | REC-001 / `TECH-011` | 1 day active work | Use the existing workflow/runbook, restore one scheduled encrypted artifact into a disposable target, reconcile critical tenant/domain invariants, measure RTO and destroy the target | Artifact hash, workflow ID, target identity, restore result, reconciliation, RTO and cleanup are recorded; production was not mutated |
| S0-03 Validate one real fabric estimate | REC-002 / `GOLDEN-A-03` | 0.5-1 day after input | Obtain an independent factory worksheet; reproduce inputs and intermediate costs in Weavly; agree tolerances; investigate any discrepancy before changing code | Signed/dated reproducible worksheet has no unexplained variance; saved quality and quote snapshot preserve the result after refresh/re-login |
| S0-04 Approve factory terminology | REC-003 / `UX-012` | 0.5 day after reviewer availability | Walk an owner and supervisor through setup, production, stock, dispatch, Upaad and payroll terminology; record accepted corrections | Dated reviewer evidence exists; disputed labels have an explicit decision; only reviewer-supported copy changes enter a later small PR |
| S0-05 Reconcile current working tree | Dependency | 0.5 day | Separate the pre-existing auth/performance/estimator changes from architecture work; commit or park them intentionally; preserve proposal/review artifacts | No unexplained overlap remains; next sprint starts from a reviewable checkpoint; recovery identity is never committed |

**Sprint exit gate:** `TECH-011` and `GOLDEN-A-03` are PASS or precisely BLOCKED by named external input. UX-012 factory-operator feedback is captured during the first pilot run and any disputed term reopens the row. Any estimator discrepancy becomes its own reviewed defect; formulas are not guessed.

## Sprint 1 - Establish release protection

**Goal:** Make every subsequent integrity change pass a repeatable source gate and a compact QA acceptance gate.

**Duration:** 5 working days.

| Story | Recommendation | Estimate | Work | Acceptance criteria |
|---|---|---:|---|---|
| S1-01 Pull-request CI | REC-004 | 1-1.5 days | Add a workflow for clean install, lint, TypeScript, Vitest and production build; use no production secrets | Each check is required and demonstrably fails on an intentional defect; clean branch passes; workflow does not print environment values |
| S1-02 Golden-journey runner/ledger | REC-004 | 1.5-2 days | Turn GJ-01..GJ-15 into a versioned release checklist; automate only stable steps; use isolated prefixed QA tenants | Every journey records build, environment, expected/actual result, evidence and PASS/FAIL/BLOCKED/N/A; source inspection is not accepted as runtime proof |
| S1-03 Security/retry release checks | REC-004 | 1 day | Add required checks for wrong-role, cross-tenant, duplicate request, refresh and re-login around consequential workflows | QA evidence shows denial and one-logical-result behavior; no production mutation or credential leakage |
| S1-04 First-shift reconciliation pack | Existing `SIGNOFF-04` | 0.5-1 day | Prepare the independent supervisor-register comparison for the first real pilot shift | Meter, production, stock and worker-earning invariants have a dated reconciliation template and named owner |

**Sprint exit gate:** Green CI plus one complete QA golden-journey run on an explicitly asserted QA project. Flaky tests are fixed or removed from the required gate with a documented reason; they are not silently retried until green.

## Sprint 2 - Close material and assignment atomicity gaps

**Goal:** Remove the two confirmed multi-write partial-completion windows that can corrupt stock audit or operator/payroll history.

**Duration:** 5 working days.

| Story | Recommendation | Estimate | Work | Acceptance criteria |
|---|---|---:|---|---|
| S2-01 Atomic manual stock-lot command | REC-005 | 2 days | Add an owner/tenant/tier/lockdown-checked RPC that creates the lot and opening movement in one transaction with an organization-scoped client request key | Forced middle failure creates neither row; same-key replay returns one lot; changed payload conflicts; wrong role/cross tenant fail; exactly one opening movement exists |
| S2-02 Stock runtime reconciliation | REC-005 | 0.5 day | Run duplicate-click, response-loss, refresh/re-login and database invariant proof in QA | UI and database show one lot/one opening movement and correct quantity; evidence is linked to migration/build |
| S2-03 Atomic machine-operator assignment | REC-006 | 1.5-2 days | Inventory legacy callers; move close-old/insert-new/mirror-or-clear into one locked RPC while preserving audit/rate/effective-date semantics | Forced failure rolls back all changes; assign/reassign/clear and concurrency are correct; current mirror and history agree |
| S2-04 Assignment/payroll runtime reconciliation | REC-006 | 0.5 day | Verify owner and supervisor state after refresh and check downstream payroll preview | Assignment history, current machine display and payroll/operator-rate attribution reconcile after re-login |

**Sprint exit gate:** Additive migrations validate against the current production migration head without applying to production during development. Tenant isolation, wrong-role denial, concurrency, rollback and QA business reconciliation all pass.

## Sprint 3 - Make remaining money operations replay-safe

**Goal:** Ensure one user intent changes cash/advance state once, including lost responses and duplicate submissions.

**Duration:** 5-7 working days.

| Story | Recommendation | Estimate | Work | Acceptance criteria |
|---|---|---:|---|---|
| S3-01 Owner Upaad request key | REC-007 | 1-1.5 days | Add a transactional creation command and org-scoped client request UUID; retain non-blocking WhatsApp after commit | Same key returns the original advance; different amount/reason conflicts; notification failure does not roll back or duplicate the advance |
| S3-02 Supervisor kharchi request key | REC-007 | 1-1.5 days | Extend the existing atomic kharchi/float RPC with durable request identity | Concurrent/replayed same intent produces one withdrawal; two new keys create two intentional withdrawals; balance limits remain correct |
| S3-03 Supervisor float-refill request key | REC-007 | 1-1.5 days | Replace direct refill insert with an authorized transactional command and stable key | Response loss/retry creates one refill; actor/org/amount rules and audit data remain correct |
| S3-04 Financial reconciliation pack | REC-007 | 1 day | Exercise unknown-outcome retry, duplicate click, refresh/re-login and payroll calculation in QA | Advances, kharchi, float and settlement preview reconcile to one money movement per intent; wrong-role/cross-tenant tests pass |
| S3-05 Review estimator conversion replay risk | C03/C14 | 0.5 day analysis | Confirm active usage and duplicate behavior of estimator-to-order and estimator-to-market-run before scheduling code | Evidence either closes the concern or produces a separate bounded story; it is not folded into financial migrations without proof |

**Sprint exit gate:** Every changed money command has database-enforced replay semantics, payload-conflict behavior, concurrent-call tests and runtime QA reconciliation.

## Sprint 4 - Operational traceability and measured performance

**Goal:** Shorten pilot incident diagnosis and establish realistic performance evidence without speculative infrastructure.

**Duration:** 5 working days.

| Story | Recommendation | Estimate | Work | Acceptance criteria |
|---|---|---:|---|---|
| S4-01 Operation-ID helper | REC-008 | 1 day | Generate/reuse a UUID per user intent, validate caller input and expose a short support code | IDs are stable across retry/reconciliation, invalid caller values are replaced/rejected safely and business APIs remain compatible |
| S4-02 First observability slice | REC-008 | 1.5 days | Add safe Sentry/log context to production logging, stock, dispatch, payroll and billing failures; do not replace every console call | One safe QA failure is traceable by support code across selected browser/server context; no access codes, tokens, cookies, PII or full financial payloads are logged |
| S4-03 Representative QA fixtures | REC-009 | 1 day | Create deterministic non-production data approximating 150 looms, 100 workers, multiple shifts and historical business records with cleanup/target guards | Fixture asserts QA ref, uses a prefixed tenant, is reproducible and can be fully removed; production credentials are not accepted |
| S4-04 Performance baseline | REC-009 | 1-1.5 days | Measure Factory Today, Machines, production, stock, dispatch, payroll, advances and estimator with route/query/mobile budgets | Timestamped p50/p95, query counts, DB plans and low-powered mobile evidence exist; optimization stories are created only for failed budgets |

**Sprint exit gate:** Selected incidents are traceable without sensitive logging, and performance decisions are backed by representative measurements. No queue, Redis cache, service extraction or index is added solely because it might help.

## Paying-release sprint - Prove billing before charging

**Goal:** Demonstrate that hosted payment, provider replay and entitlement lifecycle are correct end-to-end.

**Duration:** 2-4 working days, scheduled before accepting payment rather than blocking a clearly non-paying limited pilot.

| Story | Recommendation | Estimate | Acceptance criteria |
|---|---|---:|---|
| P-01 Hosted Razorpay Test Mode journey | REC-010 | 1 day | Successful checkout/capture, canonical verification, webhook delivery/replay, one entitlement and refresh/re-login are reconciled with redacted evidence |
| P-02 Refund/referral lifecycle | REC-010 | 0.5-1 day | Duplicate provider/database calls produce one refund/referral outcome and monotonic state |
| P-03 Checkout-attempt retry decision | C15 | 0.5 day analysis, 1-2 days if needed | Duplicate-click/lost-response test determines whether a local attempt registry is required; implement only if the current provider-before-local gap causes a demonstrated operational problem |

## Definition of done for every code sprint

- Branch and starting commit recorded; unrelated work preserved.
- Exact local/QA/production target identified before any database or runtime command.
- Additive migrations validated against the deployed migration head and deployed before dependent callers.
- Lint, TypeScript, targeted tests, full Vitest suite and production build pass.
- Wrong-role and cross-tenant denial pass where authorization changes.
- Duplicate click, concurrent request, lost response and refresh/re-login pass where idempotency changes.
- Affected mobile flow and business invariants are reconciled in QA.
- Evidence records environment, build, command/procedure, expected/actual result and remaining risk.
- Rollback/forward-fix path is written before deployment.
- No secrets, environment files, recovery keys or sensitive payloads enter Git or evidence.

## Recommended backlog order if capacity is constrained

1. REC-000 recovery-key containment.
2. REC-001 backup restore proof.
3. REC-002 estimator factory truth.
4. REC-003 terminology sign-off.
5. REC-004 CI/golden gate.
6. REC-005 manual stock atomicity.
7. REC-007 financial request keys.
8. REC-006 operator-assignment atomicity.
9. REC-008 operation correlation.
10. REC-009 representative performance measurement.
11. REC-010 billing proof before charging.

If Sprint 0 closes cleanly and the pilot is explicitly limited/non-paying, pilot onboarding can proceed while Sprints 1-4 continue behind controlled release gates. If any Sprint 0 proof finds a material defect, that defect takes priority over the planned architecture backlog.
