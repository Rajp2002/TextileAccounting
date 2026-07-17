# Narola concept-by-concept assessment

Reviewed: 2026-07-15 IST

This assessment applies Narola's principles to the implemented repository. Priorities refer to pilot relevance, not architectural fashion. Exact implementation candidates are expanded in `recommendation-register.md`; operation-level replay analysis is in `idempotency-matrix.md`.

## C01 - Formal domain-module boundaries

| Field | Analysis |
|---|---|
| Proposal concept | Domain-oriented modular backend services, with a NestJS-style backend as a possible technology shape |
| Proposal reference | Pages 10-12; technical notes section 6 |
| Current repository state | Partial, appropriate modular monolith |
| Repository evidence | Domain libraries under `lib/quotes/`, `lib/commercials/`, `lib/dispatch/`, estimator/payroll/stock modules and transactional RPCs; large mixed files remain at `app/(dashboard)/owner/actions.ts`, `app/(dashboard)/supervisor/actions.ts`, and `app/(dashboard)/owner/estimator/EstimatorClient.tsx` |
| Existing strengths | Critical rules increasingly live in database commands or reusable TypeScript modules; Next.js server boundaries and RLS avoid a second deployment |
| Concrete weakness | Several large action/UI files have mixed mutation ownership; duplicate legacy/primary paths make consistent idempotency and authorization harder |
| User impact | Maintenance regressions can surface as inconsistent stock, assignment, payroll or estimator behavior; no current user need for service extraction |
| Pilot relevance | P2 overall; P1 only when extracting a concrete unsafe command |
| Implementation size | Medium gradual refactor; architectural if rewritten |
| Regression risk | Medium for gradual extraction; extreme for backend rewrite |
| Recommendation | Strengthen incrementally around commands/read models; reject NestJS rewrite and microservices |
| Proposed validation | Import/caller inventory, existing unit tests, role/tenant tests and affected golden journey after each extraction |
| Notes | Folder reorganization alone has little pilot value; transaction ownership is the useful boundary |

## C02 - Transactional outbox and background jobs

| Field | Analysis |
|---|---|
| Proposal concept | Queue-backed jobs for messaging, webhooks, PDFs and retryable processing |
| Proposal reference | Pages 5 and 11; technical notes section 9 |
| Current repository state | Partial, sufficient for current pilot scope |
| Repository evidence | Supabase Edge Functions, `whatsapp_delivery_log`, retry metadata and hourly pg_cron in `20260402120000_retry_cron.sql`; fail-closed provider modes and non-blocking calls; Razorpay webhook claim state machine; on-demand jsPDF |
| Existing strengths | Core business writes do not depend on WhatsApp success; retries are visible/capped; webhooks are already replay-safe |
| Concrete weakness | No provider-neutral outbox; a provider timeout after accepting a WhatsApp message can create an unknown outcome; no common failed-job console |
| User impact | Optional messages may be delayed/duplicated; stock/payroll/order state remains safe |
| Pilot relevance | P2 while WhatsApp is disabled/simulated; P1 only before live messaging becomes operationally required |
| Implementation size | Small for provider-status reconciliation, medium for DB outbox, large for external queue platform |
| Regression risk | Low/medium for a small outbox; high operational burden for new queue infrastructure |
| Recommendation | Preserve current jobs; adopt a small database outbox only after live-delivery incidents or a critical notification caller exists; reject queue platform now |
| Proposed validation | Provider timeout/duplicate callback tests, retry cap, consent, cross-tenant access and manual fallback proof |
| Notes | PDF generation is not a queued workload at current volume |

## C03 - System-wide idempotency standards

| Field | Analysis |
|---|---|
| Proposal concept | Retry-safe duplicate clicks, network retries, payments, stock, dispatch, receivables and settlements |
| Proposal reference | Page 14; technical notes section 8 |
| Current repository state | Strong but operation-specific; partial standardization |
| Repository evidence | Quote `client_request_id`; stock sale/dispatch/payment idempotency indexes; production unique shift grain; Razorpay event/payment claims; referral refund keys. Gaps in manual stock-lot creation, owner advance, supervisor float/kharchi, machine-operator assignment and estimator conversion paths |
| Existing strengths | Consequential sale, receipt, payroll, production and billing workflows already use database-enforced replay boundaries |
| Concrete weakness | No shared command contract means some direct inserts still rely on UI loading state; lost responses can duplicate money/material actions |
| User impact | Potential duplicate Upaad/kharchi/refill, duplicate stock lot, or ambiguous assignment state |
| Pilot relevance | P1 targeted; no P0 gap proven in the current three formal pilot gates |
| Implementation size | Small/medium per command |
| Regression risk | Medium because migrations and callers change |
| Recommendation | Extend the existing org-scoped request-key/RPC pattern only to demonstrated gaps; do not build a generic platform first |
| Proposed validation | Same-key replay, different-payload conflict, concurrent calls, wrong role, cross tenant, refresh/re-login and response-loss simulation |
| Notes | See `idempotency-matrix.md` |

## C04 - Append-only audit and controlled correction/reversal

| Field | Analysis |
|---|---|
| Proposal concept | Audit/event records for material, financial, security, correction and reversal actions; controlled state transitions |
| Proposal reference | Pages 13-15; technical notes sections 8 and 10 |
| Current repository state | Broadly implemented; operator visibility partial/archived |
| Repository evidence | `audit_log` and trigger expansions in `20260325100000_audit_log.sql`, `20260326000000_audit_trail_expansion.sql`, `20260331010000_comprehensive_audit_expansion.sql`, `20260705100000_batch_24g_security_audit_guardrails.sql`; production correction, payroll unsettlement, stock movements and worker erasure RPCs |
| Existing strengths | Sensitive history is retained, secrets are redacted, corrections/reversals are explicit, normal users cannot rewrite audit history |
| Concrete weakness | Audit browser is under archived `/owner/settings/audit`; several direct multi-write paths can fail before their intended complete audit shape exists |
| User impact | Core historical truth is protected; support investigation is slower without an active narrow diagnostic surface |
| Pilot relevance | P2 for visibility; P1 only for repairing unsafe command boundaries |
| Implementation size | Small for support lookup; large and harmful for full event sourcing |
| Regression risk | Low for read-only support view, high for replacing current models |
| Recommendation | Preserve append-only audit and domain-specific reversals; reject full event sourcing; add only bounded support visibility after pilot demand |
| Proposed validation | Attempted mutation denial, redaction, correction/reversal reconciliation and role/tenant access tests |
| Notes | Silent overwrite is already avoided in the highest-consequence production/payroll/stock histories |

## C05 - Golden end-to-end acceptance journeys

| Field | Analysis |
|---|---|
| Proposal concept | Mandatory Estimator and full-suite journeys as formal acceptance gates |
| Proposal reference | Page 14; technical notes sections 10-11 |
| Current repository state | Extensive evidence and ledger exist; no compact automated release gate |
| Repository evidence | 96+ Vitest files; `output/qa/AMY_QA_20260603_0218/`; `output/qa/PILOTQA-20260621-2058-8QIH/`; `docs/pilot-remediation/REMAINING_GATE_REPORT.md` with 368 PASS / 0 FAIL / 6 BLOCKED / 3 N/A after Founder UX-012 approval |
| Existing strengths | Journeys already cover onboarding, roles, estimator, order, stock, dispatch, receipt, commercials and mobile; formal evidence distinguishes PASS/FAIL/BLOCKED |
| Concrete weakness | Tests are often source contracts; there is no repository PR CI or small deployment-gate suite; current auth changes have not been rerun |
| User impact | Regression detection depends too much on manual campaigns and can lag a release |
| Pilot relevance | P1; the three outstanding real-world gates are P0 operational prerequisites |
| Implementation size | Small/medium |
| Regression risk | Low, except flaky or data-destructive browser automation if poorly isolated |
| Recommendation | Adopt the 15-journey gate in `golden-journeys.md` using isolated QA tenants and evidence classifications |
| Proposed validation | CI/source gate, QA browser/database reconciliation, provider Test Mode and scheduled restore drill |
| Notes | Never count code inspection as runtime proof |

## C06 - Correlation IDs and operational observability

| Field | Analysis |
|---|---|
| Proposal concept | Structured logs, monitoring/error tracking and webhook/payment/messaging diagnostics |
| Proposal reference | Pages 11 and 13; technical notes section 12 |
| Current repository state | Partial |
| Repository evidence | `instrumentation.ts`, `instrumentation-client.ts`, `instrumentation.edge.ts`, `lib/sentry-redaction.ts`, release configuration in `next.config.ts`, route/phase tags in billing, timing/query counts in `lib/perf.ts`; no `x-request-id`/shared operation ID found; 229 direct `console.*` calls |
| Existing strengths | Sentry spans runtimes, replay is masked, sensitive headers/cookies are redacted, release metadata and route timings exist |
| Concrete weakness | One user action cannot be reliably joined across browser, server action, RPC, audit row and provider; users have no safe support reference |
| User impact | Pilot incidents take longer to diagnose and may require sensitive screenshots/descriptions |
| Pilot relevance | P1 |
| Implementation size | Small/medium |
| Regression risk | Low if additive and redacted |
| Recommendation | Add an additive operation ID helper, safe structured log fields and Sentry tags first on billing, production, stock, dispatch and payroll commands |
| Proposed validation | Propagation tests, redaction test, support-code display, log/Sentry lookup in QA, no PII/access code/full financial payload |
| Notes | Do not tag Sentry with unbounded high-cardinality sensitive identifiers indiscriminately |

## C07 - Backup, restoration and incident readiness

| Field | Analysis |
|---|---|
| Proposal concept | Automated backup, restore procedure, incident approach and handover runbooks |
| Proposal reference | Pages 13-16; technical notes section 13 |
| Current repository state | Implemented workflow/runbook; required runtime proof blocked |
| Repository evidence | `.github/workflows/supabase-production-backup.yml`, restore-drill workflow, `scripts/backup/`, `docs/pilot-remediation/closure-packs/TECH-011_BACKUP_RESTORE_RUNBOOK.md`; scheduled run 29368765626 failed after dump creation and yielded no artifact |
| Existing strengths | Encrypted logical backup, hashes, fail-closed storage coverage, 14-day artifact retention, disposable restore/reconciliation and cleanup are designed |
| Concrete weakness | No successful retained scheduled artifact has yet been restored; a sensitive-looking untracked recovery file is present at repository root |
| User impact | Recoverability is assumed rather than proven; accidental credential commit would create a security incident |
| Pilot relevance | P0 operational gate (`TECH-011`) |
| Implementation size | Small operational execution; no new architecture |
| Regression risk | Low if performed only in disposable infrastructure; unacceptable if target identity is ambiguous |
| Recommendation | Complete the existing drill and move/secure recovery material outside the repo; do not redesign backup tooling |
| Proposed validation | Scheduled artifact hash, disposable restore, tenant/domain counts/invariants, measured RTO, cleanup and artifact/key separation |
| Notes | No production or database command was run in this review |

## C08 - Representative-volume performance testing

| Field | Analysis |
|---|---|
| Proposal concept | Representative-volume performance and key-page response-time acceptance |
| Proposal reference | Page 14; scale assumptions page 2 |
| Current repository state | Partial measurement; authenticated representative proof missing |
| Repository evidence | `docs/performance/campaign-20260715/` documents 32.5%-43.3% gzip reductions and route timing helpers; `lib/perf.ts`; pagination test with 503 movements; no 25-100 tenant/150 loom/100 worker seed or p50/p95 suite found; QA sign-in blocks current authenticated campaign |
| Existing strengths | Recent work measured bundle output before changing it and rejects speculative indexes |
| Concrete weakness | No route/query budgets at realistic tenant history; unbounded/N+1 risk cannot be ranked from current evidence |
| User impact | Large pilot factories may see slow dashboards or mobile startup without warning |
| Pilot relevance | P1 measurement, P2 optimization unless a budget fails |
| Implementation size | Medium for safe fixtures/measurement; unknown for resulting fixes |
| Regression risk | Low in isolated QA; high if destructive data is seeded in production |
| Recommendation | Unblock QA auth, define non-production representative fixtures and budgets, measure first, optimize only failed routes |
| Proposed validation | Query count, DB plan, server timing, p50/p95, low-powered mobile trace and before/after threshold |
| Notes | Current stack should not be replaced based on an unmeasured concern |

## C09 - Owner, Supervisor and Platform Admin UX boundaries

| Field | Analysis |
|---|---|
| Proposal concept | Owner web app, mobile-first Supervisor PWA and platform administration interface |
| Proposal reference | Pages 5, 8 and 10-12; technical notes sections 2, 3, 6 and 17 |
| Current repository state | Owner and Supervisor implemented and role-optimized; Admin implemented but archived |
| Repository evidence | `components/navigation/owner-sidebar.tsx`, `components/factory-today/`, `components/navigation/supervisor-nav.tsx`, supervisor dashboard tests, role layouts; `/admin` source plus archive enforcement in `lib/phase1-scope.ts` and `proxy.ts` |
| Existing strengths | Owner exception-oriented home, production-mode/tier navigation, supervisor one-tap tasks, safe areas, drafts, unknown outcomes, day/night and multilingual resources |
| Concrete weakness | Factory terminology lacks reviewer sign-off; admin source is compliance-heavy and not an active focused support console |
| User impact | Owner/supervisor workflows are pilot-suitable; support diagnosis may require database/operator knowledge |
| Pilot relevance | P0 terminology sign-off; P2 minimal admin support tools |
| Implementation size | Small operational sign-off; medium support surface |
| Regression risk | Low for sign-off/read-only lookup; medium for broad admin portal |
| Recommendation | Preserve role UX; finish terminology proof; defer admin activation/build until concrete support operations are identified |
| Proposed validation | Mobile taps/viewports/weak network, wrong role/direct links, translated terminology review and admin audit/security tests |
| Notes | Native apps are unnecessary while the PWA meets pilot needs |

## C10 - Estimator cost-stack explanation

| Field | Analysis |
|---|---|
| Proposal concept | Explain yarn, warp/weft, wastage/crimp, preparation, weaving, power/labour/overhead, processing, transport, commission, margin and final rate |
| Proposal reference | Pages 3 and 15; technical notes section 17 |
| Current repository state | Implemented; formula truth still externally blocked |
| Repository evidence | Decimal engine in `lib/estimator.ts`; server validation in `lib/estimator-validation.ts`; UI in `components/cost-analysis-details.tsx` and `EstimatorClient.tsx`; deterministic tests |
| Existing strengths | Layered yarn and all major processing/commercial costs are shown; quote snapshots retain assumptions/results |
| Concrete weakness | No independent factory truth sheet proves that approved domain inputs/formulas match practice (`GOLDEN-A-03`) |
| User impact | UI is explanatory, but a formula mismatch could undermine pricing confidence |
| Pilot relevance | P0 validation; no feature rewrite |
| Implementation size | Small operational reconciliation |
| Regression risk | High if formulas are changed without evidence |
| Recommendation | Preserve UX/formulas until signed real-fabric reconciliation; only clarify labels supported by reviewer evidence |
| Proposed validation | Independent worked sheet with input/intermediate/final tolerance, saved-quality restore and quote snapshot comparison |
| Notes | Narola also required the client to supply approved formulas; it would not invent them |

## C11 - Estimator scenario comparison

| Field | Analysis |
|---|---|
| Proposal concept | Compare alternative rates, output, cost and margin scenarios |
| Proposal reference | Page 3; technical notes section 17 |
| Current repository state | Partial, useful baseline already implemented |
| Repository evidence | `runScenarios` in `lib/estimator.ts` and four sensitivity results rendered in `EstimatorClient.tsx` |
| Existing strengths | Users already see price/margin sensitivity without cloning a separate product architecture |
| Concrete weakness | No arbitrary side-by-side comparison for yarn rates, picks, width, RPM, wastage and loom type |
| User impact | Power users may do manual duplicate/edit comparison; no proven pilot blocker |
| Pilot relevance | P2 |
| Implementation size | Medium |
| Regression risk | Medium UX complexity; formula risk if calculations diverge |
| Recommendation | Defer to pilot feedback; if demanded, reuse the one estimator engine and compare immutable input/result snapshots |
| Proposed validation | User research, deterministic equality with base engine, mobile readability and export/history semantics |
| Notes | Formula correctness outranks feature breadth |

## C12 - Platform administration and support tooling

| Field | Analysis |
|---|---|
| Proposal concept | Platform dashboard for tenants, subscriptions, support, diagnostics and operations |
| Proposal reference | Pages 8 and 12; technical notes sections 3, 6 and 17 |
| Current repository state | Partial/archived |
| Repository evidence | `/admin` pages for grievances, notices, DPA, exports, lockdown, breach/compliance; admin role/RLS; archive list in `lib/phase1-scope.ts` |
| Existing strengths | Security-sensitive lockdown/export/compliance primitives exist and are role-bounded |
| Concrete weakness | No active minimum support view joining tenant/subscription/provider/audit diagnostics; existing admin scope is broader than pilot support needs |
| User impact | Founder support may require direct logs/database checks; no customer-facing workflow is blocked |
| Pilot relevance | P2 unless pilot support volume demonstrates need |
| Implementation size | Small/medium for read-only lookup; large for full portal |
| Regression risk | Medium/high due service-role and cross-tenant visibility |
| Recommendation | Defer; later activate only a narrowly scoped, audited, read-first support tool with no impersonation by default |
| Proposed validation | Admin-only, denial for owner/supervisor, reason/audit record, field redaction and tenant-lock tests |
| Notes | Do not unarchive the entire compliance portal just to satisfy a proposal diagram |

## C13 - Immutable/historical commercial snapshots

| Field | Analysis |
|---|---|
| Proposal concept | Immutable quote/order pricing and historical rate snapshots |
| Proposal reference | Pages 2, 3 and 5; technical notes sections 8 and 17 |
| Current repository state | Implemented strongly |
| Repository evidence | Estimator quote snapshots/revisions and `source_quote_id`; accepted/converted immutability; quote-to-order/market-run requirements, landed-cost and worker-rate snapshots; production operator-rate snapshots; payroll settlement itemization |
| Existing strengths | Later setting/rate changes do not silently rewrite commercial or payroll history |
| Concrete weakness | No systemic weakness found that justifies another snapshot framework; support visibility is separate |
| User impact | Historical quotes, order economics, production earnings and settlements remain explainable |
| Pilot relevance | P0 preserve |
| Implementation size | None |
| Regression risk | High if replaced or normalized away |
| Recommendation | Preserve existing domain snapshots; add fields only when a real historical decision requires them |
| Proposed validation | Change current rates/settings, then assert historical quote/order/log/settlement values remain unchanged |
| Notes | This is a proposal principle already realized without event sourcing |

## C14 - Atomic cross-module business operations

| Field | Analysis |
|---|---|
| Proposal concept | Atomic transactions and reconciliation across production, stock, dispatch, commercials and payroll |
| Proposal reference | Pages 13-15; technical notes section 8 |
| Current repository state | Strong core implementation; bounded gaps |
| Repository evidence | Production/stock, sale/dispatch/receivable, payment/allocation, payroll/deductions and assignment-context RPC migrations; direct gaps listed in `current-state-map.md` |
| Existing strengths | Highest-consequence cross-module workflows are row/advisory locked and transactional in PostgreSQL |
| Concrete weakness | Manual stock lot + opening movement and machine operator history + legacy mirror span separate requests; market-run compensation is weaker than one transaction |
| User impact | Rare mid-request failure can leave incomplete stock audit or assignment mirrors |
| Pilot relevance | P1 targeted |
| Implementation size | Medium per RPC/migration |
| Regression risk | Medium |
| Recommendation | Consolidate only the demonstrated multi-write commands; preserve current modular monolith |
| Proposed validation | Forced middle-step failure, all-or-nothing invariant, concurrent calls, tenant/role denial and rollback migration plan |
| Notes | Supabase Auth plus database provisioning remains a cross-system saga, not a candidate for fake atomicity |

## C15 - Retry-safe third-party integrations

| Field | Analysis |
|---|---|
| Proposal concept | Diagnostics, retries and idempotency for payments, webhooks and messaging |
| Proposal reference | Pages 11, 13 and 14; technical notes sections 9 and 12 |
| Current repository state | Razorpay strong but runtime-blocked; WhatsApp adequate for optional status |
| Repository evidence | HMAC and canonical fetch routes, webhook claim/payload hash, monotonic billing state, refund idempotency header; WhatsApp consent/mode/retry/callback code |
| Existing strengths | Provider events cannot readily double-activate subscriptions; business writes survive notification failure |
| Concrete weakness | Hosted successful payment/replay proof is missing; checkout-order creation has provider-before-local gap; WhatsApp unknown provider outcomes lack reconciliation |
| User impact | Paying launch cannot be fully signed off; optional message duplication is possible when live |
| Pilot relevance | P0 before charging; P2 for optional live messaging and checkout cleanup |
| Implementation size | Operational proof small; checkout registry/outbox medium |
| Regression risk | Low for Test Mode proof, medium for integration changes |
| Recommendation | Complete hosted Test Mode journey; preserve webhook lifecycle; defer provider-neutral outbox until live need |
| Proposed validation | Provider Test Mode capture, signature, replay, entitlement refresh, duplicate checkout, refund idempotency and timeout simulation |
| Notes | Limited non-paying pilot can explicitly classify Razorpay as N/A |

## C16 - Environment separation and deployment controls

| Field | Analysis |
|---|---|
| Proposal concept | Separate development, QA/staging and production, client-owned accounts/Git and CI/CD |
| Proposal reference | Pages 11, 13, 16 and 18; technical notes sections 6, 14 and 15 |
| Current repository state | Partial |
| Repository evidence | Distinct local QA/production Supabase refs; Vercel project metadata; QA provisioning assertion; `supabase/config.toml` and `.temp/project-ref` currently target production; no general application PR workflow under `.github/workflows/` |
| Existing strengths | QA and production databases are distinguishable; secrets are ignored; repository and service accounts are client-controlled |
| Concrete weakness | CLI default link points to production and no repository-enforced lint/type/test/build/promotion gate is visible |
| User impact | A mistargeted command or untested merge is a higher pilot risk than missing enterprise hosting |
| Pilot relevance | P1 |
| Implementation size | Small/medium |
| Regression risk | Low if checks are non-mutating; CI cost/time needs control |
| Recommendation | Add explicit environment assertions to destructive procedures and a lean PR CI gate; do not migrate cloud |
| Proposed validation | Deliberate wrong-ref failure, secret scan, clean install/lint/type/test/build and documented promotion/rollback |
| Notes | No database or deployment operation was performed here |

## C17 - Infrastructure and stack topology

| Field | Analysis |
|---|---|
| Proposal concept | React/Next frontend, modular Node/Nest backend, PostgreSQL, object storage, scalable cloud and queues |
| Proposal reference | Pages 10-13; technical notes sections 6 and 14 |
| Current repository state | Actual stack already meets the underlying requirements with fewer components |
| Repository evidence | Next.js/React/TypeScript in `package.json`; Supabase Auth/PostgreSQL/RLS/Storage/Edge Functions; Vercel metadata; Upstash used narrowly for rate limiting; Sentry and PWA setup |
| Existing strengths | One deployable application, transactional Postgres, managed auth/storage, tenant RLS and low operational burden fit pilot stage |
| Concrete weakness | No topology failure, isolation breach, throughput limit or operational ownership gap demonstrates need for a separate backend/cloud/container platform |
| User impact | A rewrite would delay pilot and create regressions without visible product value |
| Pilot relevance | Rejected |
| Implementation size | Architectural |
| Regression risk | Extreme |
| Recommendation | Preserve Next.js + Supabase/PostgreSQL + Vercel; reject NestJS rewrite, microservices, cloud migration, general Redis/queue, containers and Kubernetes |
| Proposed validation | Continue measuring latency, connection/load limits and deploy reliability; reconsider only upon sustained evidence |
| Notes | Upstash rate limiting already exists; that does not justify turning Redis into a system-wide dependency |

## C18 - Additional proposal product ideas

| Field | Analysis |
|---|---|
| Proposal concept | Public dispatch tracking, Gujarati/Hindi readiness, actual-metres stock, yarn inventory/accounting/analytics/mobile/IoT futures |
| Proposal reference | Pages 5-10 and 18; technical notes sections 17-18 |
| Current repository state | Mixed: language resources and actual-metres stock implemented; public tracking and yarn/ledger routes archived; futures absent/deferred |
| Repository evidence | `lib/i18n/`, stock lot/movement/dispatch models, `/track/[token]` source, `/owner/inventory` and `/owner/ledger` source, archive enforcement in `lib/phase1-scope.ts` |
| Existing strengths | Architecture can evolve without prebuilding optional modules; tracking/inventory source can be evaluated later rather than rebuilt blindly |
| Concrete weakness | Active docs are inconsistent about public tracking; terminology remains unapproved; no evidence demands ERP, IoT or predictive modules now |
| User impact | Pilot scope remains focused; accidental claims about archived features could confuse sales/support |
| Pilot relevance | P0 terminology proof; P2 tracking/yarn/accounting based on demand; P3 analytics/IoT; several ideas rejected now |
| Implementation size | Small documentation correction through architectural future modules |
| Regression risk | Low for scope docs, high for premature module activation |
| Recommendation | Treat archive code as inactive, validate terminology, gather pilot demand; reject native mobile/full accounting/IoT/predictive benchmarking now |
| Proposed validation | Active route checks, user interviews, domain data availability, hardware/API proof and explicit compliance scope before future work |
| Notes | Narola itself conditioned formula, accounting, prediction and IoT work on client inputs and separate scope |

## Overall decision

Narola's useful principles are transaction integrity, tenant isolation, replay safety, historical truth, golden journeys, observability, recovery proof, role-focused UX and representative measurement. Weavly already implements most of them in its existing stack. The repository supports finishing three real-world pilot gates and repairing a small set of command-boundary inconsistencies; it does not support a greenfield architecture replacement.
