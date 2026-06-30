# Prioritized Failure Backlog

This backlog is grouped by root cause and ordered by the required pilot priority: security, production/stock correctness, dispatch/receipt correctness, payroll/kharchi, idempotency/offline, then release gates. `code_verified` items stay open until runtime or test evidence exists.

## Coverage Ledger

All failed matrix rows are represented below. Some IDs also appear in detailed clusters when they block more than one invariant.

| Priority band | Root-cause cluster | Failed matrix IDs |
| --- | --- | --- |
| P0 | `SEC-B` privileged action and lockdown enforcement | `AUTH-008`, `PAY-018`, `PAY-020` |
| P0 | `SEC-C` webhook, export, audit, and compliance fail-closed surfaces | `TECH-009`, `WA-008`, `SEC-009`, `SEC-014`, `SEC-015`, `SEC-017` |
| P1 | `PROD-B` production boundary, assignment, and setup validity | `SETUP-011`, `MASTER-002`, `MASTER-005`, `MASTER-014`, `ORDER-005`, `ORDER-009`, `PROD-002`, `PROD-004`, `PROD-011`, `PROD-013`, `PROD-022`, `PROD-023`, `PROD-029`, `SIGNOFF-01`, `SIGNOFF-02` |
| P1 | `ECON-A` estimator, quote, order, and date snapshot correctness | `EST-003`, `EST-011`, `EST-019`, `QUOTE-003`, `QUOTE-007`, `QUOTE-010`, `ORDER-001`, `ORDER-002`, `ORDER-006`, `ORDER-008` |
| P2 | `DASH-A` dashboard and daily sign-off read-model truth | `DASH-003`, `DASH-004`, `SIGNOFF-01`, `SIGNOFF-02` |
| P3 | `PAY-A` payroll, attendance, settlement, and kharchi ledgers | `PAY-006`, `PAY-013`, `PAY-015`, `PAY-018`, `PAY-020`, `PAY-023`, `PAY-024`, `PAY-027`, `DASH-003` |
| P4 | `IDEMP-A` mutation idempotency and unknown outcomes | `EST-017`, `OFF-009` |
| P4 | `OFF-A` offline, cache, and public claims | `OFF-007`, `OFF-010` |
| P5 | `REL-A` release gates and observability | `TECH-001`, `TECH-005`, `TECH-006` |

Blocked rows also remain unresolved evidence debt. Critical or high blocked rows must be re-run or de-scoped before pilot: `TECH-011`, `TECH-012`, `BILL-003`, `SEC-018`, `GOLDEN-A-21`, `GOLDEN-A-22`, `GOLDEN-A-23`, `GOLDEN-B-12`, `GOLDEN-B-17`, `GOLDEN-B-18`.

Medium blocked rows still need evidence or explicit pilot de-scope, but they do not outrank critical/high business-data and security repair: `AUTH-014`, `AUTH-015`, `AUTH-018`, `BILL-006`, `BILL-007`, `BILL-009`, `BILL-010`, `GOLDEN-A-03`, `SIGNOFF-04`, `UX-012`, `WA-010`. `SEC-011` is blocked for Sentry event inspection and stays tied to release/security evidence.

Closed in Batch 1 and removed from the open failure coverage rows: security foundation (`SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`, `SEC-006`, `AUTH-016`). `SEC-A` is closed; `SEC-B` remains open only for `AUTH-008`, `PAY-018`, and `PAY-020`.

Closed in Batch 2 and removed from the open failure coverage rows: `PROD-A` production correction and generated stock atomicity (`PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, `SIGNOFF-05`). `SIGNOFF-05` is also removed from open `DASH-A`; remaining dashboard/signoff rows stay open.

Closed in Batch 3 and removed from the open failure coverage rows: dispatch sale receipt correctness (`SALE-015`, `DISP-003`, `DISP-007`, `DISP-010`, `DISP-019`, `GOLDEN-B-09`, `DASH-007`, `SIGNOFF-07`, `SIGNOFF-08`). `SIGNOFF-10` remained open under dashboard/release readiness because Batch 3 supplied partial dispatch/package/receipt runtime evidence only; it is closed later by Batch 8C.

Closed in Batch 4 and removed from the open failure coverage rows: commercials receivables payments correctness (`COMM-002`, `COMM-010`, `COMM-012`, `COMM-014`, `COMM-016`, `SIGNOFF-06`, `SIGNOFF-09`). `SIGNOFF-10`, `STOCK-017`, `STOCK-016`, `GOLDEN-A-19`, `GOLDEN-A-20`, `TIME-002`, and `OFF-009` remained open or partial evidence only at Batch 4 closeout; `SIGNOFF-10` is closed later by Batch 8C.

Closed in Batch 5 and removed from the open failure coverage rows: stock audit pagination and sale-only stock refresh (`STOCK-016`, `STOCK-017`). `GOLDEN-A-19`, `GOLDEN-A-20`, `SIGNOFF-10`, `TIME-002`, and `OFF-009` remained open or partial evidence only at Batch 5 closeout; `SIGNOFF-10` is closed later by Batch 8C.

Closed in Batch 6 and removed from the blocked evidence rows: Golden A runtime customer-order chain (`GOLDEN-A-13`, `GOLDEN-A-15`, `GOLDEN-A-16`, `GOLDEN-A-17`, `GOLDEN-A-18`, `GOLDEN-A-19`, `GOLDEN-A-20`, `GOLDEN-A-24`). `GOLDEN-A-21`, `GOLDEN-A-22`, `GOLDEN-A-23`, `TIME-002`, `OFF-009`, `SIGNOFF-01`, `SIGNOFF-02`, `SIGNOFF-04`, `TECH-011`, and `TECH-012` remain open or partial evidence only; `SIGNOFF-10` remained partial at Batch 6 closeout and is closed later by Batch 8C.

Closed in Batch 7 and removed from the open failure coverage rows: date-only timezone stability and source-controlled release test gate (`TIME-002`, `TECH-013`). `SIGNOFF-10`, `TECH-007`, `TECH-009`, `TECH-010`, `TECH-011`, `TECH-012`, and `SEC-011` remained blocked or partial evidence only at Batch 7 closeout because external deployed, Sentry/source-map, restore, rollback, and production migration proof was unavailable.

Closed in Batch 8 and removed from the open failure coverage rows: migration-head alignment evidence (`TECH-007`). Closed in Batch 8B and removed from the open failure coverage rows: Sentry release/source-map evidence (`TECH-010`). Closed in Batch 8C and removed from the open failure coverage rows: clean deployed browser/server/Sentry signoff (`SIGNOFF-10`). `TECH-009`, `TECH-011`, `TECH-012`, `SEC-011`, and `WA-008` remain blocked, partial, or open because deployed webhook proof, live Sentry payload inspection, restore, and rollback/forward-fix evidence are still unavailable.

Closed in Batch 9 and removed from the open failure coverage rows: offline fallback, auth-boundary cache cleanup, offline kharchi truthful de-scope, and privacy/public offline claim truth (`OFF-002`, `OFF-005`, `OFF-006`, `OFF-008`, `SEC-016`, `PAY-028`). `OFF-007` and `OFF-010` remain partial/open because production service-worker update proof with an active draft and throttled slow/intermittent-network runtime proof across core mobile screens are still unavailable. `OFF-009` remains open under unknown-timeout/idempotency scope and was not touched.

## Closed SEC-A - Mutable Profile Authorization Boundary

Closed rows: `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`

Evidence: `logs/security-review.json`, `FINAL_REPORT.md`, `FAILURE_DATA_IMPACT_REPORT.md`, `docs/pilot-remediation/FIX_LOG.md`, active QA matrix closeout.

Invariant: role, tenant, and custom authorization claims are server-owned authority. A tenant user must not be able to change the fields used to authorize owner/supervisor/admin behavior.

Original impact: all domains were corruptible. A supervisor could self-update to owner in a rolled-back production probe and then receive owner claims after token refresh.

Resolution:

- Migration `20260625195248_harden_profile_authorization_boundary.sql` was applied and aligned locally/remotely.
- Direct authenticated updates to `profiles.id`, `profiles.role`, and `profiles.org_id` are denied; allowed direct profile updates are limited to non-authorization preference fields.
- Runtime probe `node scripts/qa/batch1a-authz-boundary-probe.mjs` passed with role/org mutation denied, token refresh preserving supervisor/original-org claims, owner-only RPC denied for supervisor, and owner login preserved.
- `npx vitest run __tests__/p0-authz-boundary.test.ts` passed 5 tests.
- Browser QA confirmed supervisor `/owner/today` access redirected to `/supervisor/dashboard`, supervisor owner-only API returned 403, and owner `/owner/today` loaded.

Required proof: satisfied by Batch 1A runtime/test/browser evidence, migration alignment, and active matrix promotion to pass.

## P0 SEC-B - Privileged Action and Lockdown Enforcement Is Inconsistent

Failures: `AUTH-008`, `PAY-018`, `PAY-020`

Closed in Batch 1: `SEC-006`, `AUTH-016`

Evidence: `logs/auth-security-time-code-evidence-20260624.json`, `logs/security-access-code-evidence.json`, `logs/payroll-kharchi-source-evidence-20260624.json`

Invariant: protected owner actions, access-code actions, locked-tenant writes, and join-code validation fail closed and are consistently rate-limited. Legacy privileged RPCs cannot bypass the app-level authorization trail.

Impact: join-code brute-force/rate-limit coverage and legacy payroll settlement/reversal paths can still bypass intended controls. Batch 1 closed access-code validation (`SEC-006`) and locked-tenant write enforcement (`AUTH-016`).

Remediation direction:

- Add join-code attempt tracking/rate limiting without noisy production lockout.
- Revoke or replace legacy payroll settlement/reversal RPC execute grants.
- Keep Batch 1 access-code and locked-tenant boundaries under regression while closing the remaining SEC-B rows.

Required proof: SQL policy/grant metadata, rollback-only QA probes, and browser checks for remaining join-code and payroll privileged-action paths. `SEC-006` proof is satisfied by `node scripts/qa/batch1b-access-code-probe.mjs`, `npx vitest run __tests__/p0-access-code-boundary.test.ts`, and migration `20260625215612_harden_access_code_fail_closed.sql`; `AUTH-016` proof is satisfied by `node scripts/qa/batch1b-locked-tenant-probe.mjs`, `npx vitest run __tests__/p0-locked-tenant-boundary.test.ts`, and migration `20260626051352_harden_locked_tenant_writes.sql`.

## P0 SEC-C - External Webhooks and Compliance Surfaces Do Not Fail Closed

Failures: `TECH-009`, `WA-008`, `SEC-009`, `SEC-011`, `SEC-014`, `SEC-015`, `SEC-017`, `SEC-018`

Evidence: `logs/technical-gates.md`, `logs/security-review.json`, `logs/security-export-erasure-evidence.json`, `logs/secrets-exposure-scan.json`, `logs/offline-pwa-evidence.json`

Invariant: externally supplied data and compliance exports must be authenticated, audited, redacted, and consistent with the product's actual behavior.

Impact: unsigned WhatsApp status callbacks can be accepted when `META_APP_SECRET` is absent; owner export is not wired/audited/redaction-reviewed; public legal/offline claims do not match implementation and require counsel review.

Remediation direction:

- Fail WhatsApp webhook before DB lookup when signature secret is absent.
- Keep data export hidden until redaction and audit events are proven.
- Sanitize payslip filenames.
- Align privacy/offline wording to implementation or implement the promised behavior.
- Treat DPDP/public-policy wording as blocked until qualified counsel review exists.

Required proof: webhook negative probes, export audit evidence, filename tests, and documented counsel sign-off or explicit de-scope.

## Closed PROD-A - Production Correction Is Not Atomic With Generated Stock

Closed rows: `PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, `SIGNOFF-05`

Closed in Batch 6 follow-ons: `GOLDEN-A-13`, `GOLDEN-A-15`, `GOLDEN-A-16`, `GOLDEN-A-17`, `GOLDEN-A-18`, `GOLDEN-A-19`, `GOLDEN-A-20`, `GOLDEN-A-24`

Still blocked follow-ons: `GOLDEN-A-21`, `GOLDEN-A-22`, `GOLDEN-A-23`

Evidence: `docs/pilot-remediation/FIX_LOG.md`, `docs/pilot-remediation/LOOP_STATE.md`, active QA matrix closeout.

Invariant: generated order stock equals current valid positive production logs exactly once. Correcting a production row to downtime must update or reverse generated stock in the same transaction.

Original impact: current customer-order production reconciled to 230.75m, but order stock showed 256.00m because a stale 25.25m lot remained. Operators could sell, dispatch, value, or sign off stock that should not exist.

Resolution:

- Batch 2 migration `20260626064830_production_stock_atomicity.sql` was human-approved, applied, and aligned locally/remotely.
- Production replacement and generated stock reconciliation now run in one RPC transaction and reconcile old and new affected grains.
- Runtime proof created 256.00m production, corrected stale 25.25m Night production to downtime, and proved `production_logs`, generated stock, Factory Today, stock summary, and signoff expected stock read 230.75m.
- No stale 25.25m saleable lot remained; reversal movement was recorded exactly once; retry did not duplicate stock or movements; sale over corrected-away stock, reduction below sold quantity, and dispatch/receipt-history correction paths were blocked.
- Factory Today/signoff read-model mismatch was fixed by using `order_progress_summary.total_meters_produced`.

Required proof: satisfied by Batch 2 targeted Vitest (8 tests), broader production/stock pack (92 tests), full Vitest (287 passed, 1 skipped), TypeScript, targeted ESLint, `git diff --check`, and disposable QA runtime proof.

## Closed GOLDEN-A Runtime Customer Order Chain

Closed rows: `GOLDEN-A-13`, `GOLDEN-A-15`, `GOLDEN-A-16`, `GOLDEN-A-17`, `GOLDEN-A-18`, `GOLDEN-A-19`, `GOLDEN-A-20`, `GOLDEN-A-24`

Still blocked Golden A rows: `GOLDEN-A-21`, `GOLDEN-A-22`, `GOLDEN-A-23`

Evidence: `output/qa/batch6/BATCH6-20260628185811-golden-a-runtime-proof.json`, `docs/pilot-remediation/FIX_LOG.md`, `docs/pilot-remediation/LOOP_STATE.md`, active QA matrix closeout.

Invariant: Golden A customer-order runtime proof must reconcile production correction, generated order stock, completed-order sale/dispatch, exact and shortage receipts, discrepancy/claim actionability, receivable/payment closeout, Factory Today source blockers, second-session refresh, and order archive/unlink behavior from authoritative source rows.

Original impact: Batch 2 fixed production/stock atomicity, but the downstream customer-order sale, dispatch, receipt, commercial, and archive steps remained blocked until the full Golden A runtime chain was rerun. Completed customer orders could also be incorrectly rejected by the stock dispatch RPC even when their order-linked sold stock was valid.

Resolution:

- Batch 6 migrations `20260628183500_batch_6_allow_completed_order_stock_dispatch.sql` and `20260628185344_batch_6_qualify_completed_order_dispatch_returning.sql` were applied and aligned before docs closeout.
- Valid order-linked sold stock can dispatch for active or completed customer orders; cancelled or invalid order state remains blocked.
- Ambiguous `dispatch_number` runtime errors were removed by qualifying the dispatch insert `RETURNING` fields.
- Runtime proof corrected production from 230.75m to 235.75m, auto-completed the order, reconciled generated stock, sold 120m on credit, completed a 70m exact receipt, recorded a 50m/45m shortage with one discrepancy and one claim, closed the Rs. 7,200 receivable with two payments, reconciled second-session state, and archived/unlinked the completed order.

Required proof: satisfied by disposable Batch 6 runtime proof with 26 assertions, focused Batch 6 Vitest, Batch 2/3/4/5 guard regression pack, full Vitest, TypeScript, targeted ESLint, migration alignment evidence, and active matrix promotion to pass.

## P1 PROD-B - Production Boundary Allows Invalid Attribution or Quantities

Failures: `SETUP-011`, `MASTER-002`, `MASTER-005`, `MASTER-014`, `ORDER-005`, `ORDER-009`, `PROD-002`, `PROD-004`, `PROD-011`, `PROD-013`, `PROD-022`, `PROD-023`, `PROD-029`, `SIGNOFF-01`, `SIGNOFF-02`

Evidence: `logs/order-stock-sale-source-evidence-20260624.json`, `logs/production-logging-source-evidence-20260624.json`, `logs/prod-dashboard-ux-signoff-source-evidence-20260624.json`, `logs/setup-master-source-evidence-20260624.json`

Invariant: each production entry belongs to one org, active machine, valid date, shift, worker, and active order/run; meters are non-negative and operationally plausible; day-only or substitute-worker support is either implemented or unsupported for pilot.

Impact: direct authenticated RPC paths can allow negative meters, production against cancelled orders, or over-target production. Day-only factories and substitute workers are not supported by the current boundary.

Remediation direction:

- Add database/RPC guards for active order/run, assignment, non-negative meters, and target/cancel constraints.
- Decide pilot scope for day-only factories and substitute workers; fix or document unsupported.
- Add duplicate loom-name prevention and atomic assignment updates.

Required proof: source tests plus rollback-only SQL/RPC probes for negative meters, cancelled order, over-target, and assignment mismatch.

## P1 ECON-A - Estimator, Quote, Order, and Date Snapshots Are Not Exact Enough

Failures: `EST-003`, `EST-011`, `EST-019`, `QUOTE-003`, `QUOTE-007`, `QUOTE-010`, `ORDER-001`, `ORDER-002`, `ORDER-006`, `ORDER-008`

Blocked evidence debt: `GOLDEN-A-03`

Evidence: `logs/business-reconciliation.json`, `logs/estimator-quotes-source-evidence-20260624.json`, `logs/order-stock-sale-source-evidence-20260624.json`, `logs/auth-security-time-code-evidence-20260624.json`

Invariant: business snapshots used for quotes, orders, wage rates, due dates, and lifecycle state must be exact, server-validated, and stable across timezones. A restored draft or lifecycle shortcut must not silently overwrite or create inconsistent accepted-order state.

Impact: worker rate entered as 2.50 persisted/displayed with floating drift, estimator save lacks server-boundary validation, accepted quote/order economics can drift, order target/deadline edits lack audit and produced-meter guards, and below-target completion lacks explicit confirmation. Batch 7 closes the separate date-only rendering shift row.

Remediation direction:

- Use decimal-safe storage/serialization for rates and financial snapshots.
- Validate estimator inputs at the server boundary.
- Make quote/order lifecycle transitions explicit and auditable.
- Add guards and audit for target/deadline edits and below-target completion.
- Require the external truth sheet or business-accepted reference estimate before closing `GOLDEN-A-03`.

Required proof: estimator calculation tests, quote/order lifecycle tests, and runtime quote-to-order checks against a business truth sheet.

Scoped estimator costing reconciliation closeout:

- Date/time: 2026-06-28 00:54 IST.
- Closed sub-scope: formula/manual/manual-practical costing, mixed formula/manual semantics, width unit handling, waste/crimp semantics, Cost Breakdown audit, and saved quote restore audit preservation.
- Evidence: `npx vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts` passed 31 tests; full `npx vitest run` passed 298 tests with 1 skipped; `npx tsc --noEmit`, `npm run build`, and scoped estimator ESLint passed; browser QA validated formula mode at `₹55.75/m`, formula-equivalent manual at `₹55.75/m`, practical manual at `₹55.91/m` or `₹56.16/m` depending on overhead, width warning for `62 cm`, and quote restore preserving `₹56.16/m`.
- Matrix status: unchanged for estimator costing rows. `EST-003`, `EST-011`, `EST-019`, `QUOTE-003`, `QUOTE-007`, `QUOTE-010`, `ORDER-001`, `ORDER-002`, `ORDER-006`, and `ORDER-008` remain open until the original row-level proof is captured. Batch 7 closes `TIME-002` with focused timezone-stability tests and display-path hardening.

## Closed DISP-A - Multi-Batch Dispatch Package Identity

Closed rows: `DISP-003`, `GOLDEN-B-09`, `DASH-007`, `SIGNOFF-07`

Closed later: `SIGNOFF-10` received partial evidence in Batch 3 and is closed by Batch 8C clean deployed browser/server/Sentry evidence.

Evidence: `docs/pilot-remediation/FIX_LOG.md`, `docs/pilot-remediation/LOOP_STATE.md`, active QA matrix closeout.

Invariant: pending dispatch equals sold meters minus dispatched meters. A second valid dispatch batch for remaining sold meters must create a new unique package/batch identity without corrupting the first batch.

Original impact: the first 50m dispatch succeeded, but the second 30m dispatch failed with `idx_fabric_packages_org_package_no`, leaving 30m pending and blocking Golden Journey B.

Resolution:

- Batch 3 migration `20260627195152_batch_3_dispatch_sale_receipt_correctness.sql` was applied and aligned, followed by forward-only RPC contract fixes `20260628071340_batch_3_dispatch_tracking_token_contract_fix.sql` and `20260628073917_batch_3_dispatch_number_returning_contract_fix.sql`.
- Runtime proof `BATCH3-fc791041` sold 80m, dispatched 50m, confirmed 30m pending, dispatched the remaining 30m with a distinct deterministic package identity, and confirmed pending dispatch became 0.
- Factory Today, Dispatches, stock, Commercials, signoff, and second-session refresh reconciled for the Batch 3 dispatch path.
- No runtime path tried to use stale `dispatches.tracking_token`, and no ambiguous `dispatch_number` runtime error remained.

Required proof: satisfied for `DISP-003`, `GOLDEN-B-09`, `DASH-007`, and `SIGNOFF-07` by Batch 3 runtime proof, targeted Vitest, full Vitest, TypeScript, targeted ESLint, migration alignment, and active matrix promotion to pass. `SIGNOFF-10` was outside Batch 3 release/Sentry scope and is closed later by Batch 8C.

## Closed DISP-B - Receipt State and Difference Queue Coherence

Closed rows: `DISP-007`, `DISP-010`, `DISP-019`, `SIGNOFF-08`

Evidence: `docs/pilot-remediation/FIX_LOG.md`, `docs/pilot-remediation/LOOP_STATE.md`, active QA matrix closeout.

Invariant: receipt variance equals received meters minus sent meters. Delivered status, receipt fields, package lines, sale summary, and stock discrepancy rows must agree. A receipt mismatch creates exactly one actionable discrepancy.

Original impact: exact receipt and shortage paths left legacy receipt fields contradictory/null or hidden from views. Zero received meters could be accepted without an explicit pilot policy.

Resolution:

- Batch 3 exact receipt closed with delivered/received state and synchronized receipt fields, with no discrepancy.
- Shortage and excess receipts each created exactly one actionable discrepancy.
- Duplicate receipt submit did not duplicate discrepancy or receipt state.
- Negative and zero receipts were blocked consistently.
- Archive helper did not archive unresolved dispatch/receipt obligations.

Required proof: satisfied by Batch 3 runtime proof, targeted Vitest, full Vitest, TypeScript, targeted ESLint, migration alignment, and active matrix promotion to pass.

## Closed P2 COMM-A - Stock Audit Refresh And History Remainder

Failures: none remaining in this cluster.

Closed in Batch 3: `SALE-015`

Closed in Batch 4: `COMM-002`, `COMM-010`, `COMM-012`, `COMM-014`, `COMM-016`, `SIGNOFF-06`, `SIGNOFF-09`

Closed in Batch 5: `STOCK-016`, `STOCK-017`

Closed in Batch 6: Golden A order-linked commercial follow-ons `GOLDEN-A-19`, `GOLDEN-A-20`

Evidence: `logs/order-stock-sale-source-evidence-20260624.json`, `logs/business-reconciliation.json`, `logs/commercials-payment-mode-evidence.json`, `logs/commercials-filter-evidence.json`, `output/qa/batch5/BATCH5-20260628173243-stock-audit-refresh.json`, `output/qa/batch6/BATCH6-20260628185811-golden-a-runtime-proof.json`, `docs/pilot-remediation/FIX_LOG.md`, active QA matrix closeout.

Invariant: each sale creates one stock decrement, one receivable when credit applies, one party identity, and one profit basis. Direct and normal paths must produce the same accounting result.

Impact: Batch 4 closes the direct market-run receivable bypass, cheque metadata/history, Asia/Kolkata due buckets, Top Parties last-sale/overdue, source filters, commercial signoff, and commercial payment idempotency. Batch 5 closes the remaining stock-board movement history pagination and stale stock refresh/second-user behavior. Batch 6 closes the order-linked Golden A receivable/payment closeout.

Resolution:

- Cursor-based stock movement pagination retrieves older audit entries beyond the old 500-row cap with deterministic `created_at desc, id desc` ordering.
- Godown Stock lot entries lazy-load older movement pages and append unique movement rows.
- Sale-only stock sale success without a dispatch id refreshes the stock page and reconciles available/pending quantities.
- Disposable runtime proof retrieved 506 movement rows as 100, 100, 100, 100, 100, and 6 with no duplicates/missing rows, then verified 75m available, 25m pending, one sale movement, one receivable, and a matching second owner session.
- Batch 4 commercial receivable/payment behavior remains covered by regression guardrails.
- Golden A order-linked receivable/payment behavior is proven by the Batch 6 runtime artifact: partial Rs. 2,200 payment plus final Rs. 5,000 payment closed the Rs. 7,200 receivable to zero with two receipt rows and matching second-session state.

Required proof: satisfied by Batch 3 runtime/tests for `SALE-015`, Batch 4 runtime/tests/browser proof for `COMM-002`, `COMM-010`, `COMM-012`, `COMM-014`, `COMM-016`, `SIGNOFF-06`, and `SIGNOFF-09`, Batch 5 runtime/tests for `STOCK-016` and `STOCK-017`, and Batch 6 runtime/tests for `GOLDEN-A-19` and `GOLDEN-A-20`.

## P2 DASH-A - Dashboard and Daily Sign-Off Read Models Are Not Authoritative

Failures: `DASH-003`, `DASH-004`, `SIGNOFF-01`, `SIGNOFF-02`

Closed in Batch 3: `DASH-007`, `SIGNOFF-07`, `SIGNOFF-08`

Closed in Batch 4: `SIGNOFF-06`, `SIGNOFF-09`

Blocked evidence debt: `SIGNOFF-04`

Evidence: `logs/dashboard-evidence.json`, `logs/prod-dashboard-ux-signoff-source-evidence-20260624.json`, `logs/business-reconciliation.json`

Invariant: Factory Today and sign-off views are read models over authoritative production, stock, dispatch, commercial, payroll, and observability state. A sign-off card cannot clear when its source rows remain unresolved.

Impact: gross wages were hard-coded to zero, historical analytics mixed historical and current data, and final sign-off rows still depend on unresolved production/payroll evidence. Batch 2 closed `SIGNOFF-05` expected-stock truth. Batch 3 closed dispatch pending/receipt/difference queue truth for `DASH-007`, `SIGNOFF-07`, and `SIGNOFF-08`; Batch 4 closed commercial signoff rows `SIGNOFF-06` and `SIGNOFF-09`; Batch 6 supplies Golden A Factory Today source reconciliation for production, dispatch, receipt, receivable, and deliberate discrepancy state. Batch 8C closes `SIGNOFF-10` with clean deployed browser/server/Sentry evidence.

Remediation direction:

- Rebuild dashboard cards from the same authoritative queries used by reconciliation.
- Add date-bounded historical queries that do not mix current machines/orders into historical views.
- Make sign-off rows explicitly blocked when required external evidence, such as supervisor register truth, is missing.

Required proof: dashboard unit/read-model tests, runtime Factory Today checks after production/sale/dispatch/receipt/payment/payroll mutations, and tenant-scoped source-row reconciliation.

## P3 PAY-A - Payroll, Attendance, Settlement, and Kharchi Ledgers Can Diverge

Failures: `PAY-006`, `PAY-013`, `PAY-015`, `PAY-018`, `PAY-020`, `PAY-023`, `PAY-024`, `PAY-027`, `DASH-003`, `GOLDEN-B-18`

Evidence: `logs/payroll-kharchi-source-evidence-20260624.json`, `logs/payroll-evidence.json`, `logs/offline-pwa-evidence.json`

Invariant: payroll net equals gross plus inam minus kapaat, advance recovery, PF, and ESI. A kharchi operation creates the worker advance and supervisor float transaction atomically, or creates neither.

Impact: legacy payroll RPCs remain executable; PF/ESI preview can disagree with persisted settlement; online kharchi can return success after partial ledger write. Batch 9 closes offline kharchi by making it online-only and removing the unsupported `kharchi_offline` queue path.

Remediation direction:

- Revoke legacy RPCs or make them call the hardened path.
- Share one PF/ESI formula between preview and settlement.
- Make online kharchi a single transaction.
- Keep offline kharchi online-only unless a real queue processor for the authoritative tables is later implemented and retested.

Required proof: payroll unit tests, rollback-only RPC probes, online kharchi partial-failure test, and dashboard wage check. Batch 9 supplies offline-disabled proof for `OFF-008` and `PAY-028`.

## P4 IDEMP-A - Mutations Lack Idempotency and Unknown-Outcome Recovery

Failures: `EST-017`, `OFF-009`, plus duplicate-risk paths in estimator, market-run creation, payment, payroll, subscription, and trial actions.

Closed in Batch 3: `SALE-015` for the stock sale/dispatch path.

Closed in Batch 4: commercial receivable payment duplicate-submit idempotency for `COMM-010`/`SIGNOFF-09` evidence.

Evidence: `logs/estimator-quotes-source-evidence-20260624.json`, `logs/order-stock-sale-source-evidence-20260624.json`, `logs/source-audit-time-ux-evidence-20260624.json`

Invariant: a user retry or timeout must not create duplicate business records. Every high-value mutation must have an idempotency key or a post-timeout reconciliation path.

Impact: duplicate quotes, market runs, backing orders, sales, receivables, or settlements can be created when network state is ambiguous. Batch 4 removes the duplicate-payment risk for commercial receivable payments, but the broader unknown-timeout UX remains unresolved.

Remediation direction:

- Add idempotency keys to estimator save/create, market-run creation, sale, dispatch, payment, and payroll mutations.
- Surface "unknown outcome, checking status" instead of generic failure after timeouts.
- Add server-side uniqueness for user-intended operation keys.

Required proof: rapid double-submit tests, timeout simulation, and runtime reconciliation evidence. Batch 4 supplies payment duplicate-submit proof only; `OFF-009` remains open for unknown-outcome timeout messaging and reconciliation across high-value mutations.

## P4 OFF-A - Offline, Cache, and Public Claims Are Not Pilot-Safe

Failures: `OFF-007`, `OFF-010`

Evidence: `logs/offline-pwa-evidence.json`, `logs/billing-offline-time-code-evidence-20260624.json`, `logs/prod-dashboard-ux-signoff-source-evidence-20260624.json`

Invariant: offline support must either be correct, tenant-safe, and reconcilable, or be explicitly unsupported. Logout/account switch must clear persisted tenant data and mutation queues.

Impact: Batch 9 fixed the offline fallback, auth-boundary cache cleanup, unsupported offline kharchi promise, and privacy/public offline claims. Remaining impact is limited to partial service-worker update proof and slow/intermittent-network runtime proof gaps.

Remediation direction:

- Capture production service-worker update proof with an active draft.
- Capture throttled slow/intermittent-network runtime proof across core mobile screens.
- Keep unsupported offline production/kharchi/payroll/sale/dispatch/payment write promises removed unless a real sync architecture is implemented and retested.

Required proof: Batch 9 satisfies browser offline route, logout/account-switch cache cleanup, IndexedDB queue cleanup, offline kharchi de-scope, and policy wording review for `OFF-002`, `OFF-005`, `OFF-006`, `OFF-008`, and `SEC-016`. Remaining proof is production service-worker update runtime evidence for `OFF-007` and throttled slow/intermittent-network runtime evidence for `OFF-010`.

## P5 REL-A - Release Gates Are Not Repeatable

Failures: `TECH-001`, `TECH-005`, `TECH-006`, `TECH-011`, `TECH-012`

Evidence: `logs/technical-gates.md`, `logs/clock-and-deployment-evidence.json`

Invariant: a pilot build is reproducible, uniquely identified, migrated, tested, observable, backed up, and rollback-ready.

Impact: `npm ci` fails, high-severity audit advisories remain, and restore/rollback were not exercised. Batch 7 closes the source-controlled test script/prebuild gate. Batch 8 closes migration-head alignment evidence for `TECH-007` with local/remote Supabase migration alignment through `20260628185344`. Batch 8B closes `TECH-010` with fresh production Sentry release `2538da25b2fa` and 529 source-map artifacts. Batch 8C closes clean deployed signoff after the Sentry DSN fix, Vercel runtime log review, and Sentry no-error release inspection.

Remediation direction:

- Repair lockfile and audit advisories.
- Add CI workflow or deployment-provider proof if required beyond the Batch 7 source-level test/prebuild gate.
- Keep production migration-head alignment under release re-check; Batch 8 satisfies `TECH-007` for the current repository head `20260628185344`.
- Exercise backup restore into disposable project and document rollback/forward-fix.

Required proof: command output, CI/deployment-provider run where required, migration metadata, clean deployed browser/server/Sentry smoke, restore evidence, and rollback runbook exercise.
