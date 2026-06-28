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

Current classification after Batch 1 security foundation closeout, Batch 2 documentation closeout, the estimator costing reconciliation closeout, Batch 3 dispatch sale receipt closeout, and Batch 4 commercials receivables closeout:

| Status | Count | Pilot meaning |
| --- | ---: | --- |
| `pass` | 153 | Runtime/test evidence exists. |
| `fail` | 62 | Must be fixed, de-scoped, or explicitly accepted only where non-pilot scope. |
| `blocked` | 30 | Not pilot-ready until evidence is captured or the feature is removed from pilot scope. |
| `code_verified` | 131 | Source evidence only. This is not a pass. |
| `not_applicable` | 1 | Excluded by scope. |
| `not_run` | 0 | Matrix was fully classified. |

Critical failures: 0. High failures: 20. Critical blocked golden-journey follow-ons: 14.

Batch 1 security foundation moved `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`, `SEC-006`, and `AUTH-016` from fail to pass with runtime/test/migration evidence. `AUTH-008`, `PAY-018`, `PAY-020`, external webhook/export/compliance security rows, release gates, and unrelated unresolved failures remain open.

Batch 2 moved `PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, and `SIGNOFF-05` from fail to pass with runtime/test evidence. Downstream Golden A rows that were not rerun end-to-end remain blocked until a clean order chain is retested or explicitly de-scoped.

Estimator costing reconciliation is complete for the scoped formula/manual/manual-practical sprint with test and browser evidence. The active matrix counts above were unchanged by that sprint because the broader `ECON-A` rows still include server-boundary validation, idempotency, quote/order lifecycle, and date snapshot work outside that scope.

Batch 3 moved `SALE-015`, `DISP-003`, `DISP-007`, `DISP-010`, `DISP-019`, `GOLDEN-B-09`, `DASH-007`, `SIGNOFF-07`, and `SIGNOFF-08` from fail to pass with runtime/test/migration evidence. `SIGNOFF-10` remains open; Batch 3 supplies partial dispatch/package/receipt runtime evidence only, not release/Sentry/source-map proof.

Batch 4 moved `COMM-002`, `COMM-010`, `COMM-012`, `COMM-014`, `COMM-016`, `SIGNOFF-06`, and `SIGNOFF-09` from fail to pass with runtime/test/migration/browser evidence. `SIGNOFF-10`, `STOCK-017`, `STOCK-016`, `GOLDEN-A-19`, `GOLDEN-A-20`, `TIME-002`, and `OFF-009` remain open or partial evidence only.

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

- Golden A order-linked dispatch/receipt follow-ons not rerun by Batch 3.
- Payroll business correctness.
- Remaining `ECON-A` work outside estimator costing: server-boundary estimate validation, estimator save/market-run idempotency, quote/order lifecycle, target/deadline guards, below-target completion, and date-only rendering.
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
- `SIGNOFF-10`, `STOCK-017`, `STOCK-016`, `GOLDEN-A-19`, `GOLDEN-A-20`, `TIME-002`, and `OFF-009` remain partial evidence only or open and are not closed by Batch 4.
