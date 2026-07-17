# Repository-grounded architecture enhancement review - final summary

Completed: 2026-07-15 IST

## Executive conclusion

Weavly should remain a **Next.js + Supabase/PostgreSQL + Vercel modular monolith**. Narola's proposal is valuable mainly for its principles—transaction integrity, tenant isolation, replay safety, historical snapshots, golden acceptance, observability, recovery proof and role-focused UX—not as a literal greenfield technology plan.

The repository already implements most high-consequence architecture properties Narola proposed. The actual pre-pilot work is narrower: finish three real-world acceptance gates, contain recovery-key material, enforce CI/golden gates, close a few direct-write atomicity/idempotency gaps, add safe operation correlation, and measure representative QA volume. Microservices, NestJS, cloud migration, Kubernetes, full event sourcing and native apps would increase risk without solving current blockers.

This was an **analysis-only pass**. No production code, migration, configuration, workflow, deployment, provider or database state was changed.

## Required answers

### 1. Was the attached proposal successfully preserved in the repository?

Yes. The original attachment was identified by content, not filename, and copied byte-for-byte to `docs/reference/narola-weavly-commercial-technical-proposal.pdf`. It is a readable, unencrypted 22-page PDF 1.4 file of 4,211,132 bytes with metadata title `Commercial & Technical Proposal for Weavly`. Source and copy share SHA-256 `42ed3d628850509e1ec3a431e6588012fb0d8d71d2641988cf84f7c476f53c74`; `cmp` succeeded. Details are in `proposal-ingestion.md`.

### 2. What technical and product ideas did the proposal contain?

Narola proposed:

- Option A Estimator SaaS: reusable qualities, transparent cost stack, scenarios, quote revisions/history/PDF and immutable results.
- Option B connected suite: estimator -> quote -> order/market run -> production -> stock -> dispatch -> commercials -> payroll -> billing.
- Owner web, mobile-first Supervisor PWA and Platform Admin surfaces.
- Next/React frontend, modular Node/Nest-style backend, PostgreSQL, queues, client-owned cloud/storage/Git, separate environments and CI/CD.
- Tenant/role isolation, server validation, atomic transactions, controlled state transitions, idempotency, audit/event records and historical snapshots.
- Unit/integration/end-to-end/performance QA and mandatory golden journeys.
- Structured logs, monitoring/error tracking, provider diagnostics, backups, restoration, incident preparation and handover/support.
- Optional yarn inventory, accounting, advanced analytics, native mobile and IoT modules.

Commercially it assumed a greenfield agency engagement: Option A 2,200 hours/₹33 lakh + GST/24-26 weeks/seven people; Option B 8,500 hours/₹1.275 crore + GST/48-52 weeks/ten people; three-month warranty, 15% annual maintenance, ₹1,500/hour changes and substantial monthly infrastructure assumptions. The faithful page-referenced account is in `docs/reference/narola-weavly-proposal-technical-notes.md`.

### 3. Which Narola concepts were already implemented?

- Next.js/React PWA, PostgreSQL, managed object/storage capabilities and separate role surfaces.
- Supabase Auth plus server profile checks, tenant-scoped RLS, role denial, lockdown/tier enforcement and server validation.
- Transactional production replacement and generated-stock reconciliation.
- Atomic/keyed stock sales, dispatches, receipt reconciliation, receivables and collections.
- Atomic payroll settlement/deduction/reversal and kharchi/float mutation.
- Quote request IDs, quote-to-order uniqueness, billing/webhook claims and referral/refund idempotency.
- Broad append-only audit, stock movements, domain corrections/reversals and immutable quote/order/rate/payroll snapshots.
- Non-blocking WhatsApp delivery logs/retries, provider modes and consent controls.
- Sentry across runtimes, redaction, release tags and performance timing/query counts.
- Owner exception-oriented UX and mobile/task-oriented Supervisor PWA.
- Estimator cost-stack explanation and a four-scenario sensitivity model.
- Extensive automated tests, runtime QA packs, formal PASS/FAIL/BLOCKED ledger and detailed recovery runbook/workflows.

Exact files/migrations are mapped in `current-state-map.md` and `concept-assessment.md`.

### 4. Which concepts were only partially implemented?

- Domain boundaries: good modules/RPCs coexist with large mixed action/client files and legacy mutation ownership.
- Idempotency: strong in major flows, inconsistent in manual stock lot, owner advance, supervisor kharchi/refill, machine operator assignment and estimator conversion commands.
- Atomicity: core flows are strong; manual lot + opening movement and operator history + legacy mirror span requests.
- Observability: Sentry/perf exist, but no shared operation/request ID or user support code joins browser/server/RPC/audit/provider outcomes.
- Golden QA: very broad evidence exists, but no general PR CI or compact automated deployment gate is visible.
- Recovery: tooling/runbook exists, but retained scheduled-artifact restoration has not passed.
- Performance: bundle wins are measured; representative authenticated datasets, query budgets and p50/p95 proof are absent.
- Platform admin/public tracking/yarn/ledger: source exists but active scope archives the routes.
- Scenario comparison: useful four-scenario sensitivity exists; arbitrary side-by-side inputs do not.
- Razorpay: robust source lifecycle, but successful hosted Test Mode capture/webhook replay remains unproven.

### 5. Which missing concepts would materially improve Weavly?

The strongest missing/unfinished concepts are:

1. Successful scheduled-backup restore proof.
2. Independent real-fabric estimator reconciliation.
3. Dated factory terminology acceptance.
4. Lean required CI plus 15 golden release journeys.
5. Atomic, replay-safe manual stock-lot creation.
6. One-command machine-operator assignment transition.
7. Durable request IDs for advance/kharchi/float and selected estimator conversion actions.
8. Safe operation IDs/Sentry fields/user support codes.
9. Representative non-production scale measurement.
10. Hosted Razorpay lifecycle proof before charging.

### 6. Which recommendations were premature or irrelevant?

Broad scenario comparison, active platform-admin portal, public tracking, general outbox, yarn/accounting activation, broader domain-file reorganization and live messaging infrastructure should wait for pilot demand or a measured failure. Queue-backed PDF generation is irrelevant at current on-demand volume. Narola's agency team/process/handover shape and infrastructure budget explain its commercial assumptions but are not product requirements.

### 7. Which recommendations were rejected as overengineering?

Microservices, NestJS rewrite, separate backend solely for architecture style, AWS/Azure/GCP migration without evidence, Kubernetes, general containers, Kafka/enterprise bus, system-wide Redis/cache, full event sourcing, system-wide CQRS, native mobile now, full ERP/general ledger/GST filing, predictive analytics, cross-factory benchmarking, IoT now and broad visual redesign. Evidence and future triggers are in `rejected-ideas.md`.

### 8. What P0 or P1 changes were implemented?

None. The user explicitly requested analysis only. P0/P1 candidates were fully scoped in `recommendation-register.md` and sequenced in `implementation-plan.md` for a later authorized pass.

### 9. What evidence verifies each implemented change?

There are no product implementations to verify. Proposal preservation and the analysis baseline passed:

- PDF SHA/cmp/file/page/title/readability checks.
- TypeScript: PASS (`npx tsc --noEmit`).
- Lint: PASS (`npm run lint`).
- Tests: PASS, 96 files; 678 passed, one skipped.
- Production build: PASS, including prebuild tests, compile/type/static generation.

The detailed classifications and caveats are in `verification-results.md`. The green baseline includes unrelated pre-existing uncommitted work and is not attributed to this review.

### 10. What remains recommended before pilot?

The current formal No-Go should remain until:

- `TECH-011`: restore and reconcile one retained scheduled backup artifact.
- `GOLDEN-A-03`: independently reconcile a real fabric estimate.
- `UX-012`: obtain factory terminology sign-off.

Also immediately contain the untracked recovery-identity file without losing the only recovery key. High-confidence P1 work should then be a lean CI/golden gate, manual stock-lot atomicity, operator-assignment atomicity, financial request keys and bounded operation correlation. `SIGNOFF-04` should reconcile the first real shift against an independent supervisor register.

### 11. What should wait until after pilot?

General scenario comparison, active support console, public tracking, provider-neutral outbox, broad domain decomposition, yarn/accounting activation, advanced analytics and any native/IoT work. Performance fixes must wait for representative measurement; paid infrastructure must wait for evidence.

### 12. Were any regressions introduced?

No product behavior changed. Lint, type check, 678 tests and production build passed on the visible working tree. Only reference/analysis artifacts were added. Runtime-dependent behavior was not reclassified from code inspection.

### 13. Did any changes affect database compatibility?

No. No migration, function, policy, table, seed or database command was created or applied. Later REC-005..007 proposals use additive, backward-compatible migrations and require explicit QA/linked-target validation.

### 14. Did any changes affect tenant isolation?

No. No auth/RLS/RPC/product code was changed. Future command RPCs must derive/validate organization and actor, restrict grants, test wrong-role denial and test cross-tenant key reuse/concurrency.

### 15. Did any changes affect production or QA environments?

No remote environment was mutated. Distinct project refs were identified without printing secrets. The Supabase CLI link points to production, so later database work must fail closed unless a command explicitly verifies its intended target. A local production-configured build ran; it compiled only and did not deploy or intentionally mutate remote state.

### 16. What is the recommended next action?

First, safely relocate/contain `weavly-backup-age-identity.txt` after verifying another approved recovery copy—never commit or print it. Then complete the two remaining formal pilot gates: TECH-011 recovery governance and the independent estimator truth sheet. UX-012 is Founder-approved PASS; capture named factory-operator English/Gujarati feedback during the first pilot run and reopen it for any disputed term. After the remaining proofs, authorize a small P1 implementation batch beginning with CI/golden gates and manual stock-lot atomicity. Do not combine it with the current uncommitted auth/performance campaign until that work is reconciled.

### 17. How does current architecture compare with Narola's greenfield architecture?

Functionally, Weavly already achieves much of Narola's proposed target through fewer components. Next.js handles frontend and server boundaries; Supabase supplies Auth, PostgreSQL, RLS, Storage and Edge Functions; Vercel supplies deployment; Sentry supplies monitoring. Narola's separate modular Node/Nest backend and generalized queues are a greenfield team/topology choice, not a missing business capability. The current modular monolith is more appropriate for pilot scale and preserves transactional database ownership.

### 18. Which agency ideas were useful as principles but unnecessary as literal technology choices?

- Domain services -> clearer in-repo command/read-model ownership, not NestJS/microservices.
- Queues -> existing delivery log/cron, with a small database outbox only when live critical messaging requires it.
- Enterprise observability -> Sentry/perf plus safe operation IDs/support codes.
- Cloud architecture -> retain Supabase/Vercel, strengthen environment assertions/CI/recovery proof.
- Platform Admin -> future narrow audited read-first support tooling, not a full portal.
- Immutable history -> preserve existing snapshots, movements and controlled reversals, not event sourcing.
- Mobile apps -> continue the Supervisor PWA until a proven browser limitation exists.
- Scale readiness -> representative QA fixtures/budgets and measurement, not speculative infrastructure.

## Final disposition

The proposal was useful and is now preserved faithfully. Its strongest contribution is confirming that Weavly's existing direction—transactional PostgreSQL boundaries, tenant isolation, snapshots, role-specific PWA UX and evidence-driven release gates—is sound. Pilot readiness will improve most by completing proof and repairing a handful of concrete command gaps, not by making the codebase resemble a ₹1.275 crore greenfield agency architecture.
