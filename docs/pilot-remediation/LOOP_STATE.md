# Pilot Remediation Loop State

Run under control: `PILOTQA-20260621-2058-8QIH`

Source-of-truth artifacts:

- `output/qa/PILOTQA-20260621-2058-8QIH/FINAL_REPORT.md`
- `output/qa/PILOTQA-20260621-2058-8QIH/FAILURE_DATA_IMPACT_REPORT.md`
- `output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md`
- `output/qa/PILOTQA-20260621-2058-8QIH/results.json`
- Referenced evidence logs under `output/qa/PILOTQA-20260621-2058-8QIH/logs/`

## Current Verdict

Status: No-Go for pilot.

Current classification after Batch 1 security foundation closeout, Batch 2 documentation closeout, the estimator costing reconciliation closeout, Batch 3 dispatch sale receipt closeout, Batch 4 commercials receivables closeout, Batch 5 stock audit refresh closeout, Batch 6 Golden A runtime closeout, Batch 7 partial release/date closeout, Batch 8 migration-head evidence closeout, and Batch 8B Sentry release/source-map evidence closeout:

| Status | Count | Pilot meaning |
| --- | ---: | --- |
| `pass` | 167 | Runtime/test evidence exists. |
| `fail` | 56 | Must be fixed, de-scoped, or explicitly accepted only where non-pilot scope. |
| `blocked` | 22 | Not pilot-ready until evidence is captured or the feature is removed from pilot scope. |
| `code_verified` | 131 | Source evidence only. This is not a pass. |
| `not_applicable` | 1 | Excluded by scope. |
| `not_run` | 0 | Matrix was fully classified. |

Critical failures: 0. High failures: 19. Critical blocked golden-journey follow-ons: 6.

Batch 1 security foundation moved `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`, `SEC-006`, and `AUTH-016` from fail to pass with runtime/test/migration evidence. `AUTH-008`, `PAY-018`, `PAY-020`, external webhook/export/compliance security rows, release gates, and unrelated unresolved failures remain open.

Batch 2 moved `PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, and `SIGNOFF-05` from fail to pass with runtime/test evidence. Downstream Golden A rows that were not rerun end-to-end remain blocked until a clean order chain is retested or explicitly de-scoped.

Estimator costing reconciliation is complete for the scoped formula/manual/manual-practical sprint with test and browser evidence. The active matrix counts above were unchanged by that sprint because the broader `ECON-A` rows still include server-boundary validation, idempotency, quote/order lifecycle, and date snapshot work outside that scope.

Batch 3 moved `SALE-015`, `DISP-003`, `DISP-007`, `DISP-010`, `DISP-019`, `GOLDEN-B-09`, `DASH-007`, `SIGNOFF-07`, and `SIGNOFF-08` from fail to pass with runtime/test/migration evidence. `SIGNOFF-10` remains open; Batch 3 supplies partial dispatch/package/receipt runtime evidence only, not release/Sentry/source-map proof.

Batch 4 moved `COMM-002`, `COMM-010`, `COMM-012`, `COMM-014`, `COMM-016`, `SIGNOFF-06`, and `SIGNOFF-09` from fail to pass with runtime/test/migration/browser evidence. `SIGNOFF-10`, `STOCK-017`, `STOCK-016`, `GOLDEN-A-19`, `GOLDEN-A-20`, `TIME-002`, and `OFF-009` remained open or partial evidence only at Batch 4 closeout.

Batch 5 moved `STOCK-016` and `STOCK-017` from fail to pass with runtime/test evidence for stock movement audit pagination beyond 500 rows and sale-only stock refresh/second-session reconciliation. `GOLDEN-A-19`, `GOLDEN-A-20`, `SIGNOFF-10`, `TIME-002`, and `OFF-009` remained open or partial evidence only at Batch 5 closeout.

Batch 6 moved `GOLDEN-A-13`, `GOLDEN-A-15`, `GOLDEN-A-16`, `GOLDEN-A-17`, `GOLDEN-A-18`, `GOLDEN-A-19`, `GOLDEN-A-20`, and `GOLDEN-A-24` from blocked to pass with runtime/test/migration evidence for the Golden A customer-order chain. `GOLDEN-A-21`, `GOLDEN-A-22`, `GOLDEN-A-23`, `SIGNOFF-10`, `TIME-002`, `OFF-009`, `SIGNOFF-01`, `SIGNOFF-02`, `SIGNOFF-04`, `TECH-011`, and `TECH-012` remain open or partial evidence only.

Batch 7 moved `TIME-002` and `TECH-013` from fail to pass with focused timezone-stability tests, source-controlled release gate evidence, a successful prebuild Vitest/build run, full Vitest evidence, and local production smoke. At Batch 7 closeout, `SIGNOFF-10`, `TECH-007`, `TECH-009`, `TECH-010`, `TECH-011`, `TECH-012`, and `SEC-011` were blocked or partial evidence only because external deployed, Sentry/source-map, restore, rollback, and production migration proof was unavailable.

Batch 8 moved `TECH-007` from fail to pass with supplied Supabase migration-list evidence showing local/remote alignment through repository migration head `20260628185344` and no pending, failed, or out-of-order migrations. Batch 8B moved `TECH-010` from fail to pass with fresh production Sentry release/source-map proof for deployed release `2538da25b2fa` and 529 artifacts. `TECH-009`, `TECH-011`, `TECH-012`, `SEC-011`, `SIGNOFF-10`, and `WA-008` remain blocked, partial, or open because deployed webhook proof, live Sentry payload inspection, restore, rollback/forward-fix, and clean deployed signoff evidence are still unavailable.

## Operating Rules

1. `FINAL_REPORT.md` and `FAILURE_DATA_IMPACT_REPORT.md` decide priority.
2. `code_verified` is unresolved evidence debt until promoted by runtime or test evidence.
3. No item can move to resolved without a regression test, a runtime QA artifact, or a written reason that runtime QA is the only valid proof.
4. Work is grouped by root-cause cluster, not page.
5. Fix order is security, production/stock correctness, dispatch/receipt correctness, payroll/kharchi, idempotency/offline, then release gates.
6. Each cluster starts with the domain invariant, then code or migration design.
7. Production data changes are forbidden except rollback-only probes, isolated QA tenants, or disposable environments.
8. Anything not ready for pilot must be hidden, disabled, de-scoped, or documented as unsupported before pilot.

## Remediation Loop

Each loop batch must follow this sequence:

1. Select a root-cause cluster from `FAILURE_BACKLOG.md`.
2. Copy the relevant invariant from `DOMAIN_INVARIANTS.md` into the implementation ticket.
3. Define the smallest code/migration change that enforces the invariant.
4. Add or update regression tests. If automated coverage is impossible, document the required runtime QA path before implementation starts.
5. Run local commands in `RETEST_PLAN.md`.
6. Execute runtime QA only in the QA tenant or disposable environment.
7. Save evidence under the next QA output folder and reference it in `FIX_LOG.md`.
8. Mark rows resolved only after evidence exists and the matrix rows can be promoted to `pass`, `not_applicable`, or explicitly `unsupported`.

## First Loop Batch

Batch: `BATCH-01A-MUTABLE-PROFILE-AUTHZ`

Root cause: profile authorization fields are mutable by authenticated users, and server authorization/claims depend on those mutable fields.

Priority source:

- `FINAL_REPORT.md`: `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005` are critical failures and security is recommended first.
- `FAILURE_DATA_IMPACT_REPORT.md`: authorization boundary is practical fix priority 1 because it can corrupt all domains.
- `logs/security-review.json`: rolled-back production evidence proved supervisor self-update to owner and custom claim minting.

Failure IDs in batch:

- Critical: `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`
- Deferred from Batch 1A: `SEC-006` and `AUTH-016` were closed later in Batch 1B; `AUTH-012`, `AUTH-013`, and `SEC-013` remain outside Batch 1 security foundation closeout.

Batch 1A objective:

Authenticated users must not be able to mutate role, organization, or any other field used for authorization. Server authorization must remain correct after direct API attempts, token refresh, browser refresh, and owner/supervisor route checks.

Out of scope for Batch 1A:

- `SEC-006` and `AUTH-016`, which were deferred from Batch 1A and closed later in Batch 1B.
- Production correction/stock atomicity.
- Dispatch package numbering and receipt-state repair.
- Payroll legacy RPC removal.
- Offline kharchi and cache clearing.
- Release-gate repair, npm audit, Sentry, and migration-drift repair, except normal verification commands that prove Batch 1A did not regress the app.

## Batch 1A Acceptance Criteria

Batch 1A is accepted only when all of the following are true:

1. `authenticated` has no direct column privilege allowing update of `public.profiles.role`, `public.profiles.org_id`, or equivalent authorization fields.
2. `public.profiles` RLS update policy prevents role/org mutation even if a caller can update allowed personal profile fields.
3. A QA supervisor cannot change self role/org through Supabase client, PostgREST, server action, or RPC path.
4. After a failed self-mutation attempt and token refresh, the supervisor still receives supervisor claims and owner-only server actions remain denied.
5. Owner login, supervisor login, onboarding redirects, and route guards still work.
6. Evidence includes regression test output, SQL metadata output, and browser/runtime QA notes. Source review alone is insufficient.

## Current Batch State

Batch 1A (`SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`) is closed with evidence in `FIX_LOG.md` and active matrix rows promoted to pass.

Evidence captured:

- Pre-fix QA reproduction proved supervisor self-mutation of `profiles.role` and `profiles.org_id`, token refresh claim escalation, and owner route/server-loader access.
- Supabase migration `20260625195248_harden_profile_authorization_boundary.sql` was applied to project `vzhwahudircrpgtitwzd`.
- Post-fix SQL metadata shows `authenticated` cannot update `profiles.id`, `profiles.role`, or `profiles.org_id`.
- Post-fix QA probe shows direct role/org mutations denied, role/org unchanged, token refresh remains supervisor, owner-only RPC denied, and owner login/claims still work.
- Post-fix browser QA shows supervisor is redirected from `/owner/today` to `/supervisor/dashboard`, owner-only API returns 403 for supervisor, and real owner can load `/owner/today`.

Resolution status:

- `SEC-002`, `SEC-003`, `SEC-004`, and `SEC-005` are documented as pass in the active matrix.
- `code_verified` is still not treated as pass.
- `SEC-006` and `AUTH-016` are closed separately by Batch 1B.
- No production/stock, dispatch, payroll, estimator, offline, npm audit, Sentry, release-gate, or migration-drift work was included in Batch 1A.

## Batch 1B-A State

Batch 1B-A targets `SEC-006` only. `AUTH-016` was out of scope for this sub-batch and closed later in Batch 1B-B.

Invariant:

Access-code protected actions must fail closed. Every protected action must use the same server-side validation path, count failed attempts, enforce a real 5 attempts per 10 minutes limit, reject expired or malformed codes, consume a valid code exactly once, and avoid recoverable plaintext access-code storage after the generation response.

Implemented locally:

- Centralized generation/validation/consume in `lib/access-codes.ts`.
- Changed access-code limiter to 5 attempts per 10 minutes.
- Made access-code limiter/lockout/failure recording fail closed when Redis is missing or errors.
- Routed owner order updates, owner worker delete-with-code, owner validate/rotate, owner generation, and supervisor request flows through central helpers.
- Removed owner layout recovery/display of `organizations.last_code_plain`.
- Added non-destructive migration `20260625215612_harden_access_code_fail_closed.sql` to prevent future non-null plaintext writes.
- Added `__tests__/p0-access-code-boundary.test.ts` and `scripts/qa/batch1b-access-code-probe.mjs`.

Evidence captured:

- Focused test: `npx vitest run __tests__/p0-access-code-boundary.test.ts` -> passed, 8 tests.
- Broader relevant auth/security test: `npx vitest run __tests__/p0-authz-boundary.test.ts __tests__/p0-access-code-boundary.test.ts` -> passed, 13 tests.
- Lint for touched Batch 1B-A proof files -> passed.
- `npx tsc --noEmit` -> passed.
- `git diff --check` -> passed.
- Migration safety check classified `20260625215612_harden_access_code_fail_closed.sql` as safe forward-looking hardening: trigger/function/grants/comment only, with no delete, truncate, mass update, plaintext cleanup, table/column drop, or existing production data mutation.
- `npx supabase db push --dry-run` showed only `20260625215612_harden_access_code_fail_closed.sql` pending.
- `npx supabase db push` applied only `20260625215612_harden_access_code_fail_closed.sql` to project `vzhwahudircrpgtitwzd`.
- `npx supabase migration list` now shows local and remote aligned for Batch 1A `20260625195248` and Batch 1B-A `20260625215612`.
- Runtime probe passed owner/supervisor login, missing Redis fail-closed, 5/10 limiter block, invalid-attempt lockout, valid one-time consume, reuse failure, expired failure, wrong-code failure, and plaintext storage trigger rejection using a disposable org.

Data safety:

- No production data cleanup was performed.
- Existing `organizations.last_code_plain` values were not cleared or backfilled.
- Runtime mutation checks used a disposable organization.

Resolution status:

- `SEC-006` is documented as pass in the active matrix.
- `AUTH-016` is closed separately by Batch 1B-B.
- Production/stock, dispatch, payroll business correctness, estimator, offline, release gates, Sentry, npm audit, and lockfile work remain open/out of scope.

## Batch 1B-B State

Batch 1B-B targets `AUTH-016` only. `SEC-006` is not modified further and remains pass-ready from Batch 1B-A.

Invariant:

Locked organizations must fail closed for protected pilot business writes across UI/server actions, direct Supabase table access, RLS, and SECURITY DEFINER RPCs. Enforcement should be layered through centralized server-action guards, RLS predicates, and explicit RPC guards. Trigger enforcement is not the primary mechanism and was not added.

Implemented locally:

- Added centralized locked-organization write guard helpers in `lib/auth.ts`.
- Added server-action lockdown guard coverage for service-role write paths in `app/(dashboard)/supervisor/actions.ts`.
- Added a targeted owner service-role write guard in `app/(dashboard)/owner/actions.ts`.
- Added migration `20260626051352_harden_locked_tenant_writes.sql` for RLS write predicates and explicit RPC lockdown guards on protected business write functions.
- Added static regression tests in `__tests__/p0-locked-tenant-boundary.test.ts`.
- Added runtime probe scaffold `scripts/qa/batch1b-locked-tenant-probe.mjs` for disposable locked/unlocked organization proof after the migration can be applied with approval.

Evidence captured:

- Human operator manually applied `20260626051352_harden_locked_tenant_writes.sql` with `npx supabase db push`. This proof pass did not rerun `npx supabase db push`, migration repair, `db pull`, direct SQL, or `--include-all`.
- `npx supabase migration list` -> local and remote both include `20260626051352`.
- Runtime probe: `node scripts/qa/batch1b-locked-tenant-probe.mjs` -> passed.
- Runtime probe assertions passed: locked owner and supervisor login still work; unlocked owner and supervisor login still work; locked direct writes to `workers`, `fabric_stock_lots`, and `worker_advances` are denied; locked mutating `replace_shift_production_logs` RPC is denied; unlocked representative writes and the unlocked empty-batch RPC still work.
- Focused test: `npx vitest run __tests__/p0-locked-tenant-boundary.test.ts` -> passed, 5 tests.
- Broader relevant security test: `npx vitest run __tests__/p0-authz-boundary.test.ts __tests__/p0-access-code-boundary.test.ts __tests__/p0-locked-tenant-boundary.test.ts` -> passed, 18 tests.
- `npx tsc --noEmit` -> passed.
- Lint for touched Batch 1B-B files -> passed.
- `git diff --check` -> passed.

Data safety:

- No production data cleanup was performed.
- The runtime probe used disposable locked and unlocked organizations and cleaned them up.
- No production/stock, dispatch, payroll business-correctness, estimator, offline, release-gate, Sentry, npm audit, or lockfile work was included.

Resolution status:

- `AUTH-016` is documented as pass in the active matrix.
- Production/stock, dispatch, payroll business correctness, estimator, offline, release gates, Sentry, npm audit, and lockfile work remain open/out of scope.

## Security Foundation Closed

Date/time: 2026-06-26 11:27 IST.

Human decision: security foundation approved. Pass/pass-ready failures documented as pass in the active matrix:

- `SEC-002`
- `SEC-003`
- `SEC-004`
- `SEC-005`
- `SEC-006`
- `AUTH-016`

Committed and pushed security batches:

- Batch 1A authorization boundary: `76a25a3` plus evidence/migration-history closure commits `ff1ddb0` and `704cb54`.
- Batch 1B-A access-code boundary: `77a0382`.
- Batch 1B-B locked-tenant boundary: `e2e0cf1`.
- Security foundation documentation closure: `d98f2f2`.

Supabase migration history:

- `20260625195248_harden_profile_authorization_boundary.sql` aligned locally and remotely.
- `20260625215612_harden_access_code_fail_closed.sql` aligned locally and remotely.
- `20260626051352_harden_locked_tenant_writes.sql` aligned locally and remotely.
- `20260626064830_production_stock_atomicity.sql` aligned locally and remotely after human-approved manual application.

Batch 2 closed on main:

- Batch 2: production correction plus generated stock atomicity.
- Target failures: `PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, `SIGNOFF-05`.
- Repository state: implementation commit `f34b89c8f1f16bd87474737c69941565665f17d0` was fast-forwarded into `main`, and `origin/main` pointed to that commit before this documentation closeout.
- Invariant: production corrections must be transactionally safe; production logs and generated stock must reconcile exactly once; correcting production to downtime must not leave stale saleable stock; if stock has already been sold or dispatched, the correction must be blocked or routed through an explicit owner-authorized adjustment flow.
- Local implementation: migration `20260626064830_production_stock_atomicity.sql`, new internal generated-stock reconciler, updated `replace_shift_production_logs(...)`, safe wrapper for `create_or_refresh_stock_inward_draft(...)`, and removal of app-level post-replacement stock refresh.
- Read-model repair: `getFactoryToday()` now reads `order_progress_summary.total_meters_produced`, matching the deployed view contract. No new migration was needed.
- Migration status: `20260626064830` is aligned locally and remotely after human-approved manual application.
- Runtime QA status: fresh disposable QA tenant proof passed on 2026-06-27. Evidence: 256.00m initial production; correction of stale 25.25m night production to downtime left 230.75m production logs and 230.75m generated stock; no stale 25.25m saleable lot remained; reversal movement was recorded exactly once; retry did not duplicate stock or movements; sale over corrected-away stock was blocked; reduction below sold quantity was blocked and rolled back; dispatch/receipt history blocked automatic correction; Factory Today, stock summary, and signoff expected stock read 230.75m after refresh/second session.
- Local verification passed: targeted Batch 2 Vitest passed 8 tests; broader production/stock pack passed 92 tests; full Vitest passed 287 tests with 1 skipped; `npx tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
- Resolution status: `PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, and `SIGNOFF-05` are pass-ready with runtime/test evidence and are documented as pass in the active QA matrix.

Estimator costing closeout:

- Date/time: 2026-06-28 00:54 IST.
- Scope closed: manual kg/100m override, formula mode, formula-equivalent manual parity, mixed formula/manual semantics, width unit hardening, waste/crimp semantics, Cost Breakdown audit, and quote save/reopen audit preservation.
- Practical manual regression passed at `₹55.91/m` with `₹21.50/m` other cost and `₹56.16/m` with `₹21.75/m` other cost.
- Formula real factory specs passed at `₹55.75/m`.
- Formula-equivalent manual mode matched formula mode with `₹0.00/m` difference.
- Width warning for `62 cm` was observed in the UI; switching to `62 inch` restored expected costing.
- Saved quote restore preserved rows, costing, and audit at `₹56.16/m`.
- Local verification passed: targeted estimator/width Vitest passed 31 tests; full Vitest passed 298 tests with 1 skipped; `npx tsc --noEmit`, `npm run build`, and scoped estimator ESLint passed.
- Repo-wide `npm run lint` remains blocked only by existing unrelated `scratch/*.js` CommonJS `require()` lint errors.
- Active QA matrix rows are not promoted by this closeout because the relevant `ECON-A` rows are broader than estimator costing and still require separate proof.

Still out of scope until explicitly started:

- Remaining Golden A payroll follow-ons `GOLDEN-A-21`, `GOLDEN-A-22`, and `GOLDEN-A-23`.
- Payroll business correctness.
- Remaining `ECON-A` work outside estimator costing: server-boundary estimate validation, estimator save/market-run idempotency, quote/order lifecycle, target/deadline guards, and below-target completion. Batch 7 closes the broader date-only rendering row separately.
- Offline behavior.
- Release gates.
- Sentry.
- npm audit.
- Lockfile work.

## Batch 3 Closed on Main

Date/time: 2026-06-28 13:34 IST.

Batch 3: dispatch sale receipt correctness.

Target failures:

- `SALE-015`
- `DISP-003`
- `DISP-007`
- `DISP-010`
- `DISP-019`
- `GOLDEN-B-09`
- `DASH-007`
- `SIGNOFF-07`
- `SIGNOFF-08`

Repository state:

- Implementation commit `9661f3fcace44b1b44c71002e6d0554a58de8ab6` was fast-forwarded into `main`.
- `origin/main` pointed to `9661f3fcace44b1b44c71002e6d0554a58de8ab6` before this documentation closeout.

Migrations applied and aligned before docs closeout:

- `20260627195152_batch_3_dispatch_sale_receipt_correctness.sql`
- `20260628071340_batch_3_dispatch_tracking_token_contract_fix.sql`
- `20260628073917_batch_3_dispatch_number_returning_contract_fix.sql`

Runtime proof:

- Disposable QA run `BATCH3-fc791041` passed with `production_mode=both`.
- Duplicate 80m sale submit produced exactly one sale, one receivable where applicable, and one stock movement.
- 50m dispatch left 30m pending; second 30m dispatch used a distinct deterministic package identity and left 0m pending.
- Exact receipt closed with synchronized receipt fields and no discrepancy.
- Shortage and excess receipts each created exactly one actionable discrepancy.
- Duplicate receipt submit did not duplicate discrepancy or receipt state.
- Negative and zero receipts were blocked consistently.
- Archive helper protected unresolved obligations and allowed clean reconciled groups.
- Dispatches, Factory Today, stock, Commercials, signoff, and second-session refresh reconciled.
- No runtime path read or wrote `dispatches.tracking_token`.
- No ambiguous `dispatch_number` runtime error remained.

Verification:

- `npx vitest run __tests__/p2-dispatch-sale-receipt.test.ts` -> 7 passed.
- `npx vitest run __tests__/p1-party-first-stock-sale-dispatch.test.ts __tests__/dispatch-archive.test.ts __tests__/p1-production-dispatch-regressions.test.ts` -> 27 passed.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint -> passed.
- `git diff --check` -> passed.
- `npx vitest run` -> 34 files, 306 passed, 1 skipped.

Resolution status:

- `SALE-015`, `DISP-003`, `DISP-007`, `DISP-010`, `DISP-019`, `GOLDEN-B-09`, `DASH-007`, `SIGNOFF-07`, and `SIGNOFF-08` are documented as pass in the active matrix.
- `SIGNOFF-10` remains partial evidence only and is not closed.

## Batch 4 Closed on Main

Date/time: 2026-06-28 18:39 IST.

Batch 4: commercials receivables payments correctness.

Target failures:

- `COMM-002`
- `COMM-010`
- `COMM-012`
- `COMM-014`
- `COMM-016`
- `SIGNOFF-06`
- `SIGNOFF-09`

Repository state:

- Implementation commit `d2a464c6f9c3caa470d1fa3bf530333faa2e0d4c` was fast-forwarded into `main` and pushed to `origin/main`.
- `origin/main` pointed to `d2a464c6f9c3caa470d1fa3bf530333faa2e0d4c` before this documentation closeout.

Migration applied and aligned before docs closeout:

- `20260628121903_batch_4_commercials_receivables_payments.sql`

Runtime proof:

- Disposable QA run `BATCH4QA-20260628125203` passed.
- Duplicate stock-sale submit produced one sale and one receivable for the sale idempotency key.
- Payment partial/full/duplicate/overpayment probes reconciled exactly: Rs. 1,200 partial cheque, Rs. 3,800 full bank, two receipts total, paid balance Rs. 0, overpayment blocked.
- Cheque metadata and reference history rendered in Commercials payment history.
- Direct market-run sale RPC was disabled.
- Due today, overdue, future, and paid buckets reconciled to Asia/Kolkata date `2026-06-28`.
- Profit ledger rows used authoritative stock source fields and Manual Stock filter totals reconciled.
- Top Parties showed last sale and overdue values; period source proof distinguished 30d from all-time.
- Factory Today showed unresolved commercial receivables as blockers.
- Commercials reload and second-tab session preserved totals and had no console errors.

Verification:

- Focused Batch 4 Vitest: 32 passed.
- Batch 2/3 guard Vitest: 37 passed.
- Full Vitest: 35 files, 313 passed, 1 skipped.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for touched Batch 4 files -> passed.
- `git diff --check` -> passed.

Resolution status:

- `COMM-002`, `COMM-010`, `COMM-012`, `COMM-014`, `COMM-016`, `SIGNOFF-06`, and `SIGNOFF-09` are documented as pass in the active matrix.
- `STOCK-017`, `STOCK-016`, `GOLDEN-A-19`, and `GOLDEN-A-20` remained partial evidence only or open at Batch 4 closeout and were closed by later batches. `SIGNOFF-10`, `TIME-002`, and `OFF-009` remain open and were not closed by Batch 4.

## Batch 5 Closed on Main

Date/time: 2026-06-28 23:07 IST.

Batch 5: stock audit pagination and sale-only stock refresh.

Target failures:

- `STOCK-016`
- `STOCK-017`

Repository state:

- Implementation commit `46ad361fa03d3fb9d561c639e5e3ed6424cb8e03` was fast-forwarded into `main` and pushed to `origin/main`.
- `origin/main` pointed to `46ad361fa03d3fb9d561c639e5e3ed6424cb8e03` before this documentation closeout.

Migration status:

- No migration was required.
- No Supabase db push, repair, db pull, direct SQL, or `--include-all` command was run.

Runtime proof:

- Disposable QA proof `output/qa/batch5/BATCH5-20260628173243-stock-audit-refresh.json` passed.
- 506 stock movement rows were retrieved through cursor pagination as pages of 100, 100, 100, 100, 100, and 6.
- Pagination had no duplicate/missing rows and preserved deterministic newest-to-oldest order.
- Sale-only no-dispatch stock sale refreshed committed state to 75m available and 25m pending dispatch.
- The sale created one stock sale movement and one receivable.
- A second owner session matched the committed stock state.
- Cleanup completed with no cleanup errors.

Verification:

- Focused Batch 5 Vitest: 4 passed.
- Batch 2/3/4 guard regression pack: 85 passed.
- Full Vitest: 36 files, 317 passed, 1 skipped.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for touched Batch 5 files -> passed.
- `git diff --check` -> passed.
- After fast-forwarding `main`, focused Batch 5 Vitest, `npx tsc --noEmit`, and full Vitest passed again.

Resolution status:

- `STOCK-016` and `STOCK-017` are documented as pass in the active matrix.
- `GOLDEN-A-19` and `GOLDEN-A-20` remained partial evidence only or open at Batch 5 closeout and were closed later by Batch 6. `SIGNOFF-10`, `TIME-002`, and `OFF-009` remain open and are not closed by Batch 5.

## Batch 6 Closed on Main

Date/time: 2026-06-29 00:36 IST.

Batch 6: Golden A runtime closure.

Target failures:

- `GOLDEN-A-13`
- `GOLDEN-A-15`
- `GOLDEN-A-16`
- `GOLDEN-A-17`
- `GOLDEN-A-18`
- `GOLDEN-A-19`
- `GOLDEN-A-20`
- `GOLDEN-A-24`

Repository state:

- Implementation commit `80e8f8c6ae1318207b0c5b1f45e98c3cfe524f67` was fast-forwarded into `main` and pushed to `origin/main`.
- `origin/main` pointed to `80e8f8c6ae1318207b0c5b1f45e98c3cfe524f67` before this documentation closeout.

Migrations applied and aligned before docs closeout:

- `20260628183500_batch_6_allow_completed_order_stock_dispatch.sql`
- `20260628185344_batch_6_qualify_completed_order_dispatch_returning.sql`

Runtime proof:

- Disposable QA proof `output/qa/batch6/BATCH6-20260628185811-golden-a-runtime-proof.json` passed with 26 assertions and cleanup completed.
- Production was corrected from 230.75m to 235.75m and generated order-linked stock reconciled exactly.
- The customer order auto-completed at target and valid completed-order dispatch was allowed for order-linked sold stock.
- 120m was sold on credit for Rs. 7,200.
- 70m dispatch exact receipt closed with no discrepancy.
- 50m dispatch received as 45m created one 5m shortage discrepancy and one open party claim.
- Rs. 2,200 partial payment plus Rs. 5,000 final payment closed the receivable to zero with two receipt records.
- Second-session state matched committed receivable/payment state.
- Factory Today source reconciliation showed no pending dispatch, no in-transit receipt, no receivable balance, and one deliberate unresolved shortage discrepancy.
- Completed order archive/unlink behavior succeeded.

Verification:

- Focused Batch 6 Vitest: 1 passed.
- Batch 2/3/4/5 guard regression pack: 86 passed.
- Full Vitest: 37 files, 318 passed, 1 skipped.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for Batch 6 touched files -> passed before implementation commit.
- `git diff --check` and `git diff --cached --check` -> passed.

Resolution status:

- `GOLDEN-A-13`, `GOLDEN-A-15`, `GOLDEN-A-16`, `GOLDEN-A-17`, `GOLDEN-A-18`, `GOLDEN-A-19`, `GOLDEN-A-20`, and `GOLDEN-A-24` are documented as pass in the active matrix.
- `GOLDEN-A-21`, `GOLDEN-A-22`, `GOLDEN-A-23`, `SIGNOFF-10`, `TIME-002`, `OFF-009`, `SIGNOFF-01`, `SIGNOFF-02`, `SIGNOFF-04`, `TECH-011`, and `TECH-012` remain partial evidence only or open and are not closed by Batch 6.

## Batch 7 Closed on Main

Date/time: 2026-06-29 14:42 IST.

Batch 7: partial release/runtime/date hardening.

Target failures:

- `TIME-002`
- `TECH-013`

Repository state:

- Implementation commit `ff44f46643400c93fea79f361b1911f992be3d5c` was fast-forwarded into `main` and pushed to `origin/main`.
- `origin/main` pointed to `ff44f46643400c93fea79f361b1911f992be3d5c` before this documentation closeout.

Migrations:

- No migration was needed.

Evidence:

- Date-only rendering now uses date-only helpers instead of timezone-shifting `new Date(dateOnly)` parsing across the affected inventory, order, dispatch, archive, market-run, Factory Today, analytics, and payslip display paths.
- Focused date-only tests prove the same date-only value renders unchanged under UTC, Asia/Kolkata, and America/Los_Angeles.
- `package.json` defines `test: vitest run` and `prebuild: npm run test`, so the source-controlled build path cannot accidentally omit Vitest.
- `npm run build` passed and proved the prebuild test gate runs before build.
- Local production smoke on port 3107 returned 200 for `/login`, `/privacy`, and `/manifest.webmanifest`, with no server errors observed.
- Evidence artifacts were committed under `output/qa/batch7/`.

Verification:

- Focused Batch 7 Vitest: 9 passed.
- Full Vitest: 327 passed, 1 skipped.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for Batch 7 touched files -> passed.
- `git diff --check` and `git diff --cached --check` -> passed.
- `npm run build` -> passed with the prebuild Vitest gate.

Resolution status:

- `TIME-002` and `TECH-013` are documented as pass in the active matrix.
- At Batch 7 closeout, `SIGNOFF-10`, `TECH-007`, `TECH-009`, `TECH-010`, `TECH-011`, `TECH-012`, and `SEC-011` were blocked or partial evidence only because external deployed, Sentry/source-map, restore, rollback, and production migration proof was unavailable.
- `OFF-009`, `SIGNOFF-01`, `SIGNOFF-02`, `SIGNOFF-04`, `GOLDEN-A-21`, `GOLDEN-A-22`, and `GOLDEN-A-23` remain open and out of scope for Batch 7.

## Batch 8 Closed on Main

Date/time: 2026-06-29 20:12 IST.

Batch 8: partial release observability and migration-head closeout.

Target failure:

- `TECH-007`

Repository state:

- `origin/main` had advanced to `fb3d4dd98db398aa8aa33f5b6196fa29e536e5b1` for estimator spacing/layout before reconciliation.
- Batch 8 was reconciled on top of latest `origin/main` without force-push.
- Reconciled implementation commit `c169a8ccbb3b544d04aa576e0b03877282d49f35` was fast-forwarded into `main` and pushed to `origin/main`.

Migrations:

- No migration was needed.
- Supabase migration-list evidence showed local and remote aligned through latest repository migration `20260628185344`, with no pending, failed, or out-of-order migrations.
- No Supabase command, db push, migration repair, db pull, direct SQL, or `--include-all` command was run.

Evidence:

- Batch 8 fixed local Sentry tunnel ownership/config consistency: `withSentryConfig` owns `/monitoring`; conflicting manual `/api/sentry-tunnel` was removed.
- Batch 8 added narrow CSP `worker-src 'self' blob:;` for the deployed browser smoke CSP worker failure.
- Batch 8 added explicit Sentry auth-token, release, deploy environment, and source-map upload configuration from environment.
- Batch 8 added release/runtime config tests covering Sentry tunnel ownership, CSP, auth/release config, redaction, and webhook fail-closed checks.
- Evidence artifact was committed at `output/qa/batch8/BATCH8-20260629103146-release-observability-evidence.json`.
- Deployed pre-patch smoke showed `/monitoring?...` 403 and CSP `worker-src blob:` errors, so `SIGNOFF-10` remains blocked/partial until post-patch deploy proof is clean.
- Vercel build logs showed no `SENTRY_AUTH_TOKEN`; at Batch 8 closeout, Sentry release/source maps were not created/uploaded and `TECH-010` was still blocked pending fresh deployment evidence.
- Sentry was stale/unverified with no current release/source-map/event payload, so `SEC-011` remains blocked.
- No restore exercise exists for `TECH-011`.
- No rollback/forward-fix exercise exists for `TECH-012`.
- No deployed WhatsApp valid/invalid proof exists, so `TECH-009` remains partial and `WA-008` remains open.

Verification:

- Focused Batch 8 Vitest: 7 passed.
- Full Vitest: 39 files, 331 passed, 1 skipped.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for Batch 8 touched files -> passed.
- `npm run build` -> passed with the prebuild Vitest gate.
- `git diff --check` and `git diff --cached --check` -> passed.

Resolution status:

- `TECH-007` is documented as pass in the active matrix.
- At Batch 8 closeout, `TECH-009`, `TECH-010`, `TECH-011`, `TECH-012`, `SEC-011`, and `SIGNOFF-10` were blocked or partial evidence only. `TECH-010` is superseded by Batch 8B evidence below.
- `WA-008` remains open.
- Batch 8B must start from latest `origin/main` and capture fresh deployment plus external provider proof.

## Batch 8B Closed on Main

Date/time: 2026-06-29 21:32 IST.

Batch 8B: partial release observability closeout for Sentry release/source-map evidence.

Target failure:

- `TECH-010`

Repository state:

- Batch 8B implementation commit `d4392808690ca47f7f10f9950c82d02d94621e30` was fast-forwarded into `main` and pushed to `origin/main`.

Migrations:

- No migration was needed.
- No Supabase command, db push, migration repair, db pull, direct SQL, or `--include-all` command was run.

Evidence:

- Evidence artifact was committed at `output/qa/batch8b/BATCH8B-20260629153402-release-evidence-monitoring.json`.
- Fresh production deployment after adding `SENTRY_AUTH_TOKEN` completed successfully; Vercel build completed in 3m 38s with no observed build errors.
- Old Sentry missing-auth-token / skipped-release / skipped-source-map warnings were gone from build-log searches.
- Sentry release `2538da25b2fa` exists for project `vastra/javascript-nextjs`, deploy environment `production`, and matches the deployed commit prefix.
- Sentry source maps/artifacts are visible with 529 artifacts.
- No mapped event exists and no live Sentry event payload exists.
- Fresh deployed `/login` and `/privacy` smoke loaded visually and no longer showed the CSP `worker-src blob:` error.
- Fresh deployed `/login` and `/privacy` smoke still showed repeated `/monitoring?...` HTTP 403 console/network errors, so `SIGNOFF-10` remains blocked/partial.
- Batch 8B removed stale manual `/api/sentry-tunnel` route/proxy remnants and updated release-runtime tests to keep them absent.

Verification:

- Focused Batch 8B Vitest: 7 passed.
- Full Vitest: 39 files, 331 passed, 1 skipped.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for Batch 8B touched files -> passed.
- `npm run build` -> passed with the prebuild Vitest gate.
- `git diff --check` and `git diff --cached --check` passed.

Resolution status:

- `TECH-010` is documented as pass in the active matrix.
- `TECH-009`, `TECH-011`, `TECH-012`, `SEC-011`, and `SIGNOFF-10` remain blocked or partial evidence only.
- `WA-008` remains open.
- Next follow-up must verify external Sentry client key, allowed domains, DSN, and project settings for `/monitoring` 403, then capture fresh clean deployed smoke after any provider/config fix.
