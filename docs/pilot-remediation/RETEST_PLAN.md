# Retest Plan

This plan defines the proof needed for remediation batches. Commands are run from the repository root: `/Users/rajpatel/Projects/textile Saas`.

## Global Local Gates

Run these before promoting any batch:

```bash
npm ci
npm run lint
npx vitest run
npm run build
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
```

Current known state from `logs/technical-gates.md`:

- `npm ci` fails until the lockfile is repaired.
- `npm run lint` passed in the final QA run.
- `npx vitest run` passed in the final QA run; Batch 20 full Vitest via `npm run build` passed with 363 passed and 1 skipped.
- `npm run build` passed in the final QA run; Batch 20 also passed `npm run build` with the source-controlled `prebuild` Vitest gate.
- Both audit commands fail until advisories are fixed or formally accepted.

Do not use passing lint/build/source checks to resolve runtime failures.

## BATCH-01-AUTHZ-BOUNDARY

Failures targeted: `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`

Security foundation follow-on rows closed in Batch 1B: `SEC-006`, `AUTH-016`

Other follow-on checks that remain open unless separately proven: `AUTH-008`, `AUTH-012`, `AUTH-013`, `SEC-013`. `PAY-018` and `PAY-020` were source-fixed/code_verified by Batch 20 and are closed by Batch 21D disposable QA runtime proof.

### Acceptance Criteria

1. No authenticated user can update `public.profiles.role`, `public.profiles.org_id`, or equivalent authorization fields.
2. Profile RLS permits only intended self-service profile updates and blocks authorization-field mutation.
3. A supervisor self-mutation attempt fails and leaves the profile unchanged.
4. After token refresh, the supervisor still has supervisor claims and owner-only actions remain denied.
5. Owner login, supervisor login, onboarding redirects, and protected route guards still work.
6. SQL metadata, tests, and runtime browser/API evidence are all saved.

### Required Regression Tests

Add or update tests for the authorization boundary, then run:

```bash
npx vitest run __tests__/p1-auth-login-route.test.ts __tests__/p1-auth-authorization-boundary.test.ts
npx vitest run __tests__/p1-payroll-guard.test.ts
npx vitest run
```

If `__tests__/p1-auth-authorization-boundary.test.ts` does not exist yet, create it as part of the fix. It must cover the policy/grant expectation and server-side role/org derivation at the highest practical level available in the local test harness.

### Required SQL Metadata Checks

Run against the QA/disposable database after migrations are applied. Save sanitized output.

```sql
select grantee, table_schema, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in ('role', 'org_id')
  and grantee in ('anon', 'authenticated')
order by grantee, column_name, privilege_type;
```

Expected: no `UPDATE` privilege for `anon` or `authenticated` on `role` or `org_id`.

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'profiles'
order by policyname;
```

Expected: update policy cannot be satisfied by a user attempting to change authorization fields. If field-level enforcement is implemented through triggers or functions instead of RLS alone, include the trigger/function metadata and a failing mutation probe.

### Required Runtime QA Checks

Use an isolated QA tenant or rollback-only transaction. Do not mutate production data outside the QA tenant.

1. Log in as QA supervisor.
2. Attempt a direct Supabase/PostgREST update of the supervisor's own profile role to `owner`.
3. Attempt a direct update of the supervisor's own `org_id` to another known org ID or a generated invalid UUID.
4. Refresh the session/token.
5. Open an owner-only route and invoke one owner-only server action that was previously protected.
6. Confirm the route/action is denied and no owner data is visible.
7. Log in as QA owner and confirm owner routes/actions still work.
8. Re-query the supervisor profile and confirm role/org never changed.

Evidence to save:

- SQL metadata output.
- Mutation attempt request/response summary with sanitized user/org IDs.
- Browser route/action observations.
- Post-probe profile row summary.
- Test command output.

### Batch 01 Closure Rule

Historical closure rule: close `SEC-002`, `SEC-003`, `SEC-004`, and `SEC-005` only when all acceptance criteria pass. If `AUTH-016` is not fixed in the same implementation, keep it open and create the next security batch for lockdown policy coverage.

Retrospective closeout status: satisfied. `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`, `SEC-006`, and `AUTH-016` are documented as pass/pass-ready and promoted to pass in the active QA matrix.

Security migrations applied/aligned:

- `20260625195248_harden_profile_authorization_boundary.sql`
- `20260625215612_harden_access_code_fail_closed.sql`
- `20260626051352_harden_locked_tenant_writes.sql`

Security proof commands recorded:

```bash
node scripts/qa/batch1a-authz-boundary-probe.mjs
npx vitest run __tests__/p0-authz-boundary.test.ts
node scripts/qa/batch1b-access-code-probe.mjs
npx vitest run __tests__/p0-access-code-boundary.test.ts
node scripts/qa/batch1b-locked-tenant-probe.mjs
npx vitest run __tests__/p0-locked-tenant-boundary.test.ts
npx vitest run __tests__/p0-authz-boundary.test.ts __tests__/p0-access-code-boundary.test.ts __tests__/p0-locked-tenant-boundary.test.ts
npx tsc --noEmit
git diff --check
```

Targeted ESLint commands were also run for the Batch 1A, Batch 1B-A, and Batch 1B-B proof files as recorded in `FIX_LOG.md`.

Batch 1 proof summary:

- `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`: profile authorization fields are hardened; supervisor role/org mutation and token-refresh escalation are denied; owner/supervisor normal paths are preserved.
- `SEC-006`: access-code validation is centralized, fail-closed, attempt-limited, expiry-bound, single-use, and no longer relies on recoverable plaintext storage.
- `AUTH-016`: locked-organization writes are denied through RLS/RPC/server guard coverage; unlocked writes and owner/supervisor login still work.

## P1 Production and Stock Retest

Use after `PROD-B` fixes or when checking for regressions in the closed `PROD-A` Batch 2 production/stock atomicity scope.

Commands:

```bash
npx vitest run __tests__/p0-atomicity.test.ts __tests__/p1-production-log-strictness.test.ts __tests__/p1-production-dispatch-regressions.test.ts
npx vitest run __tests__/p1-stock-lifecycle.test.ts __tests__/p1-stock-source-validation.test.ts
npx vitest run
```

Runtime checks:

- Create order-backed production for two looms.
- Edit one positive shift to downtime inside the allowed correction window.
- Verify current positive `production_logs` sum equals generated order stock exactly.
- Re-submit the same shift and verify stock changes exactly once.
- Probe negative meters, cancelled order, over-target production, and assignment mismatch through rollback-only RPC/API checks.
- Refresh and open a second session to confirm stock/dashboard values remain reconciled.

Acceptance:

- Batch 2 already closed `PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, and `SIGNOFF-05` with runtime evidence: 256.00m production created; stale 25.25m Night production corrected to downtime; `production_logs`, generated stock, Factory Today, stock summary, and signoff expected stock read 230.75m; no stale 25.25m saleable lot remained; reversal movement was recorded exactly once; retry did not duplicate stock or movements; unsafe sale/reduction/dispatch correction paths were blocked.
- Migration `20260626064830_production_stock_atomicity.sql` is applied and aligned.
- Factory Today/signoff expected stock uses `order_progress_summary.total_meters_produced`.
- Golden A follow-ons can be re-run from a clean QA order.

## P1 Estimator, Quote, Order, and Date Snapshot Retest

Use after `ECON-A` fixes.

### Estimator Costing Reconciliation Sub-Scope

Use after estimator costing changes or when checking for regressions in the completed formula/manual/manual-practical costing scope.

Commands:

```bash
npx vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts
npx vitest run
npx tsc --noEmit
npm run build
npm run lint -- __tests__/estimator.test.ts __tests__/width-field.test.ts lib/estimator.ts 'app/(dashboard)/owner/estimator/EstimatorClient.tsx' 'app/(dashboard)/owner/estimator/actions.ts' components/cost-analysis-details.tsx
```

Runtime checks:

- Enter real formula specs for `50/600`, `Jari`, and `50 span/spun`; verify production cost is approximately `₹55.75/m`.
- Switch to formula-equivalent manual kg/100m inputs and verify the formula/manual difference is no more than `₹0.10/m`.
- Enter practical manual kg/100m inputs and verify `₹55.91/m` with `₹21.50/m` other cost or `₹56.16/m` with `₹21.75/m` other cost.
- Confirm warp audit rows show crimp plus waste and weft audit rows show waste only.
- Confirm blank row waste uses the default, explicit row waste `0` overrides the default, and row waste does not stack with default waste.
- Enter effective costing width `62 cm` and verify the warning that it is only `24.4 inches`; switch to `62 inch` and verify expected costing is restored.
- Save a quote, reopen it through Quotes -> Restore, and verify the same cost audit is displayed.

Known lint caveat:

- Repo-wide `npm run lint` may fail on existing unrelated `scratch/*.js` CommonJS `require()` lint errors. Scoped estimator ESLint must pass before promotion.

Completed evidence as of 2026-06-28:

- Targeted estimator/width Vitest passed 31 tests.
- Full Vitest passed 298 tests with 1 skipped.
- `npx tsc --noEmit`, `npm run build`, and scoped estimator ESLint passed.
- Browser QA validated formula mode at `₹55.75/m`, formula-equivalent manual at `₹55.75/m`, practical manual at `₹55.91/m` or `₹56.16/m` depending on overhead, width warning behavior, and saved quote restore audit preservation.

### Broader ECON-A Retest

Commands:

```bash
npx vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts
npx vitest run __tests__/batch10-estimator-quote-order-snapshots.test.ts
npx vitest run __tests__/estimator.test.ts __tests__/market-runs.test.ts __tests__/production-mode.test.ts
npx vitest run __tests__/p1-stock-source-validation.test.ts __tests__/p1-commercial-payments.test.ts
npx vitest run
```

Batch 10 adds targeted tests for worker-rate snapshot normalization, quote restore draft collision handling, and quote transition rules. Batch 11 adds targeted tests for server-boundary estimator validation, target/deadline produced-meter edit guards, existing audit evidence, and source-level below-target completion confirmation. Batch 13 uses the existing estimator local proof to close `EST-001`, `EST-005`, and `EST-012`; the proof command was `npx --no-install vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts __tests__/production-mode.test.ts`, which passed 3 test files and 39 tests. Batch 21B closes `ORDER-008` with disposable QA browser/runtime proof for below-target, pending-dispatch, and normal completion paths. Start Party Order atomicity/idempotency still needs database/RPC transaction proof. Batch 7 closes `TIME-002` date-only formatting with focused timezone tests.

Runtime checks:

- Build a quote/order from a business truth sheet and verify rate, margin, worker-rate, order, and commercial snapshots remain exact. Batch 10 covers the worker-rate snapshot drift by focused tests/source proof; business truth-sheet comparison still gates `GOLDEN-A-03`.
- Restore a quote into the estimator while a local draft exists and verify the user must choose whether to overwrite. Batch 10 source/tests cover the local draft collision UI.
- Edit target/deadline after production if browser proof is requested; Batch 11 source/tests and existing audit trigger evidence cover the target >= produced guard and audit/history requirement for `ORDER-006`.
- Batch 21B closes `ORDER-008`: disposable QA browser/runtime proof verified explicit remaining-quantity and pending-dispatch warning/confirmation before completion, plus normal completion without a warning.
- Batch 7 date-only proof covers representative date-only display paths under UTC, US Pacific, and Asia/Kolkata; rerun only if those display paths change.

Acceptance:

- Batch 10 satisfies `EST-003`, `EST-019`, `QUOTE-003`, `QUOTE-010`, `ORDER-001`, and `ORDER-002` with focused test/source evidence and active matrix promotion.
- Batch 11 satisfies `EST-011` and `ORDER-006` with focused source/test/audit evidence and active matrix promotion.
- Batch 13 satisfies `EST-001`, `EST-005`, and `EST-012` with focused local estimator proof and active matrix promotion.
- `QUOTE-007` still needs database/RPC transaction proof before `ECON-A` can be fully closed.
- `GOLDEN-A-03` has a supplied truth sheet/business reference or remains blocked and de-scoped from pilot sign-off.

## P2 Dispatch and Receipt Retest

Commands:

```bash
npx vitest run __tests__/p1-party-first-stock-sale-dispatch.test.ts __tests__/dispatch-archive.test.ts __tests__/p1-production-dispatch-regressions.test.ts
npx vitest run
```

Runtime checks:

- Sell 80m from a QA stock lot.
- Dispatch 50m first, then 30m second.
- Confirm package numbers are unique and both batches are visible.
- Record exact receipt, shortage receipt, excess receipt, duplicate receipt attempt, negative receipt attempt, and zero receipt according to chosen policy.
- Confirm Factory Today pending dispatch and Dispatches page match DB values.

Acceptance:

- Batch 3 satisfied this dispatch/receipt retest for `DISP-003`, `DISP-007`, `DISP-010`, `DISP-019`, `GOLDEN-B-09`, `DASH-007`, `SIGNOFF-07`, and `SIGNOFF-08`.
- Evidence: disposable QA runtime proof `BATCH3-fc791041`; migrations `20260627195152`, `20260628071340`, and `20260628073917` applied/aligned; focused Batch 3 Vitest passed 7 tests; targeted regression Vitest passed 27 tests; full Vitest passed 306 tests with 1 skipped; `npx tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
- Batch 12 satisfied `DISP-013` with focused local dispatch archive proof: `npx vitest run __tests__/dispatch-archive.test.ts` passed 7 tests and verified fully dispatched/confirmed groups archive while partial, unconfirmed, disputed, discrepancy, and e-way-gap groups stay active.
- `SIGNOFF-10` received partial dispatch/package/receipt runtime evidence here and is closed later by Batch 8C clean deployed browser/server/Sentry evidence.

## P2 Commercials Receivables Payments Retest

Commands:

```bash
npx vitest run __tests__/p1-commercial-payments.test.ts __tests__/commercials-read-model.test.ts __tests__/p2-commercials-receivables-payments.test.ts
npx vitest run __tests__/p1-party-first-stock-sale-dispatch.test.ts __tests__/p2-dispatch-sale-receipt.test.ts __tests__/p1-production-dispatch-regressions.test.ts __tests__/p1-stock-source-validation.test.ts __tests__/p0-atomicity.test.ts
npx vitest run
```

Runtime checks:

- Create a stock-sale/dispatch and verify exactly one receivable.
- Repeat the same sale submit and verify the same sale/receivable returns without duplicate rows.
- Attempt direct market-run sale and verify the disabled-path message.
- Record partial cheque payment, duplicate partial submit, full bank payment, duplicate full submit, and overpayment attempt.
- Verify cheque metadata, references, payment history, balance, and status.
- Verify due today, overdue, future, and paid buckets against Asia/Kolkata date.
- Verify Top Parties last-sale/overdue and 30d versus all-time period filtering.
- Verify Profit Ledger source filters use authoritative stock source fields.
- Verify Factory Today commercial blockers and Commercials refresh/second-session totals.

Acceptance:

- Batch 4 satisfied this Commercials retest for `COMM-002`, `COMM-010`, `COMM-012`, `COMM-014`, `COMM-016`, `SIGNOFF-06`, and `SIGNOFF-09`.
- Evidence: disposable QA runtime proof `BATCH4QA-20260628125203`; migration `20260628121903` applied/aligned; focused Batch 4 Vitest passed 32 tests; Batch 2/3 guard Vitest passed 37 tests; full Vitest passed 313 tests with 1 skipped; `npx tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
- `GOLDEN-A-19` and `GOLDEN-A-20` remained open at Batch 4 closeout and were closed later by Batch 6 Golden A runtime proof. `SIGNOFF-10` remained partial at Batch 4 closeout and is closed later by Batch 8C. `TIME-002` and `OFF-009` remain open or partial evidence only.

## P2 Stock Audit Refresh Retest

Commands:

```bash
npx vitest run __tests__/p1-stock-lifecycle.test.ts
npx vitest run __tests__/p2-stock-audit-refresh.test.ts
npx vitest run __tests__/p2-stock-audit-refresh.test.ts __tests__/p1-stock-lifecycle.test.ts __tests__/p1-stock-source-validation.test.ts __tests__/p1-production-stock-atomicity.test.ts __tests__/p0-atomicity.test.ts __tests__/p1-party-first-stock-sale-dispatch.test.ts __tests__/p2-dispatch-sale-receipt.test.ts __tests__/commercials-read-model.test.ts __tests__/p1-commercial-payments.test.ts __tests__/p2-commercials-receivables-payments.test.ts
npx vitest run
```

Runtime checks:

- Seed a disposable stock lot with more than 500 movement rows.
- Retrieve all movement history through the product-equivalent cursor path and verify older rows are reachable.
- Confirm no duplicate or missing movement rows and deterministic newest-to-oldest ordering.
- Save a sale-only stock sale with no dispatch id.
- Confirm Godown Stock refreshes to committed available and pending-dispatch state without a manual full reload requirement.
- Confirm a second owner session matches committed server state.

Acceptance:

- Batch 5 satisfied this stock audit refresh retest for `STOCK-016` and `STOCK-017`.
- Batch 12 satisfied `STOCK-012` with focused local stock lifecycle proof: `npx vitest run __tests__/p1-stock-lifecycle.test.ts` passed 10 tests and verified closed/sold-out zero-meter market-run lots are non-actionable/archive-eligible. `STOCK-011`, `STOCK-013`, `MARKET-009`, and `MARKET-010` still need exact broader proof before promotion.
- Evidence: disposable QA proof `output/qa/batch5/BATCH5-20260628173243-stock-audit-refresh.json`; implementation commit `46ad361fa03d3fb9d561c639e5e3ed6424cb8e03`; focused Batch 5 Vitest passed 4 tests; Batch 2/3/4 stock, dispatch, and commercials regression pack passed 85 tests; full Vitest passed 317 tests with 1 skipped; `npx tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
- No migration was required.
- `GOLDEN-A-19` and `GOLDEN-A-20` remained open at Batch 5 closeout and were closed later by Batch 6 Golden A runtime proof. `SIGNOFF-10` remained partial at Batch 5 closeout and is closed later by Batch 8C. `TIME-002` and `OFF-009` remain open or partial evidence only.

## P2 Golden A Runtime Closure Retest

Commands:

```bash
node scripts/qa/batch6-golden-a-runtime-proof.mjs
npx vitest run __tests__/p2-golden-a-completed-order-dispatch.test.ts
npx vitest run __tests__/p2-golden-a-completed-order-dispatch.test.ts __tests__/p2-stock-audit-refresh.test.ts __tests__/p1-stock-lifecycle.test.ts __tests__/p1-stock-source-validation.test.ts __tests__/p1-production-stock-atomicity.test.ts __tests__/p0-atomicity.test.ts __tests__/p1-party-first-stock-sale-dispatch.test.ts __tests__/p2-dispatch-sale-receipt.test.ts __tests__/commercials-read-model.test.ts __tests__/p1-commercial-payments.test.ts __tests__/p2-commercials-receivables-payments.test.ts
npx vitest run
```

Runtime checks:

- Correct customer-order production from 230.75m to 235.75m and verify generated order-linked stock changes by exactly 5m.
- Confirm the order auto-completes at target and completed-order dispatch remains allowed only for valid order-linked sold stock.
- Sell 120m on credit and verify sale, stock decrement, receivable, source fields, and committed refresh state.
- Dispatch 70m and record exact receipt with no discrepancy.
- Dispatch 50m and record 45m received, creating exactly one 5m shortage discrepancy and one open party claim.
- Record partial and final receivable payments and verify balance reaches zero with complete receipt history.
- Verify second owner session state matches committed sale, receivable, payment, dispatch, and discrepancy state.
- Verify Factory Today source reconciliation shows no pending dispatch, no in-transit receipt, no receivable balance, and one deliberate unresolved discrepancy.
- Complete/archive the order and verify assigned machines are unlinked or inactive.

Acceptance:

- Batch 6 satisfied this Golden A runtime retest for `GOLDEN-A-13`, `GOLDEN-A-15`, `GOLDEN-A-16`, `GOLDEN-A-17`, `GOLDEN-A-18`, `GOLDEN-A-19`, `GOLDEN-A-20`, and `GOLDEN-A-24`.
- Evidence: disposable QA proof `output/qa/batch6/BATCH6-20260628185811-golden-a-runtime-proof.json`; implementation commit `80e8f8c6ae1318207b0c5b1f45e98c3cfe524f67`; migrations `20260628183500` and `20260628185344` applied/aligned; focused Batch 6 Vitest passed 1 test; Batch 2/3/4/5 guard regression pack passed 86 tests; full Vitest passed 318 tests with 1 skipped; `npx tsc --noEmit`, targeted ESLint, `git diff --check`, and `git diff --cached --check` passed.
- `GOLDEN-A-21`, `GOLDEN-A-22`, `GOLDEN-A-23`, `TIME-002`, `OFF-009`, `SIGNOFF-01`, `SIGNOFF-02`, `SIGNOFF-04`, `TECH-011`, and `TECH-012` remain open or partial evidence only. `SIGNOFF-10` remained partial at Batch 6 closeout and is closed later by Batch 8C.

## P2 Dashboard and Sign-Off Read Model Retest

Use after source-domain fixes for production, stock, dispatch, commercials, and payroll are merged.

Commands:

```bash
npx vitest run __tests__/commercials-read-model.test.ts __tests__/p1-production-dispatch-regressions.test.ts
npx vitest run
```

Add dashboard read-model tests for Factory Today production, gross wages, pending dispatch, pending receipt, historical analytics, and sign-off blocking before closing this cluster.

Runtime checks:

- After production, verify Today meters, active looms, downtime, and gross wages against source rows.
- After sale and partial dispatch, verify Factory Today pending dispatch matches `fabric_stock_sales.pending_dispatch_meters`.
- After receipt discrepancy, verify sign-off shows the unresolved difference and owner/next-action state.
- Open a historical date and verify analytics use that date's production/orders/machines, not current state.
- Confirm sign-off remains blocked when external supervisor-register truth is missing.

Acceptance:

- `DASH-003`, `DASH-004`, `DASH-007`, `SIGNOFF-01`, `SIGNOFF-02`, `SIGNOFF-04`, `SIGNOFF-06`, `SIGNOFF-07`, `SIGNOFF-08`, `SIGNOFF-09`, and `SIGNOFF-10` have runtime evidence or documented pilot de-scope.
- `SIGNOFF-05` expected-stock reasonableness is already closed by Batch 2 production/stock atomicity proof and should be rerun here only if the dashboard read model changes again.
- Batch 3 closes dispatch/receipt read-model rows `DASH-007`, `SIGNOFF-07`, and `SIGNOFF-08` with runtime proof. `SIGNOFF-10` was outside Batch 3 release/Sentry/source-map scope.
- Batch 4 closes commercial signoff rows `SIGNOFF-06` and `SIGNOFF-09` with runtime/browser proof. `SIGNOFF-10` was outside Batch 4 release/Sentry/source-map scope and is closed later by Batch 8C.
- Batch 15 moves `DASH-003` from fail to `code_verified` by replacing the hard-coded gross wage placeholder with meter/rate snapshot aggregation and focused tests. It is not pass until after-shift Factory Today runtime/browser proof is captured with disposable QA data.

## P3 Payroll and Kharchi Retest

Commands:

```bash
npx vitest run __tests__/p1-payroll-guard.test.ts __tests__/p1-payroll-revert.test.ts __tests__/payroll-manual-adjustments.test.ts __tests__/payroll-settlement-history.test.ts
npx vitest run __tests__/payroll-cycle.test.ts __tests__/payroll-pay-date-config.test.ts
npx vitest run
```

Runtime checks:

- Preview and settle payroll in a valid final/pay window.
- Verify gross, inam, kapaat, advance recovery, PF, ESI, and net against source rows.
- Attempt legacy settlement/reversal RPCs and confirm they are revoked or hardened.
- Record online kharchi and verify worker advance plus supervisor float transaction are atomic.
- Verify offline kharchi remains disabled unless it queues to a real reconciled path.

Acceptance:

- `PAY-006`, `PAY-027`, and payroll-related sign-off rows have evidence. `PAY-013` and `PAY-015` are already closed by Batch 21C disposable runtime proof; `PAY-018` and `PAY-020` are already closed by Batch 21D disposable runtime proof.
- Batch 9 closes `PAY-028` and `OFF-008` by truthful online-only offline-kharchi de-scope; online kharchi atomicity and payroll correctness rows remain separate.
- Batch 15 closes `PAY-023` and `PAY-024` with focused payslip document/export tests and source proof, and closes `SEC-014` with deterministic payslip filename sanitization tests. Batch 15 moved `PAY-013` and `PAY-015` from fail to `code_verified`, not pass, because disposable live preview/settlement proof was not collected under the no-Supabase-mutation rule. Batch 21C closes `PAY-013` and `PAY-015` with disposable payroll preview/settlement runtime proof in `output/qa/batch21c/BATCH21C-payroll-preview-settlement-runtime-proof.json`.
- Batch 20 moves `PAY-018`, `PAY-020`, and `PAY-027` from fail to `code_verified`, not pass. Batch 21D closes `PAY-018` and `PAY-020` with disposable payroll boundary runtime proof in `output/qa/batch21d/BATCH21D-payroll-boundary-runtime-proof.json`: legacy payroll RPC overloads were permission denied through API roles, settlement blocked missing payment mode and missing owner verification, valid UI settlement succeeded, reversal rejected empty/invalid/reused codes, and one valid code reversed exactly once. The next disposable QA payroll run still needs to prove online Kharchi creates worker advance plus supervisor float transaction atomically for sufficient float while rejecting insufficient float before `PAY-027` can move to pass.

## P4 Idempotency, Offline, and Cache Retest

Commands:

```bash
npx vitest run __tests__/p1-razorpay-idempotency.test.ts
npx vitest run
```

Add targeted tests for estimator, market-run, sale, dispatch, payment, payroll idempotency, and logout cache clearing before closing this cluster.

Runtime checks:

- Rapid double-submit estimator save and market-run creation.
- Rapid double-submit sale and dispatch.
- Simulated timeout for sale/payment/payroll mutation with status reconciliation.
- Logout and login as another QA account on same browser profile; inspect localStorage, React Query persister, and IndexedDB mutation queue if auth-boundary cache behavior changes.
- Offline route renders the offline page if offline support remains in pilot.

Acceptance:

- `EST-017`, `OFF-007`, `OFF-009`, and `OFF-010` are fixed or de-scoped.
- Batch 9 closes `OFF-002`, `OFF-005`, `OFF-006`, and `SEC-016` with offline route proof, awaited auth-boundary cache cleanup, IndexedDB queue cleanup, and privacy/public copy truth.
- Batch 3 closes `SALE-015` for rapid duplicate stock-sale submit. Other idempotency/offline/cache rows remain open.
- Batch 4 closes commercial receivable payment duplicate-submit idempotency as part of `COMM-010` and `SIGNOFF-09`. `OFF-009` remains open for unknown-timeout UX and status reconciliation across high-value mutations.
- Batch 9 leaves `OFF-007` partial pending production service-worker update proof with an active draft and leaves `OFF-010` partial pending throttled slow/intermittent-network runtime proof across core mobile screens.

## P5 Release Gate Retest

Commands:

```bash
npm ci
npm run lint
npx vitest run
npm run build
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
```

Release checks:

- Confirm production migration head equals approved repository migration head.
- Batch 8 satisfies `TECH-007` for the current repository head: Supabase local and remote migrations were aligned through `20260628185344` with no pending, failed, or out-of-order migrations reported.
- Confirm CI runs install, lint, tests, build, and audit gate.
- Confirm the source-controlled build path still runs Vitest before build; Batch 7 satisfies this for `TECH-013` with `test: vitest run`, `prebuild: npm run test`, and a passing `npm run build`.
- Confirm Batch 8 Sentry tunnel/CSP/auth-release config remains in place: `withSentryConfig` owns `/monitoring`, `worker-src 'self' blob:` is present, and Sentry auth-token/release config is sourced from environment.
- Batch 8B satisfies `TECH-010`: fresh production deployment after adding `SENTRY_AUTH_TOKEN` produced Sentry release `2538da25b2fa` in `production` with 529 source-map artifacts and no old skipped auth/release/source-map warnings.
- Batch 8C satisfies `SIGNOFF-10`: after the Sentry DSN fix and redeploy, fresh `/login` and `/privacy` browser smoke had no `/monitoring?...` 403s, no CSP `worker-src blob:` error, and only non-blocking `.woff2` preload warnings; Vercel runtime/server logs showed Warning 0, Error 0, Fatal 0 with no 5xx/server exceptions; Sentry production release `7c6449a59061` showed 100% crash-free sessions, 0 crashes, 0 new issues, 0 handled issues, and 0 unhandled issues.
- Restore backup into a disposable project and reconcile one org, users, production, stock, receivables, and payroll.
- Exercise application rollback and database forward-fix runbook in disposable infrastructure.

Acceptance:

- `TECH-001`, `TECH-005`, `TECH-006`, `TECH-011`, and `TECH-012` have evidence or signed release-risk acceptance where allowed. `TECH-013` is closed by Batch 7 source-level test/build gate evidence. `TECH-007` is closed by Batch 8 migration-head alignment evidence for repository head `20260628185344`. `TECH-010` is closed by Batch 8B Sentry release/source-map evidence for deployed release `2538da25b2fa`. `SIGNOFF-10` is closed by Batch 8C clean deployed browser/server/Sentry evidence.
