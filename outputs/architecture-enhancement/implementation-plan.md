# Analysis-only implementation plan

Prepared: 2026-07-15 IST

## Gate decision

The analysis found bounded P0/P1 work, but **implementation is intentionally not authorized in this pass**. The user requested analysis only and instructed that production code not be changed yet. Accordingly:

- No product source, migration, configuration, workflow, environment, database or deployment was changed.
- No implementation candidate is marked complete.
- Existing uncommitted auth/performance/estimator work must be reconciled before a code batch begins.
- Operational proof must use an explicitly identified QA, Test Mode or disposable target; the Supabase CLI is currently linked to production.

This plan is the implementation gate for a later authorized session, not evidence that work occurred.

## Proposed sequence

### Stage 0 - Security and real-world gates (REC-000 through REC-003)

**Exact scope:** Safely relocate/ignore the recovery identity without displaying or losing it; complete the existing retained-artifact restore drill; obtain independent estimator truth; complete factory terminology sign-off.

**Why these pass the gate:** They address the formal remaining pilot gates and a concrete local secret-containment risk. They do not require a stack or product rewrite.

**Files to modify:** Evidence/runbook documents; optionally `.gitignore` after safe key relocation; no estimator/i18n source until reviewer evidence demonstrates a defect.

**Database changes:** None to production. Backup restore operates only on a verified disposable target; estimator/terminology proof may use isolated QA data.

**Migration and compatibility:** No migration. Production compatibility is preserved.

**Test plan:** Follow REC-000..003 plans in `recommendation-register.md`: key inventory, scheduled artifact restore/reconciliation, independent estimator inputs/intermediates/final rate, i18n/glossary and mobile workflow checks.

**Runtime proof:** TECH-011 workflow run/artifact/hash/RTO; GOLDEN-A-03 signed reconciliation; UX-012 dated reviewer result. All evidence redacted.

**Rollback:** Restore recovery access only from approved private storage; delete disposable restore environment; revert individual copy-only changes.

**Expected completion evidence:** The three formal gates are PASS, recovery material is outside repository scope, and no production mutation occurred except the normal read-only backup process.

### Stage 1 - Lean CI and acceptance gate (REC-004)

**Exact scope:** Add one application PR workflow for clean install, lint, type check, unit/source tests and build. Define QA execution/evidence commands for the 15 golden journeys. Do not place production credentials in CI or turn all 367 ledger rows into browser blockers.

**Why this passes the gate:** The repository has extensive tests but no general PR workflow; preventing regression before pilot is direct and low risk.

**Files to modify:** New `.github/workflows/ci.yml`; package scripts only if an existing command cannot be invoked; QA guide/evidence template.

**Database changes:** None in PR CI. QA golden journeys create only prefixed isolated test tenants/data through approved tooling.

**Migration and compatibility:** None. Pin/runtime versions should match current Vercel/package expectations.

**Test plan:** Prove each CI step fails intentionally on a temporary branch/change and passes cleanly; verify cache does not mask failures; verify no secret/environment dump.

**Runtime proof:** One green PR run and one QA deployment gate with classifications/evidence.

**Rollback:** Revert workflow configuration if it blocks for infrastructure reasons; keep deterministic tests.

**Expected completion evidence:** Required branch check plus GJ-01..GJ-15 ledger tied to build/environment IDs.

### Stage 2 - Manual stock-lot atomicity (REC-005)

**Exact scope:** Inventory all callers of `createTakaStockLot`; add an owner/tenant/tier/lockdown-checked PostgreSQL function that inserts one lot and its opening movement in a transaction; accept an organization-scoped UUID; make the action a thin caller.

**Why this passes the gate:** Source proves a present two-write partial-completion window affecting material truth; existing RPC patterns provide a bounded solution.

**Files to modify:** `app/(dashboard)/owner/stock/actions.ts`; one timestamped migration; generated database types only if required by repository convention; targeted stock/idempotency tests.

**Database changes:** Add RPC and grants; optionally add `client_request_id` on the lot or a narrow result identity with a partial unique `(org_id, client_request_id)` index.

**Migration and compatibility:** Additive. Retain current table columns and read API. Deploy migration before caller. Old caller remains compatible during rollout.

**Test plan:** SQL/source and integration tests for all-or-nothing failure, same-key replay, different-input conflict, two concurrent calls, wrong-role/cross-tenant denial, non-negative stock and one opening movement.

**Runtime proof:** QA manual lot with duplicated click/response loss, database invariant, refresh/re-login and stock-page reconciliation.

**Rollback:** Revert caller while RPC remains harmless if not yet used. Once rows use request keys, forward-fix rather than dropping data/indexes.

**Expected completion evidence:** One logical stock lot and exactly one opening movement for all retries/failures.

### Stage 3 - Machine-operator assignment atomicity (REC-006)

**Exact scope:** Inventory active/legacy readers and writers; move prior-history close, new-history insert and current legacy mirror/clear into one locked RPC; retain audit/rate/effective-date semantics.

**Why this passes the gate:** The current action explicitly admits partial success, and assignment history can affect production/payroll attribution.

**Files to modify:** `app/(dashboard)/owner/actions.ts`; one migration; assignment/payroll tests and possibly type definitions.

**Database changes:** RPC/grants and, only if necessary, a request-key field/index. No table replacement.

**Migration and compatibility:** Additive function deployed before caller; current rows remain valid. Decide deterministic effective-date versus UUID replay during detailed design.

**Test plan:** Assign, reassign, clear, overlap/concurrency, forced middle error, wrong-role/cross-tenant denial, lockdown and downstream payroll preview.

**Runtime proof:** Isolated QA assignment transitions followed by owner/supervisor refresh and database history/current reconciliation.

**Rollback:** Revert caller before production usage; retain new function. After usage, forward-fix to protect history.

**Expected completion evidence:** No command can persist only part of the assignment transition.

### Stage 4 - Financial request keys (REC-007)

**Exact scope:** Add one client intent UUID and database replay contract separately to owner Upaad creation, supervisor kharchi and supervisor float refill. Keep WhatsApp strictly after commit and non-blocking.

**Why this passes the gate:** These are direct, current money-changing commands where response loss can create a second valid transaction.

**Files to modify:** `app/(dashboard)/owner/advances/actions.ts`, relevant owner advance UI, `app/(dashboard)/supervisor/actions.ts`, relevant supervisor UI; additive migrations; targeted finance/payroll tests.

**Database changes:** Organization-scoped request-key columns/indexes or narrowly scoped command identity; extend `record_supervisor_kharchi` and add/replace advance/refill commands.

**Migration and compatibility:** Add nullable columns/partial indexes first, deploy keyed callers second, later make keys required only if all callers are confirmed. Preserve existing records.

**Test plan:** Same-key same-result, key/payload conflict, concurrent duplicate, two intentional distinct keys, balance/limit rules, wrong role/cross tenant, notification failure and payroll reconciliation.

**Runtime proof:** QA unknown-outcome/retry per command; verify one money movement and correct balance/settlement after refresh/re-login.

**Rollback:** Feature-compatible additive schema; revert caller while accepting null for legacy paths. Forward-fix after keyed data exists.

**Expected completion evidence:** Each user intent changes cash/advance state exactly once under clicks, retries and response loss.

### Stage 5 - Operation correlation first slice (REC-008)

**Exact scope:** Define `operationId` UUID creation/reuse and safe structured fields; propagate through selected billing, production, manual-stock, dispatch and payroll entry points; attach to Sentry and user-visible short support references. Do not replace all console calls in one campaign.

**Why this passes the gate:** Current Sentry/perf foundations make an additive slice cheap, and incident trace gaps directly affect pilot support.

**Files to modify:** New `lib/observability/` helpers; selected API routes/server actions; Sentry/redaction tests; shared error display if one exists.

**Database changes:** None initially. A later migration may add operation IDs to audit/provider records only when a demonstrated trace requires it.

**Migration and compatibility:** None in first slice; APIs accept optional IDs and generate server fallbacks.

**Test plan:** UUID/propagation, malicious caller input replacement, redaction/no-sensitive-fields, exception path, support-code stability and unchanged business return types.

**Runtime proof:** Trigger a safe QA validation/provider-simulation failure and find the same operation code in client/server diagnostic context.

**Rollback:** Remove additive tags/helper calls; business behavior remains unchanged.

**Expected completion evidence:** A selected user operation is traceable without logging secrets, access codes, PII or full financial payloads.

### Stage 6 - Representative measurement and paying-launch proof (REC-009, REC-010)

**Exact scope:** Reconcile the existing uncommitted auth/performance campaign; create deterministic QA-only scale fixtures and route/query/mobile budgets; run Razorpay hosted lifecycle in Test Mode. Implement performance fixes only for measured failures and integration fixes only for proven provider defects.

**Why this passes the gate:** Measurement and Test Mode proof close known evidence gaps without speculative infrastructure.

**Files to modify:** Performance fixtures/scripts/docs and runtime evidence; billing/product files only if a defect is reproduced and separately approved.

**Database changes:** Prefixed QA fixture rows and Test Mode billing rows only. No production load test.

**Migration and compatibility:** None for measurement/proof. Any later index/RPC change needs its own explain plan and migration review.

**Test plan:** Fixture cleanup/target assertion, query counts, plans, p50/p95, mobile trace; Razorpay capture, webhook replay, entitlement, re-login and refund/idempotency.

**Runtime proof:** Timestamped QA/build/ref evidence and redacted provider/database reconciliation.

**Rollback:** Delete isolated QA data/test entities; revert only separately evidenced query/integration changes.

**Expected completion evidence:** Performance budgets exist with measured status; paying-release journey is PASS or precisely BLOCKED by an external dependency.

## Explicitly outside the next implementation batch

Do not include scenario-comparison expansion, full admin portal, public tracking activation, generic outbox/queue, domain-wide file refactor, yarn/accounting modules, native mobile, IoT, predictive analytics, microservices, NestJS, cloud migration, containers or Kubernetes. These are P2/P3, deferred or rejected and would dilute the pilot-safety batch.
