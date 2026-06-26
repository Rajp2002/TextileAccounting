# Fix Log

This log starts from the completed pre-pilot QA artifacts. No application fix has been made or verified by this remediation operating-system step.

Rules for entries:

- Do not mark a failure resolved from source review alone.
- `code_verified` is not resolved.
- Runtime probes must use an isolated QA tenant, rollback-only transaction, or disposable environment.
- Each entry must link the invariant, tests, runtime evidence, and matrix rows changed.

## Current Resolution State

| Cluster | Status | Notes |
| --- | --- | --- |
| `SEC-A` mutable profile authorization | Review ready for Batch 1A | `SEC-002` through `SEC-005` have post-fix test/runtime evidence below. Matrix rows are not edited here. |
| `SEC-B` privileged action/lockdown enforcement | Open | Security follow-up after `SEC-A`, unless implementation safely includes it. |
| `SEC-C` webhook/export/compliance fail-closed | Open | Some items may require de-scope or counsel review. |
| `PROD-A` production correction/stock atomicity | Open | Critical business-data cluster after security. |
| `PROD-B` production boundary validation | Open | Must clarify day-only/substitute-worker pilot scope. |
| `ECON-A` estimator/quote/order/date snapshot correctness | Open | Medium failures, but must close before Golden A can be trusted. |
| `DISP-A` multi-batch dispatch identity | Open | Blocks Golden B. |
| `DISP-B` receipt-state coherence | Open | Blocks difference sign-off. |
| `COMM-A` sales/receivables/profit boundary | Open | Includes sale idempotency and direct market-run sale bypass. |
| `DASH-A` dashboard/sign-off read-model truth | Open | Depends on source-domain repairs and independent dashboard retest. |
| `PAY-A` payroll/kharchi ledger integrity | Open | Includes legacy RPCs and offline kharchi. |
| `IDEMP-A` mutation idempotency/unknown outcome | Open | Cross-cutting after core data invariants. |
| `OFF-A` offline/cache/PWA claims | Open | Some features likely de-scoped for pilot. |
| `REL-A` release gates | Open | Must be closed before pilot. |

## Entry Template

| Field | Required content |
| --- | --- |
| Date/time | IST timestamp. |
| Batch | Example: `BATCH-01-AUTHZ-BOUNDARY`. |
| Cluster | Backlog cluster ID. |
| Invariant | Exact invariant from `DOMAIN_INVARIANTS.md`. |
| Failures addressed | Matrix IDs. |
| Change summary | Code/migration/config files changed. |
| Regression tests | Command output and test file names. |
| Runtime QA | Browser/SQL/API evidence path. |
| Data safety | QA tenant/disposable/rollback-only proof. |
| Result | `open`, `blocked`, `retest_needed`, or `resolved_with_evidence`. |
| Matrix update | Rows promoted and evidence references. |

## Active Entry: BATCH-01A-MUTABLE-PROFILE-AUTHZ

Status: review ready.

Failures targeted: `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`.

Scope note: this is Batch 1A only. `SEC-006` and `AUTH-016` remain open for Batch 1B unless directly affected by this authorization-boundary fix.

Invariant: role, tenant, and custom authorization claims are server-owned authority. A tenant user must not be able to change the fields used to authorize owner/supervisor/admin behavior.

### Pre-Fix Reproduction Evidence

Date/time: 2026-06-26 01:19 IST.

Environment: local Next dev server at `http://localhost:3000` using Supabase project `vzhwahudircrpgtitwzd`; reusable QA supervisor account only. Passwords, tokens, cookies, and service-role keys were not printed or stored.

Data safety: the probe used the QA supervisor profile and a second QA/disposable organization id. The script restored the supervisor profile in a `finally` block and verified the final profile was restored to `role=supervisor` and the original `org_id`.

Pre-fix results:

- Direct authenticated update of own `profiles.role` to `owner`: succeeded. Stored row became `owner`; token refresh minted root JWT claim `user_role=owner`.
- Direct authenticated update of own `profiles.org_id` to another QA org: succeeded. Stored row moved to the target org; token refresh minted root JWT `org_id` for the target org.
- Owner route and owner-only server loader after role mutation: `/owner/today` loaded in the browser using the refreshed supervisor session. This route invokes the owner-only Factory Today server loader guarded by `requireRole(['owner'])`.
- Final restoration check: restored profile remained `role=supervisor` on the original QA org.

Current result: reproduced before patch. `SEC-002`, `SEC-003`, `SEC-004`, and `SEC-005` remained open until the post-fix evidence below.

### Root Cause

- Grants: `authenticated` had table-level `INSERT` and `UPDATE` on `public.profiles`, which granted write access to every profile column, including `id`, `role`, and `org_id`.
- RLS: the old `"Users can update their own profile"` policy was `FOR UPDATE USING (auth.uid() = id)` with no explicit `TO authenticated` and no `WITH CHECK`.
- Triggers/functions: `profiles` only had the audit trigger. There was no guard comparing `OLD` versus `NEW` authorization fields.
- Claim refresh: `public.custom_access_token_hook(event jsonb)` derives `org_id` and `user_role` from `public.profiles`, so a mutated profile row minted escalated or cross-org claims after refresh.
- Server authorization: `requireRole()` correctly re-reads the server profile row, but the row was user-mutable, so owner routes/server loaders accepted the mutated role.
- RPCs/server actions: owner-only RPCs and owner routes depend on `auth.jwt()->>'user_role'` or `requireRole(['owner'])`; those checks were bypassable only because profile mutation could mint owner claims.

### Change Summary

Files changed:

- `supabase/migrations/20260625195248_harden_profile_authorization_boundary.sql`
- `__tests__/p0-authz-boundary.test.ts`
- `scripts/qa/batch1a-authz-boundary-probe.mjs`
- `docs/pilot-remediation/FIX_LOG.md`
- `docs/pilot-remediation/LOOP_STATE.md`

Migration/policy changes applied to Supabase project `vzhwahudircrpgtitwzd`:

- Revoked `INSERT` and table-level `UPDATE` on `public.profiles` from `anon` and `authenticated`.
- Re-granted `authenticated` update only on `full_name`, `phone`, `whatsapp_number`, `whatsapp_opted_in`, and `whatsapp_opted_in_at`.
- Dropped the old own-profile update policy.
- Added `"Users can update own non-authorization profile fields"` `FOR UPDATE TO authenticated USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id)`.
- Added `public.prevent_profile_authorization_field_update()` plus `protect_profile_authorization_fields` trigger for `id`, `role`, and `org_id`.
- Revoked public/authenticated execute on the guard function; `service_role` retains execute.

### Post-Fix Evidence

Date/time: 2026-06-26 01:26 IST.

Targeted tests:

- `npx vitest run __tests__/p0-authz-boundary.test.ts` -> 1 file passed, 5 tests passed.
- `node scripts/qa/batch1a-authz-boundary-probe.mjs` -> passed. Direct role mutation denied with `42501`; direct org mutation denied with `42501`; stored profile stayed supervisor/original org; token refresh stayed supervisor/original org; owner-only RPC was denied for supervisor; owner login and owner token refresh stayed owner.

Broader auth/security-adjacent tests:

- `npx vitest run __tests__/p0-authz-boundary.test.ts __tests__/p1-auth-login-route.test.ts __tests__/p1-billing-gates.test.ts` -> 3 files passed, 12 tests passed.
- `npx eslint __tests__/p0-authz-boundary.test.ts scripts/qa/batch1a-authz-boundary-probe.mjs` -> passed.
- `npx eslint scripts/qa/batch1a-authz-boundary-probe.mjs` -> passed after adding the RPC assertion.

SQL metadata evidence:

- `authenticated` no longer has `UPDATE` on `profiles.id`, `profiles.role`, or `profiles.org_id`.
- `authenticated` has `UPDATE` only on non-authorization profile preference columns listed above.
- The new update policy has `roles={authenticated}`, `USING ((select auth.uid()) = id)`, and matching `WITH CHECK`.
- `protect_profile_authorization_fields` trigger is installed before update of `id`, `role`, or `org_id`.
- Guard function ACL is `{postgres=X/postgres,service_role=X/postgres}`.

Browser/runtime evidence:

- Post-fix browser QA with QA supervisor after denied mutation and token refresh: `/owner/today` redirected to `/supervisor/dashboard`.
- Supervisor owner-only API check: `POST /api/subscriptions/trial` returned `403 {"error":"Owner access required"}`.
- Real owner browser check: `/owner/today` loaded successfully.

### Final Compatibility Smoke Before Commit

Date/time: 2026-06-26 02:21 IST.

Scope: profile authorization boundary compatibility only.

Commands/checks run:

- `node --input-type=module <<'NODE' ... NODE` inline Supabase smoke, using local env plus private QA credential loader -> passed, 28 sanitized assertions.
- `npm run dev` -> Next dev server ready on `http://localhost:3000`; stopped after browser QA.
- In-app Browser runtime against `http://localhost:3000` using the real login form and QA owner/supervisor accounts -> passed.

Database compatibility evidence:

- Owner and supervisor authenticated clients can still update allowed profile preference fields: `full_name`, `phone`, `whatsapp_number`, `whatsapp_opted_in`, and `whatsapp_opted_in_at`.
- Owner and supervisor authenticated clients cannot update `profiles.id`, `profiles.role`, `profiles.org_id`, `profiles.email`, or `profiles.created_at`; each denied attempt returned `42501 permission denied for table profiles`.
- After denied updates, owner remained `role=owner` on the original org and supervisor remained `role=supervisor` on the original org.
- Owner and supervisor token refreshes kept the expected `user_role` and original `org_id` claims.
- Disposable service-role owner signup profile creation succeeded.
- Disposable service-role supervisor join profile creation succeeded.
- Disposable profiles, disposable organization, and disposable auth users were cleaned up successfully.

Browser/runtime compatibility evidence:

- Existing owner UI login succeeded through the real login form and reached `/owner/today`.
- Owner `/owner/settings` loaded successfully with registered profile details, two read-only profile inputs, and role display; no `permission denied`, profile-load, authorization, or profile-save failure text appeared.
- Owner logout succeeded through the localized logout control.
- Existing supervisor UI login succeeded through the real login form and reached `/supervisor/dashboard`.
- Supervisor `/supervisor/dashboard` loaded successfully; no `permission denied`, profile-load, authorization, or profile-save failure text appeared.
- Browser console check found zero relevant profile/permission/authorization/RLS errors.

Compatibility risk note:

- Revoking table-level `UPDATE` from `authenticated` is compatible with the current profile preference surface because direct authenticated profile updates are limited to the five granted preference columns. Service-role signup/join and owner-only WhatsApp preference actions still work because they use admin/server paths after authorization. Any future direct client profile edit must either use only those granted columns or move through an authorized server action.
- Dev server logs still showed an out-of-scope Sentry proxy `ECONNRESET`; no Batch 1A profile authorization failure was indicated.

Supabase advisor note:

- Security advisor still reports existing out-of-scope findings such as security-definer views, mutable search paths, executable security-definer RPCs, and tables with RLS but no policies. The new Batch 1A guard function is not executable by `authenticated`. Existing advisor findings remain for later security/release batches.

Data safety:

- Runtime mutation attempts used reusable QA accounts and QA/disposable org ids only.
- The probe scripts restore the QA supervisor profile in `finally`.
- No destructive production data changes were made. The applied DDL changes grants, policies, and a trigger only.

Result: `resolved_with_evidence` for Batch 1A scope (`SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`), pending human review and matrix promotion. `SEC-006`, `AUTH-016`, release gates, npm audit, Sentry, migration drift, production/stock, dispatch, payroll, estimator, and offline remain open/out of scope.

## Batch 1B-A - SEC-006 Access-Code Fail-Closed Boundary

### Scope

Date/time started: 2026-06-26 03:24 IST.

Scope is `SEC-006` only. `AUTH-016`, production/stock, dispatch, payroll business correctness, estimator, offline, release gates, Sentry, npm audit, lockfile, and unrelated security findings remain out of scope unless directly required to prove `SEC-006`.

### Invariant

Access-code protected actions must fail closed. Every protected action must use the same server-side validation path, count failed attempts, enforce a real 5 attempts per 10 minutes limit, reject expired or malformed codes, consume a valid code exactly once, and avoid recoverable plaintext access-code storage after the generation response.

### Pre-Fix Evidence

Evidence sources:

- `output/qa/PILOTQA-20260621-2058-8QIH/logs/security-access-code-evidence.json`
- `output/qa/PILOTQA-20260621-2058-8QIH/results.json`
- Current source inspection on branch `codex/batch-1b-security-lockdown` at Batch 1A base commit `ff1ddb0`.

Safe reproduction method: non-destructive source review plus the existing sanitized QA evidence. No brute-force traffic or destructive production mutation was executed.

Findings reproduced before patching:

- Access-code limiter mismatch: `lib/rate-limit.ts:98` configures `createLimiter(100, 10 * 60)` while the documented security rule is 5 attempts per 10 minutes.
- Fail-open behavior: `lib/rate-limit.ts:147` and `lib/rate-limit.ts:160` allow requests when Redis is missing or errors; `lib/rate-limit.ts:218` also treats Redis lockout read failure as unlocked.
- Manual validator bypass: `app/(dashboard)/owner/orders/actions.ts:124` defines a local `validateOwnerAccessCode`, and `app/(dashboard)/owner/orders/actions.ts:206` calls it instead of the central helper.
- Plaintext recovery/display path: `app/(dashboard)/owner/actions.ts:567` stores generated codes in `organizations.last_code_plain`, and `app/(dashboard)/owner/layout.tsx:24` selects `last_code_plain` for owner banner display.
- Inconsistent plaintext cleanup: `app/(dashboard)/owner/orders/actions.ts:163` consumes owner order codes by clearing `access_code_hash` and `access_code_expires_at` without clearing `last_code_plain`.

Existing positive controls:

- `lib/access-codes.ts` already validates format, checks hash/expiry, consumes the code, clears `last_code_plain`, and resets failures on the central path.
- Supervisor protected paths already call `validateAndConsumeAccessCode`.

Pre-fix conclusion: `SEC-006` is reproducible from deterministic source evidence. The fix must centralize every access-code consume path, make limiter failures fail closed for access-code checks, remove persistent plaintext storage reliance, and preserve normal owner/supervisor access-code workflows.

### Batch 1B-A Implementation

Date/time: 2026-06-26 03:37 IST.

Files changed:

- `lib/rate-limit.ts`
- `lib/access-codes.ts`
- `app/(dashboard)/owner/actions.ts`
- `app/(dashboard)/supervisor/actions.ts`
- `app/(dashboard)/owner/orders/actions.ts`
- `app/(dashboard)/owner/layout.tsx`
- `supabase/migrations/20260625215612_harden_access_code_fail_closed.sql`
- `__tests__/p0-access-code-boundary.test.ts`
- `scripts/qa/batch1b-access-code-probe.mjs`

Patch summary:

- Access-code limiter now uses 5 attempts per 10 minutes instead of 100 attempts per 10 minutes.
- Access-code limiter, lockout check, and failure recording now fail closed when Redis is missing or errors.
- `recordAccessCodeFailure` now locks after five failures in the 10-minute window.
- Access-code generation is centralized in `generateAndStoreAccessCode`, which stores hash/expiry only and writes `last_code_plain: null`.
- Central validation/consume uses server-derived org/user inputs and the service-role admin client so supervisor request/consume flows still work under owner-only organization RLS.
- Valid consume now conditionally updates on the current hash, clears hash/expiry/plaintext, and fails if the row was already consumed.
- Owner order update, owner worker delete-with-code, owner validate/rotate, owner access-code generation, and supervisor access-code request paths now use central helpers.
- Owner layout no longer selects/displays `organizations.last_code_plain`.
- New migration prevents future non-null `organizations.last_code_plain` writes without backfilling or mutating existing values.

Tests and local checks:

- `npx vitest run __tests__/p0-access-code-boundary.test.ts` -> 1 file passed, 8 tests passed.
- `npx vitest run __tests__/p0-access-code-boundary.test.ts __tests__/p0-authz-boundary.test.ts __tests__/p1-auth-login-route.test.ts __tests__/p1-payroll-revert.test.ts` -> 4 files passed, 17 tests passed.
- `npx eslint lib/access-codes.ts lib/rate-limit.ts app/'(dashboard)'/owner/actions.ts app/'(dashboard)'/supervisor/actions.ts app/'(dashboard)'/owner/orders/actions.ts app/'(dashboard)'/owner/layout.tsx __tests__/p0-access-code-boundary.test.ts scripts/qa/batch1b-access-code-probe.mjs` -> passed.
- `npx tsc --noEmit` -> passed.
- `git diff --check` -> passed.

Runtime probe evidence:

- `node scripts/qa/batch1b-access-code-probe.mjs` -> passed after applying the migration. Assertions passed: owner login/profile works; supervisor login/profile works in same QA org; missing Redis dependency fails closed; real 5 attempts per 10 minutes limiter blocks the sixth attempt; five recorded invalid attempts create lockout; valid code works once and clears stored hash/expiry/plaintext on a disposable org; reused code fails; expired code fails; wrong code fails; plaintext storage trigger rejects future non-null `last_code_plain` writes with `42501`.
- The probe uses a disposable organization for access-code mutation checks and does not clear or mutate existing production `organizations.last_code_plain` values.

Final production-linked migration proof:

- Date/time: 2026-06-26 03:53 IST.
- Linked Supabase project: `vzhwahudircrpgtitwzd`.
- Migration safety classification: `A. Safe forward-looking schema/security hardening`.
- Migration safety summary: `20260625215612_harden_access_code_fail_closed.sql` creates/replaces `public.prevent_access_code_plaintext_storage()`, installs `prevent_organizations_last_code_plaintext` before insert/update of `organizations.last_code_plain`, revokes public/authenticated execute on the guard, grants execute to `service_role`, and comments the deprecated column. It does not delete, truncate, mass-update, clear existing `last_code_plain`, drop columns/tables, or mutate existing production data.
- `npx supabase db push --dry-run` -> would push only `20260625215612_harden_access_code_fail_closed.sql`.
- `npx supabase db push` -> applied only `20260625215612_harden_access_code_fail_closed.sql`; no migration repair, direct SQL, `db pull`, or `--include-all` was used.
- `npx supabase migration list` -> local and remote both include `20260625195248` and `20260625215612`; no Batch 1A migration drift remains.

Final tests and checks:

- `npx vitest run __tests__/p0-access-code-boundary.test.ts` -> 1 file passed, 8 tests passed.
- `npx vitest run __tests__/p0-authz-boundary.test.ts __tests__/p0-access-code-boundary.test.ts` -> 2 files passed, 13 tests passed.
- `npx tsc --noEmit` -> passed.
- `npx eslint __tests__/p0-access-code-boundary.test.ts scripts/qa/batch1b-access-code-probe.mjs` -> passed.
- `git diff --check` -> passed.

Data safety:

- No production data cleanup was performed.
- Existing non-null `organizations.last_code_plain` values were not cleared, updated, or backfilled.
- Runtime consume/expiry/reuse checks used a disposable organization and cleaned up after the probe.

Result: `SEC-006` is pass-ready with runtime/test/migration evidence, pending human review and matrix promotion. `AUTH-016`, production/stock, dispatch, payroll business correctness, estimator, offline, release gates, Sentry, npm audit, and lockfile work remain open/out of scope.

## Batch 1B-B - AUTH-016 Locked-Tenant Write Boundary

Date/time: 2026-06-26 10:58 IST.

Scope: `AUTH-016` only. No production/stock atomicity, dispatch correctness, payroll business-correctness, estimator, offline, release-gate, Sentry, npm audit, lockfile, `SEC-006`, or other security work was included.

Invariant:

Locked organizations must not mutate protected pilot business data through UI, server actions, API routes, direct Supabase table access, RLS gaps, or SECURITY DEFINER RPCs. Unlocked organizations must continue normal writes. Lockdown is enforced primarily through centralized server-action guards, RLS predicates, and explicit RPC guards; no trigger was added as the primary enforcement mechanism.

Pre-fix evidence:

- QA finding `AUTH-016` remains open from the pre-pilot security batch: locked tenants were redirected at the UI layer but backend write surfaces still existed through direct table writes, service-role server actions, and privileged RPCs.
- Existing policies included protected pilot tables without a consistent `NOT public.check_org_lockdown(org_id)` write predicate.
- Existing service-role write paths in `app/(dashboard)/supervisor/actions.ts` obtained `getServiceClient()` directly after role checks, allowing locked organizations to reach admin writes if the UI redirect was bypassed.
- Existing privileged RPCs mutated protected business data without an explicit internal `public.assert_org_not_locked(...)` guard.

Implementation status:

- Added central server guard helpers in `lib/auth.ts`:
  - `assertOrgWritable(orgId)`
  - `requireWritableOrg(allowedRoles)`
  - `ORG_LOCKED_WRITE_MESSAGE`
- Routed supervisor service-role write helpers through `assertOrgWritable(orgId)` before creating the admin client.
- Added an owner service-role write guard for owner market-run/order helper writes.
- Added migration `20260626051352_harden_locked_tenant_writes.sql` to harden locked-tenant writes with RLS predicates and explicit SECURITY DEFINER RPC guards.
- Added static regression coverage in `__tests__/p0-locked-tenant-boundary.test.ts`.
- Added runtime probe scaffold `scripts/qa/batch1b-locked-tenant-probe.mjs` for disposable locked/unlocked organization proof after the migration can be safely dry-run and applied.

Migration safety summary:

- The migration is intended as forward-looking schema/security hardening: function definitions, grants, RLS enablement, policy replacement, and explicit RPC guard injection.
- It does not contain `DELETE FROM`, `TRUNCATE`, table/column drops, mass production data updates, or cleanup of existing production rows.
- It does not add trigger-based primary enforcement.
- The migration was manually applied by the human operator with `npx supabase db push`; this pass did not rerun `npx supabase db push`, migration repair, `db pull`, direct SQL, or `--include-all`.
- `npx supabase migration list` now shows `20260626051352` aligned locally and remotely.

Runtime proof:

- Initial probe run exposed probe-only schema drift in the disposable seed payload (`workers.rate_per_meter`, then missing `fabric_stock_lots.original_meters`). The probe was corrected to match the current live schema without changing product logic or migration SQL.
- `node scripts/qa/batch1b-locked-tenant-probe.mjs` -> passed.
- Runtime assertions passed: locked owner login still works; locked supervisor login still works; unlocked owner login still works; unlocked supervisor login still works; locked org direct `workers` insert denied with RLS `42501`; locked org direct `fabric_stock_lots` insert denied with RLS `42501`; locked org direct `worker_advances` insert denied with RLS `42501`; locked org mutating `replace_shift_production_logs` RPC denied with `42501`; unlocked org representative `workers`, `fabric_stock_lots`, and `worker_advances` inserts still work; unlocked org empty-batch mutating RPC still works.
- Runtime proof used disposable locked and unlocked organizations and cleaned them up after the probe.

Final tests and checks:

- `npx vitest run __tests__/p0-locked-tenant-boundary.test.ts` -> 1 file passed, 5 tests passed.
- `npx vitest run __tests__/p0-authz-boundary.test.ts __tests__/p0-access-code-boundary.test.ts __tests__/p0-locked-tenant-boundary.test.ts` -> 3 files passed, 18 tests passed.
- `npx tsc --noEmit` -> passed.
- `npx eslint lib/auth.ts app/'(dashboard)'/owner/actions.ts app/'(dashboard)'/supervisor/actions.ts __tests__/p0-locked-tenant-boundary.test.ts scripts/qa/batch1b-locked-tenant-probe.mjs` -> passed.
- `git diff --check` -> passed.

Data safety:

- No production data was mutated.
- No production data cleanup was performed.
- The runtime probe used disposable QA organizations and did not run broad production writes.

Result: `AUTH-016` is pass-ready with migration-history, runtime, test, typecheck, lint, and diff-check evidence, pending human review and matrix promotion. Production/stock atomicity, dispatch correctness, payroll business correctness, estimator, offline, release gates, Sentry, npm audit, and lockfile work remain open/out of scope.
