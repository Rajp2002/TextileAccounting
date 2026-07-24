# Prioritized Failure Backlog

This backlog is grouped by root cause and ordered by the required pilot priority: security, production/stock correctness, dispatch/receipt correctness, payroll/kharchi, idempotency/offline, then release gates. `code_verified` items stay open until runtime or test evidence exists.

## Runtime Rerun 2026-07-10 Terminal Results

The historical 145-row runtime-rerun queue classified 39 pass, 9 fail, 97 blocked, and 0 not run. Subsequent remediation closed every formal failure. `OFF-009` and `OFF-010` now have exact delayed/throttled runtime proof; `WA-008` retains its live-provider acceptance test as a named post-pilot requirement without PASS credit. Historical row-level actuals remain immutable in `output/qa/runtime-rerun-20260710/results.json`; current proof is in `output/qa/runtime-remediation-20260711/` and `output/qa/remaining-gate-campaign/`.

Current remediation note (2026-07-17): the active formal matrix has **368 pass, 0 fail, 6 blocked, and 3 not applicable**. `UX-012` passes its traceably amended pre-pilot criterion at production commit `93c2622`; Raj explicitly reconfirmed approval as Founder and fresh authenticated QA screenshots were retained. Actual pilot-user comprehension feedback remains an open operating control, not factory-supervisor approval. The two remaining genuine limited-pilot gates are `TECH-011` recovery governance and `GOLDEN-A-03` a business truth sheet. TECH-011 scheduled artifact/restore proof and release integration are complete at production merge `5f8d0c8`; named verification and deferred second recovery-identity confirmation remain.

## Coverage Ledger

All failed matrix rows are represented below. Some IDs also appear in detailed clusters when they block more than one invariant.

| Priority band | Root-cause cluster | Failed matrix IDs |
| --- | --- | --- |
| P0 | `SEC-B` privileged action and lockdown enforcement | None — `AUTH-008` closed 2026-07-11 |
| P0 | `SEC-C` webhook, export, audit, and compliance fail-closed surfaces | None — `WA-008` is post-pilot `PP-WA-002`, without PASS credit |
| P1 | `PROD-B` production boundary, assignment, and setup validity | None — `MASTER-014`, `SIGNOFF-01`, and `SIGNOFF-02` closed |
| P1 | `ECON-A` estimator, quote, order, and date snapshot correctness | None |
| P2 | `DASH-A` dashboard and daily sign-off read-model truth | None — `SIGNOFF-01` and `SIGNOFF-02` closed |
| P3 | `PAY-A` payroll, attendance, settlement, and kharchi ledgers | None — unresolved payroll rows are blocked evidence debt, not formal failures |
| P4 | `IDEMP-A` mutation idempotency and unknown outcomes | None — `OFF-009` closed with delayed-response runtime proof |
| P4 | `OFF-A` offline, cache, and public claims | None — `OFF-010` closed with constrained-3G runtime proof |
| P5 | `REL-A` release gates and observability | None — `TECH-001`, `TECH-005`, and `TECH-006` closed |

Blocked rows also remain unresolved evidence debt. Only `TECH-011` and `GOLDEN-A-03` independently gate the limited pilot. `UX-012` is a passed pre-pilot row with an open in-pilot user-validation control. `SEC-018` gates public reliance, not the closed supervised pilot. `TECH-012`, `BILL-003`, and the Golden payroll/stock rows formerly listed here are closed by B11–B18 direct runtime proof.

Medium rows retain exact controls: `GOLDEN-A-03` is a pilot gate; `UX-012` retains an open in-pilot user-validation control; `OFF-001` is optional device evidence; `SIGNOFF-04` is a mandatory first-shift operating control. `WA-010` is post-pilot `PP-WA-003`. `SEC-011` remains deferred to the owner’s physical laptop for read-only Sentry inspection; its token must never be transferred or exposed.

Closed in Batch 1 and removed from the open failure coverage rows: security foundation (`SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`, `SEC-006`, `AUTH-016`). `SEC-A` is closed. `SEC-B` is now also closed after `AUTH-008` received fail-closed source coverage and fresh QA Redis proof on 2026-07-11. Batch 20 moved the payroll RPC boundary rows `PAY-018` and `PAY-020` to `code_verified`; Batch 21D closes them with disposable QA runtime proof.

Closed in Batch 2 and removed from the open failure coverage rows: `PROD-A` production correction and generated stock atomicity (`PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, `SIGNOFF-05`). `SIGNOFF-05` is also removed from open `DASH-A`; remaining dashboard/signoff rows stay open.

Closed in Batch 3 and removed from the open failure coverage rows: dispatch sale receipt correctness (`SALE-015`, `DISP-003`, `DISP-007`, `DISP-010`, `DISP-019`, `GOLDEN-B-09`, `DASH-007`, `SIGNOFF-07`, `SIGNOFF-08`). `SIGNOFF-10` remained open under dashboard/release readiness because Batch 3 supplied partial dispatch/package/receipt runtime evidence only; it is closed later by Batch 8C.

Closed in Batch 4 and removed from the open failure coverage rows: commercials receivables payments correctness (`COMM-002`, `COMM-010`, `COMM-012`, `COMM-014`, `COMM-016`, `SIGNOFF-06`, `SIGNOFF-09`). `SIGNOFF-10`, `STOCK-017`, `STOCK-016`, `GOLDEN-A-19`, `GOLDEN-A-20`, `TIME-002`, and `OFF-009` remained open or partial evidence only at Batch 4 closeout; `SIGNOFF-10` is closed later by Batch 8C.

Closed in Batch 5 and removed from the open failure coverage rows: stock audit pagination and sale-only stock refresh (`STOCK-016`, `STOCK-017`). `GOLDEN-A-19`, `GOLDEN-A-20`, `SIGNOFF-10`, `TIME-002`, and `OFF-009` remained open or partial evidence only at Batch 5 closeout; `SIGNOFF-10` is closed later by Batch 8C.

Closed in Batch 6 and removed from the blocked evidence rows: Golden A runtime customer-order chain (`GOLDEN-A-13`, `GOLDEN-A-15`, `GOLDEN-A-16`, `GOLDEN-A-17`, `GOLDEN-A-18`, `GOLDEN-A-19`, `GOLDEN-A-20`, `GOLDEN-A-24`). `GOLDEN-A-21`, `GOLDEN-A-22`, `GOLDEN-A-23`, `TIME-002`, `OFF-009`, `SIGNOFF-01`, `SIGNOFF-02`, `SIGNOFF-04`, `TECH-011`, and `TECH-012` remain open or partial evidence only; `SIGNOFF-10` remained partial at Batch 6 closeout and is closed later by Batch 8C.

Closed in Batch 7 and removed from the open failure coverage rows: date-only timezone stability and source-controlled release test gate (`TIME-002`, `TECH-013`). `SIGNOFF-10`, `TECH-007`, `TECH-009`, `TECH-010`, `TECH-011`, `TECH-012`, and `SEC-011` remained blocked or partial evidence only at Batch 7 closeout because external deployed, Sentry/source-map, restore, rollback, and production migration proof was unavailable.

Closed in Batch 8 and removed from the open failure coverage rows: migration-head alignment evidence (`TECH-007`). Closed in Batch 8B and removed from the open failure coverage rows: Sentry release/source-map evidence (`TECH-010`). Closed in Batch 8C and removed from the open failure coverage rows: clean deployed browser/server/Sentry signoff (`SIGNOFF-10`). `TECH-009`, `TECH-011`, `TECH-012`, `SEC-011`, and `WA-008` remain blocked, partial, or open because deployed webhook proof, live Sentry payload inspection, restore, and rollback/forward-fix evidence are still unavailable.

Closed in Batch 9 and removed from the open failure coverage rows: offline fallback, auth-boundary cache cleanup, offline kharchi truthful de-scope, and privacy/public offline claim truth (`OFF-002`, `OFF-005`, `OFF-006`, `OFF-008`, `SEC-016`, `PAY-028`). `OFF-007` was subsequently closed by the 2026-07-11 two-build production-mode update/draft proof. `OFF-010` remains partial/open because throttled slow/intermittent-network runtime proof across core mobile screens is unavailable. `OFF-009` remains open under unknown-timeout/idempotency scope.

Closed in Batch 10 and removed from the open failure coverage rows: estimator/quote/order worker-rate snapshot drift, quote restore draft collision warning, and quote transition shortcut cleanup (`EST-003`, `EST-019`, `ORDER-001`, `ORDER-002`, `QUOTE-010`, `QUOTE-003`). `EST-011`, `QUOTE-007`, `ORDER-006`, and `ORDER-008` remained open at Batch 10 closeout because they required distinct server-boundary validation, fast-path atomicity/idempotency, order edit audit/produced-meter guard, and below-target completion confirmation work.

Closed in Batch 11 and removed from the open failure coverage rows: server-boundary estimator validation and target/deadline produced-meter/audit guard (`EST-011`, `ORDER-006`). `ORDER-008` is source-fixed and moved to `code_verified`, but remains open/partial pending runtime/browser proof. `QUOTE-007` remains fail/open because strict Start Party Order atomicity requires database/RPC transaction work.

Closed in Batch 12 and removed from `code_verified` evidence debt: stock archive policy and dispatch archive eligibility (`STOCK-012`, `DISP-013`). `ORDER-008`, `GOLDEN-B-12`, `STOCK-011`, `STOCK-013`, `MARKET-009`, and `MARKET-010` remain open/partial under their existing proof requirements.

Closed in Batch 13 and removed from `code_verified` evidence debt: focused estimator math and boundary rows (`EST-001`, `EST-005`, `EST-012`). `EST-004`, `SETUP-001`, `SETUP-002`, `BILL-002`, `PAY-017`, `TIME-003`, and `TIME-004` remain `code_verified` because their inspected local/static evidence was supporting or partial, not exact proof of the active row wording.

Closed in Batch 15 and removed from open failure coverage rows: payroll payslip PDF/export and payslip filename safety (`PAY-023`, `PAY-024`, `SEC-014`). Moved from fail to `code_verified` but not closed by Batch 15: payroll PF/ESI preview/settlement formula rows and Factory Today gross wage signal (`PAY-013`, `PAY-015`, `DASH-003`). `PAY-013` and `PAY-015` are later closed by Batch 21C; `DASH-003` still needs disposable after-shift runtime/browser proof before it can be counted as pass.

Moved from fail to `code_verified` in Batch 20 but still unresolved evidence debt: online Kharchi atomicity row (`PAY-027`). `PAY-018` and `PAY-020` were source/test fixed by Batch 20 and are closed by Batch 21D disposable QA runtime proof.

Closed in Batch 21B and removed from `code_verified` evidence debt: `ORDER-008`. Disposable QA browser/runtime proof confirmed below-target completion and pending-dispatch completion both require explicit confirmation and do not complete silently, while normal completion works without a warning.

Closed in Batch 21C and removed from `code_verified` evidence debt: `PAY-013` and `PAY-015`. Disposable QA payroll runtime proof confirmed enrolled Rs. 20000 gross -> PF Rs. 1800, ESI Rs. 150, net Rs. 18050; not-enrolled Rs. 20000 gross -> PF/ESI Rs. 0, net Rs. 20000; preview, paid row, and reopened Past settlements history matched.

Closed in Batch 21D and removed from `code_verified` evidence debt: `PAY-018` and `PAY-020`. Disposable QA payroll runtime proof confirmed missing payment/owner verification was blocked in the UI, hardened settlement RPC calls rejected missing payment mode and missing owner verification, valid UI settlement succeeded, legacy direct settlement RPC was permission denied, empty reversal code kept reversal disabled, invalid reversal code was rejected while settlement stayed paid, a valid one-time code reversed to pending, consumed-code reuse was rejected, and legacy direct unsettle RPC was permission denied. `PAY-027`, `DASH-003`, Golden rows, and all other rows remain unchanged.

Moved from fail to `code_verified` in Batch 22 but still unresolved evidence debt: production/order boundary rows (`ORDER-005`, `ORDER-009`, `PROD-011`). Migration `20260702121238_batch_22_production_order_boundary_hardening.sql` source-fixes over-target, cancelled/completed/stale-assignment order-attributed logs, and negative-meter guards at the RPC/table boundary, but it was not applied and QA runtime/API proof has not been collected. `SIGNOFF-02` dependency is improved through `ORDER-009`, but `SIGNOFF-02` remains fail/open until full current-run attribution proof exists. `GOLDEN-A-23`, `PAY-027`, `DASH-003`, Golden rows, and all other rows remain unchanged.

Moved from fail to `code_verified` in Batch 23 but still unresolved evidence debt: Start Party Order fast-path transaction boundary (`QUOTE-007`). Migration `20260702131500_batch_23_start_party_order_transaction_boundary.sql` source-fixes the accepted quote plus active order transaction boundary, but it was not applied and QA runtime/API proof has not been collected.

Moved from fail to `code_verified` in Batch 24B but still unresolved evidence debt: supervisor production UX/source rows (`PROD-013`, `PROD-023`). Suspicious large positive shift meters now show a non-blocking confirmation at 10,000m, and restored localStorage drafts now show a visible unsaved-draft indicator. `PROD-029` was later closed by QA-env browser/runtime proof in `output/qa/runtime-proof-loop/GROUP_A-runtime-proof-20260706-PROD-029.json`, confirming shift-meter terminology and no raw opening/closing proof claim on public and supervisor production surfaces.

Moved from fail to `code_verified` in Batch 24D but still unresolved evidence debt: estimator rapid double-submit (`EST-017`) and supervisor production date/shift draft isolation (`PROD-022`). Estimator Save Quote and Save & Create Market Run now have a synchronous client-side submit lock; production drafts are scoped by org, user, selected date, and shift, with stale date/shift fetch results ignored. QA/browser proof has not been collected, and `EST-017` does not claim server/database idempotency.

Batch 24E master-data loom evidence debt is closed for `MASTER-002` and `MASTER-005` by formal blocked-row Batch 4 isolated browser/database proof; `MASTER-003` is also closed by the same history-bearing fixture. Migration `20260704120000_batch_24e_master_data_loom_guardrails.sql` remains the database boundary for normalized duplicates. `MASTER-014` was closed separately by runtime remediation.

Moved from fail to `code_verified` in Batch 24G production reconciliation but still unresolved evidence debt: security audit/export rows (`SEC-015`, `SEC-009`). A production DB push reportedly applied `20260705100000_batch_24g_security_audit_guardrails.sql` and `20260705182406_harden_settings_audit_function.sql` while linked to production ref `vzhwahudircrpgtitwzd`; no rollback or additional DB command was run during reconciliation. `SEC-015` still needs controlled settings-change audit-row proof with redacted payloads. `SEC-009` still needs owner export browser/security proof and audit-log EXPORT proof. `SEC-017` remains fail/open; `AUTH-008` closed on 2026-07-11.

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

## Closed P0 SEC-B - Privileged Action and Lockdown Enforcement

Failures: none. `AUTH-008` closed on 2026-07-11.

Code-verified evidence debt: none for payroll settlement/reversal boundary; `PAY-018` and `PAY-020` are closed by Batch 21D.

Closed in Batch 1: `SEC-006`, `AUTH-016`

Evidence: `logs/auth-security-time-code-evidence-20260624.json`, `logs/security-access-code-evidence.json`, `logs/payroll-kharchi-source-evidence-20260624.json`

Invariant: protected owner actions, access-code actions, locked-tenant writes, and join-code validation fail closed and are consistently rate-limited. Legacy privileged RPCs cannot bypass the app-level authorization trail.

Impact: join-code brute-force/rate-limit coverage remains open. Batch 1 closed access-code validation (`SEC-006`) and locked-tenant write enforcement (`AUTH-016`). Batch 20 source-fixed legacy payroll settlement/reversal bypass paths, and Batch 21D supplied the disposable runtime proof.

Remediation direction:

- Closed in runtime-remediation 2026-07-11: dedicated fail-closed validation/join IP buckets enforce 10 attempts per 10 minutes; fresh QA Redis proof rejected attempt 11 for an isolated synthetic key.
- Keep Batch 21D payroll RPC revocation and hardened settlement/reversal wrapper proof under regression.
- Keep Batch 1 access-code and locked-tenant boundaries under regression while closing the remaining SEC-B rows.

Required proof: SQL policy/grant metadata, rollback-only QA probes, and browser checks for remaining join-code privileged-action paths. `SEC-006` proof is satisfied by `node scripts/qa/batch1b-access-code-probe.mjs`, `npx vitest run __tests__/p0-access-code-boundary.test.ts`, and migration `20260625215612_harden_access_code_fail_closed.sql`; `AUTH-016` proof is satisfied by `node scripts/qa/batch1b-locked-tenant-probe.mjs`, `npx vitest run __tests__/p0-locked-tenant-boundary.test.ts`, and migration `20260626051352_harden_locked_tenant_writes.sql`. `PAY-018` and `PAY-020` proof is satisfied by Batch 20 source proof plus Batch 21D disposable QA runtime proof in `output/qa/batch21d/BATCH21D-payroll-boundary-runtime-proof.json`.

## P0 SEC-C - External Webhooks and Compliance Surfaces Do Not Fail Closed

Failures: `WA-008` (`TECH-009` and `SEC-017` are closed)

Blocked evidence debt: `SEC-011`, `SEC-018`

Code-verified evidence debt: `SEC-009`, `SEC-015`

Evidence: `logs/technical-gates.md`, `logs/security-review.json`, `logs/security-export-erasure-evidence.json`, `logs/secrets-exposure-scan.json`, `logs/offline-pwa-evidence.json`

Invariant: externally supplied data and compliance exports must be authenticated, audited, redacted, and consistent with the product's actual behavior.

Impact: the deployed QA webhook now fails closed when verification/signing configuration is absent, but `WA-008` still lacks a valid signed delivery-row update because QA has no `META_APP_SECRET`. Owner export and settings audit remain source-fixed/code_verified and still lack controlled browser/security/audit-row proof; the fresh isolated Premium Settings route also rendered blank main content and needs focused debugging. Public legal/offline claims still require counsel review. Batch 15 closes the payslip filename safety slice (`SEC-014`) with deterministic source/test proof.

Remediation direction:

- Configure the approved QA signing secret and prove one valid signed callback updates exactly one intended delivery row while invalid signatures remain rejected.
- Treat the Batch 24G owner export as source-fixed only until redaction and audit events are proven in controlled QA/browser/security proof.
- Treat the Batch 24G settings audit migrations as production-reconciled/source-fixed only until settings-change audit rows with redacted payloads are proven in controlled QA.
- Align privacy/offline wording to implementation or implement the promised behavior.
- Treat DPDP/public-policy wording as blocked until qualified counsel review exists.

Required proof: webhook negative probes, export audit evidence, settings-change audit-row evidence with redacted payloads, and documented counsel sign-off or explicit de-scope. `SEC-014` filename proof is satisfied by Batch 15 focused tests and active matrix promotion to pass. Batch 24G does not mark any security row pass-ready.

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

Failures: None — `MASTER-014`, `SIGNOFF-01`, and `SIGNOFF-02` are closed by isolated runtime proof.

Code-verified evidence debt: `ORDER-005`, `ORDER-009`, `PROD-002`, `PROD-004`, `PROD-011`, `PROD-013`, `PROD-022`, `PROD-023`

Evidence: `logs/order-stock-sale-source-evidence-20260624.json`, `logs/production-logging-source-evidence-20260624.json`, `logs/prod-dashboard-ux-signoff-source-evidence-20260624.json`, `logs/setup-master-source-evidence-20260624.json`

Invariant: each production entry belongs to one org, active machine, valid date, shift, worker, and active order/run; meters are non-negative and operationally plausible; day-only or substitute-worker support is either implemented or unsupported for pilot.

Impact: Batch 22 source-fixes the direct authenticated RPC/table paths for negative meters, order-attributed logs against cancelled/completed/stale assignments, and over-target production. These rows remain `code_verified`, not pass, until migration application and QA runtime/API proof. Batch 24B source-fixes suspicious large-meter confirmation and restored-unsaved draft labeling; these rows remain `code_verified`, not pass, until QA/browser proof. `PROD-029` copy truth is now pass by QA-env browser/runtime proof. Batch 24C source-fixes `SETUP-011` Factory Today setup checklist state by using the correct costing, loom-target, assignment, worker, and payroll-config data sources; it remains `code_verified`, not pass, until browser/runtime proof. Batch 24D source-fixes `PROD-022` by scoping supervisor production draft keys by org, user, selected date, and shift and preventing stale date/shift fetch results from restoring the wrong visible draft. Batch 24E source-fixes `MASTER-002` duplicate loom-name checks and `MASTER-005` protected loom delete/deactivate/unlink guardrails, including the prior null-target unlink bypass; these rows remain `code_verified`, not pass, until migration/DB-boundary and QA/browser proof. Batch 24F source-fixes `PROD-002` day-only selected-shift worker policy and `PROD-004` explicit substitute-worker reassignment-required behavior; these rows remain `code_verified`, not pass, until QA/browser proof.

Remediation direction:

- Apply the Batch 22 migration in QA after review and run rollback-only/API proof for active order/run, assignment, non-negative meters, and target/cancel constraints.
- Capture QA/browser proof for day-only day-shift logging, night-shift missing-worker accountability, and substitute/reassignment behavior before pass.
- Apply or DB-boundary-prove the Batch 24E duplicate loom-name migration in QA after duplicate data review, then prove duplicate add/bulk-add/rename blocking and allowed different-org/different-name behavior.
- Keep the atomic assignment RPC, caller-RLS, rollback, and concurrent last-writer proof under regression while closing the remaining production-boundary evidence debt.

Required proof: Batch 22 source tests are present for `ORDER-005`, `ORDER-009`, and `PROD-011`; pass still requires migration application evidence plus rollback-only/API probes for negative meters, cancelled/completed order, over-target, and assignment mismatch, and valid production/correction runtime proof that generated stock/order progress/payroll basis remain consistent.
Batch 24B source tests are present for `PROD-013`, `PROD-023`, and `PROD-029`; pass still requires browser proof for large-meter warning/confirmation and restored-draft refresh/crash behavior. `PROD-029` copy review is now satisfied by `output/qa/runtime-proof-loop/GROUP_A-runtime-proof-20260706-PROD-029.json`. Batch 24D source tests are present for `PROD-022`; pass still requires browser proof for org/user/date/shift draft isolation and save payload date/shift. Batch 24E source tests are present for `MASTER-002` and `MASTER-005`; pass still requires migration/DB-boundary proof for normalized duplicate loom names and QA/browser proof for protected delete/deactivate/unlink messaging and unused-loom behavior. Batch 24F source tests are present for `PROD-002` and `PROD-004`; pass still requires browser proof for selected-shift day-only/no-night-worker behavior and substitute/reassignment accountability.

## P1 ECON-A - Estimator, Quote, Order, and Date Snapshots Are Not Exact Enough

Failures: None

Code-verified evidence debt: `QUOTE-007`

Closed source/runtime evidence debt: `ORDER-008` is pass as of Batch 21B.

Blocked evidence debt: `GOLDEN-A-03`

Evidence: `logs/business-reconciliation.json`, `logs/estimator-quotes-source-evidence-20260624.json`, `logs/order-stock-sale-source-evidence-20260624.json`, `logs/auth-security-time-code-evidence-20260624.json`

Invariant: business snapshots used for quotes, orders, wage rates, due dates, and lifecycle state must be exact, server-validated, and stable across timezones. A restored draft or lifecycle shortcut must not silently overwrite or create inconsistent accepted-order state.

Impact: Batch 10 fixes worker-rate floating drift in estimator-origin quote/order snapshots and quote restore/lifecycle cleanup. Batch 11 fixes estimator save server-boundary validation and order target/deadline produced-meter/audit guards. Batch 13 closes exact local proof for the single warp/weft estimator cost stack, paise-per-pick 100x guard, and invalid commission-plus-margin boundary. Batch 21B closes below-target and pending-dispatch completion confirmation with disposable QA browser/runtime proof. Batch 23 source-fixes Start Party Order accepted-quote/order atomicity at the database boundary via the `start_party_order_from_estimator` RPC. Batch 7 closes the separate date-only rendering shift row.

Remediation direction:

- Apply the Batch 23 migration in QA and run runtime/API proof for atomic quote/order/yarn-requirements creation and rollback safety.
- Require the external truth sheet or business-accepted reference estimate before closing `GOLDEN-A-03`.

Required proof: Batch 23 source tests are present; pass still requires migration application evidence and valid Start Party Order transaction boundary runtime proof.

Scoped estimator costing reconciliation closeout:

- Date/time: 2026-06-28 00:54 IST.
- Closed sub-scope: formula/manual/manual-practical costing, mixed formula/manual semantics, width unit handling, waste/crimp semantics, Cost Breakdown audit, and saved quote restore audit preservation.
- Evidence: `npx vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts` passed 31 tests; full `npx vitest run` passed 298 tests with 1 skipped; `npx tsc --noEmit`, `npm run build`, and scoped estimator ESLint passed; browser QA validated formula mode at `₹55.75/m`, formula-equivalent manual at `₹55.75/m`, practical manual at `₹55.91/m` or `₹56.16/m` depending on overhead, width warning for `62 cm`, and quote restore preserving `₹56.16/m`.
- Matrix status at that scoped estimator closeout was unchanged. Batch 7 later closed `TIME-002` with focused timezone-stability tests and display-path hardening.

Batch 10 estimator/quote/order snapshot closeout:

- Date/time: 2026-06-30 16:45 IST.
- Closed sub-scope: Decimal-backed worker-rate snapshot normalization, quote/order worker-rate copy stability, quote restore draft collision warning, and explicit quote lifecycle transitions.
- Evidence: `output/qa/batch10/BATCH10-estimator-quote-order-snapshots-proof.json`; `npx vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts` passed 33 tests; `npx vitest run __tests__/batch10-estimator-quote-order-snapshots.test.ts` passed 4 tests; targeted ESLint, `npx tsc --noEmit --pretty false`, `git diff --check`, `jq empty`, and `npm run build` passed.
- Matrix status: `EST-003`, `EST-019`, `ORDER-001`, `ORDER-002`, `QUOTE-010`, and `QUOTE-003` are pass. At Batch 10 closeout, `EST-011`, `QUOTE-007`, `ORDER-006`, and `ORDER-008` remained open.

Batch 11 estimator/order lifecycle closeout:

- Date/time: 2026-06-30 20:05 IST.
- Closed sub-scope: server-boundary validation for zero/negative/extreme/empty warp-weft estimator inputs and target/deadline edits guarded by produced-meter checks plus existing audit history.
- Evidence: `output/qa/batch11/BATCH11-estimator-order-lifecycle-proof.json`; `npx vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts` passed 33 tests; `npx vitest run __tests__/batch11-estimator-order-lifecycle.test.ts` passed 6 tests; targeted ESLint, `npx tsc --noEmit --pretty false`, `git diff --check`, `jq empty`, and `npm run build` passed.
- Matrix status: `EST-011` and `ORDER-006` are pass. `ORDER-008` is `code_verified`/open-partial pending runtime/browser proof. `QUOTE-007` remains fail/open pending database/RPC transaction work.

Batch 21B ORDER-008 runtime proof closeout:

- Date/time: 2026-07-02 03:58 IST.
- Closed sub-scope: `ORDER-008` only.
- Evidence: `output/qa/batch21b/BATCH21B-order-008-runtime-proof.json`; runtime host `http://localhost:3000`; QA Supabase ref `eutycrtzzxmlkcpipgod`; production ref `vzhwahudircrpgtitwzd` absent from `.env.qa.local` and rebuilt `.next` cache.
- Matrix status: `ORDER-008` is pass. No payroll, dashboard, production/order boundary, stock/dispatch/commercial, billing/provider, Sentry/WhatsApp/restore/rollback, or other row was promoted.

Batch 23 Start Party Order transaction boundary closeout:

- Date/time: 2026-07-02 18:58 IST.
- Closed sub-scope: None. Promoted `QUOTE-007` to `code_verified`.
- Evidence: `output/qa/batch23/BATCH23-start-party-order-transaction-boundary-proof.json`.
- Matrix status: `QUOTE-007` is `code_verified`, not pass, pending migration application and QA runtime proof.

Batch 13 targeted estimator proof sweep:

- Date/time: 2026-07-01 03:02 IST.
- Closed sub-scope: `EST-001`, `EST-005`, and `EST-012` only.
- Evidence: `output/qa/batch13/BATCH13-code-verified-proof-sweep.json`; `npx --no-install vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts __tests__/production-mode.test.ts` passed 3 test files and 39 tests.
- Matrix status: `EST-001`, `EST-005`, and `EST-012` are pass. `EST-004`, `SETUP-001`, `SETUP-002`, `BILL-002`, `PAY-017`, `TIME-003`, and `TIME-004` remain `code_verified`/partial under their exact proof requirements.

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

Batch 12 follow-on archive proof: `DISP-013` is satisfied by focused local proof that a fully dispatched and confirmed dispatch group archives and is not actionable while partial, unconfirmed, disputed, discrepancy, and e-way-gap groups remain active. Evidence: `output/qa/batch12/BATCH12-code-verified-proof-sweep.json`; `npx vitest run __tests__/dispatch-archive.test.ts` passed 7 tests.

## Closed STOCK-A - Sold-Out Market Lot Archive Eligibility

Closed rows: `STOCK-012`

Evidence: `output/qa/batch12/BATCH12-code-verified-proof-sweep.json`, `lib/stock-lifecycle.ts`, `__tests__/p1-stock-lifecycle.test.ts`, active QA matrix closeout.

Invariant: closed or sold-out market-run lots with zero available, zero reserved, zero pending dispatch, and no unresolved discrepancy are not active godown rows and are archive/history eligible.

Resolution:

- Focused local lifecycle proof verified the closed/sold-out zero-meter market-run cases through `isStockLotActionable`.
- `npx vitest run __tests__/p1-stock-lifecycle.test.ts` passed 10 tests.
- No product code, migration, Supabase command, direct SQL, package install, lockfile change, or production data mutation was used.

Required proof: satisfied for `STOCK-012` only. `STOCK-011`, `STOCK-013`, `MARKET-009`, and `MARKET-010` remain `code_verified` because Batch 12 proof did not fully satisfy their exact row wording.

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

Failures: `SIGNOFF-01`, `SIGNOFF-02`

Code-verified evidence debt: `DASH-003`, `DASH-004`

Closed in Batch 3: `DASH-007`, `SIGNOFF-07`, `SIGNOFF-08`

Closed in Batch 4: `SIGNOFF-06`, `SIGNOFF-09`

Blocked evidence debt: `SIGNOFF-04`

Evidence: `logs/dashboard-evidence.json`, `logs/prod-dashboard-ux-signoff-source-evidence-20260624.json`, `logs/business-reconciliation.json`

Invariant: Factory Today and sign-off views are read models over authoritative production, stock, dispatch, commercial, payroll, and observability state. A sign-off card cannot clear when its source rows remain unresolved.

Impact: final sign-off rows still depend on unresolved production/payroll evidence. Batch 2 closed `SIGNOFF-05` expected-stock truth. Batch 3 closed dispatch pending/receipt/difference queue truth for `DASH-007`, `SIGNOFF-07`, and `SIGNOFF-08`; Batch 4 closed commercial signoff rows `SIGNOFF-06` and `SIGNOFF-09`; Batch 6 supplies Golden A Factory Today source reconciliation for production, dispatch, receipt, receivable, and deliberate discrepancy state. Batch 8C closes `SIGNOFF-10` with clean deployed browser/server/Sentry evidence. Batch 15 source-fixes `DASH-003` by replacing hard-coded gross wages with meter/rate snapshot aggregation, but it remains `code_verified` pending after-shift runtime proof. Batch 24C source-fixes `DASH-004` historical analytics state so selected historical dates no longer retain stale current orders, machines, today KPI, or trend data; it remains `code_verified`, not pass, until browser/runtime proof. Batch 22 source-fixes the `ORDER-009` dependency for `SIGNOFF-02`, but `SIGNOFF-02` remains fail/open pending full current-run attribution runtime proof.

Remediation direction:

- Runtime-prove the Batch 15 Factory Today gross wage read model after disposable production-log creation.
- Rebuild remaining dashboard cards from the same authoritative queries used by reconciliation.
- Add date-bounded historical queries that do not mix current machines/orders into historical views.
- Make sign-off rows explicitly blocked when required external evidence, such as supervisor register truth, is missing.

Required proof: dashboard unit/read-model tests, runtime Factory Today checks after production/sale/dispatch/receipt/payment/payroll mutations, and tenant-scoped source-row reconciliation.

## P3 PAY-A - Payroll, Attendance, Settlement, and Kharchi Ledgers Can Diverge

Failures: `GOLDEN-B-18`

Code-verified evidence debt: `DASH-003`, `PAY-027`, `PAY-006`

Evidence: `logs/payroll-kharchi-source-evidence-20260624.json`, `logs/payroll-evidence.json`, `logs/offline-pwa-evidence.json`

Invariant: payroll net equals gross plus inam minus kapaat, advance recovery, PF, and ESI. A kharchi operation creates the worker advance and supervisor float transaction atomically, or creates neither.

Impact: `GOLDEN-B-18` still needs payroll runtime proof. Batch 24A source-fixes `PAY-006` by hardening attendance RLS date boundaries (restricting supervisor direct client writes to today's date and owner direct client writes to today or past only, using database Surat time), and routing supervisor past-date writes through the save-time access-code server boundary. Disposable QA runtime proof is still required for `PAY-006` to be promoted to pass. Batch 21C closes PF/ESI preview and preview-versus-settlement equality rows `PAY-013` and `PAY-015` with disposable runtime proof. Batch 21D closes payroll settlement/reversal boundary rows `PAY-018` and `PAY-020` with disposable QA runtime proof. Factory Today gross wages and online Kharchi atomicity are source/test fixed but still need runtime proof before pass. Batch 9 closes offline kharchi by making it online-only and removing the unsupported `kharchi_offline` queue path. Batch 15 closes payslip PDF and settlement CSV/history statutory export rows `PAY-023` and `PAY-024`. Batch 20 source-fixes legacy payroll RPC exposure and online Kharchi atomicity.

Remediation direction:

- Keep Batch 21D settlement/reversal RPC proof under regression.
- Runtime-prove Factory Today gross wage read models after disposable after-shift production data.
- Runtime-prove online Kharchi as a single transaction with sufficient and insufficient supervisor float.
- Keep offline kharchi online-only unless a real queue processor for the authoritative tables is later implemented and retested.

Required proof: payroll unit tests, rollback-only RPC probes, online kharchi partial-failure test, and dashboard wage check. Batch 9 supplies offline-disabled proof for `OFF-008` and `PAY-028`. Batch 21C supplies disposable runtime proof for `PAY-013` and `PAY-015`. Batch 21D supplies disposable runtime proof for `PAY-018` and `PAY-020`. Batch 20 supplies source/test proof for `PAY-027`, but not runtime proof.

## P4 IDEMP-A - Mutations Lack Idempotency and Unknown-Outcome Recovery

Failures: `OFF-009`, plus duplicate-risk paths in payment, payroll, subscription, and trial actions.

Code-verified evidence debt: `EST-017`

Closed in Batch 3: `SALE-015` for the stock sale/dispatch path.

Closed in Batch 4: commercial receivable payment duplicate-submit idempotency for `COMM-010`/`SIGNOFF-09` evidence.

Evidence: `logs/estimator-quotes-source-evidence-20260624.json`, `logs/order-stock-sale-source-evidence-20260624.json`, `logs/source-audit-time-ux-evidence-20260624.json`

Invariant: a user retry or timeout must not create duplicate business records. Every high-value mutation must have an idempotency key or a post-timeout reconciliation path.

Impact: duplicate quotes, market runs, backing orders, sales, receivables, or settlements can be created when network state is ambiguous. Batch 4 removes the duplicate-payment risk for commercial receivable payments. Batch 24D adds client-side rapid double-submit protection for estimator Save Quote and Save & Create Market Run, but does not add server/database idempotency. The broader unknown-timeout UX remains unresolved.

Remediation direction:

- Add idempotency keys to remaining duplicate-prone sale, dispatch, payment, and payroll mutations where server/database idempotency is required.
- Surface "unknown outcome, checking status" instead of generic failure after timeouts.
- Add server-side uniqueness for user-intended operation keys.

Required proof: rapid double-submit tests, timeout simulation, and runtime reconciliation evidence. Batch 4 supplies payment duplicate-submit proof only. Batch 24D supplies source/test proof for estimator rapid double-submit UI guarding only; browser rapid double-click proof and any future server/database idempotency design remain required before `EST-017` can pass. `OFF-009` remains open for unknown-outcome timeout messaging and reconciliation across high-value mutations.

2026-07-13 OFF-009 update: the supervisor shift-log reference flow now has a tested unknown-outcome timeout boundary and authoritative post-timeout lookup. Production browser evidence proves the UI does not misreport the delayed request as a definite failure and prevents blind retry when state cannot be confirmed. Promotion remains blocked because production's unrelated `UPDATE requires a WHERE clause` shift-log failure creates zero rows, so the commit-succeeded/response-lost reconciliation branch and duplicate-row invariant cannot yet be exercised. Formal status remains `fail`; closeout status is `code_verified_but_not_runtime_verified`.

## P4 OFF-A - Offline, Cache, and Public Claims Are Not Pilot-Safe

Failures: `OFF-010`. `OFF-007` closed on 2026-07-11.

Evidence: `logs/offline-pwa-evidence.json`, `logs/billing-offline-time-code-evidence-20260624.json`, `logs/prod-dashboard-ux-signoff-source-evidence-20260624.json`

Invariant: offline support must either be correct, tenant-safe, and reconcilable, or be explicitly unsupported. Logout/account switch must clear persisted tenant data and mutation queues.

Impact: Batch 9 fixed the offline fallback, auth-boundary cache cleanup, unsupported offline kharchi promise, and privacy/public offline claims. Remaining impact is limited to partial service-worker update proof and slow/intermittent-network runtime proof gaps.

Remediation direction:

- Capture production service-worker update proof with an active draft.
- Capture throttled slow/intermittent-network runtime proof across core mobile screens.
- Keep unsupported offline production/kharchi/payroll/sale/dispatch/payment write promises removed unless a real sync architecture is implemented and retested.

Required proof: Batch 9 satisfies browser offline route, logout/account-switch cache cleanup, IndexedDB queue cleanup, offline kharchi de-scope, and policy wording review for `OFF-002`, `OFF-005`, `OFF-006`, `OFF-008`, and `SEC-016`. The 2026-07-11 runtime-remediation campaign closes `OFF-007` with a two-build production-mode service-worker update and active-draft proof. Remaining proof is throttled slow/intermittent-network runtime evidence for `OFF-010`.

## P5 REL-A - Release Gates Are Not Repeatable

Open blocker: `TECH-011`. Freshly closed: `TECH-001`, `TECH-005`, `TECH-006`, and `TECH-012`.

Evidence: `logs/technical-gates.md`, `logs/clock-and-deployment-evidence.json`

Invariant: a pilot build is reproducible, uniquely identified, migrated, tested, observable, backed up, and rollback-ready.

Impact: clean install and the high/critical dependency-audit gates are repeatable. B18 exercised sanitized restore mechanics and rollback/forward-fix, closing `TECH-012`; it did not supply a retained production artifact for `TECH-011`. Batch 7 closes the source-controlled test script/prebuild gate. Batch 8 closes migration-head alignment evidence for `TECH-007` with local/remote Supabase migration alignment through `20260628185344`. Batch 8B closes `TECH-010` with fresh production Sentry release `2538da25b2fa` and 529 source-map artifacts. Batch 8C closes clean deployed signoff after the Sentry DSN fix, Vercel runtime log review, and Sentry no-error release inspection.

Remediation direction:

- Retain the repaired lockfile and zero-high/critical audit gate; track the two remaining moderate PostCSS/Next advisories separately.
- Add CI workflow or deployment-provider proof if required beyond the Batch 7 source-level test/prebuild gate.
- Keep production migration-head alignment under release re-check; Batch 8 satisfies `TECH-007` for the current repository head `20260628185344`.
- Keep the configured Free-tier encrypted schedule active, validate the sanitized-inventory correction with a manual canary, then retain a new successful scheduled production artifact and restore/reconcile that exact artifact in the disposable workflow. Scheduled run `29368765626` failed closed and produced no artifact.

Fresh proof: final `npm ci` installed 1,088 packages successfully; runtime-only and full audits both exited successfully at `--audit-level=high` with zero high/critical findings. B18 supplies rollback and sanitized restore proof. Scheduled run `29368765626` proves the schedule fired and failed closed but supplied zero artifacts. Remaining `TECH-011` proof is one newly scheduled encrypted production artifact restored and reconciled under the implemented runbook.

## Runtime Rerun Findings - 2026-07-10

### `AUTH-012` - Authenticated cross-tenant organization read

Status: `fail`. Severity: high until the exposed organization columns and policy scope are reviewed.

Root cause group: organization-table RLS/policy boundary. An Org A authenticated client queried a guessed Org D organization ID and received the row. The same client received no Org D machine rows and could not mutate the Org D machine, so the failure is narrower than a general tenant-boundary collapse.

Evidence: `output/qa/runtime-rerun-20260710/evidence/AUTH-012-cross-org-production.json`.

Required fix/proof:

- Inspect active `organizations` SELECT policies and any helper functions/views involved in authenticated reads.
- Define the minimum organization fields, if any, that supervisors joining by code legitimately need before membership.
- Add an explicit two-tenant regression test for organization guessed-ID reads.
- Re-run organization, profile, machine, worker, and representative server-action read/mutation probes before promotion.

### `MASTER-006` - Piece-rate worker decimal-rate scenario conflicts with runtime model

Status: `blocked` pending QA schema parity and runtime proof against the authoritative assignment-rate model.

Root cause group: product contract drift. The Add Piece Rate Worker runtime form accepts identity/compliance fields but no decimal rate. Current production/payroll code derives and snapshots rate from order/quality/costing context instead of a worker master rate.

Disposition and required proof:

- The current product contract is authoritative: onboarding explicitly does not collect worker rates; costing/quality provides the work rate, and `machine_operator_assignments.rate` records the effective assignment rate and pay mode.
- The matrix scenario is rewritten to exercise a decimal per-meter assignment rate, its production-log snapshot, and payroll output without mutating historical logs.
- QA does not yet contain `machine_operator_assignments` or the complete machine-operator payroll migration chain, and applying that broad backfill to a shared QA database would exceed the isolated-fixture safety boundary. The row therefore becomes blocked rather than being falsely passed or left failed against an obsolete worker-master field.
- Runtime promotion requires a disposable schema-parity environment with `20260709080948_machine_operator_payroll_v2.sql` and the forward safe-update repair applied, followed by exact decimal assignment → production log → payroll reconciliation.

### Runtime blockers retained

- `AUTH-005`: expired/reused reset token and final password mutation.

Closed 2026-07-13: `SETUP-012` old-code rejection and current-code intended-organization resolution passed in a fresh isolated QA tenant, complementing the existing rename/regeneration persistence proof.

Closed 2026-07-13: `SETUP-007` passed one controlled pre-mutation 503, incomplete/enabled-retry UI proof, zero-row post-failure reconciliation, exactly-one-row retry reconciliation, and refresh-stable completion. No migration or deployment was involved.

### `MASTER-009` - Inactive assigned worker remains visibly complete

Status: `fail`.

An authenticated QA owner deactivated the standing piece-rate worker. The authoritative worker row became inactive, but Machines continued displaying that worker on both shifts and the loom as Active; Factory Today continued marking Assign workers to looms Done. A client hydration mismatch also showed server/client disagreement between Assign Worker and the inactive worker name.

Evidence: `output/qa/runtime-rerun-20260710/evidence/MASTER-009-deactivate-assigned-worker-production.json`.

Required fix/proof: define how inactive workers terminate or invalidate standing operator and legacy assignments, make SSR/client loaders agree, make Factory Today use the same active-assignment rule, and retain historical production attribution by immutable log snapshots.

### Shift-log submission and activation-rule blockers

- Shift-log Save returned `UPDATE requires a WHERE clause` twice and created zero production rows. This blocks `MASTER-011`, `MASTER-012`, and any later row needing new production history.
- Application activation logic accepts either a day or night assignment, while the deployed database constraint requires both day and night workers plus an active order. Align source and deployed database rules before reproof.

### Runtime Rerun Batch 3

Batch 3 added no new failure or blocker. `MASTER-013`, `MASTER-015`, `EST-002`, `EST-004`, `EST-006`, `EST-007`, `EST-008`, `EST-009`, `EST-010`, and `EST-013` are runtime-proven pass. Existing shift-log, tenant-read, worker-rate-contract, and inactive-assignment findings remain open.

### Runtime remediation superseding closeout — SIGNOFF-01 / SIGNOFF-02

Fresh isolated QA proof on 2026-07-13 supersedes the historical open references above. Factory Today was repaired to stop selecting nonexistent `production_logs.market_run_id` and `production_logs.created_at`; it now follows the order relationship and uses `submitted_at`. The owner UI displayed 50m and a clear-factory state, while database reconciliation proved one accounted active loom and matching log/loom/dated-assignment order and worker attribution. Both rows are now `PASS`; the remaining failures are `AUTH-012`, `WA-008`, `OFF-009`, and `OFF-010`.

### AUTH-012 superseding production closeout — 2026-07-13

The historical AUTH-012 failure above is closed. Production migration `20260710210828` removed the public permissive organization lookup policy, and the policy catalog now contains only authenticated tenant SELECT and owner tenant UPDATE. A disposable two-tenant production probe passed own read/update and cross-tenant organization/profile/machine denial plus persisted non-mutation. Exact cleanup reconciled all synthetic rows and auth users to zero. Remaining formal failures are `WA-008`, `OFF-009`, and `OFF-010`.

### Needs formal audit/debugging — production schema lint (2026-07-13 checkpoint)

The production checkpoint did not promote any of these findings to pass. Post-migration schema lint reports six legacy stored-function errors requiring isolated ownership and runtime-impact analysis: `lockdown_tenant` mixes bigint and UUID branches in a UNION; `link_batch_to_machine` references removed `machines.rate_per_meter`; `get_daily_brief_stats` references removed `workers.rate_per_meter`; `replace_shift_production_logs` references absent `weavly_shift_logs`; `settle_worker_payroll` references absent constraint `payroll_unique_meter_worker_month`; and `get_yield_alert` references removed `yarn_batches.weight_kg`. Treat this cluster as `Needs formal audit/debugging` before deciding whether each function should be repaired, replaced, or retired.

### Formal blocked-row Batch 7 production prerequisite closeout

`PROD-002`, `PROD-004`, and `MASTER-012` are closed. Migration `20260713124500` resolved the day-only activation contract, and isolated production proved separate day/night worker, rate, order, stock, and payroll snapshots after an owner-controlled context/operator remap. The shared safe-update shift-log prerequisite is therefore no longer the blocker for these rows. `MASTER-006` remains a product-contract audit over rate ownership, not schema availability.

`NEEDS-AUDIT-004` is the new dated-flow cluster. The production date field accepted 2026-07-12, but changing Production/Downtime state or entering meter state restored 2026-07-13. Keep `MASTER-011`, `PROD-017`, `PROD-018`, `PAY-006`, `TIME-003`, and `TIME-004` blocked until the date/draft effect is debugged and a historical submission persists its chosen date through refresh and payroll/correction checks.

### Batch 8 resolved dated-substitution root

Remove `MASTER-011` from the blocked backlog. The selected historical date, persisted dated worker, order start boundary, worker/rate snapshots, refresh state, generated stock, and owner payroll attribution all passed isolated production proof. `PROD-017`, `PROD-018`, `PAY-006`, `TIME-003`, and `TIME-004` are not downstream pass claims; keep them blocked until their exact correction/access-code/attendance/calendar scenarios run. `NEEDS-AUDIT-004` is closed for the production-date root, with those five rows retained as individual work.

### B09 production-resilience cluster resolved

Remove all 17 B09 IDs from the blocked backlog: `PROD-005`, `PROD-006`, `PROD-007`, `PROD-010`, `PROD-011`, `PROD-013`, `PROD-014`, `PROD-022`, `PROD-023`, `PROD-024`, `PROD-025`, `PROD-026`, `PROD-027`, `PROD-030`, `OFF-003`, `OFF-004`, and `UX-001`. Runtime evidence covers the client/server validation boundaries, copy, scoped draft recovery, pre/post-request network outcomes, atomic concurrency, verified status/breakdown persistence, and 20-loom phone workflow on the exact production commit.

The backlog now has 86 blocked rows. B10 is next with eight independent historical/access/calendar scenarios; B11–B18 remain internally executable clusters, while B19 retains the five genuine external/human dependencies. Existing failures remain `WA-008`, `OFF-009`, and `OFF-010`; B09 does not reclassify them.

### B10 protected-date/calendar cluster resolved

Remove all eight B10 IDs from the blocked backlog: `PROD-017`, `PROD-018`, `PROD-019`, `PAY-006`, `PAY-022`, `COMM-013`, `TIME-003`, and `TIME-004`. Exact deployed proof covers correction-window enforcement, single-use owner authorization and negative cases, settled-payroll immutability, past/future attendance policy boundaries, India month inclusion/exclusion, year rollover, and leap day. Migration `20260714005500_b10_enforce_attendance_date_lockdown.sql` is applied in QA and production.

The backlog now has 78 blocked rows. B11 is active with 12 rows from the canonical campaign inventory. Existing failures remain `WA-008`, `OFF-009`, and `OFF-010`; B10 does not reclassify them or relax the No-Go gate.

### B11 quote/order protected-history cluster resolved

Remove all twelve B11 IDs from the blocked backlog: `QUOTE-007`, `ORDER-005`, `ORDER-007`, `ORDER-009`, `ORDER-010`, `ORDER-011`, `ORDER-012`, `ORDER-013`, `ORDER-014`, `ORDER-015`, `STOCK-011`, and `GOLDEN-A-23`. Exact proof covers atomic quote/order/yarn creation, over-target immutability, completion/cancellation/deletion boundaries, reserved-stock lineage, partial dispatch, shortage discrepancy/claim creation, receivable settlement, payroll settlement, and paid-history correction rejection.

The backlog now has 66 blocked rows. B12 is active with 10 rows. Existing failures remain `WA-008`, `OFF-009`, and `OFF-010`; B11 does not reclassify them or relax the No-Go gate.

### B12 market-stock lifecycle cluster resolved

Remove all ten B12 IDs from the blocked backlog: `MARKET-009`, `MARKET-010`, `MARKET-013`, `STOCK-005`, `STOCK-009`, `DISP-017`, `DISP-018`, `COMM-015`, `GOLDEN-B-12`, and `GOLDEN-B-17`. Exact QA and production proof covers tenant-safe relational sources, sold-out and archived market truth, partial/exact dispatch receipts, advisory compliance fields, party-ID separation, serialized concurrent stock mutation, and fresh 26-run summaries.

The backlog now has 56 blocked rows. B13 is active with 16 worker-money rows. Existing failures remain `WA-008`, `OFF-009`, and `OFF-010`; B12 does not reclassify them or relax the No-Go gate.

### B13 payroll and worker-money lifecycle cluster resolved

Remove all sixteen B13 IDs from the blocked backlog: `MASTER-006`, `PAY-002`, `PAY-010`, `PAY-011`, `PAY-012`, `PAY-014`, `PAY-017`, `PAY-019`, `PAY-021`, `PAY-025`, `PAY-026`, `PAY-027`, `DASH-003`, `GOLDEN-A-21`, `GOLDEN-A-22`, and `GOLDEN-B-18`. Exact QA runtime/browser and production runtime proof covers decimal and historical assignment-rate snapshots, capped debt recovery, protected deducted advances, serialized settlement, authorized reversal, itemized adjustments, cycle boundaries/status, atomic final exit, supervisor Kharchi, Factory Today wage signals, and shared immutable Golden A/B payroll history.

The backlog now has 40 blocked rows. B14 is active with five realtime/dashboard rows. Existing failures remain `WA-008`, `OFF-009`, and `OFF-010`; B13 does not reclassify them or relax the No-Go gate.

### B14 realtime dashboard cluster resolved

Remove all five B14 IDs from the blocked backlog: `DASH-005`, `DASH-006`, `DASH-008`, `DASH-010`, and `UX-010`. Exact QA runtime/browser and production runtime proof covers no-reload realtime refresh without double counting, disconnect/reconnect recovery from authoritative data, independent pace arithmetic, explicit zero-production risk, the complete 90-day/1,800-log range below two seconds, and distinct actionable loading/error/offline/empty/live states.

The backlog now has 35 blocked rows. B15 is active with eleven authentication, privacy, audit, adversarial UX, and PWA rows. Existing failures remain `WA-008`, `OFF-009`, and `OFF-010`; B14 does not reclassify them or relax the No-Go gate.

### B15 authentication, privacy, audit, and adversarial UX cluster resolved

Remove ten B15 IDs from the blocked backlog: `AUTH-005`, `AUTH-014`, `AUTH-018`, `SEC-009`, `SEC-010`, `SEC-012`, `SEC-013`, `SEC-015`, `UX-006`, and `UX-009`. QA browser/HTTP/database and matching production database proof covers recovery-token lifecycle, idle expiry, proxy client isolation, audited tenant export, atomic retained-history erasure/redaction, stored-XSS safety, cross-origin session/action rejection, destructive/settings audit context, keyboard operation, and 200%-equivalent layout integrity.

Retain `OFF-001` as blocked: manifest, icons, scope, start route, update notice, and refresh activation passed, but actual install and standalone reopen need a supported external PWA browser/device. The backlog now has 25 blocked rows. B16 is active with nine WhatsApp simulation/provider rows. Existing failures remain `WA-008`, `OFF-009`, and `OFF-010`; B15 does not reclassify them or relax the No-Go gate.

### B16 WhatsApp consent, delivery, cooldown, and retry cluster resolved

Remove eight B16 IDs from the blocked backlog: `WA-001`, `WA-002`, `WA-003`, `WA-004`, `WA-005`, `WA-006`, `WA-007`, and `WA-009`. Disposable QA runtime proof covers opted-in delivery, opted-out and missing-prerequisite skips, provider timeout isolation, worker/phone-bound payslips, owner-only access codes without plaintext snapshots, independent brief cooldowns, and tenant-safe targeted retry with capped history.

Retain `WA-010` as blocked: deterministic rejection and expired-token simulation proved clear logs and manual fallback, but the row explicitly requires a controlled live Meta provider event against a consented recipient. No live provider call was made. The backlog now has 17 blocked rows. B17 is active with Razorpay checkout, webhook, replay, entitlement, and security rows. Existing failures remain `WA-008`, `OFF-009`, and `OFF-010`; B16 does not reclassify them or relax the No-Go gate.

### B17 Razorpay lifecycle and entitlement cluster resolved

Remove all eight B17 IDs from the blocked backlog: `BILL-003`, `BILL-004`, `BILL-005`, `BILL-006`, `BILL-007`, `BILL-009`, `BILL-010`, and `SEC-007`. Hosted Razorpay TEST checkout through Netbanking and Bank of Baroda plus signed QA/production probes cover initial and renewal capture, failed-renewal access preservation, replay/conflict/invalid-HMAC boundaries, provider-canonical convergence, monotonic cancellation/expiry, exactly one 10% referral refund, and access loss without account/history loss.

The backlog now has 9 blocked rows. B18 is active with `TECH-011` and `TECH-012`; execute restore/reconciliation and rollback/forward-fix proof in disposable infrastructure with no production mutation. Existing failures remain `WA-008`, `OFF-009`, and `OFF-010`; B17 does not reclassify them or relax the No-Go gate.

### B18 recovery exercise partially resolved

Remove `TECH-012` from the blocked backlog. A sanitized six-ledger logical backup restored into isolated QA with matching canonical SHA-256 digests, four reconciliation assertions, restored owner authentication, and a 2,478.4 ms restore. A disposable actual-app deployment then returned to exact source commit `57caa6e6f15f25b6e26654a1d3cfc4b431452e9b` through native Vercel rollback in two provider-reported seconds, and a rollback-only QA transaction recovered a deliberately dropped legacy value through a reviewed provenance-preserving forward-fix. Cleanup reconciled to zero and production was not mutated.

Retain `TECH-011` as blocked. Production reports WAL-G enabled, PITR disabled, and no retained backups. The runtime restore itself passed, but no automated retained or approved off-site production backup schedule exists. The minimum closure dependency is a Pro upgrade with retained backups/PITR, or an approved off-site destination plus authorized database-dump credential placement. The backlog now has 8 blocked rows and B19 is active. Existing failures remain `WA-008`, `OFF-009`, and `OFF-010`; B18 does not reclassify them or relax the No-Go gate.

### B19 external evidence review complete

Retain all five B19 IDs as blocked. `SEC-011` needs a locally configured read-only Sentry token and direct inspection of a live production event payload. `SEC-018` needs a dated qualified-counsel approval or redline. `UX-012` needs a named factory supervisor's terminology approve/change register. `GOLDEN-A-03` needs one business-accepted real-fabric truth sheet. `SIGNOFF-04` needs one dated supervisor meter register. Workspace and generated-artifact review found none of these closure artifacts, and source/test evidence was not substituted.

The backlog remains 8 blocked rows. All blocked-row batches are reviewed and no independent executable batch remains. Existing failures remain `WA-008`, `OFF-009`, and `OFF-010`; B19 does not reclassify them or relax the No-Go gate.

### Base Estimator residual backlog — 2026-07-22

- `BASE-RATE-ATOMIC-P1`: replace the rate-book row, history, factory-default, and saved-quality writes with one tenant-scoped transaction/RPC; prove rollback on every injected failure.
- `BASE-PDF-PROD-P0`: download internal and customer PDFs in a physical production browser, render both, require nonblank A4 output, and prove the customer copy contains no internal cost, margin, overhead, or break-even details.
- `BASE-SIGNUP-P0`: prove a new owner can complete signup/email confirmation and authenticate without admin intervention; make the UI state explicit when confirmation is required.
- `BASE-OBS-P1`: inspect one current-release production error/Sentry event with redacted fields and release attribution; never print credentials or PII.
- `BASE-BILLING-PROD-P0`: rerun approved Razorpay TEST lifecycle against the exact release before paid self-serve promotion; no real-money charge is required or authorized.
- `BASE-DB-LINT-P2`: repair or retire five Premium/legacy functions referencing removed relations/columns. These do not receive Base pilot pass/fail credit but block a clean whole-database lint gate.

### Base Estimator follow-up disposition — 2026-07-22

- Remove `BASE-RATE-ATOMIC-P1`: production migration `20260721203000` is aligned, an induced missing-profile failure left zero rate rows and zero history delta, and the success path committed one rate/history/default/quality update together.
- Reclassify `BASE-SIGNUP-P0` as a monitored pilot operating check. The product owner reports multiple successful self-service accounts; the first external pilot signup remains an evidence capture, not a launch blocker.
- Reclassify `BASE-BILLING-PROD-P0` outside the pilot gate. Razorpay TEST mode is explicitly accepted for the pilot; live activation waits for incorporation details.
- Keep `BASE-PDF-PROD-P0` as a first-pilot physical-browser acceptance check and `BASE-OBS-P1` as an exact-release operational evidence item. Neither blocks opening the owner-led costing pilot, but a PDF privacy/blank-output failure would pause use of that output.
- Keep `BASE-DB-LINT-P2` outside Base scope; it blocks only a clean whole-database claim.

### Base pilot blocker sprint disposition — 2026-07-24

- Close `BASE-PILOT-DEP-01`, `BASE-PILOT-TSC-01`, and `BASE-PILOT-UX-01` at local proof: the runtime audit is zero, the independent TypeScript gate passes, and standalone Base/referral/landing language is aligned.
- Reclassify `BASE-PILOT-SEC-01` as `fixed_pending_runtime_proof`: migration `20260724161732` removes authenticated execution and validates explicit actors, but is not yet applied to the linked target.
- Reclassify `BASE-PILOT-EXP-01` as `fixed_pending_runtime_proof`: shared download dispatch and user feedback are regression-covered, but deployed file capture/render/readability proof remains required.
- Keep `BASE-PDF-PROD-P0` open as the exact-candidate acceptance gate. Add organization JSON readability to the same physical-browser evidence bundle.
- The candidate remains No-Go until the reviewed migration, deployment, fresh Base browser smoke, artifact inspection, and exact fixture cleanup all pass.
