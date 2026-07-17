# Weavly current-state map

Reviewed: 2026-07-15 IST

## Scope and evidence rules

This map describes the active repository and its existing evidence. It does not infer production behavior from source alone. Status terms mean:

- **Confirmed implementation:** active source plus a clear caller and/or database boundary.
- **Partial implementation:** a meaningful implementation exists but a stated gap or deliberately archived surface remains.
- **Documentation-only claim:** documentation describes a control whose runtime result is not present.
- **Test-only scaffolding:** automated assertions/simulations exist without equivalent runtime proof.
- **Dead or unused:** source exists but the active archive/routing boundary prevents product use.
- **Unverified implementation:** source exists but current runtime evidence is absent, stale, or blocked.
- **Missing capability:** thorough search found no implementation.
- **Runtime verification blocked:** the implementation exists but the required safe/external proof cannot currently be produced.

The working tree contained unrelated uncommitted authentication, production-mode, estimator, and test work before this review. Those files are listed in `pre-change-checkpoint.md` and have not been edited by this review.

## Executive architecture map

Weavly is an implemented modular monolith, not a greenfield project:

- Next.js 16 App Router, React 19, TypeScript, server components/actions, route handlers, and client components (`package.json`, `app/`).
- Supabase Auth, SSR/browser clients, service-role server client, PostgreSQL, RLS, triggers, views, and transactional RPCs (`lib/supabase/*`, `supabase/migrations/`).
- Vercel deployment metadata and Sentry integration (`.vercel/project.json`, `next.config.ts`, `instrumentation*.ts`).
- Responsive owner and supervisor PWAs using `@ducanh2912/next-pwa`, safe-area layout, mobile bottom navigation, and install/update/session controls (`next.config.ts`, `app/manifest.ts`, `components/navigation/*`, `components/pwa-*`).
- 211 SQL migrations, 74 unique table declarations, about 100 named SQL functions, 96 Vitest files, nine Next API routes, 11 Supabase Edge Functions, and 46 pages at inspection time.

The repository already embodies most useful principles in Narola's proposal: PostgreSQL transactions/constraints, tenant isolation, role-specific web surfaces, immutable commercial snapshots, non-blocking messaging retries, billing/webhook idempotency, audit trails, PWA delivery, and extensive pilot QA. The central gaps are proof completion, consistency across the remaining direct writes, operational traceability, and measured representative-volume performance - not stack replacement.

## Application and routing

**Confirmed implementation.** `app/` uses Next.js route groups for `(auth)`, `(dashboard)`, and `(public)`, plus `app/api`. Owner routes cover estimator, quotes, orders, market runs, analytics, stock, dispatches, commercials, payroll, advances, machines, workers, billing, archive, settings, and Factory Today. Supervisor routes cover the production dashboard, workers, attendance, and machines. An admin route and public tracking route also exist.

**Important active boundary.** `lib/phase1-scope.ts` deliberately redirects `/admin`, `/owner/inventory`, `/owner/ledger`, `/owner/settings/audit`, `/owner/system-health`, and `/track` to `/feature-archived`; `proxy.ts:315-316` enforces that boundary. These surfaces are implemented code but inactive for the pilot. `__tests__/phase1-scope.test.ts` protects the archive list.

**Documentation inconsistency.** `docs/general/PHASE_1_SCOPE.md` both describes public tracking concepts and explicitly defers `/track/[token]`; `docs/general/PHASE_1_ARCHIVE.md` says dispatches and public tracking are kept while the active `PHASE_1_ARCHIVED_ROUTES` includes `/track`. The code is authoritative: public tracking is currently archived.

## Server and client boundaries

**Confirmed but mixed.** Server-side auth and initial loaders are common: `app/(dashboard)/owner/layout.tsx`, `app/(dashboard)/supervisor/layout.tsx`, payroll/advances/machines/dispatch loaders, and route actions. Browser clients remain in interactive screens such as payroll and supervisor pages.

Domain rules are increasingly extracted into `lib/estimator.ts`, `lib/estimator-validation.ts`, `lib/quotes/`, `lib/commercials/`, `lib/dispatch/`, `lib/payroll-*`, `lib/stock-*`, and role/action modules. Critical mutations frequently delegate to SQL RPCs.

**Maintainability weakness.** `app/(dashboard)/supervisor/actions.ts`, `app/(dashboard)/owner/actions.ts`, and `app/(dashboard)/owner/estimator/EstimatorClient.tsx` remain large multi-responsibility files. This is a gradual modular-monolith boundary problem, not evidence for microservices or a separate backend.

## Authentication, sessions, and tenant resolution

**Confirmed implementation.** `lib/auth.ts` provides request-cached session/profile resolution, role routing, revocation checks, server-side profile validation, writable-organization checks, and `requireRole`. `lib/supabase/server.ts` binds Supabase SSR to server cookies; `lib/supabase/client.ts` provides a singleton browser client; `lib/supabase/admin.ts` is server-only and explicitly warns that it bypasses RLS.

`proxy.ts` refreshes/reads Supabase session state and applies role, onboarding, subscription, archive, and tenant-lockdown routing. Authorization-critical server actions query the profile/database rather than trusting client metadata alone (`lib/auth.ts:125-141`).

**Uncommitted overlap.** `lib/auth.ts`, `proxy.ts`, login actions/forms, signout code, and related tests had active uncommitted performance-campaign work before this review. Conclusions use the visible working tree but no recommendation should edit these files until that campaign is reconciled.

**Partial cross-system transactionality.** `createOrganization` and `joinOrganization` in `app/(auth)/actions/auth.ts` create Auth and application rows with compensating deletion on failure. The email uniqueness boundary makes duplicate signup retries safe in the normal case, but Supabase Auth plus PostgreSQL cannot be one database transaction; cleanup failure can theoretically leave an orphan. The code comment says "atomically," but the implementation is a saga/compensation pattern.

## Organisation membership and roles

**Confirmed implementation.** Profiles carry `org_id` and `role`; roles include owner, supervisor, and admin (`20260425181500_admin_dashboard_foundation.sql`). JWT custom claims are populated by migrations such as `20260403010000_jwt_app_metadata_hook.sql`, while live server authorization rechecks `profiles`.

Owner, supervisor, and admin layouts call `requireRole`. Database policies repeatedly bind `org_id` to JWT membership and role. `20260625195248_harden_profile_authorization_boundary.sql` blocks user mutation of authorization fields. `20260625215612_harden_access_code_fail_closed.sql`, `lib/access-codes.ts`, and `lib/rate-limit.ts` harden access-code validation, one-time consumption, and lockout.

## Supabase use, RLS, and server authorization

**Confirmed implementation.** The system uses user-scoped clients for RLS-governed reads/writes and service-role clients for controlled server operations. Migrations enable RLS on tenant tables and implement owner/supervisor/admin/public boundaries. `20260710110907_enforce_standalone_estimator_boundary.sql` adds restrictive subscription-aware RLS and mutation triggers across tenant-owned tables, plus same-tenant quote revision links.

**Strength.** Critical SECURITY DEFINER functions generally validate actor, role, tenant, lockdown, and entity ownership, then restrict execution grants. Recent functions use advisory locks and row locks for serialization.

**Risk.** Service-role use is broad in compliance/admin/auth helpers (`lib/actions/compliance.ts`, auth provisioning, billing/webhooks). Those callers require strict server-only imports and explicit org/role filters because RLS is bypassed. Existing tests cover many boundaries, but this remains an area where centralized command/service ownership would improve maintainability.

## Database constraints and transaction usage

**Confirmed implementation with strong core coverage.** Examples:

- Quote conversion: unique quote/order links, row lock, and `convert_accepted_quote_to_order` in `20260509140000_p0_atomic_quote_and_production.sql`.
- Supervisor production: unique `(org_id,machine_id,date,shift)`, advisory lock, replacement transaction, correction audit, and generated-stock reconciliation in `20260626064830_production_stock_atomicity.sql`.
- Assignment context: row-locked `upsert_shift_assignment_context_v1` writes dated assignment, standing assignment, and current order in one transaction (`20260711134000_atomic_machine_assignment_context.sql`).
- Stock sale/dispatch/receivable: idempotency keys, row locks, stock decrement, movement, dispatch packages, and receivable in the same RPC (`20260627195152_batch_3_dispatch_sale_receipt_correctness.sql`).
- Receivable collection: required idempotency key and row-locked `record_commercial_payment_v1` (`20260628121903_batch_4_commercials_receivables_payments.sql`).
- Payroll: settlement uniqueness/serialization, atomic advance deductions, protected reversal, and kharchi plus float transaction (`20260701105404_batch_20_payroll_rpc_kharchi_atomicity.sql`, `20260714043000_b13_harden_payroll_settlement_lifecycle.sql`).
- Billing/referrals: atomic activation, unique payment/event identities, monotonic lifecycle events, advisory locks, and provider refund idempotency (`20260714090000_b17_harden_razorpay_lifecycle.sql`, `lib/billing-activation.ts`, `lib/referral-webhook.ts`).

**Confirmed current partial-completion windows.** These are bounded candidates, not reasons for a new architecture:

- `createTakaStockLot` inserts `fabric_stock_lots` and then `fabric_stock_movements` in separate requests. A movement failure returns an error after the lot exists (`app/(dashboard)/owner/stock/actions.ts:624+`).
- `createAdvance` inserts a monetary advance without an idempotency key. Its WhatsApp call is non-blocking and does not roll back the advance, which is correct, but a lost response/retry can create a duplicate advance (`app/(dashboard)/owner/advances/actions.ts:17+`).
- `refillSupervisorFloat` directly inserts a float transaction without a request key (`app/(dashboard)/supervisor/actions.ts:1726+`).
- `upsertMachineOperatorAssignment` closes the prior operator row, inserts a new historical row, then mirrors/clears `machine_assignments` in separate requests and explicitly reports possible partial success (`app/(dashboard)/owner/actions.ts:531+`).
- Razorpay order creation calls the provider before persisting the local checkout row. Duplicate clicks can create unused provider orders and a local insert failure can orphan an external order, although activation/payment uniqueness prevents duplicate entitlement (`app/api/billing/create-order/route.ts`).

## Existing idempotency

**Confirmed but operation-specific, not system-standardized.** Quote saves use client UUIDs and `(org_id,client_request_id)` uniqueness. Sales, dispatches, and commercial receipts use explicit idempotency keys. Production replacement uses a unique business grain and lock. Webhooks use stored event identity/payload hashes and a claim state machine. Billing activation is idempotent by provider order/payment identity. Referral refunds use both a database claim and Razorpay's idempotency header.

The repository lacks one shared idempotency contract/helper covering request-key generation, persistence, conflict semantics, replay responses, expiry, and observability. The detailed operation assessment is in `idempotency-matrix.md`.

## Audit, correction, reversal, and historical snapshots

**Confirmed broad audit implementation.** `audit_log` is append-only to normal application users and is populated by triggers or explicit RPC events. Audit triggers cover production, payroll payments/settlements, advances, attendance, workers, fixed workers, machines, orders, qualities, assignments, profiles, payroll config, estimator settings/templates/quotes, yarn/beam data, operator assignments, settings, and security operations (`20260325100000_audit_log.sql`, `20260326000000_audit_trail_expansion.sql`, `20260331010000_comprehensive_audit_expansion.sql`, `20260705100000_batch_24g_security_audit_guardrails.sql`). Settings payloads redact access-code, phone, and provider values.

**Confirmed controlled correction/reversal patterns.** Production corrections replace a shift grain transactionally, emit correction audit data, and reconcile generated stock. Payroll has hardened settlement/unsettlement and prevents deletion of settlement-linked advances. Stock adjustments append `fabric_stock_movements`. Dispatch receipt confirmation records variance and discrepancy state. Worker erasure is atomic and audited (`20260714063000_b15_atomic_worker_erasure.sql`).

**Confirmed commercial snapshots.** Estimator quotes store complete recipe/rates/cost results; accepted/converted quotes become immutable history and re-estimation creates `source_quote_id` revisions. Orders and market runs receive worker-rate, landed-cost, requirement, and estimator snapshots (`app/(dashboard)/owner/estimator/actions.ts`, `20260710054420_estimator_production_readiness_hardening.sql`, `__tests__/batch10-estimator-quote-order-snapshots.test.ts`). Production logs retain worker/operator rate snapshots; payroll settlements retain itemization.

**Partial/archived visibility.** `/owner/settings/audit` is implemented but archived, so pilot operators do not have an active audit browser. The minimum need is support diagnostics, not necessarily unarchiving the full registry.

## Background jobs, cron, and external integrations

**Confirmed lightweight background processing.** Supabase Edge Functions implement WhatsApp messages, summaries, deadline/pace checks, lockdown alerts, and retry. `20260402120000_retry_cron.sql` schedules hourly retry of recent failed messages; retry metadata and a three-attempt cap live in the delivery table. Daily/monthly summary records have an idempotency grain (`20260714073000_b16_whatsapp_delivery_boundaries.sql`).

**No general outbox.** There is no provider-neutral transactional outbox table. WhatsApp sends generally happen after the business write and failures are logged/retried, so core writes remain intact. This is sufficient for disabled/optional pilot messaging; a generic queue service is not justified.

**Razorpay.** Route handlers verify HMAC, fetch canonical provider entities, claim webhook events by identity/payload hash, reject identity conflicts, handle retries, and apply lifecycle state monotonically. Provider refund calls use `x-refund-idempotency` (`app/api/webhooks/razorpay/route.ts`, `lib/razorpay-refund-client.ts`). Successful hosted payment/webhook replay remains runtime-blocked for paying launch, not missing in source.

**WhatsApp.** Provider modes are fail-closed (`disabled`, `simulate`, `meta`), consent is checked, sends/logs are separated from core writes, failures have manual fallback, and status callbacks are signature-guarded. Live provider delivery remains post-pilot or externally blocked in the current ledger.

**PDF generation.** jsPDF powers client-generated payslips and quote/document outputs (`lib/generate-payslip.ts`, estimator/quote code). The performance campaign defers the payslip module until click. PDFs are generated on demand; there is no evidence that a PDF queue is needed at pilot volume.

## Observability and performance instrumentation

**Partial implementation.** Sentry is initialized for Node, Edge, and client runtimes, with trace sampling, replay masking, request/header/cookie redaction, and Vercel release metadata (`instrumentation*.ts`, `lib/sentry-redaction.ts`, `next.config.ts`). Billing/webhook paths attach route/phase tags. `lib/perf.ts` emits structured key-value timing for auth, org/tier, business data, total route time, and Supabase call count when enabled.

**Missing correlation standard.** No `x-request-id`, operation ID middleware, shared structured logger, user-visible support code, or consistent Sentry org/actor/operation context was found. There are 229 direct `console.*` calls across application/lib/Edge source. A browser operation cannot reliably be joined to server action, RPC, audit event, provider event, and Sentry issue.

**Latest source-map evidence.** Older estimator readiness evidence recorded a failed source-map upload, while the later remaining-gate report records a production gate where Sentry release upload passed. The later evidence supersedes the older deployment for general repository state, but current-branch release proof is not rerun here.

## Testing and runtime evidence

**Confirmed extensive automated coverage.** Vitest covers deterministic estimator formulas, date/finance/payroll functions, authorization/RLS source boundaries, migrations, atomicity, idempotency, stock/dispatch/commercial reconciliation, PWA/cache behavior, Razorpay/WhatsApp boundaries, and performance architecture. Many tests are source-contract assertions rather than database integration tests; they prove repository intent and prevent accidental removal but are not runtime SQL proof.

**Confirmed runtime evidence repository.** `output/qa/AMY_QA_20260603_0218/` contains browser screenshots and database/console reconciliation for onboarding, role denial, estimator/quote/order, manual stock, partial sale, dispatch, receipt, commercials payment, and mobile routes. `output/qa/PILOTQA-20260621-2058-8QIH/` contains a formal matrix, security scans, business reconciliation, screenshots, and updates. Later pilot-remediation documents record runtime batches and production checkpoints.

**Current formal state.** `docs/pilot-remediation/REMAINING_GATE_REPORT.md` records 368 PASS, 0 FAIL, 6 BLOCKED, and 3 NOT APPLICABLE after Founder UX-012 approval. It concludes No-Go pending two core gates: TECH-011 recovery governance closure and an independent real-fabric estimator truth sheet. Factory-operator terminology review is a mandatory first-pilot-run control. PASS claims in that ledger are evidence-backed or explicitly identified as Founder scope decisions; code inspection is not counted as runtime proof.

## Backup, restore, rollback, and incident readiness

**Implemented control, runtime gate blocked.** Daily encrypted logical backup and disposable restore workflows exist in `.github/workflows/supabase-production-backup.yml` and `supabase-production-restore-drill.yml`, with scripts under `scripts/backup/`. The runbook defines encryption, retention, hashes, fail-closed Storage coverage, restore order, tenant/domain reconciliation, RTO measurement, and cleanup.

`docs/pilot-remediation/closure-packs/TECH-011_BACKUP_RESTORE_RUNBOOK.md` records that scheduled run `29368765626` reached dump creation but failed closed while parsing formatted inventory; no artifact existed to restore. A source correction is documented, but `TECH-011` remains BLOCKED until one later scheduled encrypted artifact is restored and reconciled in disposable infrastructure.

**Rollback/forward-fix evidence.** Pilot remediation includes production checkpoints, migration-head checks, rollback/forward-fix procedure, and a limited-pilot authorization pack. These controls should be preserved rather than redesigned.

**Security concern outside source.** A sensitive-looking untracked recovery file exists at repository root. Its content was not inspected. `.gitignore` ignores `*.agekey` and encrypted archives but not that `.txt` filename. It must remain uncommitted and should ultimately be stored outside the repository as the runbook requires.

## Environment and deployment controls

**Partial separation.** Local production and QA env files point to distinct Supabase refs: production `vzhwahudircrpgtitwzd`, QA `eutycrtzzxmlkcpipgod`. Secrets are ignored. The Vercel project and production URL are known. `qa:provisioning-smoke` explicitly asserts the QA ref.

**Safety risk.** `supabase/config.toml` and the current CLI link target production. This makes explicit target assertions essential before any database command. No database command was run in this review.

**Missing general CI gate.** `.github/workflows/` contains production backup/restore workflows but no general pull-request workflow for install, lint, type check, tests, migration lint, or build. Vercel may supply deployment behavior externally, but repository evidence does not show a mandatory application CI gate or promotion policy.

## Representative-volume performance

**Partial measurement, runtime proof blocked.** The active performance campaign measured deterministic initial JavaScript bundles and removed 32.5%-43.3% gzip from five routes; payroll improved 46.5% gzip. Existing route work reduced server read fan-out and added structured timing (`docs/performance/campaign-20260715/*`, `lib/perf.ts`). Stock movement pagination is tested with 503 rows (`__tests__/p2-stock-audit-refresh.test.ts`).

**Missing representative data evidence.** No current 25-100 tenant, 150-loom, 100-worker, multi-period QA fixture, database plan suite, p50/p95 route budget, or low-powered authenticated mobile trace was found. The performance campaign is blocked by QA sign-in and explicitly rejects speculative indexes/SQL changes. This is a measurement gap, not evidence that the current stack cannot scale.

## Owner, supervisor, admin, and public UX

**Owner confirmed and role-optimized.** Owner navigation is grouped around Control, Factory flow, Money, Workforce, Looms, and System; it changes with production mode and subscription tier (`components/navigation/owner-sidebar.tsx`). Factory Today uses exception/action cards for production, risk, payroll, receipts, sales, commercials, and setup (`components/factory-today/*`).

**Supervisor confirmed and mobile-first.** Supervisor navigation keeps Production Log, Workers, Attendance, and Machines one tap away; layouts include safe areas, mobile bottom navigation, 44px-class targets, PWA install affordance, draft restoration, day/night selection, duplicate/correction controls, suspicious-meter confirmation, and unknown-outcome reconciliation (`components/navigation/supervisor-nav.tsx`, `app/(dashboard)/supervisor/dashboard/page.tsx`, `__tests__/batch24b-supervisor-ux-failures.test.ts`, `__tests__/off-009-mutation-outcome.test.ts`). Runtime OFF-009/OFF-010 evidence records one-row behavior under delayed/constrained network conditions.

**Language partial.** English, Hindi, and Gujarati runtime resources and glossary guards exist (`lib/i18n/*`, `__tests__/i18n-runtime.test.ts`). Factory terminology is not considered accepted until a real factory reviewer completes `UX-012`.

**Admin implemented but inactive.** `/admin` contains grievances, notices, DPA, export, tenant lockdown, breach, and compliance settings, but the route is archived. It does not provide the smaller pilot support operations Narola's platform-admin concept suggests, such as tenant/subscription lookup and provider diagnostics in one active support view.

**Public tracking implemented but inactive.** Database token functions and `/track/[token]` source exist; the route is archived and client share links were removed from current dispatch UI. Do not describe public receipt tracking as a current pilot capability.

## Estimator architecture and product clarity

**Confirmed deterministic engine and validation.** `lib/estimator.ts` uses Decimal.js and documents yarn, weaving, process, overhead, commission, transport, and margin equations. `lib/estimator-validation.ts` enforces server-side snapshot correctness. Tests contain worked deterministic scenarios, including a 60g Georgette case.

**Cost-stack explanation implemented.** The estimator UI presents yarn layers, weaving, power, overhead, warping/sizing, optional winding/processing/finishing, transport, commission, production cost, landed cost, quote price, and profit (`app/(dashboard)/owner/estimator/EstimatorClient.tsx`, `components/cost-analysis-details.tsx`). Formula truth against one independent factory sheet is still BLOCKED (`GOLDEN-A-03`). No formula should change before that evidence.

**Scenario comparison partial but already valuable.** `runScenarios` in `lib/estimator.ts` and the estimator UI expose four price/margin sensitivity scenarios. It is not a general side-by-side comparison of arbitrary yarn rates, picks, width, RPM, wastage, and loom variants. A broader feature is P2/pilot-feedback work, not a pre-pilot priority.

## Billing and subscription architecture

**Confirmed robust source implementation.** Base/Premium/trial entitlement is enforced in UI, server, RLS, and mutation triggers. Razorpay order/payment values are server-derived and canonical provider records are refetched. Atomic activation and webhook claims prevent duplicate entitlement. Referrals and refunds have database/provider idempotency.

**Runtime verification blocked for paying launch.** A Razorpay Test Mode renewal reached Checkout, but contact validation prevented successful hosted payment. Captured payment, webhook reconciliation, and replay proof are therefore BLOCKED in `outputs/estimator-production-readiness/estimator-final-summary.md`.

## Remaining FAIL and BLOCKED rows relevant to this review

- No current formal FAIL rows: the remaining-gate ledger records zero.
- `TECH-011` BLOCKED: scheduled retained backup artifact plus disposable restore/reconciliation proof.
- `UX-012` PASS: authenticated English evidence plus explicit Founder acceptance; factory-operator English/Gujarati review is mandatory during the first pilot run and may reopen the row.
- `GOLDEN-A-03` BLOCKED: independent real-fabric estimator truth sheet.
- `SIGNOFF-04` BLOCKED but downstream/operational: first-shift app meters versus independent supervisor register.
- `SEC-011` BLOCKED but assurance-deferred: direct live Sentry payload inspection.
- `OFF-001` BLOCKED but optional: physical-device PWA install/reopen.
- `SEC-018` BLOCKED before public reliance: qualified legal review.
- Paying release additionally has hosted Razorpay success/replay proof blocked.
- Current authenticated performance evidence is blocked by QA sign-in.

## Repository-grounded conclusion

The current architecture is already closer to Narola's desired behavioral properties than to Narola's proposed greenfield technology topology. Weavly should remain a Next.js/Supabase/PostgreSQL modular monolith on Vercel. The right next work is to finish real operational proof, close a few direct-write atomicity/idempotency gaps, add low-cost correlation/CI controls, and measure realistic loads. A NestJS rewrite, microservices, cloud migration, enterprise queue, Kubernetes, or full event sourcing would increase regression and operational risk without addressing the actual pilot gates.
