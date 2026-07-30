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

## UX-012 pilot-user operating retest — OPEN

1. Use the deployed product in the actual pilot user's normal task context.
2. Record reviewer name, role, date/time/time zone, route/output, language, and task context.
3. Record every confusing or rejected term, including Worker Hisaab, Upaad, Kharchi, Inam, Kapaat, Hajiri, Taka, Warp/Weft local terms, and Fabric Quality.
4. Implement each accepted correction consistently across UI, validation, locales, PDFs, exports, messages, documentation, and help.
5. Rerun UX-012 targeted tests, full tests, TypeScript, build, and affected deployed route/output checks.
6. Obtain the same user's dated confirmation after changes. Keep the operating action OPEN until all steps are complete.

This control does not reopen the amended pre-pilot row unless feedback identifies a production/stock/payroll/dispatch/financial ambiguity or a regression.

- `npm ci` fails until the lockfile is repaired.
- `npm run lint` passed in the final QA run.
- `npx vitest run` passed in the final QA run; Batch 20 full Vitest via `npm run build` passed with 363 passed and 1 skipped.
- `npm run build` passed in the final QA run; Batch 20 also passed `npm run build` with the source-controlled `prebuild` Vitest gate.
- Both audit commands fail until advisories are fixed or formally accepted.

Do not use passing lint/build/source checks to resolve runtime failures.

## BATCH-01-AUTHZ-BOUNDARY

Failures targeted: `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`

Security foundation follow-on rows closed in Batch 1B: `SEC-006`, `AUTH-016`

Other follow-on checks that remain open unless separately proven: `AUTH-012`, `AUTH-013`, `SEC-013`. `AUTH-008` is closed by the 2026-07-11 runtime-remediation proof. `PAY-018` and `PAY-020` were source-fixed/code_verified by Batch 20 and are closed by Batch 21D disposable QA runtime proof.

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
npx vitest run __tests__/batch22-production-order-boundary-hardening.test.ts
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
- Batch 22 source-fixes `ORDER-005`, `ORDER-009`, and `PROD-011` but does not make them pass-ready. Migration `20260702121238_batch_22_production_order_boundary_hardening.sql` must be applied to QA before runtime proof. Then rollback-only/API probes must prove over-target, cancelled/completed order-attributed logs, stale assignment, and negative-meter writes are rejected, while valid production/correction still reconciles generated stock, order progress, and payroll basis.
- Batch 24B source-fixes `PROD-013`, `PROD-023`, and `PROD-029`. Browser proof must still verify that suspicious large positive shift meters show a non-blocking confirmation and can proceed after confirmation, and restored localStorage drafts after refresh/crash show the unsaved-draft indicator and clear after save/reset. `PROD-029` copy proof is closed by `output/qa/runtime-proof-loop/GROUP_A-runtime-proof-20260706-PROD-029.json`: the QA-env local app showed shift-meter/shift-total terminology on public and supervisor production surfaces with no raw opening/closing proof claim. `PROD-022` remains open for separate date/shift draft-isolation runtime proof.
- Batch 24D source-fixes `PROD-022` but does not make it pass-ready. Browser proof must verify production drafts are isolated by org, user, selected date, and shift; changing date/shift does not show another draft; returning restores the matching draft; and save submits the currently selected date/shift.
- Batch 24C source-fixes `SETUP-011` but does not make it pass-ready. Batch 24F updates the worker-assignment portion to selected-shift/day-only policy. Browser proof must create/verify the quote or market-run costing, active linked loom target, at least one selected-shift worker assignment for the operating shift, active workers, supervisor, payroll config, and plan, then refresh Factory Today and confirm the setup checklist remains complete from persisted data.
- Batch 24E source-fixes `MASTER-002` and `MASTER-005` but does not make them pass-ready. Migration `20260704120000_batch_24e_master_data_loom_guardrails.sql` was revised from a retroactive unique index to a trigger-backed duplicate guard and reportedly applied during the production DB push incident; this improves DB-boundary evidence but does not replace controlled proof. Before promoting `MASTER-002`, run controlled QA/browser proof for duplicate manual add, duplicate bulk add, duplicate rename, trim/case duplicate rejection, same-name different-org allowance, and different-name same-type allowance. Before promoting `MASTER-005`, browser/API proof must verify owner delete/deactivate, supervisor delete-with-code, and cost-analysis unlink are blocked for protected looms with active targets, assignments, shift-assignment history, and production history; verify unlink does not silently deactivate; and verify unused loom behavior remains intentional.
- Batch 24F source-fixes `PROD-002` and `PROD-004` but does not make them pass-ready. Browser proof must verify day-only/day-shift production saves without requiring a night worker, night-shift positive production without a night worker returns the selected-shift accountability error, day-only setup/checklist/activation does not falsely fail for missing night worker, and substitute-worker mismatch returns reassignment-required behavior without silently attributing production to the wrong worker. `SIGNOFF-01` remains fail/open until current-run owner sign-off proof is collected.

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
- `QUOTE-007` was source-fixed in Batch 23 and is `code_verified`. Retesting/pass still requires applying the database/RPC migration and verifying atomicity/rollback under runtime QA.
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
- Open a historical date and verify analytics use that date's production, worker breakdown, and seven-day trend, while current-only orders/machines/today state is cleared or hidden instead of shown as historical data.
- Confirm sign-off remains blocked when external supervisor-register truth is missing.

Acceptance:

- `DASH-003`, `DASH-004`, `DASH-007`, `SIGNOFF-01`, `SIGNOFF-02`, `SIGNOFF-04`, `SIGNOFF-06`, `SIGNOFF-07`, `SIGNOFF-08`, `SIGNOFF-09`, and `SIGNOFF-10` have runtime evidence or documented pilot de-scope.
- `SIGNOFF-05` expected-stock reasonableness is already closed by Batch 2 production/stock atomicity proof and should be rerun here only if the dashboard read model changes again.
- Batch 3 closes dispatch/receipt read-model rows `DASH-007`, `SIGNOFF-07`, and `SIGNOFF-08` with runtime proof. `SIGNOFF-10` was outside Batch 3 release/Sentry/source-map scope.
- Batch 4 closes commercial signoff rows `SIGNOFF-06` and `SIGNOFF-09` with runtime/browser proof. `SIGNOFF-10` was outside Batch 4 release/Sentry/source-map scope and is closed later by Batch 8C.
- Batch 15 moves `DASH-003` from fail to `code_verified` by replacing the hard-coded gross wage placeholder with meter/rate snapshot aggregation and focused tests. It is not pass until after-shift Factory Today runtime/browser proof is captured with disposable QA data.
- Batch 22 improves the `SIGNOFF-02` `ORDER-009` dependency by source-fixing cancelled/completed/stale-assignment order attribution at the RPC/table boundary, but `SIGNOFF-02` remains fail until full current-run attribution runtime proof is captured after the migration is applied in QA.
- Batch 24C moves `DASH-004` from fail to `code_verified` by replacing stale current-state merges with full selected-date state replacement and selected-date trend scoping. It is not pass until historical-date Analytics browser/runtime proof is captured.
- Batch 24F improves the `SIGNOFF-01` dependencies by source-fixing `PROD-002` and `PROD-004`, but `SIGNOFF-01` remains fail/open until current-run owner sign-off proof confirms all active looms are accounted for with production or downtime.

## P3 Payroll and Kharchi Retest

Commands:

```bash
npx vitest run __tests__/p1-payroll-guard.test.ts __tests__/p1-payroll-revert.test.ts __tests__/payroll-manual-adjustments.test.ts __tests__/payroll-settlement-history.test.ts
npx vitest run __tests__/payroll-cycle.test.ts __tests__/payroll-pay-date-config.test.ts __tests__/p1-attendance-rls-boundary.test.ts
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
- Batch 24A moves `PAY-006` from fail to `code_verified`: it enforces attendance date boundaries at the RLS database layer, restricts direct writes to today (for supervisors) or today/past (for owners), blocks future direct writes, and routes supervisor past-date edits through the save-time access-code server action boundary. The migration has been created but is not yet applied, and the updated UI/database behavior still requires disposable QA runtime/browser verification.

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

### OFF-009 production retest after shift-write repair

1. Provision the isolated OFF-009 supervisor fixture and confirm the target shift has zero production logs.
2. Submit one 42m shift entry through the one-shot delay proxy so the server commit completes but the response arrives after the 15-second client boundary.
3. Require the UI to identify the outcome as unknown while checking, then resolve to the reconciled-success message from authoritative state; it must not show a definite failure or invite an immediate retry.
4. Reconcile exactly one production row for the fixture machine/date/shift with 42m, then verify a second row was not created.
5. Capture browser/console and database evidence, run exact fixture cleanup, and only then promote the formal `OFF-009` row from `fail` to `pass`.
- Batch 9 originally left `OFF-007` partial; the 2026-07-11 runtime-remediation campaign now closes it with two-build production-mode proof showing the waiting update notice and exact active draft together. `OFF-010` remains partial pending throttled slow/intermittent-network runtime proof across core mobile screens.
- Batch 24D moves `EST-017` from fail to `code_verified` by adding a synchronous estimator submit lock and focused source tests. It is not pass until browser rapid double-click proof is collected, and it does not claim server/database idempotency.

## Batch 24G Security Audit And Export Retest

Production reconciliation note:

- A Supabase DB push reportedly occurred before reconciliation while linked to production ref `vzhwahudircrpgtitwzd`, applying migration history `20260704120000`, `20260705100000`, and `20260705182406`.
- The repo is reconciled to that production-applied reality. No rollback and no additional DB command occurred during reconciliation.
- This incident does not make any row pass-ready.
- `MASTER-002` still needs controlled duplicate-flow proof; `MASTER-005` still needs browser lifecycle proof; `SEC-015` still needs settings-change audit-row proof with redacted payloads; `SEC-009` still needs owner export browser/security proof and audit-log EXPORT proof, plus focused debugging of the blank Premium Settings content observed in isolated QA. `SEC-017` and `AUTH-008` are closed by runtime-remediation proof.

Formal blocked-row Batch 3 completed 2026-07-13: `UX-003` passed retained-value validation recovery with no partial join rows; `BILL-008` passed valid/self/duplicate authenticated referral API and database proof; `AUTH-015` passed two-independent-session revocation proof after server enforcement was added. Keep the focused 5-test pack and exact cleanup probe under regression.

## Runtime Rerun Reproof Plan - Checkpoint Through Queue 16

Use only strongly QA-prefixed test tenants. Verify project ref before database work, reconcile exact IDs before and after every destructive lifecycle test, and preserve fixtures only while they are required by the next queued row.

- `AUTH-005`: use an isolated browser session for token reuse, verify an expired token, obtain explicit confirmation before submitting the final password change, and verify the resulting session behavior.
- `AUTH-012`: after policy repair, repeat Org A guessed-ID reads for Org D organization/profile/machine/worker rows and representative server actions; assert no data and no mutation.
- `SETUP-007` completed 2026-07-13: a same-origin proxy intercepted exactly one setup save with a controlled 503 before mutation. The step remained incomplete, the retry message appeared, the save action re-enabled, and database count stayed zero; retry created exactly one machine and a fresh load retained the completed step. Evidence: `output/qa/runtime-remediation-20260711/evidence/SETUP-007-formal-batch6.json`.
- `SETUP-011` completed 2026-07-13: an isolated Both-mode fixture supplied an estimate, active order and linked loom, piece-rate and fixed workers, day/night assignments, supervisor, payroll config, and active plan. After repairing the deferred checklist Strict Mode lifecycle, Factory Today rendered 11 of 14 steps with `Log first production` next before and after refresh.
- `SETUP-012` completed 2026-07-13: a retained prior code failed after rotation, while the current code resolved only the intended isolated QA organization and exposed its join form; no join was submitted and no code value was recorded.
- `MASTER-002` completed 2026-07-13: isolated bulk UI and database-boundary proof covered duplicate types with distinct generated names, normalized insert/rename rejection, same-type different-name allowance, and same-name cross-tenant allowance.
- `MASTER-003` completed 2026-07-13: an active history-bearing loom retained the same target, two standing assignments, one dated assignment, and one production log after name/type edit and refresh.
- `MASTER-005` completed 2026-07-13: owner deactivate/delete were rejected for the protected loom with all reference reasons visible and history intact; a separate unused loom delete persisted. Null-target unlink remains source-regression-covered and was not used to broaden this runtime row beyond its stated deactivate/delete scenario.
- `MASTER-006`: resolve the worker-rate versus costing-rate contract, then run the decimal value through its authoritative input, production snapshot, payroll preview, settlement, and refresh.

Continue the main queue at `MASTER-008` and do not infer blocked-row success from later dependent workflows.

Batch 2 continuation result:

- `MASTER-008` passed and needs no immediate rerun unless payroll calculation code changes.
- Repair shift-log submission so the scoped update includes an explicit tenant/record predicate; prove zero partial rows on failure and one exact row per loom/shift on success.
- Align app and database loom-activation requirements, then prove intended day-only and two-shift configurations.
- Re-run `MASTER-009` after inactive-worker assignment invalidation is fixed; verify Machines and Factory Today become incomplete while pre-deactivation logs retain worker attribution.
- Re-run `MASTER-011` with Worker A standing assignment, Worker B dated substitution, a successful log, and payroll attribution to Worker B only for that shift.
- Re-run `MASTER-012` with context A log, target replacement to context B, context B log, and immutable order/rate snapshots on both historical rows.
- Main queue continuation starts at queue item 21; production-history-dependent rows remain blocked until the shared log-save prerequisite passes.

Commands:

```bash
npm test -- __tests__/batch24e-master-data-guardrails.test.ts __tests__/batch24g-security-audit-guardrails.test.ts
npx tsc --noEmit --pretty false
npx eslint 'app/(auth)/actions/auth.ts' 'app/(dashboard)/owner/actions.ts' 'app/(dashboard)/owner/estimator/actions.ts' 'app/(dashboard)/owner/settings/data-export.ts' 'app/(dashboard)/owner/settings/page.tsx' 'lib/actions/compliance.ts' '__tests__/batch24g-security-audit-guardrails.test.ts' '__tests__/batch24e-master-data-guardrails.test.ts'
```

Runtime/security checks required before pass:

- In controlled QA or a disposable tenant, make representative settings changes for organizations, factory_cost_profile, compliance_settings, notification_consents, and whatsapp_settings.
- Verify audit_log rows include actor, org where applicable, table/action/record, timestamp, and redacted old/new payloads.
- Run owner data export from the active settings UI.
- Verify the export payload is current-org only, excludes/redacts sensitive fields, and does not include runtime secrets, auth headers, cookies, request bodies, service-role keys, Supabase keys, or DB URLs.
- Verify an EXPORT audit row exists before considering the export proof complete.

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

- `TECH-001`, `TECH-005`, and `TECH-006` have fresh command proof: repaired-lockfile `npm ci` succeeds and both runtime-only and full audits contain zero high/critical findings. `TECH-011` and `TECH-012` still require restore/rollback evidence or signed release-risk acceptance where allowed. `TECH-013` is closed by Batch 7 source-level test/build gate evidence. `TECH-007` is closed by Batch 8 migration-head alignment evidence for repository head `20260628185344`. `TECH-010` is closed by Batch 8B Sentry release/source-map evidence for deployed release `2538da25b2fa`. `SIGNOFF-10` is closed by Batch 8C clean deployed browser/server/Sentry evidence.

## Runtime Rerun Batch 3 Continuation

- Queue items 21-30 all passed with browser/runtime and tenant-scoped DB proof.
- Continue at `EST-014` (queue item 31), followed by `EST-015`, `EST-017`, `EST-018`, and quote/order lifecycle rows.
- Do not classify an interaction while a required setup overlay is intercepting the target control.
- Continue to use disposable, strongly prefixed QA records and reconcile cleanup after each lifecycle.

## Runtime Rerun 2026-07-10 Follow-up

- Repair and directly rerun the remaining confirmed runtime failure: `AUTH-012`. `MASTER-006` is now a schema-parity blocker against the rewritten assignment-rate contract. `UX-007`, `EST-014`, `MASTER-009`, `SALE-010`, `SALE-012`, `SALE-014`, and `DASH-004` passed fresh QA runtime proof in `runtime-remediation-20260711`.
- Keep the 97 blocked rows blocked until their exact prerequisite is available; do not convert setup, environment, safety, external-provider, destructive, timed, device, or fixture gaps into product failures.
- For security-sensitive rows, use a disposable tenant/project or purpose-built simulator and obtain explicit scope before replay, invalid-signature, XSS, CSRF, erasure, or destructive audit tests.
- Reconcile outcomes back into `output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md`; the current runtime campaign has no remaining `code_verified` or `not_run` rows.

### Runtime remediation superseding closeout — SIGNOFF-01 / SIGNOFF-02

- The current-run owner reproof is complete. Factory Today displayed 50m and `Factory is clear today.` after its production query was aligned to the deployed schema.
- Database readback proved the only active loom was accounted for and that log, loom, dated assignment, active order, and day worker attribution all matched.
- `SIGNOFF-01` and `SIGNOFF-02` are `PASS`; historical statements above that they remain open are retained only as batch history and are superseded by this closeout.

### AUTH-012 superseding production closeout — 2026-07-13

- Migration `20260710210828` is applied in production and recorded in migration history.
- Post-deployment catalog contains no public/true organization SELECT policy.
- Fresh production reproof passed own organization read/update, cross-tenant organization/profile/machine non-disclosure, cross-tenant organization/machine mutation denial, and service-role non-mutation reconciliation.
- Exact synthetic cleanup passed. `AUTH-012` is now `PASS`; earlier open/retest instructions are retained only as historical batch context.

### Production checkpoint live-test handoff — 2026-07-13

- Test against `https://textile-accounting.vercel.app`; deployment `dpl_4pP8ovMPoS1tCwAcp9RZQL5gNfnY` is the checkpoint release for source commit `40b414a6ed7b9285048045c118074d8e0d010065`.
- Database migrations are aligned through `20260711180000`; `whatsapp-webhook` is active at version 16.
- Start live validation with authenticated owner and supervisor smoke, then rerun the remaining shift-write/unknown-outcome prerequisites before production-history-dependent rows.
- Do not mark the six schema-lint functions pass-ready. Audit `lockdown_tenant`, `link_batch_to_machine`, `get_daily_brief_stats`, `replace_shift_production_logs`, `settle_worker_payroll`, and `get_yield_alert` independently and reconcile each to a formal row or retirement decision.
- Preserve the current formal counts until new runtime evidence is reconciled: 266 pass, 3 fail, 107 blocked, and 1 not applicable.

### Formal Batch 7 superseding production prerequisite proof — 2026-07-13

- `PROD-002`, `PROD-004`, and `MASTER-012` are `PASS` from isolated production browser/database proof; do not rerun them unless activation, operator assignment, shift submission, generated stock, or payroll snapshot code changes.
- Production migration head is `20260713124500`. The day-only activation contract now requires one active shift worker plus an active order; the selected shift still requires its own worker.
- Preserve the Batch 7 two-grain regression: Context A/Worker A/day/40m/₹2.50 and Context B/Worker B/night/55m/₹3.25 must remain independent across refresh, stock generation, and payroll calculations.
- Next focused repair: reproduce why selecting a historical production date is overwritten when mode/meter state changes. Inspect the dashboard effects and tenant/user/date/shift draft restoration before changing behavior.
- After the repair, rerun `MASTER-011` with a dated Worker B substitution, persist the historical date and worker/rate/order snapshots, refresh, and reconcile payroll to the substituted worker. Then reassess `PROD-017`, `PROD-018`, `PAY-006`, `TIME-003`, and `TIME-004` individually.
- Current formal counts: 269 pass, 3 fail, 104 blocked, and 1 not applicable. Readiness remains No-Go.

### Formal Batch 8 superseding dated-substitution proof — 2026-07-13

- `MASTER-011` is `PASS`; preserve the Worker A standing / Worker B dated-only / 2026-07-12 / 32m / ₹3.25 / ₹104 regression across supervisor refresh, generated stock, and owner payroll.
- Do not rerun unless production date navigation, shift assignment precedence, order-start validation, snapshot persistence, correction-window replacement, stock generation, or payroll aggregation changes.
- Reassess `PROD-017`, `PROD-018`, `PAY-006`, `TIME-003`, and `TIME-004` separately. Batch 8 did not execute their exact after-window access-code, attendance, month/year, or leap-day scenarios.
- Current formal counts: 270 pass, 3 fail, 103 blocked, and 1 not applicable. Readiness remains No-Go.

### B09 production-resilience regression guard — 2026-07-14

- Preserve rejection of positive metres without order, worker, or positive rate and rejection of negative metres at both client/server boundaries.
- Preserve tenant/user/date/shift draft keys, visible unsaved restoration, no success claim before a request reaches the server, and authoritative reconciliation after an unknown response timeout.
- Preserve one result for concurrent same-grain submissions: one success, one duplicate rejection, one production log, and one generated stock lot.
- Preserve Copy previous visibility when placeholder rows exist but no worker is assigned, and copy only the selected prior date/shift into one editable target grain.
- Preserve verified breakdown update-or-insert behavior when the dated row is absent, plus an H2-labelled dialog and independent machine status.
- Re-run the 390×844 20-loom workflow if card layout, fixed action footer, metre input naming, or shift-submit state changes.
- Canonical counts after B09: 287 pass, 3 fail, 86 blocked, and 1 not applicable. Begin B10; do not rerun B09 unless one of these boundaries changes.

### B10 protected-boundary regression guard — 2026-07-14

- Preserve correction-window behavior: open-window correction remains direct where allowed; closed-window correction requires one valid owner code; invalid, expired, and consumed codes mutate nothing; successful use is single-use.
- Preserve settled-payroll immutability even when a fresh valid code is supplied.
- Preserve attendance policy parity with UI navigation: no future write, deterministic prior-day navigation, owner authorization for supported past changes, and refresh-stable locked history.
- Preserve India half-open month boundaries derived from one instant, plus explicit year-rollover and leap-day coverage.
- Preserve access-code rate-limit wording as remaining seconds, not an absolute epoch value.
- Focused regression commands: `npx vitest run __tests__/b10-attendance-date-lockdown.test.ts __tests__/b10-india-calendar-boundaries.test.ts __tests__/b10-rate-limit-retry.test.ts __tests__/p1-commercial-payments.test.ts`; re-run the production fixture if correction, settlement, attendance RLS, access-code, or India date-boundary code changes.
- Canonical evidence is `output/qa/blocked-row-campaign/B10-qa-boundaries.json`, `B10-production-boundaries.json`, and `B10-production-runtime.json` on production deployment `dpl_5rKpnNLwszpfgfzkn8VBh291wyS6`.
- Canonical counts after B10: 295 pass, 3 fail, 78 blocked, and 1 not applicable. Begin B11; do not rerun B10 unless one of these boundaries changes.

### B11 quote/order protected-history regression guard — 2026-07-14

- Preserve atomic Start Party Order behavior: one accepted quote, one active order, reciprocal links, one yarn requirement, and navigation to the created order; any failure must leave no partial chain.
- Preserve explicit over-target rejection with no production, stock, progress, or payroll mutation.
- Preserve completion/cancellation loom unlinking while retaining production and order-reserved stock history; physical deletion must not orphan protected records.
- Preserve order/party/source links across sale, multiple partial dispatches, receipts, discrepancies, claims, receivables, and payment history.
- Preserve exact and shortage receipt arithmetic without rewriting production-backed stock, and preserve independent customer collection and worker payroll settlement.
- Preserve paid/completed correction rejection and second-session reconciliation of order progress, stock, dispatches, receipts, discrepancy, and zero receivable balance.
- Focused regression commands: `npx vitest run __tests__/batch23-start-party-order-atomicity.test.ts`; run `node scripts/qa/batch6-golden-a-runtime-proof.mjs` in an isolated QA tenant when quote/order, production, stock, dispatch, receipt, commercials, payroll, cancellation, or archive boundaries change.
- Canonical evidence is `output/qa/blocked-row-campaign/B11-qa-order-lifecycle.json` and `B11-production-runtime.json` on production deployment `dpl_HQbasVXv3NDZjrtVjoXjpebgtbGV`.
- Canonical counts after B11: 307 pass, 3 fail, 66 blocked, and 1 not applicable. Begin B12; do not rerun B11 unless one of these boundaries changes.

### B12 market-stock lifecycle regression guard — 2026-07-14

- Preserve database rejection of cross-tenant market-run sources, quote/order mismatches, and relational IDs on manual/opening lots, with no rejected row left behind.
- Preserve sold-out pending-dispatch truth, two independently actionable dispatch batches, exact receipt arithmetic, closed archive totals, and stock-sale-inclusive `sales_count`.
- Preserve advisory compliance truth: above-threshold dispatch with missing e-way/challan/transporter data remains visibly incomplete; below-threshold state remains a reminder, not a legal-compliance claim.
- Preserve explicit `party_id` on new receivables and separation of distinct parties that share a normalized display name.
- Preserve row-locked lot mutation: a concurrent sale and adjustment that together exceed availability yield one success, one rejection, one movement, and a non-negative lot.
- Preserve fresh second-session market summaries and the formal under-two-second budget for the exercised 26-run fixture.
- Focused regression command: `npx vitest run __tests__/b12-stock-source-integrity.test.ts`; run `node scripts/qa/b12-market-stock-runtime-proof.mjs` in isolated QA, and use `--production` only against an approved exact deployment when stock-source, sale, dispatch, receipt, commercial party, or market-summary boundaries change.
- Canonical evidence is `output/qa/blocked-row-campaign/B12-qa-market-stock.json` and `B12-production-market-stock.json` on production deployment `dpl_q1bQa4dHd9bFKFU8ZphcVQNcE2d1`.
- Canonical counts after B12: 317 pass, 3 fail, 56 blocked, and 1 not applicable. Begin B13; do not rerun B12 unless one of these boundaries changes.

### B13 payroll lifecycle regression guard — 2026-07-14

- Preserve per-worker/type/cycle settlement serialization: two concurrent first attempts yield one success, one explicit rejection, one settlement, and one advance deduction.
- Preserve server-derived gross from immutable decimal rate snapshots; assignment-rate changes cannot rewrite historical 2.75, 3.125, or 3.00 production earnings.
- Preserve capped standard recovery, explicit carry-forward debt, non-negative payout, and reasoned/itemized inam and kapaat.
- Preserve database rejection of direct deducted/settlement-linked advance deletion and exact, one-time-authorized reversal restoration.
- Preserve atomic final-exit settlement/deactivation and supervisor Kharchi float/advance equality.
- Preserve Factory Today market-summary compatibility plus exact meters, shift, work-risk, advance, and payroll signals; preserve the refreshed payroll rate breakdown, final badge, and payslip action.
- Focused regression commands: `npx vitest run __tests__/b13-payroll-settlement-boundaries.test.ts __tests__/payroll-cycle.test.ts __tests__/b10-india-calendar-boundaries.test.ts __tests__/batch20-payroll-rpc-kharchi-atomicity.test.ts`; run `node scripts/qa/b13-payroll-runtime-proof.mjs` in isolated QA, and use `--production` only against an approved exact deployment when payroll settlement, advances, reversal, exit, Kharchi, operator snapshots, or Factory Today sources change.
- Canonical evidence is `output/qa/blocked-row-campaign/B13-boundary-probe.json`, `B13-qa-browser.json`, and `B13-production-payroll.json` on production deployment `dpl_EBYTZG33aozbGbPLpYeAWQcF4JJD`.
- Canonical counts after B13: 333 pass, 3 fail, 40 blocked, and 1 not applicable. Begin B14; do not rerun B13 unless one of these boundaries changes.

### B14 realtime dashboard regression guard — 2026-07-14

- Preserve error unwrapping for every dashboard source: fulfilled responses containing Supabase errors must reach an actionable retry state, never empty success data.
- Preserve unique channel epochs on reconnect and authoritative slice replacement after realtime invalidation; the 20m/₹80 baseline plus a 25m event must resolve to 45m/₹180, never 70m.
- Preserve disconnected-mutation recovery: returning live must refetch the 60m/₹240 truth without reload, stale channel, or duplicate totals.
- Preserve worker-breakdown ordering on `submitted_at`, meter-worker identity fallback, and Realtime publication of `production_logs`.
- Preserve independent order-health arithmetic, explicit zero-production risk, and distinct future-critical versus overdue labels.
- Preserve distinct actionable loading/reconnecting, error, offline, historical empty, and live connected states.
- Preserve the formal two-second budget and complete-result requirement for the exercised 90-day/1,800-log dashboard fixture.
- Focused regression command: `npx vitest run __tests__/b14-realtime-dashboard-states.test.ts`; run `node scripts/qa/b14-dashboard-runtime-proof.mjs` in isolated QA, and use `--production` only against an approved exact deployment when realtime topics, dashboard actions/states, pace RPCs, worker breakdowns, or large-range queries change.
- Canonical evidence is `output/qa/blocked-row-campaign/B14-qa-dashboard.json`, `B14-qa-browser.json`, and `B14-production-dashboard.json` on production deployment `dpl_3Xb6mYaqnG5FRpye7ULVWcxq9ttq`.
- Canonical counts after B14: 338 pass, 3 fail, 35 blocked, and 1 not applicable. Begin B15; do not rerun B14 unless one of these boundaries changes.

### B15 authentication/privacy/adversarial regression guard — 2026-07-14

- Preserve valid/used/expired recovery behavior and the seven-day last-activity cookie used to enforce the one-hour idle boundary; expired responses must redirect without tenant/user content.
- Preserve normalized first-forwarded-IP auth limiter keys and same-user/foreign-Origin server-action rejection without mutation.
- Preserve plan-independent, responsive owner export and fail-closed actor/org/record audit creation.
- Preserve atomic owner-only worker erasure, immutable production/payroll basis, and redaction of DOB, provenance, statutory/contact identifiers, and client IP from retained audit payloads.
- Preserve inert rendering for stored hostile text across orders, dispatches, workers, and Estimator.
- Preserve keyboard activation/naming for custom order/worker/audit controls and no overflow/clipped actions at the exercised 200%-equivalent Settings, Orders, and Today layouts.
- Preserve manifest start `/login`, scope `/`, standalone display, exact 192/512 icons, and `SKIP_WAITING` update handling. Keep `OFF-001` blocked until install and standalone reopen are observed on a supported browser/device.
- Focused regression command: `npx vitest run __tests__/b15-auth-privacy-pwa-guardrails.test.ts __tests__/auth-reset-flow.test.ts __tests__/batch24g-security-audit-guardrails.test.ts __tests__/sec-017-worker-age-verification.test.ts`; run `node scripts/qa/b15-security-runtime-proof.mjs --preserve` only in isolated QA and complete its expiry/exercise/finalize sequence before cleanup.
- Canonical evidence is `output/qa/blocked-row-campaign/B15-qa-security.json`, `B15-qa-browser.json`, `B15-qa-http.json`, and `B15-production-security.json` on production deployment `dpl_CmFozomMsAhE36kvGUMQiPwJpsFr`.
- Canonical counts after B15: 348 pass, 3 fail, 25 blocked, and 1 not applicable. Begin B16; do not rerun B15 unless one of these boundaries changes or a supported PWA install surface becomes available.

### B16 WhatsApp delivery regression guard — 2026-07-14

- Preserve exact organization/recipient/normalized-phone consent binding and durable, distinct opt-out, missing-consent, missing-phone, and phone-mismatch skip logs.
- Preserve the business-write boundary: provider timeout, rejection, or token expiry changes delivery history and fallback state, never the underlying advance, payroll, or access-code mutation.
- Preserve worker-and-phone-bound payslip content, owner-only access codes, and the absence of plaintext access codes from persisted snapshots.
- Preserve independent organization/date/type idempotency for daily and monthly briefs and a separate deadline cooldown; repeated execution cannot duplicate one type or suppress another.
- Preserve targeted tenant-safe retry, compare-and-set claiming, historical attempt fields, the three-attempt cap, and the 24-hour retry window.
- Keep deterministic failure modes behind explicit `WHATSAPP_PROVIDER=simulate`. Never enable the simulator in production and never use simulated rejection to close `WA-010`.
- Focused regression command: `npx vitest run __tests__/b16-whatsapp-provider-boundaries.test.ts`; run `node scripts/qa/b16-whatsapp-runtime-proof.mjs` only against an isolated QA project configured for simulation, and reconcile every fixture to zero before exit.
- Verify migration `20260714073000_b16_whatsapp_delivery_boundaries.sql`, delivery status/retry/brief constraints, the organization/date/type uniqueness grain, and the six active function versions before production claims.
- Canonical evidence is `output/qa/blocked-row-campaign/B16-qa-whatsapp.json` on production deployment `dpl_HSVWPpa4zPnR3gfEqXB1h3c55p4y` and implementation commit `ee2af23a31e648880bdf3810f9cacb545cefcedd`.
- Canonical counts after B16: 356 pass, 3 fail, 17 blocked, and 1 not applicable. Begin B17; do not rerun B16 unless one of these boundaries changes or a controlled live Meta proof surface becomes available.

### B17 Razorpay lifecycle regression guard — 2026-07-14

- Preserve verify-before-claim webhook handling, body-bound event identity, same-body replay success, same-ID/different-body conflict, and zero mutation on invalid HMAC.
- Preserve canonical provider convergence for `order.paid` and `payment.captured`, captured-state protection from late failure, and explicit failed-to-captured recovery.
- Preserve paid access after renewal failure and cancellation, exact 365-day anchored renewal, monotonic cancellation/expiry, and absence of any false auto-renew enablement path.
- Preserve database-first referral conversion/refund claims, one 10% provider refund with stable idempotency, and replay behavior that cannot reserve or issue another refund.
- Preserve expiry access loss for the same authenticated session while retaining account, profile, subscription, payment, and referral history.
- Focused regression command: `npx vitest run __tests__/b17-razorpay-lifecycle-boundaries.test.ts __tests__/p1-payment-invariants.test.ts`; use `node scripts/qa/b17-razorpay-runtime-proof.mjs` only with isolated Razorpay TEST credentials and disposable data. Production-boundary proof must assert the exact deployment and TEST key before mutation.
- Verify migration `20260714090000_b17_harden_razorpay_lifecycle.sql`, production history version `20260714040018`, four RPCs, both activation wrappers, six subscription columns, three indexes, and service-role-only refund claims before production lifecycle claims.
- Canonical evidence is `output/qa/blocked-row-campaign/B17-qa-razorpay.json` and `B17-production-runtime.json` on production deployment `dpl_AjR5NjfcewVpx9kS2cNXBU89v8fw` and implementation commit `57caa6e6f15f25b6e26654a1d3cfc4b431452e9b`.
- Canonical counts after B17: 364 pass, 3 fail, 9 blocked, and 1 not applicable. Begin B18; do not rerun hosted provider proof unless one of these boundaries changes, and never substitute live money for TEST mode.

### B18 recovery regression guard — 2026-07-14

- Run `node scripts/qa/b18-backup-restore-proof.mjs` only against an isolated non-production target. It must create a sanitized organization/user/production/stock/receivable/payroll backup, restore it, match canonical digests, authenticate the restored owner, and report zero cleanup.
- Recheck production backup inventory separately. `TECH-011` stays blocked whenever there is no automated retained or approved off-site production backup schedule, even if the disposable restore passes.
- For application rollback, deploy an actual app build twice to a disposable project with distinct release markers, use the provider's native rollback command to restore the marked last-known-good deployment, verify exact source identity and an HTTP 200 route, then delete the project.
- Rehearse non-reversible database recovery in a rollback-only transaction: preserve provenance, remove the legacy representation, introduce/backfill the canonical representation, assert reconciliation, roll back, and verify no temporary object remains.
- Canonical evidence is `output/qa/blocked-row-campaign/B18-qa-backup-restore.json` and `B18-recovery-runtime.json`.
- Canonical counts after B18: 365 pass, 3 fail, 8 blocked, and 1 not applicable. Begin B19; rerun B18 only if backup policy, schema recovery strategy, or deployment provider behavior changes.

### TECH-011 Free-tier backup control retest — 2026-07-14

- Static preparation paths: `.github/workflows/supabase-production-backup.yml`, `.github/workflows/supabase-production-restore-drill.yml`, `scripts/backup/create-supabase-logical-backup.sh`, `scripts/backup/restore-supabase-logical-backup.sh`, and `scripts/backup/sql/sanitized_inventory.sql`.
- Before enabling, verify only the names—not values—of `SUPABASE_PRODUCTION_DB_URL`, `SUPABASE_PRODUCTION_PROJECT_REF`, `BACKUP_AGE_RECIPIENT`, and `BACKUP_AGE_IDENTITY`. The service-role key is not a database dump credential.
- Wait for a default-branch scheduled run at `20:17 UTC`. A manual run can validate configuration but cannot alone close the schedule requirement.
- Record the exact private artifact, 14-day expiry, encrypted byte count/SHA-256, source project/commit and timestamps. Confirm no plaintext SQL or identity file appears in the artifact/log.
- Trigger the restore drill for that run/artifact. Require database start, payload hashes, documented restore order, exact migration head/extensions, Auth linkage, organization/users, estimator, orders, production, stock, receivables, payroll, tenant-boundary counts/digests, measured RTO and `--no-backup` cleanup.
- Recheck `storage.buckets`/`storage.objects` at backup time. The current read-only baseline is zero buckets/objects/bytes. Any object must stop database-only closure until object bytes are independently retained/restored/hash-verified.
- Only a real scheduled production artifact plus successful disposable restore and named verifier can promote `TECH-011`. The 2026-07-14 preparation artifact is `output/qa/remaining-gate-campaign/TECH-011-UX-012-preparation.json` and has no status effect.
- Scheduled run `29368765626` on 2026-07-14/15 is failure evidence only: all five dump commands completed, but aligned psql rendering of multiline `jsonb_pretty` output caused sanitized-inventory `jq` parsing to fail. Artifact count was zero; do not attempt restore or grant schedule credit from this run.
- Regression-test the corrected inventory capture with zero/non-zero/malformed/missing/multiple-row JSON, numeric-type enforcement, stderr isolation, unusual whitespace/Unicode and credential non-echo. Preserve one-object SQL aggregation and `psql --no-psqlrc --tuples-only --no-align --quiet --set ON_ERROR_STOP=1`.
- After merge, use one `workflow_dispatch` run only as a canary for valid inventory, zero Storage, SHA-256 completion, encryption and 14-day artifact upload. Label it supporting validation, not scheduled evidence, and do not use it for formal restore closure.
- Keep the daily `17 20 * * *` schedule unchanged. Record the next successful `event=schedule` run ID and exact artifact name; only that artifact may proceed to disposable restore, exact reconciliation, measured RTO, cleanup proof and named-verifier approval.
- 2026-07-16 result: scheduled run `29451202680` produced artifact `8357639557`; restore run `29494683840` restored it in 128 seconds with exact business/Auth/Storage/migration reconciliation, zero jobs, no production target and successful cleanup. The only compatible variance was `pg_net` `0.19.5` to `0.20.3`. Do not repeat this drill merely to manufacture evidence. After this release reaches `main`, remaining work is named independent-verifier sign-off and confirmation of the deferred second recovery-identity copy.

### UX-012 supervisor review retest — 2026-07-14

- Use `UX-012_TERMINOLOGY_INVENTORY.md`, `UX-012_RECOMMENDED_GLOSSARY.md`, and `UX-012_TERMINOLOGY_DECISION_PACK.md` from the closure-pack directory.
- Capture the required owner/supervisor/mobile/output screen contexts for every language actually used. Do not submit production forms only to make screenshots; redact identities/amounts.
- A named pilot-factory supervisor explains and decides every canonical term plus every high-risk term visible in the pilot. Record name, real role/factory, date/time/time zone, exact choice and change request.
- Implement only approved changes, update affected tests/docs/exports, deploy if user-facing behavior changes, recapture affected contexts, and obtain the same reviewer’s dated re-approval.
- 2026-07-17 result: Raj explicitly reconfirmed the deployed baseline as Founder and disposable-QA owner/supervisor screenshots were captured and cleaned. UX-012 remains `pass`; actual-user review of populated English contexts and exact Gujarati wording stays OPEN during the first pilot run. Any disagreement reopens the row.
- Keep `UX-012` blocked for blank/unclear choices, product-owner-only opinion, unsigned screenshots, unimplemented changes, or an unreviewed used locale.

### B19 external-evidence regression guard — 2026-07-14

- For `SEC-011`, use the read-only Sentry API with a local `SENTRY_AUTH_TOKEN` carrying `org:read`, `project:read`, and `event:read`. Inspect a current production event and report only redacted field-presence/results; never print the token, email/IP values, or a raw stack trace.
- For `SEC-018`, attach a dated qualified-counsel approval/redline covering DPDP, breach, grievance, retention, offline storage, and minor/child wording. QA review alone cannot promote it.
- For `UX-012`, capture a named factory supervisor's dated approve/change decision for loom, shift meters, quality/run, godown, party, challan, Upaad/Kharchi, and hisaab.
- For `GOLDEN-A-03`, compare one real fabric estimate against a business-accepted independent truth sheet containing inputs and expected yarn, weave, processing, overhead, landed-cost, and quote totals.
- For `SIGNOFF-04`, reconcile Today meters against one dated external supervisor shift register and retain both totals and any explained variance.
- Canonical evidence is `output/qa/blocked-row-campaign/B19-external-evidence-review.json`. Counts remain 365 pass, 3 fail, 8 blocked, and 1 not applicable. Rerun only the row whose named external artifact becomes available.

### Remaining-gate campaign regression guard — 2026-07-14

- Preserve `results.json.scopeModel`, `release_scope`, and `pilot_gating`; every post-pilot `not_applicable` row must retain a specific `post_pilot_backlog_id` and no PASS credit.
- Preserve disabled WhatsApp as the default for missing, empty, or invalid `WHATSAPP_PROVIDER`. Only explicit `simulate` or `meta` may enable their respective boundary; disabled mode must not issue a provider fetch.
- Preserve manual owner handoff for supervisor access-code requests while disabled. Do not generate an inaccessible code or show a delivery-success claim.
- Focused regression: `npx vitest run __tests__/pilot-whatsapp-disabled-readiness.test.ts __tests__/b16-whatsapp-provider-boundaries.test.ts __tests__/off-009-mutation-outcome.test.ts`.
- For `OFF-009`, delay exactly one shift-log server-action response beyond the 15-second client timeout. Require disabled resubmission, unknown-outcome messaging, authoritative saved-state reconciliation, exactly one matching persisted row, zero console errors/warnings, and exact fixture cleanup.
- For `OFF-010`, use a mobile viewport and constrained 2G/3G profile. Require one persisted submission, guarded repeat submission, and usable Shift Meters, Workers, Attendance, and Machines screens. Do not add an offline-queue condition not present in the row.
- Run fixture setup and cleanup against the same explicit target. The harness must reject target mismatch; reconcile `QA-OFF009-*` to zero.
- Canonical runtime evidence is `output/qa/remaining-gate-campaign/OFF-009-OFF-010-runtime.json`. Current counts are 367 pass, 0 fail, 7 blocked, and 3 not applicable.
- Reopen the verdict only for a regression or when one of `TECH-011`, `UX-012`, or `GOLDEN-A-03` receives its exact external artifact. Do not treat `OFF-001`, `SEC-011`, `SEC-018`, `SIGNOFF-04`, `WA-008`, or `WA-010` as an independent limited-pilot No-Go outside their recorded scope.
### Performance release and migration-alignment regression guard — 2026-07-15

- Before promotion, verify the exact merged commit is READY and production-targeted on Vercel and aliased to `https://textile-accounting.vercel.app`.
- Run `supabase migration list --linked` and `supabase db push --linked --dry-run`; require 212 matching local/remote versions through `20260715113013` and `Remote database is up to date`.
- Inspect `pg_class.reloptions` for `order_progress_summary`, `party_ledger_entries`, `yarn_lot_stock_summary`, `order_yarn_variance_summary`, `market_run_summary`, and `order_dispatch_summary`; require `security_invoker=true` for each. Re-run security advisors and require no `security_definer_view` error.
- With the isolated owner QA account, open Today, orders, market runs, stock, party ledger, and dispatches read-only. Confirm final content, no endless loading, and no authorization error. Tenant-negative view probes must return zero foreign-organization rows; dispatch summary order IDs must all belong to owner-visible orders.
- With the isolated supervisor account, hard reload `/supervisor/dashboard`. Require loom/assignment content plus the hidden ready marker, absence of `Loading shift data...`, and a settled save helper within the measured timeout. Do not submit production solely for this retest. Requesting `/owner/today` must redirect to `/supervisor/dashboard` without owner content.
- Repeat the supervisor dashboard check at 390×844 and confirm the fixed save area remains reachable without horizontal clipping.
- Preserve the existing six legacy stored-function lint findings as open audit work. Do not mark them fixed because the security-advisor view errors are closed.
- Regression commands: `npm run lint`, `npm test`, the production-environment Next.js build, CSV/JSON validation for campaign artifacts, secret scan, `git diff --check`, and the migration dry-run/list commands above.
- Rollback for the new migration is metadata-only: reset `security_invoker` on the six named views. Do not roll back unless production runtime demonstrates a verified incompatibility; underlying-table RLS must remain authoritative.

### Estimator physical-iPhone regression guard — 2026-07-19

- Preserve request-ID creation when `crypto.randomUUID()` is missing or throws;
  generated fallback IDs must be valid RFC 4122 version-4 UUIDs.
- At a physical-iPhone width, preserve a reachable mobile `New Quality` action,
  zero blocking horizontal overflow, and Estimator-scoped text/select font size
  of at least 16 px so focus does not trigger Safari zoom.
- Preserve `40 Ne` → `132.875 D`, `1,000 m` tape → approximately `952 m`
  capacity, and two required beams for a 1,000 m costing.
- Save and reopen must produce exactly one costing; a failed or repeated request
  must not create a duplicate.
- Focused command: `npx vitest run __tests__/client-request-id.test.ts
  __tests__/estimator-production-readiness.test.ts
  __tests__/batch10-estimator-quote-order-snapshots.test.ts`.
- Before release, also run the full suite, TypeScript, ESLint and the production
  build. Production proof must identify the exact merged commit/deployment and
  reconcile the disposable Base account and tenant to zero.

### Base Estimator go-readiness regression guard — 2026-07-22

- Run `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high`, and `npm audit --audit-level=high`; record runtime and dev-only advisories separately.
- Require linked migration list/dry-run alignment through `20260721183000`. Database lint must distinguish Base-path defects from unrelated legacy/Premium functions.
- In one exact prefixed Base tenant, configure direct overhead, calculate a representative fabric, save a reusable quality and two costing revisions, update a yarn rate, compare the revisions, and verify production cost versus commercial break-even on every surface.
- Open the Rate Book after a saved quality exists. If zero placeholders were seeded first, they must be promoted to the saved positive rates and retain tenant/Base enforcement.
- Download and render both PDF modes. Require nonblank A4 content and customer privacy. Exercise owner organization export and require all dataset queries to succeed.
- Confirm a no-plan owner is gated from Estimator/Rate Book but can still reach the owner-only data-export route. Confirm Premium retains Base access and a foreign tenant sees no rows.
- Record exact commit/deployment identity, browser console results, database reconciliation, and exact `BASEGO-*` cleanup to zero before promotion.

### Base Estimator costing-only and atomic-rate regression guard — 2026-07-22

- Run `node scripts/qa/base-estimator-atomic-rate-proof.mjs` only against the exact `BASEGO-*` production fixture. Require rollback `{rateRows: 0, historyDelta: 0}`, then one matching Rate Book value, one history row, the same factory default, one updated saved quality, and exact cleanup to zero.
- Require migration list/dry-run alignment through `20260721203000`; the RPC must remain owner-only, Base-entitled, tenant-scoped, lockdown-aware, and SECURITY DEFINER with an explicit search path.
- On a fresh Base tenant, complete both fast-overhead and costing-default steps. Verify warping, sizing, processing, finishing, commission, transport, warp crimp, and yarn waste persist in Settings and positive optional values enable their sections.
- At 1600px require ten weft inputs to occupy two rows of five. At normal mobile/tablet sizes require no clipped input, blocking horizontal overflow, or unreachable Save Costing action.
- Base must expose Save Costing and Export Cost Sheet without Party Order, Market Run, applied-production panels, or Scenario Analysis. Premium behavior must remain unchanged.
- Accept Razorpay TEST mode for pilot evidence. Do not make live-provider credentials a pilot prerequisite before incorporation; observe the first external signup and physical PDF outputs as pilot operating checks.

### Base pilot blocker candidate retest — 2026-07-24

- Before deployment run `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high`, and `git diff --check`. Runtime audit must exit zero; record full-audit dev-tool findings separately.
- Review migration `20260724161732_harden_export_audit_boundary.sql`, then prove PUBLIC, anon, and authenticated cannot execute `log_export_event`; service-role server actions can record an explicit same-org owner or admin actor; missing, foreign-org, and forged actors fail with no audit row.
- Require migration list alignment after apply. A pre-apply dry-run may list only `20260724161732`; it is not runtime proof.
- In the exact deployed Base candidate, use a fresh `BASEGO-*` owner to calculate, save/reopen/version, update a rate atomically, download both PDF modes, and download organization JSON. Require visible filename feedback for every download.
- Open both PDFs and the JSON outside the application. Require nonblank A4 internal output, no internal economics in customer output, valid JSON, expected current-organization scope, and no unredacted sensitive field.
- Verify `Start From` on the applied saved-quality action, saved-costing-history landing copy, and annual referral-credit copy at their deployed surfaces.
- Record candidate commit/deployment identity, browser console state, database audit row, filenames/hashes, and exact fixture cleanup to zero. Only then promote `fixed_pending_runtime_proof` to `pass` and issue the controlled-pilot Go.

### Base failed-checkout renewal-price production retest — 2026-07-30

1. Before release, require focused billing 17/17, the full Vitest suite,
   ESLint, TypeScript, optimized build, zero high production dependency
   vulnerabilities, and `git diff --check`.
2. Review and apply only
   `20260730214000_reject_unearned_billing_renewal_pricing.sql`; require
   local/remote migration alignment afterward.
3. Deploy the exact pushed main commit and verify the canonical production
   alias resolves to a READY deployment for that commit.
4. Log into retained account
   `basepilotretest.20260730.2027.68w7@weavly.test`. Its prior failed payment
   must remain failed, access must remain inactive, and Base must show ₹8,260
   first-year activation—not ₹2,360 renewal.
5. Complete Razorpay TEST Netbanking through the mock-bank Success window. UPI
   remains outside this pilot activation path.
6. Reconcile exactly one captured ₹8,260 payment and exactly one active Base
   entitlement for the fresh organization; direct Estimator access must become
   available only after capture.
7. Keep `BILL-003` blocked if the provider popup cannot be completed. Promote
   `BILL-006` and `BILL-003` to pass only with the exact deployed browser and
   database evidence.

#### Result

- Steps 1–4 passed for commit `ed6e32a`, migration `20260730214000`, and READY
  deployment `dpl_7aJizgchjx96eLG8pQzvCxGw1UhL`.
- Step 5 remained blocked because the automation harness could not expose
  Razorpay's mock-bank Success/Failure window after Netbanking selection.
- The safe negative invariant passed: the prior failed ₹8,260 payment remains
  failed, the replacement checkout is only `created`, no payment is captured,
  and no active entitlement exists.
- Disposition: `BILL-006=pass`; `BILL-003=blocked`. Rerun only the successful
  provider-popup and post-capture reconciliation portion when a compatible
  browser session is available.
