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
| `SEC-A` mutable profile authorization | Closed in Batch 1 / pass | `SEC-002` through `SEC-005` have post-fix test/runtime evidence below and active matrix rows are promoted to pass. |
| `SEC-B` privileged action/lockdown enforcement | Partially closed through Batch 21D / open remainder | Batch 1 closed `SEC-006` and `AUTH-016` with runtime/test evidence and active matrix rows promoted to pass. Batch 20 source-fixed payroll RPC boundary rows `PAY-018` and `PAY-020`; Batch 21D closes them with disposable QA runtime proof. `AUTH-008` remains open. |
| `SEC-C` webhook/export/compliance fail-closed | Partially closed through Batch 15 / open remainder | Batch 9 closes `SEC-016` privacy/offline wording truth. Batch 15 closes `SEC-014` payslip filename safety with deterministic source/test proof. Webhook, owner export, settings audit, age/consent, counsel-review, and live Sentry payload rows remain open or blocked. |
| `PROD-A` production correction/stock atomicity | Closed in Batch 2 / pass-ready | `PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, and `SIGNOFF-05` have post-fix test/runtime evidence below and active matrix rows are promoted to pass. |
| `PROD-B` production boundary validation | Partially source-fixed through Batch 24F / open remainder | Batch 22 moves `ORDER-005`, `ORDER-009`, and `PROD-011` from fail to `code_verified` with source/test/migration proof for over-target, cancelled/completed/stale-assignment, and negative-meter boundaries. Batch 24C moves `SETUP-011` to `code_verified` by source-fixing Factory Today setup checklist data-source correctness. Batch 24E moves `MASTER-002` and `MASTER-005` to `code_verified` by source-fixing normalized duplicate loom-name checks and protected loom delete/deactivate/unlink guardrails. Batch 24F moves `PROD-002` and `PROD-004` to `code_verified` by source-fixing selected-shift day-only worker assignment policy and explicit substitute-worker reassignment-required behavior. Runtime/API, browser, or migration/DB-boundary proof is still required before these rows can pass. `MASTER-014`, `SIGNOFF-01`, `SIGNOFF-02`, and remaining production-boundary rows stay open. |
| `STOCK-A` stock lifecycle/archive policy | Partially closed in Batch 12 / open remainder | Batch 12 closes `STOCK-012` with focused local lifecycle proof. `STOCK-011`, `STOCK-013`, `MARKET-009`, and `MARKET-010` remain open/partial because their exact row wording needs broader proof. |
| `ECON-A` estimator/quote/order/date snapshot correctness | Partially remediated through Batch 21B / open remainder | Estimator costing reconciliation is complete for formula/manual modes with browser QA and tests. Batch 7 closes `TIME-002` date-only rendering stability. Batch 10 closes worker-rate snapshot drift, quote restore draft collision, and quote transition cleanup rows. Batch 11 closes server-boundary estimator validation and target/deadline produced-meter/audit guard rows. Batch 13 closes `EST-001`, `EST-005`, and `EST-012` with exact local estimator proof. Batch 21B closes `ORDER-008` below-target and pending-dispatch completion confirmation with disposable QA browser/runtime proof. Start Party Order fast-path atomicity remains open. |
| `DISP-A` multi-batch dispatch identity | Closed in Batch 3 / pass | `DISP-003`, `GOLDEN-B-09`, `DASH-007`, and `SIGNOFF-07` have post-fix runtime/test/migration evidence below and active matrix rows are promoted to pass. `SIGNOFF-10` received partial dispatch/package evidence here and was closed later by Batch 8C clean deployed browser/server/Sentry evidence. |
| `DISP-B` receipt-state coherence | Closed through Batch 12 / pass | `DISP-007`, `DISP-010`, `DISP-019`, and `SIGNOFF-08` have post-fix runtime/test/migration evidence below and active matrix rows are promoted to pass. Batch 12 closes `DISP-013` with focused local dispatch archive proof. |
| `COMM-A` sales/receivables/profit boundary | Closed through Batch 6 / pass | Batch 3 closes `SALE-015`. Batch 4 closes `COMM-002`, `COMM-010`, `COMM-012`, `COMM-014`, `COMM-016`, `SIGNOFF-06`, and `SIGNOFF-09` with runtime/test/migration evidence. Batch 5 closes `STOCK-016` and `STOCK-017`. Batch 6 closes the Golden A order-linked sale, dispatch, receipt, receivable, payment, and order-archive follow-ons `GOLDEN-A-13`, `GOLDEN-A-15`, `GOLDEN-A-16`, `GOLDEN-A-17`, `GOLDEN-A-18`, `GOLDEN-A-19`, `GOLDEN-A-20`, and `GOLDEN-A-24`. Broad timezone/offline rows and release/Sentry proof remain open separately. |
| `DASH-A` dashboard/sign-off read-model truth | Partially closed/code-verified through Batch 24C / open remainder | Batch 3 closes dispatch/receipt read-model rows `DASH-007`, `SIGNOFF-07`, and `SIGNOFF-08`; Batch 2 closes `SIGNOFF-05`; Batch 4 closes the commercial signoff rows `SIGNOFF-06` and `SIGNOFF-09`; Batch 8C closes `SIGNOFF-10`; Batch 15 source-fixes `DASH-003` gross wage read-model calculation but keeps it `code_verified` pending disposable after-shift runtime proof. Batch 24C moves `DASH-004` to `code_verified` by source-fixing historical selected-date analytics state so stale current values are not mixed into historical views. `SIGNOFF-01`, `SIGNOFF-02`, and remaining dashboard runtime evidence debt stay open. |
| `PAY-A` payroll/kharchi ledger integrity | Partially remediated through Batch 21D / open remainder | Batch 9 closes offline kharchi rows `OFF-008` and `PAY-028` by truthful online-only de-scope. Batch 15 closes payroll payslip PDF/export rows `PAY-023` and `PAY-024`. Batch 21C promotes PF/ESI preview and preview-versus-settlement rows `PAY-013` and `PAY-015` to pass with disposable payroll settlement runtime proof. Batch 21D promotes payroll settlement/reversal boundary rows `PAY-018` and `PAY-020` to pass with disposable QA runtime proof. Batch 20 online Kharchi atomicity row `PAY-027` remains `code_verified`, not pass, pending disposable QA runtime proof. Broader settlement correctness remains open. |
| `IDEMP-A` mutation idempotency/unknown outcome | Partially closed in Batch 4 / open remainder | Batch 3 closes `SALE-015` duplicate sale idempotency for the stock sale/dispatch path. Batch 4 closes commercial payment duplicate-submit idempotency for receivable payments. Estimator, market-run creation, payroll, subscription, trial, timeout, and offline idempotency remain open. |
| `OFF-A` offline/cache/PWA claims | Partially closed in Batch 9 / open remainder | Batch 9 closes `OFF-002`, `OFF-005`, `OFF-006`, `OFF-008`, and `SEC-016` with offline fallback, auth-boundary cache cleanup, online-only kharchi, and truthful public/privacy copy. `OFF-007`, `OFF-010`, and `OFF-009` remain open or partial. |
| `REL-A` release gates | Partially remediated through Batch 8C / open remainder | Batch 7 closes `TECH-013` source-level release test gate. Batch 8 closes `TECH-007` migration-head alignment evidence. Batch 8B closes `TECH-010` Sentry release/source-map proof. Batch 8C closes final clean deployed signoff evidence for `SIGNOFF-10`. Clean install, audit, live Sentry payload inspection, restore, and rollback remain open or blocked. |

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

Scope note: this is Batch 1A only. `SEC-006` and `AUTH-016` were deferred from Batch 1A and closed later in Batch 1B.

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

Result: `resolved_with_evidence` for Batch 1A scope (`SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`). These rows are promoted to pass in the active matrix by the retrospective Batch 1 security foundation closeout. `SEC-006` and `AUTH-016` are closed separately by Batch 1B. Release gates, npm audit, Sentry, production/stock outside later Batch 2 closure, dispatch, payroll, estimator, and offline remain open/out of scope.

## Batch 1B-A - SEC-006 Access-Code Fail-Closed Boundary

### Scope

Date/time started: 2026-06-26 03:24 IST.

Scope is `SEC-006` only. `AUTH-016` was out of scope for this sub-batch and closed later in Batch 1B-B. Production/stock, dispatch, payroll business correctness, estimator, offline, release gates, Sentry, npm audit, lockfile, and unrelated security findings remained out of scope unless directly required to prove `SEC-006`.

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

Result: `SEC-006` is pass-ready with runtime/test/migration evidence and is promoted to pass in the active matrix by the retrospective Batch 1 security foundation closeout. `AUTH-016` is closed separately by Batch 1B-B. Production/stock outside later Batch 2 closure, dispatch, payroll business correctness, estimator, offline, release gates, Sentry, npm audit, and lockfile work remain open/out of scope.

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

Result: `AUTH-016` is pass-ready with migration-history, runtime, test, typecheck, lint, and diff-check evidence and is promoted to pass in the active matrix by the retrospective Batch 1 security foundation closeout. Production/stock atomicity is closed later by Batch 2; dispatch correctness, payroll business correctness, estimator, offline, release gates, Sentry, npm audit, and lockfile work remain open/out of scope.

## Security Foundation Closure

Date/time: 2026-06-26 11:27 IST.

Human decision: security foundation approved. The following failures are treated as pass/pass-ready based on runtime/test evidence and are documented as pass in the active QA matrix:

- `SEC-002`
- `SEC-003`
- `SEC-004`
- `SEC-005`
- `SEC-006`
- `AUTH-016`

Closure evidence:

- Batch 1A authorization boundary is covered by the profile authorization migration, SQL metadata proof, browser/runtime QA, and `__tests__/p0-authz-boundary.test.ts`.
- Batch 1B-A access-code boundary is covered by the access-code migration, runtime disposable-org probe, and `__tests__/p0-access-code-boundary.test.ts`.
- Batch 1B-B locked-tenant boundary is covered by the locked-tenant migration, runtime disposable locked/unlocked organization probe, and `__tests__/p0-locked-tenant-boundary.test.ts`.
- Supabase migration history is aligned locally and remotely for `20260625195248`, `20260625215612`, and `20260626051352`.
- `code_verified` was not treated as pass without runtime/test proof.

Security commits/evidence:

- Batch 1A authorization boundary: `76a25a3` (`fix(authz): harden profile authorization boundary`), `ff1ddb0` (`docs(qa): close Batch 1A authorization evidence`), and `704cb54` (`chore(db): reconcile Batch 1A migration history`).
- Batch 1B-A access-code boundary: `77a0382` (`fix(security): harden access-code validation`).
- Batch 1B-B locked-tenant boundary: `e2e0cf1` (`fix(security): enforce locked-tenant write boundary`).
- Security foundation closure: `d98f2f2` (`docs(qa): close security foundation`).

Security migrations applied/aligned:

- `20260625195248_harden_profile_authorization_boundary.sql`.
- `20260625215612_harden_access_code_fail_closed.sql`.
- `20260626051352_harden_locked_tenant_writes.sql`.

Proof commands recorded:

- `node scripts/qa/batch1a-authz-boundary-probe.mjs`.
- `npx vitest run __tests__/p0-authz-boundary.test.ts`.
- `node scripts/qa/batch1b-access-code-probe.mjs`.
- `npx vitest run __tests__/p0-access-code-boundary.test.ts`.
- `node scripts/qa/batch1b-locked-tenant-probe.mjs`.
- `npx vitest run __tests__/p0-locked-tenant-boundary.test.ts`.
- `npx vitest run __tests__/p0-authz-boundary.test.ts __tests__/p0-access-code-boundary.test.ts __tests__/p0-locked-tenant-boundary.test.ts`.
- `npx tsc --noEmit`.
- Targeted `npx eslint ...` commands listed in the Batch 1A, Batch 1B-A, and Batch 1B-B entries above.
- `git diff --check`.

Active matrix result:

- `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`, `SEC-006`, and `AUTH-016` are promoted to pass.
- `AUTH-008`, `TECH-009`, `WA-008`, `SEC-009`, `SEC-015`, `SEC-017`, and other unrelated unresolved failures remain open. `SEC-014` is closed later by Batch 15; `PAY-018` and `PAY-020` are closed later by Batch 21D.

Out of scope and still open for later batches:

- Batch 3 dispatch/receipt correctness for the approved target rows is closed; Golden A order-linked receipt follow-ons and unrelated dispatch-adjacent proof remain out of scope.
- Payroll business correctness.
- Estimator.
- Offline behavior.
- Release gates.
- Sentry.
- npm audit.
- Lockfile work.

Most recent completed remediation batch: Batch 2, production correction plus generated stock atomicity, covering `PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, and `SIGNOFF-05`. Implementation commit `f34b89c8f1f16bd87474737c69941565665f17d0` was reconciled into `main` by fast-forward; `origin/main` points to that commit before this documentation closeout.

## Batch 2 - Production Correction and Generated Stock Atomicity

Date/time: 2026-06-27 15:41 IST. Documentation closeout: 2026-06-27 after `main` was fast-forwarded to `f34b89c8f1f16bd87474737c69941565665f17d0`.

Scope:

- `PROD-016`
- `PROD-028`
- `STOCK-015`
- `GOLDEN-A-11`
- `GOLDEN-A-12`
- `GOLDEN-A-14`
- `SIGNOFF-05`

Implementation status:

- Added migration `20260626064830_production_stock_atomicity.sql`.
- Added internal RPC `reconcile_generated_stock_for_production_grain(...)`.
- Updated `replace_shift_production_logs(...)` so production replacement and generated stock reconciliation run in the same database transaction.
- The replacement RPC captures affected `(org_id, order_id, date, shift)` grains from both old rows and new rows, so an old order/date/shift that loses all production is still reconciled to zero.
- `create_or_refresh_stock_inward_draft(...)` is now a wrapper over the same reconciler instead of retaining a separate implementation.
- Removed the app-level post-replacement stock refresh from `bulkLogProduction`; the server action now delegates production/stock atomicity to the RPC.
- Generated stock remains keyed by the existing deterministic grain: `fabric_stock_inward_drafts(org_id, order_id, source_date, source_shift)`.
- Stock deltas insert `fabric_stock_movements` rows. Negative production corrections use `adjustment_subtract` with a production-correction note.
- Unsafe reductions are blocked instead of clamped. The migration does not use `GREATEST(0, available_meters + delta)` or equivalent clamping to hide over-consumption.
- Automatic production correction is blocked if the generated stock has already been dispatched/received, or if corrected production would fall below already sold meters.
- Fixed the Factory Today/signoff read-model contract mismatch by updating `getFactoryToday()` to read `order_progress_summary.total_meters_produced`, matching the deployed view and existing owner order surfaces. No new migration was needed.

Regression tests and checks run:

- `npx vitest run __tests__/p1-production-stock-atomicity.test.ts` -> passed, 8 tests.
- `npx vitest run __tests__/p1-production-stock-atomicity.test.ts __tests__/p1-production-dispatch-regressions.test.ts __tests__/p1-production-log-strictness.test.ts __tests__/p1-stock-lifecycle.test.ts __tests__/p1-stock-source-validation.test.ts __tests__/p1-party-first-stock-sale-dispatch.test.ts __tests__/market-runs.test.ts __tests__/production-mode.test.ts __tests__/p0-atomicity.test.ts` -> passed, 9 files, 92 tests.
- `npx vitest run` -> passed, 33 files, 287 passed, 1 skipped.
- `npx tsc --noEmit` -> passed.
- `npx eslint app/'(dashboard)'/supervisor/actions.ts __tests__/p1-production-stock-atomicity.test.ts` -> passed.
- `git diff --check` -> passed.

Migration safety status:

- `20260626064830_production_stock_atomicity.sql` was manually applied after human approval before runtime proof.
- `npx supabase migration list` showed `20260626064830 | 20260626064830` before runtime proof.
- No new migration was needed for the Factory Today read-model fix because the deployed `order_progress_summary` canonical column is `total_meters_produced`.
- No additional migration was applied to the production-linked Supabase project.
- No migration repair, `db pull`, direct SQL, or `--include-all` was used.

Runtime QA status:

- Executed with a disposable QA tenant and disposable owner/supervisor users, then cleaned up in `finally`.
- Sanitized QA evidence: project `vzhwahudircrpgtitwzd`, org `a7deb148...d5c7`, order `2b6755b2...462b`, target date `2026-06-27`, control day-shift date `2026-06-26`.
- Production totaling 256.00m was created.
- Correcting stale 25.25m night production to downtime left valid production at 230.75m.
- `production_logs` total was 230.75m.
- Generated order stock original total was 230.75m after correction; final generated stock original total remained 230.75m after sale/dispatch guard probes.
- No stale 25.25m lot remained.
- Reversal movement count was exactly 1 after correction; retry/double-submit kept movement count at 2 and did not duplicate the reversal.
- Sale over corrected-away stock was blocked with "Cannot sell more than available stock".
- Reduction below sold quantity was blocked and rolled back with the generated-stock sold/dispatched error.
- Dispatch and delivered/receipt-history rows blocked automatic production correction and rolled back to 230.75m.
- Multiple looms same order/date/night shift aggregated correctly; day control production stayed independent at 17.50m on the control date.
- Second-session stock summary read 230.75m, Factory Today production source read 230.75m, and `order_progress_summary.total_meters_produced` read 230.75m for signoff expected-stock proof.

Resolution status:

- Code, migration, regression tests, runtime proof, and active matrix closeout are complete for this Batch 2 scope.
- `PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, and `SIGNOFF-05` are pass-ready with the evidence above and are documented as pass in the active QA matrix.
- Remaining dashboard/signoff rows outside `SIGNOFF-05` stay open in `DASH-A`.

## Estimator Reconciliation Sprint - Costing Formula/Manual Audit

Date/time: 2026-06-28 00:54 IST.

Scope:

- Estimator costing engine only.
- Manual kg/100m override mode.
- Formula mode and formula-equivalent manual parity.
- Finished/market pano versus effective costing width handling.
- Waste/crimp semantics.
- Cost Breakdown audit UI.
- Quote save/reopen cost-audit preservation.

Out of scope:

- `ECON-A` server-boundary validation for impossible estimates.
- Estimator save/market-run idempotency.
- Quote/order lifecycle transition model.
- Order target/deadline audit and produced-meter guards.
- Date-only rendering under multiple timezones.
- Production deployment verification.

Invariant:

Estimator costing must be deterministic, explainable, and honest. Formula rows must use the formula-derived kg/100m unless the user explicitly switches the row to manual kg/100m. Manual rows must use the entered base kg/100m. Warp crimp applies only to warp. Waste applies to warp and weft. Blank row waste uses the default, explicit row waste `0` overrides the default to zero, and row waste does not stack with default waste. The audit UI must show exactly the values used by the engine.

Implementation status:

- Added manual kg/100m calculation mode for warp and weft layers.
- Added formula/manual audit fields to `calcFullTotals(...)`, including formula kg, base kg used, crimp %, waste %, total adjustment %, final kg/100m, rate, and cost/m.
- Fixed weft costing so warp crimp no longer applies to weft.
- Split finished/market width from effective costing width and defaulted fresh estimator sessions to inches.
- Added width warnings for suspicious cm inputs such as `62 cm`, which costs as only `24.4 inches`.
- Fixed row-waste semantics: blank uses default, explicit `0` overrides to zero, and row waste does not stack with default waste.
- Added a visible Cost Breakdown audit panel that explains formula/manual mode and every cost line.
- Added quote detail/restore audit rendering for saved estimator quotes.
- Fixed a hydration mismatch by rendering a deterministic initial width unit and loading persisted width unit after mount.
- Updated template legacy `reed_space` snapshots to use effective costing width.

Files changed:

- `lib/estimator.ts`
- `app/(dashboard)/owner/estimator/EstimatorClient.tsx`
- `components/cost-analysis-details.tsx`
- `app/(dashboard)/owner/estimator/actions.ts`
- `__tests__/estimator.test.ts`
- `__tests__/width-field.test.ts`

Calculation QA evidence:

- Practical manual regression:
  - `50/600`: `3.800 -> 4.180 kg/100m`, `₹7.98/m`
  - `Jari`: `3.300 -> 3.630 kg/100m`, `₹12.34/m`
  - `40 spun`: `6.500 -> 7.150 kg/100m`, `₹14.09/m`
  - Yarn total: `₹34.41/m`
  - With `₹21.50/m` other cost: `₹55.91/m`
  - With `₹21.75/m` other cost: `₹56.16/m`
- Formula real factory specs:
  - `50/600`: base `3.789`, final `4.547`, `20.0%` adjustment, `₹8.68/m`
  - `Jari`: base `3.307`, final `3.968`, `20.0%` adjustment, `₹13.49/m`
  - `50 span/spun`: base `5.456`, final `6.002`, `10.0%` adjustment, `₹11.82/m`
  - Production cost: `₹55.75/m`
- Formula-equivalent manual mode:
  - Production cost: `₹55.75/m`
  - Difference from formula mode: `₹0.00/m`

Browser/runtime QA evidence:

- Estimator UI loaded in a QA owner session on local dev.
- Fresh estimator sessions render width unit as inches.
- Entering effective width `62 cm` produced the low formula result `₹48.58/m` and displayed the warning that `62 cm` is only `24.4 inches` and asks whether the user meant `62 inches`.
- Switching the same width to `62 inch` produced `₹55.75/m`.
- Warp rows showed `10.0% crimp + 10.0% waste = 20.0%`.
- Weft row showed `0.0% crimp + 10.0% waste = 10.0%`.
- Explicit row waste `0` overrode default waste and dropped the first practical warp row to `₹7.26/m`.
- Explicit row waste `10` did not stack with default waste and restored `₹7.98/m`.
- Saving quote `QA Formula Factory / DNO Practical Manual` created a quote at `₹56.16/m`; Quotes -> Restore reopened the estimator with the same rows and `₹56.16/m` audit.

Verification commands:

- `npx vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts` -> passed, 2 files, 31 tests.
- `npx vitest run` -> passed, 33 files, 298 passed, 1 skipped.
- `npx tsc --noEmit` -> passed.
- `npm run build` -> passed.
- `npm run lint -- __tests__/estimator.test.ts __tests__/width-field.test.ts lib/estimator.ts app/(dashboard)/owner/estimator/EstimatorClient.tsx app/(dashboard)/owner/estimator/actions.ts components/cost-analysis-details.tsx` -> passed.
- `npm run lint` -> failed only on existing unrelated `scratch/*.js` CommonJS `require()` lint errors.

Data safety:

- Browser QA used a QA owner session.
- A draft estimator quote was created for QA evidence.
- No production data mutation or database migration was performed.

Resolution status:

- Estimator costing reconciliation is complete for the scoped formula/manual/manual-practical costing sprint.
- Active QA matrix rows are not promoted by this closeout because existing `ECON-A` rows also cover server-boundary validation, idempotency, quote/order lifecycle, and date rendering that remain outside this sprint.
- `ECON-A` remains open for those remaining rows.

## Batch 3 - Dispatch Sale Receipt Correctness

Date/time: 2026-06-28 13:34 IST. Documentation closeout after `main` was fast-forwarded to implementation commit `9661f3fcace44b1b44c71002e6d0554a58de8ab6`.

Scope:

- `SALE-015`
- `DISP-003`
- `DISP-007`
- `DISP-010`
- `DISP-019`
- `GOLDEN-B-09`
- `DASH-007`
- `SIGNOFF-07`
- `SIGNOFF-08`

Partial evidence only:

- `SIGNOFF-10` received dispatch/package/receipt runtime evidence that no Batch 3 runtime path produced `tracking_token` or ambiguous `dispatch_number` errors. Full `SIGNOFF-10` remained open at Batch 3 closeout for non-dispatch release/Sentry/source-map evidence and is closed later by Batch 8C.

Invariant:

Dispatch is a batch-level obligation against sold meters. Pending dispatch equals sold meters minus dispatched meters. Receipt variance equals received meters minus sent meters. A partial dispatch is not a shortage. Duplicate sale/dispatch/receipt submissions must not duplicate stock, receivable, dispatch, package, receipt, or discrepancy state.

Implementation status:

- Added migration `20260627195152_batch_3_dispatch_sale_receipt_correctness.sql` to make stock-sale dispatch and receipt paths idempotent and coherent.
- Added migration `20260628071340_batch_3_dispatch_tracking_token_contract_fix.sql` to remove stale `dispatches.tracking_token` writes from Batch 3 RPC definitions because public tracking is deferred and active stock-sale dispatch actions return `trackingUrl: null`.
- Added migration `20260628073917_batch_3_dispatch_number_returning_contract_fix.sql` to qualify `dispatch_number` `RETURNING` references and remove the ambiguous runtime error.
- Added focused regression coverage in `__tests__/p2-dispatch-sale-receipt.test.ts` and archive regression coverage in `__tests__/dispatch-archive.test.ts`.
- Updated dispatch/sale/receipt server actions, shared types, dispatch archive helper, and dispatch UI components so pending dispatch, package identity, receipt fields, discrepancy creation, archive eligibility, and refresh behavior use the same Batch 3 contract.

Migrations applied/aligned:

- `20260627195152 | 20260627195152`
- `20260628071340 | 20260628071340`
- `20260628073917 | 20260628073917`

Runtime QA status:

- Fresh disposable QA runtime proof passed on run `BATCH3-fc791041` with valid `production_mode=both`.
- Rapid duplicate 80m sale submit produced exactly one sale, one receivable where applicable, and one stock movement.
- Dispatching 50m left 30m pending; dispatching the remaining 30m with a distinct deterministic package identity reduced pending dispatch to 0.
- Exact receipt closed with no discrepancy and synchronized receipt fields.
- Shortage receipt created exactly one actionable shortage discrepancy.
- Excess receipt created exactly one actionable excess discrepancy.
- Duplicate receipt submit did not duplicate discrepancy or receipt state.
- Negative and zero receipts were blocked consistently.
- Archive helper did not archive unresolved dispatch/receipt obligations and allowed clean reconciled groups.
- Dispatches, Factory Today, stock, Commercials, signoff, and second-session refresh reconciled.
- No runtime path tried to read or write `dispatches.tracking_token`.
- No ambiguous `dispatch_number` runtime error remained.

Verification commands:

- `npx vitest run __tests__/p2-dispatch-sale-receipt.test.ts` -> passed, 1 file, 7 tests.
- `npx vitest run __tests__/p1-party-first-stock-sale-dispatch.test.ts __tests__/dispatch-archive.test.ts __tests__/p1-production-dispatch-regressions.test.ts` -> passed, 3 files, 27 tests.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for changed app/components/lib files -> passed.
- `git diff --check` -> passed.
- `npx vitest run` -> passed, 34 files, 306 passed, 1 skipped.

Data safety:

- Runtime proof used a fresh disposable QA tenant/run.
- Earlier failed disposable proof attempts were cleaned up when they had no durable dispatch rows.
- One orphan disposable QA auth user from the failed setup attempt was deleted only after verifying no org/profile/workflow rows existed.
- No direct SQL, migration repair, `db pull`, `--include-all`, or npm audit was used during Batch 3 closeout.

Resolution status:

- Code, migrations, regression tests, runtime proof, and active matrix closeout are complete for the Batch 3 target scope.
- `SALE-015`, `DISP-003`, `DISP-007`, `DISP-010`, `DISP-019`, `GOLDEN-B-09`, `DASH-007`, `SIGNOFF-07`, and `SIGNOFF-08` are pass-ready with the evidence above and are documented as pass in the active QA matrix.
- `SIGNOFF-10` remained open at Batch 3 closeout because Batch 3 only supplied partial dispatch/package/receipt runtime evidence. The missing release/Sentry proof is closed later by Batch 8C.

## Batch 4 - Commercials Receivables Payments Correctness

Date/time: 2026-06-28 18:39 IST. Documentation closeout after `main` was fast-forwarded to implementation commit `d2a464c6f9c3caa470d1fa3bf530333faa2e0d4c`.

Scope:

- `COMM-002`
- `COMM-010`
- `COMM-012`
- `COMM-014`
- `COMM-016`
- `SIGNOFF-06`
- `SIGNOFF-09`

Partial evidence only, not promoted by Batch 4:

- `SIGNOFF-10` remained open for release/Sentry/source-map proof at this closeout and is closed later by Batch 8C.
- `STOCK-017` received Commercials refresh/second-session evidence only during Batch 4; stock-board stale refresh remained open until Batch 5.
- `STOCK-016` remained open for movement history pagination beyond 500 rows until Batch 5.
- `GOLDEN-A-19` and `GOLDEN-A-20` remained blocked at Batch 4 closeout because the order-linked Golden A payment/receivable chain had not been rerun. They were closed later by Batch 6.
- `TIME-002` remains open for non-Commercials date-only surfaces.
- `OFF-009` remains open for unknown-timeout UX beyond the commercial payment idempotency proof.

Invariant:

Sales, receivables, payments, and profit are derived from stored sale snapshots. Each sale creates exactly one receivable when required, payment collection reduces outstanding exactly once, duplicate submits do not duplicate sale or payment rows, overpayment is blocked, due buckets are Asia/Kolkata date-only, and Factory Today/signoff cannot falsely clear while commercial receivables remain unresolved.

Implementation status:

- Added migration `20260628121903_batch_4_commercials_receivables_payments.sql`.
- Disabled the direct `create_market_run_sale` RPC path so it cannot bypass receivable creation.
- Added commercial payment idempotency with `commercial_payment_receipts.idempotency_key` and a unique org/key index.
- Replaced `record_commercial_payment_v1` with a row-locking, overpayment-blocking, cheque-metadata-validating, idempotent RPC.
- Recreated `commercial_profit_entries` with authoritative `stock_source_type`, `stock_market_run_id`, and `stock_order_id` fields.
- Added Asia/Kolkata due-bucket helpers for Commercials.
- Updated owner Commercials UI/actions for cheque metadata, payment history detail, source filters, Top Parties last-sale/overdue, and refresh-stable totals.
- Added Factory Today commercial blockers for due/overdue receivables and payment mismatches.
- Blocked the estimator direct market-run sale action with the same unsupported-path message.

Migrations applied/aligned:

- `20260628121903 | 20260628121903`

Runtime QA status:

- Fresh disposable QA runtime proof passed on run `BATCH4QA-20260628125203` using factory `BATCH4QA-20260628125203 Factory`.
- Duplicate stock-sale submit returned the same sale and receivable and left exactly one sale row for the idempotency key.
- Sale path created exactly one `commercial_receivable` and preserved the Batch 3 dispatch-created receivable link.
- Direct market-run sale RPC returned the disabled-path message and did not create sale/invoice/receivable state.
- Partial cheque payment of Rs. 1,200 left received Rs. 1,200 and balance Rs. 3,800.
- Duplicate partial payment submit left exactly one receipt row.
- Full bank payment of Rs. 3,800 closed the receivable with received Rs. 5,000 and balance Rs. 0.
- Duplicate full payment submit did not duplicate payment rows.
- Overpayment returned `Payment amount exceeds remaining balance`.
- Payment history contained two receipts with `REF-FULL`, `REF-PARTIAL`, `Cheque CHQ125203`, cheque date `28 Jun 2026`, and `Batch 4 QA Bank`.
- Due-bucket proof on 2026-06-28 Asia/Kolkata produced one due-today receivable, one overdue receivable, two future receivables, and one paid receivable.
- Profit read model returned five realized stock-sale rows with authoritative manual stock source fields.
- Top Parties source facts showed Party Mills last sale `28 Jun 2026`, outstanding Rs. 5,020, overdue Rs. 1,600, and four recent rows versus five all-time rows.
- Factory Today rendered the Commercials blocker with two receivables needing review: Rs. 1,600 overdue and Rs. 1,320 due today.
- Commercials reload and second-tab session reconciled totals: outstanding Rs. 7,020, collected Rs. 5,000, overdue Rs. 1,600, Sales (5), Parties (2), Profit Ledger (5).
- Browser proof for Commercials, payment history, Profit Ledger, refresh, second tab, and Factory Today had no console errors.

Verification commands:

- `npx vitest run __tests__/p1-commercial-payments.test.ts __tests__/commercials-read-model.test.ts __tests__/p2-commercials-receivables-payments.test.ts` -> passed, 3 files, 32 tests.
- `npx vitest run __tests__/p1-party-first-stock-sale-dispatch.test.ts __tests__/p2-dispatch-sale-receipt.test.ts __tests__/p1-production-dispatch-regressions.test.ts __tests__/p1-stock-source-validation.test.ts __tests__/p0-atomicity.test.ts` -> passed, 5 files, 37 tests.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for Batch 4 touched files -> passed.
- `git diff --check` -> passed.
- `npx vitest run` -> passed, 35 files, 313 passed, 1 skipped.

Data safety:

- Runtime proof used a fresh disposable QA tenant/run.
- Disposable setup mutations were scoped to the `BATCH4QA-20260628125203` org only.
- No direct SQL, migration repair, `db pull`, `--include-all`, npm audit, payroll/kharchi work, lockfile work, Sentry work, or release-gate work was used for Batch 4.

Resolution status:

- Code, migration, regression tests, runtime proof, browser proof, and active matrix closeout are complete for the Batch 4 target scope.
- `COMM-002`, `COMM-010`, `COMM-012`, `COMM-014`, `COMM-016`, `SIGNOFF-06`, and `SIGNOFF-09` are pass-ready with the evidence above and are documented as pass in the active QA matrix.
- `GOLDEN-A-19` and `GOLDEN-A-20` remained open at Batch 4 closeout and were closed later by Batch 6. `SIGNOFF-10` remained open at Batch 4 closeout and is closed later by Batch 8C. `TIME-002` and `OFF-009` remain open or partial evidence only as listed above.

## Batch 5 - Stock Audit Pagination And Sale-Only Refresh

Date/time: 2026-06-28 23:07 IST. Documentation closeout after `main` was fast-forwarded to implementation commit `46ad361fa03d3fb9d561c639e5e3ed6424cb8e03`.

Scope:

- `STOCK-016`
- `STOCK-017`

Explicitly not promoted by Batch 5:

- `GOLDEN-A-19` and `GOLDEN-A-20` remained blocked at Batch 5 closeout because the order-linked Golden A payment/receivable chain had not been rerun. They were closed later by Batch 6.
- `SIGNOFF-10` remained open for release/Sentry/source-map proof at this closeout and is closed later by Batch 8C.
- `TIME-002` remains open for non-Commercials date-only surfaces.
- `OFF-009` remains open for unknown-timeout UX and status reconciliation across high-value mutations.

Invariant:

Stock movement history must be complete, paginated, deterministic, and auditable. Stock after sale-only, dispatch, payment, and refresh paths must reconcile to committed server state, and a second session must not show stale stock values.

Implementation status:

- Added cursor-based stock movement pagination with deterministic `created_at desc, id desc` ordering and page size guardrails.
- Reduced the stock board's initial recent movement load to an explicit recent-history summary while adding a dedicated `getTakaStockMovements` server action for older pages.
- Updated Godown Stock lot entries to lazy-load movement pages, append unique movement rows, show loading/error states, and expose an explicit "Load older entries" action.
- Changed stock sale callback handling so sale-only success with no `dispatchId` closes the dialog and refreshes the stock page instead of skipping the success callback.
- Added focused Batch 5 regression tests and a disposable QA proof script.

Migrations:

- No migration was required.
- No Supabase db push, repair, db pull, direct SQL, or `--include-all` command was run for Batch 5.

Runtime QA status:

- Disposable QA proof passed with artifact `output/qa/batch5/BATCH5-20260628173243-stock-audit-refresh.json`.
- 506 stock movements were retrieved as pages of 100, 100, 100, 100, 100, and 6 rows.
- Movement pagination had no duplicate rows and preserved deterministic newest-to-oldest ordering.
- Sale-only stock sale returned no dispatch id, returned 25m pending dispatch, and refreshed committed stock to 75m available / 25m pending.
- The sale created exactly one stock sale movement and one receivable.
- A second owner session matched the committed stock state: 75m available, 25m pending, and one receivable.
- Disposable cleanup completed with no cleanup errors.

Verification commands:

- `npm run lint -- app/(dashboard)/owner/stock/actions.ts app/(dashboard)/owner/stock/TakaStockClient.tsx components/dispatches/SellAndDispatchDialog.tsx lib/stock-movement-pagination.ts __tests__/p2-stock-audit-refresh.test.ts scripts/qa/batch5-stock-audit-refresh-probe.mjs` -> passed.
- `npx tsc --noEmit` -> passed.
- `npx vitest run __tests__/p2-stock-audit-refresh.test.ts` -> passed, 1 file, 4 tests.
- Batch 2/3/4 stock, dispatch, and commercials regression pack -> passed, 10 files, 85 tests.
- `npx vitest run` -> passed, 36 files, 317 passed, 1 skipped.
- `git diff --check` -> passed.
- After fast-forwarding `main`, `npx vitest run __tests__/p2-stock-audit-refresh.test.ts`, `npx tsc --noEmit`, and `npx vitest run` passed again.

Data safety:

- Runtime proof used a fresh disposable QA tenant/run.
- Disposable setup mutations were scoped to the Batch 5 QA organization only.
- The proof artifact stores redacted ids only and records cleanup completion.
- No migration, direct SQL, migration repair, `db pull`, `--include-all`, npm audit, payroll/kharchi work, Sentry work, release-gate work, or lockfile work was used for Batch 5.

Resolution status:

- Code, regression tests, runtime proof, and active matrix closeout are complete for the Batch 5 target scope.
- `STOCK-016` and `STOCK-017` are pass-ready with the evidence above and are documented as pass in the active QA matrix.
- `GOLDEN-A-19` and `GOLDEN-A-20` remained open at Batch 5 closeout and were closed later by Batch 6. `SIGNOFF-10` remained open at Batch 5 closeout and is closed later by Batch 8C. `TIME-002` and `OFF-009` remain open or partial evidence only and are not closed by Batch 5.

## Batch 6 - Golden A Runtime Closure

Date/time: 2026-06-29 00:36 IST. Documentation closeout after `main` was fast-forwarded to implementation commit `80e8f8c6ae1318207b0c5b1f45e98c3cfe524f67`.

Scope:

- `GOLDEN-A-13`
- `GOLDEN-A-15`
- `GOLDEN-A-16`
- `GOLDEN-A-17`
- `GOLDEN-A-18`
- `GOLDEN-A-19`
- `GOLDEN-A-20`
- `GOLDEN-A-24`

Explicitly not promoted by Batch 6:

- `GOLDEN-A-21`, `GOLDEN-A-22`, and `GOLDEN-A-23` remain open for worker advance, payroll settlement, payslip, and settled-production correction proof.
- `SIGNOFF-10` remained open for release/Sentry/source-map proof at this closeout and is closed later by Batch 8C.
- `TIME-002` remains open for broader date-only rendering surfaces.
- `OFF-009` remains open for unknown-timeout UX and status reconciliation across high-value mutations.
- `SIGNOFF-01`, `SIGNOFF-02`, `SIGNOFF-04`, `TECH-011`, and `TECH-012` remain open/out of scope.

Invariant:

Golden A customer-order runtime proof must reconcile production correction, generated order stock, completed-order sale/dispatch, exact and shortage receipts, actionable discrepancy/claim state, receivable/payment closeout, second-session refresh, Factory Today source blockers, and final order archive/unlink behavior from the same authoritative rows.

Implementation status:

- Added migration `20260628183500_batch_6_allow_completed_order_stock_dispatch.sql`.
- Added migration `20260628185344_batch_6_qualify_completed_order_dispatch_returning.sql`.
- Updated the stock dispatch RPC contract so valid active or completed customer orders can dispatch order-linked sold stock while cancelled or invalid orders remain blocked.
- Qualified the dispatch insert `RETURNING` fields to avoid ambiguous `dispatch_number` runtime errors.
- Added focused regression coverage in `__tests__/p2-golden-a-completed-order-dispatch.test.ts`.
- Added disposable Golden A runtime proof script `scripts/qa/batch6-golden-a-runtime-proof.mjs`.

Migrations applied/aligned before docs closeout:

- `20260628183500_batch_6_allow_completed_order_stock_dispatch.sql`
- `20260628185344_batch_6_qualify_completed_order_dispatch_returning.sql`

Runtime QA status:

- Disposable QA proof passed with artifact `output/qa/batch6/BATCH6-20260628185811-golden-a-runtime-proof.json`.
- The proof completed 26 assertions and cleanup completed.
- Production correction moved the Golden A order from 230.75m to 235.75m, proving the exact +5m delta and generated order-linked stock reconciliation.
- The order auto-completed at the target and still allowed valid order-linked stock sale/dispatch.
- The proof sold 120m of order-linked stock on credit for Rs. 7,200.
- The first 70m dispatch was received exactly and closed with no discrepancy.
- The second 50m dispatch was received as 45m, leaving one 5m shortage discrepancy and one open party claim.
- Partial payment Rs. 2,200 and final payment Rs. 5,000 closed the receivable to zero with two receipt records.
- First and second owner sessions matched committed receivable/payment state.
- Factory Today source reconciliation showed no pending dispatch, no in-transit receipt, no receivable balance, and one unresolved deliberate shortage discrepancy.
- The completed order archived cleanly and associated machines were unlinked/inactive.

Verification commands:

- `npx vitest run __tests__/p2-golden-a-completed-order-dispatch.test.ts` -> passed, 1 file, 1 test.
- Batch 2/3/4/5 guard regression pack -> passed, 11 files, 86 tests.
- `npx vitest run` -> passed, 37 files, 318 passed, 1 skipped.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for Batch 6 touched files -> passed before implementation commit.
- `git diff --check` and `git diff --cached --check` -> passed.

Data safety:

- Runtime proof used a fresh disposable QA tenant/run.
- Disposable setup mutations were scoped to the Batch 6 QA organization only.
- Proof artifacts store redacted ids and record cleanup completion.
- No Supabase command, migration push/repair/pull, direct SQL, `--include-all`, npm audit, payroll/kharchi work, Sentry work, release-gate work, or lockfile work was used during documentation closeout.

Resolution status:

- Code, migrations, regression tests, runtime proof, and active matrix closeout are complete for the Batch 6 target scope.
- `GOLDEN-A-13`, `GOLDEN-A-15`, `GOLDEN-A-16`, `GOLDEN-A-17`, `GOLDEN-A-18`, `GOLDEN-A-19`, `GOLDEN-A-20`, and `GOLDEN-A-24` are pass-ready with the evidence above and are documented as pass in the active QA matrix.
- `GOLDEN-A-21`, `GOLDEN-A-22`, `GOLDEN-A-23`, `TIME-002`, `OFF-009`, `SIGNOFF-01`, `SIGNOFF-02`, `SIGNOFF-04`, `TECH-011`, and `TECH-012` remain open or partial evidence only and are not closed by Batch 6. `SIGNOFF-10` remained partial at Batch 6 closeout and is closed later by Batch 8C.

## Batch 7 - Release Runtime Date Hardening Partial Closeout

Date/time: 2026-06-29 14:42 IST. Documentation closeout after `main` was fast-forwarded to implementation commit `ff44f46643400c93fea79f361b1911f992be3d5c`.

Scope:

- `TIME-002`
- `TECH-013`

Partial source hardening not promoted by Batch 7:

- `TECH-009` has WhatsApp webhook fail-closed source hardening, but deployed/runtime webhook proof remains unavailable.
- `SEC-011` has Sentry redaction/source hardening, but live Sentry payload inspection remains unavailable.

Explicitly not promoted by Batch 7:

- At Batch 7 closeout, `SIGNOFF-10`, `TECH-007`, `TECH-009`, `TECH-010`, `TECH-011`, `TECH-012`, and `SEC-011` were blocked or partial evidence only because external deployed, Sentry/source-map, restore, rollback, and production migration evidence was unavailable.
- `OFF-009`, `SIGNOFF-01`, `SIGNOFF-02`, `SIGNOFF-04`, `GOLDEN-A-21`, `GOLDEN-A-22`, and `GOLDEN-A-23` remain out of scope.

Invariant:

Date-only business values must remain date-only and render to the same calendar day across UTC, Asia/Kolkata, and America/Los_Angeles. The source-controlled release command must be repeatable and must not let a production build accidentally omit Vitest.

Implementation status:

- Added reusable date-only rendering helpers in `lib/format.ts` and used them across the affected owner inventory, orders, dispatch, archive, market-run, Factory Today, analytics, and payslip display paths.
- Preserved timestamp/datetime formatting outside the date-only surfaces.
- Added `__tests__/date-only-format.test.ts` to prove the same date-only value renders consistently under UTC, Asia/Kolkata, and America/Los_Angeles.
- Added a source-level release gate by defining `test: vitest run` and `prebuild: npm run test` in `package.json`.
- Added `__tests__/release-runtime-config.test.ts` and `scripts/qa/batch7-release-runtime-evidence.mjs`.
- Added Sentry redaction/source hardening and WhatsApp webhook source hardening, but those rows are not promoted without live deployed evidence.

Migration status:

- No migration was needed.

Runtime and release evidence:

- Evidence artifacts were committed at `output/qa/batch7/BATCH7-20260628194456-release-runtime-evidence.json` and `output/qa/batch7/BATCH7-20260628194456-local-verification-summary.json`.
- `npm run build` passed and proved the `prebuild` Vitest gate runs before build.
- Local production smoke on port 3107 returned 200 for `/login`, `/privacy`, and `/manifest.webmanifest`, with no server errors observed.
- No deployed Sentry/source-map event, live Sentry payload inspection, restore exercise, rollback exercise, or production deployment-provider proof was available.

Verification commands:

- Focused Batch 7 Vitest: 9 passed.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for touched files -> passed.
- `git diff --check` and `git diff --cached --check` -> passed.
- Full `npx vitest run` -> passed, 327 passed and 1 skipped.
- `npm run build` -> passed with the prebuild Vitest gate.

Data safety:

- No Supabase command, migration push/repair/pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, production/customer data mutation, Sentry deployment, restore/rollback exercise, OFF-009 work, payroll/kharchi work, or broad Golden A work was used.

Resolution status:

- `TIME-002` and `TECH-013` are pass-ready with the evidence above and are documented as pass in the active QA matrix.
- At Batch 7 closeout, `SIGNOFF-10`, `TECH-007`, `TECH-009`, `TECH-010`, `TECH-011`, `TECH-012`, and `SEC-011` were blocked or partial evidence only.
- `OFF-009`, `SIGNOFF-01`, `SIGNOFF-02`, `SIGNOFF-04`, `GOLDEN-A-21`, `GOLDEN-A-22`, and `GOLDEN-A-23` remain open and out of scope for Batch 7.

## Batch 8 - Release Observability Migration-Head Partial Closeout

Date/time: 2026-06-29 20:12 IST. Documentation closeout after `main` advanced to `fb3d4dd98db398aa8aa33f5b6196fa29e536e5b1`, Batch 8 was reconciled without force-push, and `main` was fast-forwarded to implementation commit `c169a8ccbb3b544d04aa576e0b03877282d49f35`.

Scope:

- `TECH-007`

Partial source hardening not promoted by Batch 8:

- `TECH-009` has source and test evidence for WhatsApp webhook fail-closed behavior, but deployed valid-signature and invalid-signature webhook proof remains unavailable.
- `TECH-010` had Sentry tunnel, auth-token, release, and source-map configuration wiring, but Batch 8 Vercel build logs showed no `SENTRY_AUTH_TOKEN`; no current Sentry release, artifacts, mapped event, or live payload proof existed at Batch 8 closeout.
- `SEC-011` has local Sentry redaction test coverage, but no live Sentry event payload inspection exists.
- `SIGNOFF-10` had local fixes for the pre-patch `/monitoring?...` 403 and CSP `worker-src blob:` deployed smoke failures at Batch 8 closeout, but no clean post-patch deployed browser/server/Sentry proof existed yet. It is closed later by Batch 8C.
- `TECH-011` and `TECH-012` remain blocked because no disposable restore, application rollback, or database forward-fix exercise exists.
- `WA-008` remains open because no deployed valid/invalid WhatsApp callback proof exists.

Invariant:

A pilot build is reproducible, uniquely identified, migrated, tested, observable, backed up, and rollback-ready. The migration-head portion is pass-ready only when local and remote Supabase migration heads are aligned with no pending, failed, or out-of-order migrations.

Implementation status:

- Reconciled Batch 8 on top of `fb3d4dd98db398aa8aa33f5b6196fa29e536e5b1` and preserved the estimator spacing/layout commit.
- `withSentryConfig` now owns the `/monitoring` tunnel route, and the conflicting manual client tunnel `/api/sentry-tunnel` was removed.
- Added narrow CSP `worker-src 'self' blob:;` to address the deployed browser smoke CSP worker failure.
- Added explicit Sentry `authToken`, release name, deploy environment, and widened client file upload configuration from environment.
- Added release/runtime config tests covering Sentry tunnel ownership, CSP worker policy, auth/release config, Sentry redaction, and WhatsApp webhook fail-closed source checks.
- Added Batch 8 evidence collector `scripts/qa/batch8-release-observability-evidence.mjs`.

Migration status:

- No migration was needed.
- Supabase migration list evidence showed local and remote aligned through latest repository migration `20260628185344`, with no pending, failed, or out-of-order migrations.
- No Supabase command, db push, migration repair, db pull, direct SQL, or `--include-all` command was run during reconciliation or docs closeout.

Evidence:

- Evidence artifact committed at `output/qa/batch8/BATCH8-20260629103146-release-observability-evidence.json`.
- Deployed pre-patch smoke showed `/monitoring?...` 403 responses and CSP worker errors because `worker-src` did not allow `blob:`.
- Vercel build logs showed missing `SENTRY_AUTH_TOKEN`; Sentry release creation and source-map upload did not run.
- The Sentry project remained stale/unverified with no current release, source-map artifact, mapped event, or live payload inspection.
- No restore, rollback/forward-fix, or deployed WhatsApp valid/invalid callback proof was available.

Verification commands:

- `npx vitest run __tests__/release-runtime-config.test.ts` -> passed, 1 file, 7 tests.
- `npx tsc --noEmit` -> passed.
- `npm run lint -- __tests__/release-runtime-config.test.ts instrumentation-client.ts next.config.ts scripts/qa/batch8-release-observability-evidence.mjs` -> passed.
- `npx vitest run` -> passed, 39 files, 331 passed, 1 skipped.
- `npm run build` -> passed with the prebuild Vitest gate, 39 files, 331 passed, 1 skipped during prebuild.
- `git diff --check`, `git diff --cached --check`, and post-fast-forward `git diff --check` passed.

Data safety:

- No migration, Supabase mutation, db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, production/customer data mutation, restore exercise, rollback exercise, or external provider mutation was used.
- Sentry auth-token availability is recorded only as a boolean in the evidence artifact; no secret values are printed.

Resolution status:

- `TECH-007` is pass-ready and documented as pass in the active QA matrix.
- At Batch 8 closeout, `TECH-009`, `TECH-010`, `TECH-011`, `TECH-012`, `SEC-011`, and `SIGNOFF-10` were blocked or partial evidence only. `TECH-010` is superseded by Batch 8B evidence below, and `SIGNOFF-10` is superseded by Batch 8C evidence below.
- `WA-008` remains open.
- Batch 8B requires a fresh deployment and external provider proof for Sentry release/source maps, clean deployed browser/server smoke, live Sentry payload redaction, restore, rollback/forward-fix, and deployed WhatsApp valid/invalid callback behavior.

## Batch 8B - Sentry Release Evidence Partial Closeout

Date/time: 2026-06-29 21:32 IST. Implementation commit `d4392808690ca47f7f10f9950c82d02d94621e30` was fast-forwarded into `main` and pushed to `origin/main`.

Scope:

- `TECH-010`

Rows explicitly not closed by Batch 8B:

- `SIGNOFF-10` remained blocked/partial at Batch 8B closeout because fresh deployed `/login` and `/privacy` smoke still showed repeated `/monitoring?...` HTTP 403 console/network errors. It is superseded by Batch 8C evidence below.
- `SEC-011` remains blocked because no live Sentry event payload exists for redaction inspection.
- `TECH-009` remains partial and `WA-008` remains open because no deployed WhatsApp valid-signature and invalid-signature callback proof exists.
- `TECH-011` remains blocked because no disposable restore exercise exists.
- `TECH-012` remains blocked because no rollback/forward-fix exercise exists.

Invariant:

A pilot build is reproducible, uniquely identified, migrated, tested, observable, backed up, and rollback-ready. The Sentry release/source-map portion is pass-ready when the deployed production commit has a matching Sentry release and uploaded source-map artifacts.

Implementation status:

- Removed the stale manual `app/api/sentry-tunnel/route.ts`.
- Removed the stale `/api/sentry-tunnel` public-route exception from `proxy.ts`.
- Updated release/runtime config tests to assert the old manual tunnel route and proxy whitelist remain absent while `withSentryConfig` owns `/monitoring`.
- Added Batch 8B evidence collector `scripts/qa/batch8b-release-evidence-monitoring.mjs`.

Migration status:

- No migration was needed.
- No Supabase command, db push, migration repair, db pull, direct SQL, or `--include-all` command was run.

Evidence:

- Evidence artifact committed at `output/qa/batch8b/BATCH8B-20260629153402-release-evidence-monitoring.json`.
- Fresh production deployment after adding `SENTRY_AUTH_TOKEN` completed successfully; Vercel build completed in 3m 38s with no observed build errors.
- Build-log searches for `No auth token provided`, `not create release`, and `upload source maps` returned no old skipped-release/source-map warnings.
- Sentry release `2538da25b2fa` exists for project `vastra/javascript-nextjs`, deploy environment `production`, and matches the deployed commit prefix.
- Sentry source maps/artifacts are visible with 529 artifacts.
- Sentry release showed 0 issues, 0 errors, and 0 transactions at inspection time.
- No mapped event exists, so mapped-stack proof remains unavailable.
- No live Sentry event payload exists, so secrets-in-Sentry redaction inspection remains unavailable.
- Fresh deployed `/login` and `/privacy` browser smoke loaded visually and no longer showed the CSP `worker-src blob:` error, but `/monitoring?...` still returned HTTP 403.
- `/monitoring` 403 is classified as likely external Sentry client key / allowed domains / DSN / project configuration evidence debt after the Next/Sentry tunnel rewrite, not as a repo auth/proxy block.

Verification commands:

- `npx vitest run __tests__/release-runtime-config.test.ts` -> passed, 1 file, 7 tests.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for touched runtime/evidence files -> passed.
- `npx vitest run` -> passed, 39 files, 331 passed, 1 skipped.
- `npm run build` -> passed with the prebuild Vitest gate.
- `git diff --check` and `git diff --cached --check` passed.

Data safety:

- No migration, Supabase mutation, db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, production/customer data mutation, restore exercise, rollback exercise, or external provider mutation was used.
- Raw Sentry DSN and token values were not printed; the evidence artifact records only non-secret DSN shape and token availability booleans.

Resolution status:

- `TECH-010` is pass-ready and documented as pass in the active QA matrix.
- At Batch 8B closeout, `TECH-009`, `TECH-011`, `TECH-012`, `SEC-011`, and `SIGNOFF-10` remained blocked or partial evidence only. `SIGNOFF-10` is superseded by Batch 8C evidence below.
- `WA-008` remains open.
- Next follow-up requires external Sentry client key, allowed domains, DSN, and project checks for the `/monitoring` 403, followed by fresh deployed smoke after any provider/config fix.

## Batch 8C - Clean Deployed Signoff Evidence Closeout

Date/time: 2026-06-30 00:16 IST. Source commit `7c6449a590617bf0b84811bc71462843a559e34e`.

Scope:

- `SIGNOFF-10`

Rows explicitly not closed by Batch 8C:

- `SEC-011` remains blocked because no live Sentry event payload exists for redaction inspection.
- `TECH-009` remains partial and `WA-008` remains open because no deployed WhatsApp valid-signature and invalid-signature callback proof exists.
- `TECH-011` remains blocked because no disposable restore exercise exists.
- `TECH-012` remains blocked because no rollback/forward-fix exercise exists.

Evidence:

- Evidence artifact committed at `output/qa/batch8c/BATCH8C-20260629184639-clean-deployed-smoke-after-dsn.json`.
- Vercel `NEXT_PUBLIC_SENTRY_DSN` was updated to the current `javascript-nextjs` Sentry project DSN and redeployed; the raw DSN value was not copied into repo or Codex.
- Fresh deployed `/login` and `/privacy` browser smoke loaded visually.
- `/monitoring?...` 403 browser errors were gone.
- The CSP `worker-src blob:` browser error was gone.
- No blocking browser console errors were visible; only non-blocking `.woff2` preload warnings remained.
- Vercel production runtime/server logs for deployment `dpl_54VCavyUikrAETiiuZzt7MAW8Kpg` showed Warning 0, Error 0, and Fatal 0 during the smoke window.
- Relevant route requests returned 200 or cache 304 responses; `_offline` returned redirect 307; no 5xx responses or server exceptions were observed.
- Sentry project `vastra/javascript-nextjs` production release `7c6449a59061` showed 100% crash-free sessions, 0 crashes, 0 new issues, 0 handled issues, 0 unhandled issues, 1K source-map artifacts, and "No new issues in this release."
- No Sentry event payload, cookies, auth headers, request bodies, tokens, service keys, or secrets were copied.

Verification commands:

- `jq empty output/qa/batch8c/BATCH8C-20260629184639-clean-deployed-smoke-after-dsn.json` -> passed.
- `git diff --check` -> passed.
- `git diff --cached --check` -> passed.

Data safety:

- No Supabase command, db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, product code change, restore exercise, rollback exercise, or WhatsApp webhook proof was used.

Resolution status:

- `SIGNOFF-10` is pass-ready and documented as pass in the active QA matrix.
- `SEC-011`, `TECH-009`, `TECH-011`, `TECH-012`, and `WA-008` remain open, blocked, or partial as listed above.

## Batch 9 - Offline Cache Truth Closeout

Date/time: 2026-06-30 15:15 IST. Source base `origin/main` at `bb02aaaa95616b2c6be8ac515c5cf76c23b8135a`.

Scope:

- `OFF-002`
- `OFF-005`
- `OFF-006`
- `OFF-008`
- `SEC-016`
- `PAY-028`

Rows explicitly not closed by Batch 9:

- `OFF-007` remains partial/open because production service-worker update proof with an active draft was not captured.
- `OFF-010` remains partial/open because throttled slow/intermittent-network runtime proof across core mobile screens was not captured.
- `OFF-009` remains open and out of scope for unknown-timeout UX and status reconciliation.
- `SEC-011`, `TECH-009`, `TECH-011`, `TECH-012`, `WA-008`, `WA-010`, billing/external evidence rows, restore/rollback rows, Sentry live payload rows, WhatsApp rows, and production/order/payroll rows outside the approved Batch 9 scope remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch9/BATCH9-offline-cache-truth-proof.json`.
- `OFF-002`: `/offline` and `/_offline` are public/proven, `/_offline` rewrites to `/offline`, both routes return 200 locally, and the rendered offline page states that production, kharchi, payroll, sale, dispatch, and payment writes require internet instead of showing a login fallback.
- `OFF-005`: auth-boundary cleanup covers login, the PWA session guard, and logout. Logout prevents the first submit, clears the in-memory QueryClient, awaits `clearClientSessionState()`, catches cleanup errors, then uses a guarded `requestSubmit()` so server logout still runs after client cleanup.
- `OFF-006`: `clearClientSessionState()` removes user-specific localStorage keys, clears sessionStorage, and awaits the Dexie offline mutation queue clear through `clearOfflineMutationQueue()`.
- `OFF-008` and `PAY-028`: offline kharchi is truthfully online-only. The dialog disables offline cash entry, the old `kharchi_offline` queue path is removed, and unsupported queued mutations are discarded with explicit error copy instead of replayed or reported as synced.
- `SEC-016`: privacy, FAQ, and offline banner copy no longer claim unsupported offline write sync. Privacy copy now describes cached screens, local drafts, PWA assets, logout cleanup, and online-only production/kharchi/payroll/sale/dispatch/payment writes.
- Sentry `/monitoring` remains excluded in the proxy matcher; dashboard/auth gating is unchanged except for public `/offline` and `/_offline`.

Verification commands:

- `git diff --check` -> passed.
- `jq empty output/qa/batch9/BATCH9-offline-cache-truth-proof.json` -> passed.
- Targeted `npx eslint app/\(auth\)/login/login-form.tsx components/auth/logout-button.tsx hooks/use-pwa-session-guard.ts lib/client-storage-cleanup.ts app/offline/page.tsx next.config.ts proxy.ts components/supervisor/KharchiDialog.tsx hooks/use-offline-sync.ts app/privacy/page.tsx components/landing/faq.tsx components/offline-sync-provider.tsx components/pwa-update-notice.tsx components/providers.tsx __tests__/batch9-offline-cache-truth.test.ts` -> passed.
- `npx vitest run __tests__/batch9-offline-cache-truth.test.ts` -> passed, 1 test file and 8 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npm run build` -> passed. Prebuild full Vitest passed with 40 test files, 339 tests passed, and 1 skipped; Next production build completed successfully and generated `/offline` as a static route with PWA document fallback `/_offline`.

Data safety:

- No migration was needed.
- No Supabase command, db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, production/customer data mutation, Sentry deployment, restore/rollback exercise, OFF-009 work, or broad payroll/product hardening outside the approved offline truth scope was used.

Resolution status:

- `OFF-002`, `OFF-005`, `OFF-006`, `OFF-008`, `SEC-016`, and `PAY-028` are pass-ready and documented as pass in the active QA matrix.
- `OFF-007`, `OFF-010`, and `OFF-009` remain open or partial as listed above.

## Batch 10 - Estimator Quote Order Snapshot Closeout

Date/time: 2026-06-30 16:45 IST. Source base `origin/main` at `2ada670d32efeacdb39cc5827fcbd33cc626022d`.

Scope:

- `EST-003`
- `EST-019`
- `ORDER-001`
- `ORDER-002`
- `QUOTE-010`
- Secondary same-root row: `QUOTE-003`

Rows explicitly not closed by Batch 10:

- `EST-011` remains open because server-boundary validation for negative/extreme estimator rows and empty row arrays is a distinct validation root.
- `QUOTE-007` remains open because Start Party Order accepted-quote/order atomicity is a distinct transaction/idempotency root.
- `ORDER-006` remains open because target/deadline audit rows and target >= produced-meter enforcement are a distinct order edit/audit root.
- `ORDER-008` remains open because below-target completion confirmation and runtime proof are a distinct order completion root.
- Production/order boundary rows, payroll/kharchi rows, offline/cache rows, Sentry/WhatsApp/restore/rollback/billing external-evidence rows, `OFF-009`, `ORDER-005`, `ORDER-009`, `PROD-011`, `PROD-002`, `PROD-004`, `SIGNOFF-01`, and `SIGNOFF-02` remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch10/BATCH10-estimator-quote-order-snapshots-proof.json`.
- `EST-003`: Decimal-backed `calcWorkerRateSnapshot` and `normalizeCurrencySnapshot` preserve the two-decimal user-facing worker wage and cover the `2.5020000000000002` -> `2.50` regression case without changing estimator cost formulas.
- `EST-019`: estimator quote save, Start Party Order, and market-run quote/order writes all store normalized `worker_rate_per_m`; commercial formulas and read models were not intentionally changed.
- `ORDER-001`: new accepted quotes persist normalized worker-rate snapshots, and the existing `convert_accepted_quote_to_order` RPC copies `estimator_quotes.worker_rate_per_m` into `orders.worker_rate_per_m`.
- `ORDER-002`: supervisor-visible worker rate is sourced from the order snapshot; assignment and supervisor production logic were not changed.
- `QUOTE-010`: quote restore now parses the same autosave key used by the estimator, warns before replacing a different recoverable draft, offers Keep draft and Overwrite draft choices, and does not block same-quote restore.
- `QUOTE-003`: `updateQuoteStatus` no longer performs a silent `draft -> sent -> accepted` shortcut; the server enforces `draft -> sent` and `sent -> accepted/rejected`, and Quote History exposes only those valid actions.
- `app/(dashboard)/owner/estimator/EstimatorClient.tsx` change is intentional and narrow: the market-run worker-rate client value now uses `calcWorkerRateSnapshot(...)`, matching normalized server write paths.

Verification commands:

- `git diff --check` -> passed.
- `jq empty output/qa/batch10/BATCH10-estimator-quote-order-snapshots-proof.json` -> passed.
- Targeted `npx eslint __tests__/estimator.test.ts app/\(dashboard\)/owner/estimator/EstimatorClient.tsx app/\(dashboard\)/owner/estimator/actions.ts app/\(dashboard\)/owner/quotes/QuotesClient.tsx hooks/useAutosave.ts lib/estimator.ts __tests__/batch10-estimator-quote-order-snapshots.test.ts lib/estimator-drafts.ts` -> passed.
- `npx vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts` -> passed, 2 test files and 33 tests.
- `npx vitest run __tests__/batch10-estimator-quote-order-snapshots.test.ts` -> passed, 1 test file and 4 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npm run build` -> passed on review rerun. Prebuild full Vitest passed with 41 test files, 345 tests passed, and 1 skipped; Next compiled successfully in 4.0 minutes, TypeScript finished after 5.2 minutes, static page generation completed for 40 pages, and the command exited 0.

Data safety:

- No migration was needed.
- No Supabase command, db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, production/customer data mutation, production/stock/dispatch/commercial/payroll hardening, or docs work outside the approved Batch 10 scope was used.

Resolution status:

- `EST-003`, `EST-019`, `ORDER-001`, `ORDER-002`, `QUOTE-010`, and `QUOTE-003` are pass-ready and documented as pass in the active QA matrix.
- At Batch 10 closeout, `EST-011`, `QUOTE-007`, `ORDER-006`, and `ORDER-008` remained open as listed above.

## Batch 11 - Estimator Order Lifecycle Closeout

Date/time: 2026-06-30 20:05 IST. Source base `2ecf27c6b0619dec201395c4cc0c52ca9c11ff8c`.

Scope:

- `EST-011`
- `ORDER-006`

Rows explicitly not closed by Batch 11:

- `QUOTE-007` remains open because strict Start Party Order accepted-quote plus active-order atomicity requires combined database/RPC transaction work.
- `ORDER-008` remains open/partial because the server guard and confirmation UI are source-fixed and tested, but runtime/browser proof with disposable below-target order data was not collected.
- `ORDER-005`, `ORDER-009`, `PROD-011`, `PROD-002`, `PROD-004`, `SIGNOFF-01`, `SIGNOFF-02`, payroll/kharchi rows, offline/cache rows already handled by Batch 9, external-evidence rows, `OFF-009`, and other unapproved rows remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch11/BATCH11-estimator-order-lifecycle-proof.json`.
- `EST-011`: `lib/estimator-validation.ts` adds server-boundary validation for empty warp/weft arrays, zero or negative required fields, non-finite numbers, and extreme yarn/width/rate values.
- `EST-011`: estimator validation is called before `estimator_quotes` persistence in Save Quote, Start Party Order, and market-run creation paths.
- `ORDER-006`: `updateOrderDetails` rejects invalid deadlines and target meters below already-produced meters before the order update.
- `ORDER-006`: existing `audit_orders` trigger evidence covers old/new target/deadline history without schema work.
- `ORDER-008`: `updateOrderStatus` now requires explicit confirmation for below-target or pending-dispatch completion, and `OrdersClient` uses one shared completion confirmation UI from card and drawer paths. This is not closed without runtime/browser proof.
- `QUOTE-007`: no migration/RPC change was made; strict atomicity remains out of scope for Batch 11.

Verification commands:

- `git diff --check` -> passed.
- `jq empty output/qa/batch11/BATCH11-estimator-order-lifecycle-proof.json` -> passed.
- Targeted `npx eslint lib/estimator-validation.ts app/\(dashboard\)/owner/estimator/actions.ts app/\(dashboard\)/owner/orders/actions.ts app/\(dashboard\)/owner/orders/OrdersClient.tsx __tests__/batch11-estimator-order-lifecycle.test.ts` -> passed.
- `npx vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts` -> passed, 2 test files and 33 tests.
- `npx vitest run __tests__/batch11-estimator-order-lifecycle.test.ts` -> passed, 1 test file and 6 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npm run build` -> passed. Prebuild Vitest passed with 42 test files, 351 tests passed, and 1 skipped; Next compiled successfully, static page generation completed for 40 pages, and the command exited 0.

Data safety:

- No migration was needed or created.
- No Supabase command, db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, production/customer data mutation, staging, commit, push, or docs work outside the approved Batch 11 scope was used during implementation/review.
- Docs closeout force-adds only the ignored Batch 11 proof artifact and stages only the approved Batch 11 implementation, docs, matrix, and proof files.

Resolution status:

- `EST-011` and `ORDER-006` are pass-ready and documented as pass in the active QA matrix.
- `ORDER-008` is documented as `code_verified`/open-partial pending runtime/browser proof.
- `QUOTE-007` remains fail/open pending database/RPC transaction work.

## Batch 12 - Code-Verified Proof Sweep Closeout

Date/time: 2026-06-30 20:29 IST. Source base `9b21acd2334cd4048fc999acb3d102926581540e`.

Scope:

- `STOCK-012`
- `DISP-013`

Rows explicitly not closed by Batch 12:

- `ORDER-008` remains `code_verified` because Batch 11 source/test evidence still lacks disposable runtime/browser proof for below-target, pending-dispatch, and normal completion paths.
- `GOLDEN-B-12` remains blocked because the active row requires a full Golden B second-batch exact receipt rerun; Batch 3 exact-receipt proof is analogous only.
- `STOCK-011`, `STOCK-013`, `MARKET-009`, and `MARKET-010` remain `code_verified` because Batch 12 safe tests did not fully satisfy their exact row wording.
- External/provider, restore/rollback, Sentry live-event, WhatsApp deployed-callback, billing-provider, and unapproved rows remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch12/BATCH12-code-verified-proof-sweep.json`.
- `STOCK-012`: `npx vitest run __tests__/p1-stock-lifecycle.test.ts` passed 10 tests and directly proved closed/sold-out market-run lots with zero available/reserved/pending meters and no discrepancy are non-actionable/archive-eligible.
- `DISP-013`: `npx vitest run __tests__/dispatch-archive.test.ts` passed 7 tests and directly proved fully dispatched and confirmed groups archive, while incomplete, unconfirmed, disputed, discrepancy, or e-way-gap groups remain active.

Verification commands:

- `git status --short` -> clean before docs closeout.
- `git diff --check` -> passed before docs closeout.
- `jq empty output/qa/batch12/BATCH12-code-verified-proof-sweep.json` -> passed.
- `npx vitest run __tests__/p1-stock-lifecycle.test.ts` -> passed, 1 test file and 10 tests.
- `npx vitest run __tests__/dispatch-archive.test.ts` -> passed, 1 test file and 7 tests.

Data safety:

- No product code, migration, schema, RPC, Supabase command, db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, production data mutation, or external provider proof was used.
- Docs closeout force-adds only the ignored Batch 12 proof artifact and stages only the approved Batch 12 docs, matrix, and proof files.

Resolution status:

- `STOCK-012` and `DISP-013` are pass-ready and documented as pass in the active QA matrix.
- `ORDER-008`, `GOLDEN-B-12`, `STOCK-011`, `STOCK-013`, `MARKET-009`, and `MARKET-010` remain unchanged/open as listed above.

## Batch 13 - Targeted Code-Verified Proof Sweep Closeout

Date/time: 2026-07-01 03:02 IST. Source base `origin/main` at `40fca35170b5127e6a37eb43f8238f0bf99816fa`.

Scope:

- `EST-001`
- `EST-005`
- `EST-012`

Rows explicitly not closed by Batch 13:

- `EST-004` remains `code_verified` because the width helper proof passed, but it did not directly prove persisted estimator/quote width value.
- `SETUP-001` and `SETUP-002` remain `code_verified` because workflow visibility helper proof passed, but completed-onboarding browser navigation persistence was not directly proven.
- `BILL-002`, `PAY-017`, `TIME-003`, and `TIME-004` remain `code_verified` because their exact row wording still needs stronger proof than the inspected local/static evidence.
- `ORDER-008`, `GOLDEN-B-12`, `QUOTE-007`, `SEC-011`, `TECH-009`, `WA-008`, `TECH-011`, `TECH-012`, `OFF-007`, `OFF-010`, `STOCK-011`, `STOCK-013`, `MARKET-009`, `MARKET-010`, external/provider, restore/rollback, Sentry live-event, WhatsApp deployed-callback, billing-provider, and unapproved rows remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch13/BATCH13-code-verified-proof-sweep.json`.
- `EST-001`: focused local estimator proof directly covers representative single warp/weft cost-stack fixtures through `calcFullTotals` and `calcOrderQuote`, including yarn kg/cost, weave cost, warping/sizing, overhead, total/landed cost, quote price, and gross profit.
- `EST-005`: focused local estimator proof directly covers direct wage conversion, paise direct entry, safe weave cost, and the old dangerous 100x paise/rupee failure mode.
- `EST-012`: focused local estimator proof directly covers invalid commission-plus-margin boundary behavior with `isValid=false`, a clear error message, and zero quote price.

Verification commands:

- `git diff --check` -> passed before docs closeout.
- `jq empty output/qa/batch13/BATCH13-code-verified-proof-sweep.json` -> passed.
- `npx --no-install vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts __tests__/production-mode.test.ts` -> passed, 3 test files and 39 tests.

Data safety:

- No product code, test code, migration, schema, RPC, Supabase command, db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, production data mutation, browser/runtime mutation, or external provider proof was used.
- Docs closeout force-adds only the ignored Batch 13 proof artifact and stages only the approved Batch 13 docs, matrix, and proof files.

Resolution status:

- `EST-001`, `EST-005`, and `EST-012` are pass-ready and documented as pass in the active QA matrix.
- `EST-004`, `SETUP-001`, `SETUP-002`, and all unproven supporting candidates remain unchanged/open as listed above.

## Batch 15 - Payroll Document Export Statutory Consistency Closeout

Date/time: 2026-07-01 04:08 IST. Source base `origin/main` at `01c2f4d6f63cfe1870919b8678e2742122460608`.

Scope:

- `PAY-013`
- `PAY-015`
- `PAY-023`
- `PAY-024`
- `SEC-014`
- Secondary same-root row: `DASH-003`

Rows promoted to pass:

- `PAY-023`
- `PAY-024`
- `SEC-014`

Rows moved to `code_verified` but not pass at Batch 15 closeout:

- `PAY-013` was unresolved evidence debt because the preview PF/ESI formula was source/test aligned, but no disposable high-gross enrolled settlement was executed. Batch 21C later closed this row with disposable settlement runtime proof.
- `PAY-015` was unresolved evidence debt because the preview-versus-settlement ESIC divergence was source/test fixed, but no live persisted settlement proof was collected. Batch 21C later closed this row with persisted settlement/history runtime proof.
- `DASH-003` remains unresolved evidence debt because the Factory Today wage read model is source/test fixed, but no after-shift runtime/browser proof was collected.

Rows explicitly not closed by Batch 15:

- `PAY-006`, `PAY-018`, `PAY-020`, `PAY-027`, and `PAY-028` remain outside this document/export/statutory consistency scope. `PAY-028` was already closed by Batch 9 and was not disturbed.
- `QUOTE-007`, `ORDER-005`, `ORDER-009`, `PROD-011`, `MASTER-014`, `SEC-015`, `TECH-001`, `TECH-005`, `TECH-006`, `TECH-009`, `WA-008`, billing/provider rows, restore/rollback rows, Sentry live-event rows, production/order boundary rows, and stock/dispatch/commercial flows remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch15/BATCH15-payroll-doc-export-consistency-proof.json`.
- `PAY-013`: `lib/payroll-statutory.ts` now centralizes PF/ESI preview calculations with PF basis capped at 15000 and employee ESIC applied only when adjusted gross is at or below 21000. Focused tests prove enrolled below-threshold, enrolled above-threshold, and non-enrolled behavior. Runtime settlement proof was missing at Batch 15 closeout and is supplied later by Batch 21C.
- `PAY-015`: payroll preview now uses the shared statutory helper, and optimistic settlement itemization writes nested `pf`/`esic` objects alongside legacy fields. Focused tests cover the high-gross ESIC divergence that caused the row to fail. Runtime persisted-settlement proof was missing at Batch 15 closeout and is supplied later by Batch 21C.
- `PAY-023`: `lib/generate-payslip.ts` now includes explicit cycle dates, earning lines, manual inam/kapaat adjustments, advance recovery, PF, ESI, net pay, carried-forward debt, and payment mode; the payroll page disables PDF generation until a paid settlement exists and passes settlement-backed values into the generator.
- `PAY-024`: settlement history detail and CSV export now read statutory deductions through a shared extractor that prefers persisted nested `pf.employee` and `esic.employee` and falls back to legacy top-level fields.
- `SEC-014`: payslip filename generation now strips path separators, traversal dots, and filename-hostile punctuation, constraining generated PDF filenames to safe ASCII filename parts.
- `DASH-003`: Factory Today `grossWagesSoFar` now uses existing production log `meters * worker_rate_snapshot` snapshots through `calculatePieceRateGrossWages`; runtime after-shift proof remains missing.

Verification commands:

- `git diff --check` -> passed.
- `jq empty output/qa/batch15/BATCH15-payroll-doc-export-consistency-proof.json` -> passed.
- `npx vitest run __tests__/batch15-payroll-doc-export-consistency.test.ts` -> passed, 1 test file and 7 tests.
- `npx vitest run __tests__/payroll-manual-adjustments.test.ts __tests__/payroll-settlement-history.test.ts __tests__/payroll-cycle.test.ts __tests__/payroll-pay-date-config.test.ts __tests__/p1-payroll-revert.test.ts __tests__/p1-payroll-guard.test.ts __tests__/p1-payroll-config-onboarding.test.ts` -> passed, 7 test files and 40 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx eslint app/\(dashboard\)/owner/payroll/page.tsx app/\(dashboard\)/owner/today/actions.ts lib/generate-payslip.ts lib/payroll-statutory.ts lib/payroll-read-models.ts __tests__/batch15-payroll-doc-export-consistency.test.ts` -> passed.
- `npm run build` -> passed. Prebuild full Vitest passed with 43 test files, 358 tests passed, and 1 skipped; Next production build exited 0.

Data safety:

- No migration was needed or created.
- No Supabase command, db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, production/customer data mutation, external provider call, stock/dispatch/commercial path change, or production/order boundary change was used.
- Docs closeout force-adds only the ignored Batch 15 proof artifact and stages only the approved Batch 15 implementation, tests, docs, matrix, and proof files.

Resolution status:

- `PAY-023`, `PAY-024`, and `SEC-014` are documented as pass in the active QA matrix.
- At Batch 15 closeout, `PAY-013`, `PAY-015`, and `DASH-003` were documented as `code_verified`, not pass, pending disposable runtime/browser proof. Batch 21C later closes `PAY-013` and `PAY-015`; `DASH-003` remains `code_verified`.

## Batch 20 - Payroll RPC Hardening and Kharchi Atomicity Closeout

Date/time: 2026-07-01 12:15 IST. Source base `origin/main` at `af1d8a59d24796f71abbfa04bac54e32e46d35f2`.

Scope:

- `PAY-018`
- `PAY-020`
- `PAY-027`

Rows moved to `code_verified` but not pass:

- At Batch 20 closeout, `PAY-018` remained unresolved evidence debt because settlement blocking was source-fixed at the RPC boundary, but migration application and disposable runtime permission/settlement proof were not executed. Batch 21D later closes this row.
- At Batch 20 closeout, `PAY-020` remained unresolved evidence debt because reversal access-code enforcement was source-fixed at the RPC boundary, but migration application and missing/invalid/valid/reused access-code runtime proof were not executed. Batch 21D later closes this row.
- `PAY-027` remains unresolved evidence debt because online Kharchi worker advance plus supervisor float ledger writes are source-fixed as one RPC transaction, but migration application and sufficient/insufficient-float runtime proof were not executed.

Rows explicitly not closed by Batch 20:

- `GOLDEN-A-21`, `GOLDEN-A-22`, `GOLDEN-A-23`, and `GOLDEN-B-18` remain blocked/open pending later Golden/runtime proof.
- At Batch 20 closeout, `PAY-013`, `PAY-015`, `DASH-003`, and `PAY-006` remained under their existing proof requirements. Batch 21C later closes `PAY-013` and `PAY-015`.
- Production/order boundary rows, stock/dispatch/commercial rows, billing/provider rows, Sentry/WhatsApp/restore/rollback rows, and all unapproved rows remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch20/BATCH20-payroll-rpc-kharchi-atomicity-proof.json`.
- Migration file: `supabase/migrations/20260701105404_batch_20_payroll_rpc_kharchi_atomicity.sql`.
- `PAY-018`: legacy `settle_worker_payroll` overloads are revoked from callable API roles, and `settle_worker_payroll_hardened` enforces auth.uid actor match, JWT org/owner claim, org-lock guard, payment mode, and owner verification before delegating to the latest settlement engine.
- `PAY-020`: legacy `unsettle_worker_payroll` overloads are revoked from callable API roles, and `unsettle_worker_payroll_hardened` validates and consumes the access code inside the database transaction with rollback on underlying reversal failure.
- `PAY-027`: `record_supervisor_kharchi` validates actor/org/role, worker ownership, paid-cycle rollover, float balance, and org-lock state, then inserts `worker_advances` and `supervisor_float_transactions` in one transaction under an advisory transaction lock.
- App routing: owner payroll actions call the hardened settlement/reversal RPCs, and supervisor `recordKharchi` calls the atomic Kharchi RPC instead of split table inserts.

Verification commands:

- `git diff --check` -> passed.
- `jq empty output/qa/batch20/BATCH20-payroll-rpc-kharchi-atomicity-proof.json` -> passed.
- `npx vitest run __tests__/batch20-payroll-rpc-kharchi-atomicity.test.ts __tests__/p1-payroll-revert.test.ts` -> passed, 2 test files and 8 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx eslint __tests__/batch20-payroll-rpc-kharchi-atomicity.test.ts __tests__/p1-payroll-revert.test.ts app/\(dashboard\)/owner/payroll/actions.ts app/\(dashboard\)/supervisor/actions.ts` -> passed.
- `npm run build` -> passed. Prebuild full Vitest passed with 44 test files, 363 tests passed, and 1 skipped; Next production build exited 0.

Data safety:

- Migration file was created but not applied.
- No Supabase command, db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, production/customer data mutation, browser/runtime mutation proof, stock/dispatch/commercial path change, production/order boundary change, or external provider call was used.
- Docs closeout force-adds only the ignored Batch 20 proof artifact and stages only the approved Batch 20 implementation, tests, docs, matrix, migration file, and proof artifact.

Resolution status:

- At Batch 20 closeout, `PAY-018`, `PAY-020`, and `PAY-027` were documented as `code_verified`, not pass, pending migration application and disposable QA runtime/browser proof. Batch 21D later closes `PAY-018` and `PAY-020`; `PAY-027` remains `code_verified`.

## Batch 21B - ORDER-008 Runtime Proof Closeout

Date/time: 2026-07-02 03:58 IST. Source base `origin/main` at `1660e95db6cd1562ecaf95f56f1db9b60cb7696c`.

Scope:

- `ORDER-008`

Rows promoted to pass:

- `ORDER-008`

Rows explicitly not closed by Batch 21B:

- At Batch 21B closeout, `PAY-013`, `PAY-015`, `PAY-018`, `PAY-020`, `PAY-027`, and `DASH-003` remained under their existing proof requirements. Batch 21C later closes `PAY-013` and `PAY-015`.
- Payroll, dashboard, production/order boundary, stock/dispatch/commercial, billing/provider, Sentry/WhatsApp/restore/rollback, Batch 1-20 closed statuses, and all unapproved rows remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch21b/BATCH21B-order-008-runtime-proof.json`.
- Runtime host: `http://localhost:3000`.
- QA safety: `.env.qa.local` and rebuilt `.next` contained QA Supabase ref `eutycrtzzxmlkcpipgod`; production ref `vzhwahudircrpgtitwzd` was absent from both; the deployed production app was not used.
- Scenario A: below-target completion showed explicit confirmation with remaining quantity, did not complete silently before confirmation, and completed only after Complete Anyway.
- Scenario B: pending-dispatch completion showed explicit confirmation with 10m remaining and 20m pending dispatch, did not complete silently before confirmation, and completed only after Complete Anyway.
- Scenario C: normal completion with no pending dispatch showed no confirmation warning and completed normally.

Verification commands:

- `git status --short` -> passed before proof closeout.
- `git diff --check` -> passed.
- `jq empty output/qa/batch21b/BATCH21B-order-008-runtime-proof.json` -> passed.
- `npx vitest run __tests__/batch11-estimator-order-lifecycle.test.ts` -> passed, 1 test file and 6 tests.
- `npx tsc --noEmit --pretty false` -> passed.

Data safety:

- No production mutation occurred.
- No secrets were copied into the artifact or docs.
- No migration, Supabase command, db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, app-code change, staging, commit, push, or docs closeout outside this Batch 21B closeout was used.

Resolution status:

- `ORDER-008` is documented as pass in the active QA matrix.
- Matrix movement is pass +1 and `code_verified` -1: total 377, pass 191, fail 31, blocked 22, `code_verified` 132, `not_applicable` 1, `not_run` 0.

## Batch 21C - Payroll Preview Settlement Runtime Proof Closeout

Date/time: 2026-07-02 16:53 IST. Source base `origin/main` at `b78b67806393dd30a84f82db58aadb01369a78c3`.

Scope:

- `PAY-013`
- `PAY-015`

Rows promoted to pass:

- `PAY-013`
- `PAY-015`

Rows explicitly not closed by Batch 21C:

- At Batch 21C closeout, `PAY-018`, `PAY-020`, and `PAY-027` remained `code_verified`, not pass, pending Batch 20 migration application and disposable QA runtime proof for RPC permission, settlement blocking, reversal access-code behavior, and Kharchi atomicity. Batch 21D later closes `PAY-018` and `PAY-020`; `PAY-027` remains `code_verified`.
- `DASH-003` remains `code_verified`, not pass, pending disposable after-shift Factory Today runtime/browser proof.
- `PAY-006`, Golden payroll follow-ons, dashboard/signoff rows, production/order boundary rows, stock/dispatch/commercial rows, billing/provider rows, Sentry/WhatsApp/restore/rollback rows, and all unapproved rows remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch21c/BATCH21C-payroll-preview-settlement-runtime-proof.json`.
- Runtime host: `http://localhost:3000`.
- QA safety: `.env.local`, `.env.qa.local`, and rebuilt `.next` cache were checked against QA Supabase ref `eutycrtzzxmlkcpipgod`; production ref `vzhwahudircrpgtitwzd` was absent from the targeted checks. The deployed production app was not used.
- `PAY-013`: disposable fixed workers at Rs. 20000 gross proved enrolled PF Rs. 1800, ESI Rs. 150, net Rs. 18050; the not-enrolled worker proved PF/ESI Rs. 0 and net Rs. 20000. Settlement/history matched both workers.
- `PAY-015`: preview gross, deductions, manual adjustments, advance recovery, debt, and net matched the paid payroll rows and persisted Past settlements history exactly. Past settlements was reopened after the stale window, and values remained unchanged.

Verification commands:

- `git status --short` -> clean before closeout edits.
- `git diff --check` -> passed before closeout edits.
- `jq empty output/qa/batch21c/BATCH21C-payroll-preview-settlement-runtime-proof.json` -> passed.
- `npx vitest run __tests__/batch15-payroll-doc-export-consistency.test.ts` -> passed, 1 test file and 7 tests.
- `npx vitest run __tests__/batch20-payroll-rpc-kharchi-atomicity.test.ts __tests__/p1-payroll-revert.test.ts` -> passed, 2 test files and 8 tests.
- `npx tsc --noEmit --pretty false` -> passed.

Data safety:

- No app code, migration, Supabase command, db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, production/customer data mutation, external provider call, or env/secret copy was used for closeout.
- Docs closeout force-adds only the ignored Batch 21C proof artifact and stages only the approved Batch 21C docs, matrix, and proof files.

Resolution status:

- `PAY-013` and `PAY-015` are documented as pass in the active QA matrix.
- Matrix movement is pass +2 and `code_verified` -2: total 377, pass 193, fail 31, blocked 22, `code_verified` 130, `not_applicable` 1, `not_run` 0.

## Batch 21D - Payroll Boundary Runtime Proof Closeout

Date/time: 2026-07-02 17:29 IST. Source base `origin/main` at `5e60265554a453cb137201f4d16a0e6fe047cf73`.

Scope:

- `PAY-018`
- `PAY-020`

Rows promoted to pass:

- `PAY-018`: payment mode and owner verification are enforced at the UI and hardened RPC boundary.
- `PAY-020`: payroll reversal requires a valid one-time access code through the intended boundary.

Rows explicitly not closed by Batch 21D:

- `PAY-027` remains `code_verified`, not pass, pending disposable online Kharchi sufficient/insufficient-float runtime proof.
- `DASH-003` remains `code_verified`, not pass, pending disposable after-shift Factory Today runtime/browser proof.
- Golden rows, `PAY-006`, production/order boundary rows, stock/dispatch/commercial rows, billing/provider rows, Sentry/WhatsApp/restore/rollback rows, and all unapproved rows remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch21d/BATCH21D-payroll-boundary-runtime-proof.json`.
- Runtime host: `http://localhost:3000`.
- QA safety: `.env.qa.local` and rebuilt `.next` cache were checked against QA Supabase ref `eutycrtzzxmlkcpipgod`; production ref `vzhwahudircrpgtitwzd` was absent from the targeted checks. The deployed production app was not used.
- `PAY-018`: missing payment/owner verification was blocked in the UI; authenticated API-role calls to `settle_worker_payroll_hardened` rejected missing payment mode and missing owner verification; valid UI settlement succeeded; legacy direct `settle_worker_payroll` returned permission denied.
- `PAY-020`: empty code kept reversal disabled; invalid code was rejected while settlement stayed paid; valid one-time code reversed the settlement to pending; consumed-code reuse was rejected; legacy direct `unsettle_worker_payroll` returned permission denied.

Verification commands:

- `git status --short` -> clean before closeout edits.
- `git diff --check` -> passed before closeout edits.
- `jq empty output/qa/batch21d/BATCH21D-payroll-boundary-runtime-proof.json` -> passed.
- `npx vitest run __tests__/batch20-payroll-rpc-kharchi-atomicity.test.ts __tests__/p1-payroll-revert.test.ts` -> passed, 2 test files and 8 tests.
- `npx vitest run __tests__/batch15-payroll-doc-export-consistency.test.ts` -> passed, 1 test file and 7 tests.
- `npx tsc --noEmit --pretty false` -> passed.

Data safety:

- Runtime data used disposable QA payroll, worker, and factory identifiers only; identifiers in the artifact are sanitized.
- No production mutation occurred.
- No secrets, keys, database URLs, cookies, tokens, auth headers, request bodies, or full env files were copied into the artifact or docs.
- No app code, migration, Supabase command, db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, production/customer data mutation, external provider call, or env/secret copy was used for proof.
- Docs closeout force-adds only the ignored Batch 21D proof artifact and stages only the approved Batch 21D docs, matrix, and proof files.

Resolution status:

- `PAY-018` and `PAY-020` are documented as pass in the active QA matrix.
- Matrix movement is pass +2 and `code_verified` -2: total 377, pass 195, fail 31, blocked 22, `code_verified` 128, `not_applicable` 1, `not_run` 0.

## Batch 22 - Production/Order Boundary Source-Fix Closeout

Date/time: 2026-07-02 18:12 IST. Source base `origin/main` at `b0cef34910a255dfb1415bf3c605b09b02c7acc3`.

Scope:

- `ORDER-005`
- `ORDER-009`
- `PROD-011`

Rows promoted to `code_verified`, not pass:

- `ORDER-005`: over-target order production is source-fixed at the RPC/table boundary. `replace_shift_production_logs` computes post-replacement totals before any delete/insert and rejects totals above `orders.total_target_meters`; the direct table trigger rejects over-target writes too.
- `ORDER-009`: cancelled/completed/stale-assignment order-attributed logs are source-fixed at the RPC/table boundary. Any order-attributed log must belong to an active order currently assigned to the active loom, and replacing order-attributed logs for non-active orders is blocked.
- `PROD-011`: negative meters are source-fixed at the RPC/table boundary. The migration adds `production_logs_meters_nonnegative CHECK (meters >= 0) NOT VALID` for new writes and rejects negative meters in both the trigger and replacement RPC.

Rows explicitly not closed by Batch 22:

- `SIGNOFF-02` remains fail/open. Its `ORDER-009` dependency is improved, but full current-run order/run attribution runtime proof is still required after the migration is applied in QA.
- `GOLDEN-A-23`, `PAY-027`, `DASH-003`, Golden rows, `QUOTE-007`, payroll rows, stock/dispatch/commercial rows, billing/provider rows, Sentry/WhatsApp/restore/rollback rows, and all unapproved rows remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch22/BATCH22-production-order-boundary-hardening-proof.json`.
- Migration created but not applied: `supabase/migrations/20260702121238_batch_22_production_order_boundary_hardening.sql`.
- Focused source test: `__tests__/batch22-production-order-boundary-hardening.test.ts`.
- Regression coverage kept Batch 2/6/11 behavior under test: Batch 11 lifecycle test, production strictness, production stock atomicity, P0 atomicity, completed-order dispatch, and stock lifecycle tests.

Verification commands:

- `git status --short` -> showed only the approved new Batch 22 test and migration before docs closeout; proof artifact is ignored under `output/qa`.
- `git diff --check` -> passed.
- `jq empty output/qa/batch22/BATCH22-production-order-boundary-hardening-proof.json` -> passed.
- `npx vitest run __tests__/batch22-production-order-boundary-hardening.test.ts` -> passed, 1 test file and 6 tests.
- `npx vitest run __tests__/batch11-estimator-order-lifecycle.test.ts` -> passed, 1 test file and 6 tests.
- `npx vitest run __tests__/p1-production-log-strictness.test.ts __tests__/p1-production-stock-atomicity.test.ts __tests__/p0-atomicity.test.ts __tests__/p2-golden-a-completed-order-dispatch.test.ts __tests__/p1-stock-lifecycle.test.ts` -> passed, 5 test files and 55 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx eslint __tests__/batch22-production-order-boundary-hardening.test.ts` -> passed.

Data safety:

- No migration was applied.
- No production mutation occurred.
- No Supabase db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, runtime/browser proof, production/customer data mutation, external provider call, env file staging, Supabase temp-file staging, or secret copy was used.
- Docs closeout force-adds only the ignored Batch 22 proof artifact and stages only the approved Batch 22 implementation, migration, docs, matrix, and proof files.

Resolution status:

- `ORDER-005`, `ORDER-009`, and `PROD-011` are documented as `code_verified` in the active QA matrix.
- Matrix movement is fail -3 and `code_verified` +3: total 377, pass 195, fail 28, blocked 22, `code_verified` 131, `not_applicable` 1, `not_run` 0.

## Batch 23 - Start Party Order Transaction Boundary Source-Fix Closeout

Date/time: 2026-07-02 18:58 IST. Source base `origin/main` at `2dddaea39208aa10bb3b06d6ab43a6b3a849428e`.

Scope:

- `QUOTE-007`

Rows promoted to `code_verified`, not pass:

- `QUOTE-007`: Start Party Order fast path is source-fixed at the database boundary. The new atomic RPC `start_party_order_from_estimator` inserts the accepted estimator_quote, active order, quote/order backlinks, and order_yarn_requirements in a single database transaction. If any write fails, the entire transaction is rolled back. The server action `startPartyOrderFromEstimator` is refactored to pre-compute the yarn requirements and invoke this RPC.

Rows explicitly not closed by Batch 23:

- `ORDER-005`, `ORDER-009`, `PROD-011` remain `code_verified`, not pass, pending database migration application and QA runtime proof.
- `PAY-027` remains `code_verified`, not pass, pending disposable online Kharchi float runtime proof.
- `DASH-003` remains `code_verified`, not pass, pending disposable after-shift wage updates runtime proof.
- Golden rows, other payroll rows, stock/dispatch/commercial rows, billing/provider rows, Sentry/WhatsApp/restore/rollback rows, and all unapproved rows remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch23/BATCH23-start-party-order-transaction-boundary-proof.json`.
- Migration created but not applied: `supabase/migrations/20260702131500_batch_23_start_party_order_transaction_boundary.sql`.
- Focused source test: `__tests__/batch23-start-party-order-atomicity.test.ts`.
- Regression coverage: Vitest checks on related lifecycle, snapshots, and atomicity test suites.

Verification commands:

- `git status --short` -> showed only the approved new Batch 23 test, migration, and updated action/test files before docs closeout; proof artifact is ignored/force-added under `output/qa`.
- `git diff --check` -> passed.
- `jq empty output/qa/batch23/BATCH23-start-party-order-transaction-boundary-proof.json` -> passed.
- `npx vitest run __tests__/batch23-start-party-order-atomicity.test.ts` -> passed, 1 test file and 21 tests.
- `npx vitest run __tests__/batch11-estimator-order-lifecycle.test.ts` -> passed, 1 test file and 6 tests.
- `npx vitest run __tests__/batch10-estimator-quote-order-snapshots.test.ts` -> passed, 1 test file and 4 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx eslint __tests__/batch23-start-party-order-atomicity.test.ts` -> passed.

Data safety:

- No migration was applied.
- No production mutation occurred.
- No Supabase db push, migration repair, db pull, direct SQL, --include-all, npm audit, package install, lockfile change, runtime/browser proof, production/customer data mutation, external provider call, env file staging, Supabase temp-file staging, or secret copy was used.
- Docs closeout force-adds only the ignored Batch 23 proof artifact and stages only the approved Batch 23 implementation, migration, docs, matrix, and proof files.

Resolution status:

- `QUOTE-007` is documented as `code_verified` in the active QA matrix.
- Matrix movement is fail -1 and `code_verified` +1: total 377, pass 195, fail 27, blocked 22, `code_verified` 132, `not_applicable` 1, `not_run` 0.

## Batch 24A - PAY-006 Past/Future Attendance RLS and Access-Code Boundary

Date/time: 2026-07-02 19:35 IST. Source base `origin/main` at `49c2c47857e15211216699d9d81b740a96d0d651`.

Scope:

- `PAY-006`

Rows promoted to `code_verified`, not pass:

- `PAY-006`: Past/future attendance is source-fixed at the database and UI boundary. The new database migration `20260702191500` enforces date-bounds on direct client-side `INSERT`/`UPDATE` writes. Supervisor direct writes are limited to today's date using Surat DB date: `date = (now() AT TIME ZONE 'Asia/Kolkata')::date` (enforced via both USING and WITH CHECK). Owner direct writes are limited to today or past using Surat DB date: `date <= (now() AT TIME ZONE 'Asia/Kolkata')::date` (enforced via both USING and WITH CHECK). Future attendance writes are blocked at the RLS boundary. Supervisor past-date edits no longer bypass RLS via client-side upsert, and instead prompt for the owner access code at save time, validating/consuming it server-side.

Rows explicitly not closed by Batch 24A:

- `ORDER-005`, `ORDER-009`, `PROD-011`, `QUOTE-007` remain `code_verified`, not pass, pending database migration application and QA runtime proof.
- `PAY-027` remains `code_verified`, not pass, pending disposable online Kharchi float runtime proof.
- `DASH-003` remains `code_verified`, not pass, pending disposable after-shift wage updates runtime proof.
- Golden rows, other payroll rows, stock/dispatch/commercial rows, billing/provider rows, Sentry/WhatsApp/restore/rollback rows, and all unapproved rows remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch24a/BATCH24A-attendance-rls-boundary-proof.json`.
- Migration created but not applied: `supabase/migrations/20260702191500_batch_24a_harden_attendance_rls_date_bounds.sql`.
- Focused source test: `__tests__/p1-attendance-rls-boundary.test.ts`.
- Regression coverage: Vitest checks on related tests.

Verification commands:

- `git status --short` -> showed only the approved new Batch 24A test, migration, and updated page file before docs closeout; proof artifact is ignored under `output/qa`.
- `git diff --check` -> passed.
- `jq empty output/qa/batch24a/BATCH24A-attendance-rls-boundary-proof.json` -> passed.
- `npx vitest run __tests__/p1-attendance-rls-boundary.test.ts` -> passed, 1 test file and 11 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx eslint __tests__/p1-attendance-rls-boundary.test.ts "app/(dashboard)/supervisor/attendance/page.tsx"` -> passed.

Data safety:

- No migration was applied.
- No production mutation occurred.
- No Supabase db push, migration repair, db pull, direct SQL, --include-all, npm audit, package install, lockfile change, runtime/browser proof, production/customer data mutation, external provider call, env file staging, Supabase temp-file staging, or secret copy was used.
- Docs closeout force-adds only the ignored Batch 24A proof artifact and stages only the approved Batch 24A implementation, migration, docs, matrix, and proof files.

Resolution status:

- `PAY-006` is documented as `code_verified` in the active QA matrix.
- Matrix movement is fail -1 and `code_verified` +1: total 377, pass 195, fail 26, blocked 22, `code_verified` 133, `not_applicable` 1, `not_run` 0.

## Batch 24B - Supervisor UX and Production Logging Failure Source-Fix Closeout

Date/time: 2026-07-03 11:23 IST. Source base `origin/main` at `d3aa28c488c280ef3cd54a049518f6d2c6ec80d6`.

Scope:

- `PROD-013`
- `PROD-023`
- `PROD-029`

Rows promoted to `code_verified`, not pass:

- `PROD-013`: suspicious large positive shift-meter behavior is source-fixed. A documented 10,000m warning threshold now triggers a non-blocking supervisor confirmation for large valid entries. The threshold is a warning threshold, not a hard business maximum; confirmed large positive entries can still proceed, and existing negative-meter validation remains blocking.
- `PROD-023`: restored production drafts are source-fixed in the supervisor UX. Restored localStorage shift-meter drafts are compared with server-loaded existing logs, shown with a visible "Restored unsaved draft" indicator, and the copy says the values were restored from this device and have not been saved yet. The restored-draft state clears on save/reset.
- `PROD-029`: production copy is source-fixed. Public landing, pricing, setup/help, and generated legacy translation copy now use shift-total/shift-meter terminology and remove raw opening/closing meter-reading proof claims.

Rows explicitly not closed:

- `PROD-022` was outside Batch 24B and is later source-fixed by Batch 24D pending browser/runtime proof for date/shift draft isolation.
- `AUTH-008`, `SEC-009`, `SEC-015`, `SEC-017`, `PAY-027`, `DASH-003`, Golden rows, production/order boundary rows, stock/dispatch/commercial rows, billing/provider rows, Sentry/WhatsApp/restore/rollback rows, and all unapproved rows remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch24b/BATCH24B-supervisor-ux-failures-proof.json`.
- Focused source test: `__tests__/batch24b-supervisor-ux-failures.test.ts`.
- Regression coverage: supervisor production strictness, production dispatch regression, production stock atomicity, P0 atomicity, and Batch 22 production/order boundary tests.

Verification commands:

- `git status --short` -> showed only approved Batch 24B implementation files and new focused test before docs closeout; proof artifact ignored under `output/qa`.
- `git diff --check` -> passed.
- `jq empty output/qa/batch24b/BATCH24B-supervisor-ux-failures-proof.json` -> passed.
- `npx vitest run __tests__/batch24b-supervisor-ux-failures.test.ts` -> passed, 1 test file and 4 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx eslint __tests__/batch24b-supervisor-ux-failures.test.ts "app/(dashboard)/supervisor/dashboard/page.tsx" components/factory-today/SetupPanel.tsx components/landing/faq.tsx components/landing/features.tsx components/landing/pricing.tsx lib/production-log-validation.ts` -> passed.
- `npx vitest run __tests__/p1-production-log-strictness.test.ts __tests__/p1-production-dispatch-regressions.test.ts __tests__/p1-production-stock-atomicity.test.ts __tests__/p0-atomicity.test.ts __tests__/batch22-production-order-boundary-hardening.test.ts` -> passed, 5 test files and 56 tests.

Data safety:

- No migration was created or applied.
- No RPC/database work occurred.
- No production mutation occurred.
- No Supabase db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, runtime/browser proof, production/customer data mutation, external provider call, env file staging, Supabase temp-file staging, or secret copy was used.
- Docs closeout force-adds only the ignored Batch 24B proof artifact and stages only the approved Batch 24B implementation, test, docs, matrix, and proof files.

Resolution status:

- `PROD-013`, `PROD-023`, and `PROD-029` are documented as `code_verified` in the active QA matrix.
- Matrix movement is fail -3 and `code_verified` +3: total 377, pass 195, fail 23, blocked 22, `code_verified` 136, `not_applicable` 1, `not_run` 0.

## Batch 23 - Production Migration Signature Hotfix Closeout

Date/time: 2026-07-03 12:20 IST. Branch `codex/batch-24c-factory-today-analytics-state`.

Scope:

- Batch 23 migration hotfix only: `supabase/migrations/20260702131500_batch_23_start_party_order_transaction_boundary.sql`.
- Regression coverage only: `__tests__/batch23-start-party-order-atomicity.test.ts`.

Root cause:

- The `start_party_order_from_estimator(...)` PostgreSQL function had required parameters after earlier defaulted parameters: `p_target_meters NUMERIC` and `p_deadline DATE`.
- PostgreSQL rejected the migration with `ERROR: input parameters after one with a default value must also have defaults (SQLSTATE 42P13)`.

Fix:

- `p_target_meters` now defaults to `NULL`, while the existing RPC validation still rejects `NULL` or `<= 0` target meters before writes.
- `p_deadline` now defaults to `NULL`, and the RPC now explicitly returns `Add a deadline before starting an order.` when `p_deadline IS NULL` before inserting into `orders`.
- No destructive DB operation was added.

Production migration status:

- Human production action completed outside this agent run: `npx supabase db push` succeeded after the hotfix.
- The successful push applied `20260702131500_batch_23_start_party_order_transaction_boundary.sql` and `20260702191500_batch_24a_harden_attendance_rls_date_bounds.sql`.
- Production DB is now migrated through Batch 24A attendance migration. This Batch 23 note did not itself claim Batch 24C closure; it is superseded for Batch 24C by the recovery closeout below.

Verification commands:

- Static migration review -> passed: 44 parameters checked, no non-default parameter appears after a defaulted parameter, target/deadline validation present, and no `DROP`, `TRUNCATE`, or `DELETE` statement introduced.
- Static RPC/test review -> passed: signature/deadline assertions present and all 44 app RPC payload parameter names match the function.
- `git diff --check` -> passed.
- `npm test -- __tests__/batch23-start-party-order-atomicity.test.ts` -> passed, 1 test file and 21 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx supabase migration list` -> passed as read-only verification; remote/local history includes `20260702131500` and `20260702191500`.

Data safety:

- This closeout did not run `npx supabase db push`.
- No direct SQL, production mutation, new migration, package install, npm audit, lockfile change, or merge to main was performed.
- Historical note superseded: at Batch 23 hotfix time the Batch 24C/factory-today files were intentionally left unstaged and uncommitted. Batch 24C code was later squash-merged through PR #4 and is now closed by the recovery closeout below.

## Batch 24C - Factory Today Setup and Historical Analytics State Recovery Closeout

Date/time: 2026-07-04 IST. Recovery branch `codex/batch-24c-recovery-closeout`.

Context:

- Batch 24C code was squash-merged to `main` through PR #4 at `9eeed018cf88553b37df6f4fc2db5ae3d23a4538`.
- Original implementation commit before squash: `ee0ab46f6fc8dcd2b1c075e0464b77ab952f79eb`.
- The active matrix is `output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md`.
- This recovery closeout commits the ignored proof artifact and promotes only `SETUP-011` and `DASH-004` to `code_verified`.

Scope:

- `SETUP-011`: Factory Today setup panel after creating estimates, machines, workers, and payroll config.
- `DASH-004`: Historical date selection.

Recovered proof artifact:

- `output/qa/batch24c/BATCH24C-factory-today-analytics-state-proof.json`

Root cause and implementation summary:

- SETUP-011: Factory Today setup checklist had duplicated/inconsistent client-facing logic and did not recognize completed costing consistently from quote, order, machines, workers, assignments, and payroll config. Fixed by centralizing the setup checklist logic in `lib/factory-today-checklist.ts`. Costing completion recognizes quality, estimate, order, or market run. Day/night assignments require workers on the same loom. Worker checks use active rows only. Payroll config validation bounds mirror DB bounds.
- DASH-004: Historical analytics selection mixed historical and current values. Fixed by clearing current-only today/orders/machines state for historical dates, scoping the 7-day trend to the selected date via `getDailyMeterTrend(supabase, org_id, targetDate)`, and replacing the full state on the client instead of merging over previous current state. Live state is restored when returning to today.

Verification:

- `git diff --check` -> passed.
- `jq empty output/qa/batch24c/BATCH24C-factory-today-analytics-state-proof.json` -> passed.
- `npx vitest run __tests__/batch24c-factory-today-analytics-state.test.ts` -> passed, 1 test file and 7 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx eslint 'app/(dashboard)/owner/actions/dashboard.ts' 'app/(dashboard)/owner/analytics/_components/DashboardClient.tsx' 'app/(dashboard)/owner/today/actions.ts' lib/factory-today-checklist.ts lib/dashboard-trend.ts __tests__/batch24c-factory-today-analytics-state.test.ts` -> passed.

Data safety:

- This closeout did not run `npx supabase db push`.
- No direct SQL, production mutation, new migration, package install, npm audit, lockfile change, or merge to main occurred.

Result:

- Batch 24C is completed as source-fixed/code-verified.
- `SETUP-011` and `DASH-004` are closed as `code_verified`/`source-fixed` candidates.
- Browser/runtime QA proof is still required before marking true pass-ready. No production/browser pass is claimed because actual runtime proof has not been performed in this agent run.
- Matrix movement from current main: fail -2 and `code_verified` +2, for total 377, pass 195, fail 21, blocked 22, `code_verified` 138, `not_applicable` 1, `not_run` 0.

## Batch 24D - Estimator Submit and Production Draft Isolation Closeout

Date/time: 2026-07-04 IST. Source base `origin/main` at `37b3ad0dc9516734699cc0137ccb1bc2059908d6`.

Scope:

- `EST-017`
- `PROD-022`

Rows promoted to `code_verified`, not pass:

- `EST-017`: estimator rapid double-submit is source-fixed by a synchronous `saveQuoteLockRef` guard before `createMarketRunFromEstimator` or `saveEstimatorQuoteV3`, disabled save/create controls while saving, and lock reset in `finally`. This does not claim server/database idempotency.
- `PROD-022`: production draft date/shift isolation is source-fixed by scoping draft localStorage keys to org, user, selected date, and shift. The supervisor dashboard uses `userProfile.org_id` and `userProfile.userId`, avoids date/shift-only fallback keys, ignores stale date/shift fetch completions, restores only the matching active draft, and saves with the currently selected date/shift. Batch 24B restored-draft indicator and suspicious large-meter warning behavior remain compatible.

Rows explicitly not closed:

- `AUTH-008`, `SEC-009`, `SEC-015`, `SEC-017`, MASTER rows, `PROD-002`, `PROD-004`, `PAY-027`, `DASH-003`, TECH/audit/dependency rows, WA/OFF rows, SIGNOFF rows, Golden rows, and all unapproved rows remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch24d/BATCH24D-submit-draft-isolation-proof.json`.
- Focused source test: `__tests__/batch24d-submit-draft-isolation.test.ts`.
- Compatibility source test: `__tests__/batch24b-supervisor-ux-failures.test.ts`.
- Implementation files: `app/(dashboard)/owner/estimator/EstimatorClient.tsx`, `app/(dashboard)/supervisor/dashboard/page.tsx`, and `lib/production-drafts.ts`.

Verification commands:

- `git diff --check` -> passed.
- `jq empty output/qa/batch24d/BATCH24D-submit-draft-isolation-proof.json` -> passed.
- `npx vitest run __tests__/batch24d-submit-draft-isolation.test.ts` -> passed, 1 test file and 13 tests.
- `npx vitest run __tests__/batch24b-supervisor-ux-failures.test.ts` -> passed, 1 test file and 4 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx eslint app/\(dashboard\)/owner/estimator/EstimatorClient.tsx app/\(dashboard\)/supervisor/dashboard/page.tsx lib/production-drafts.ts __tests__/batch24d-submit-draft-isolation.test.ts __tests__/batch24b-supervisor-ux-failures.test.ts` -> passed.
- `npx vitest run __tests__/batch11-estimator-order-lifecycle.test.ts __tests__/batch23-start-party-order-atomicity.test.ts __tests__/batch10-estimator-quote-order-snapshots.test.ts __tests__/batch22-production-order-boundary-hardening.test.ts __tests__/p1-production-stock-atomicity.test.ts __tests__/production-mode.test.ts __tests__/p1-production-log-strictness.test.ts __tests__/p1-production-dispatch-regressions.test.ts __tests__/estimator.test.ts` -> passed, 9 test files and 116 tests.

Data safety:

- No migration was created or applied.
- No RPC/database work occurred.
- No production mutation occurred.
- No Supabase db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, browser/runtime proof, env file staging, Supabase temp-file staging, or secret copy was used.

Resolution status:

- `EST-017` and `PROD-022` are documented as `code_verified` in the active QA matrix.
- Matrix movement is fail -2 and `code_verified` +2: total 377, pass 195, fail 19, blocked 22, `code_verified` 140, `not_applicable` 1, `not_run` 0.

## Batch 24E - Master Data Loom Guardrails Source-Fix Closeout

Date/time: 2026-07-05 IST. Source base `origin/main` at `04637f62746e9cbeae5821d944f558c65ec4f07b`.

Scope:

- `MASTER-002`
- `MASTER-005`

Rows promoted to `code_verified`, not pass:

- `MASTER-002`: duplicate loom-name guardrails are source-fixed for manual add, bulk add, and rename/update. Names are normalized with trim/case-folding, duplicates are checked within the submitted bulk batch and against existing org looms, same-type different-name looms remain allowed, and duplicate database errors are mapped to a clear validation message. Migration `20260704120000_batch_24e_master_data_loom_guardrails.sql` was later revised from a retroactive unique index to a trigger-backed normalized duplicate guard so existing duplicate production rows are preserved while future normalized duplicates are blocked.
- `MASTER-005`: protected loom lifecycle behavior is source-fixed for owner deactivate/delete, supervisor delete-with-code, and cost-analysis null-target unlink. The shared guard blocks active/current targets, linked targets, standing worker assignments, dated shift-assignment history, and production history. The targeted review fix closes the null-target unlink/deactivate bypass by guarding unlink and clearing only `current_order_id` when safe.

Rows explicitly not closed:

- `MASTER-014` remains fail/open because assignment concurrency needs a separate transaction/RPC/lock design spanning `shift_assignments`, `machine_assignments`, and `machines.current_order_id`.
- `AUTH-008`, `SEC-009`, `SEC-015`, `SEC-017`, `PROD-002`, `PROD-004`, `PAY-027`, `DASH-003`, TECH/audit/dependency rows, WA/OFF rows, SIGNOFF rows, Golden rows, and all unapproved rows remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch24e/BATCH24E-master-data-guardrails-proof.json`.
- Focused source test: `__tests__/batch24e-master-data-guardrails.test.ts`.
- Implementation files: `app/(dashboard)/owner/actions.ts`, `app/(dashboard)/supervisor/actions.ts`, `components/MachineManagement.tsx`, `lib/master-data-loom-guardrails.ts`.
- Migration file: `supabase/migrations/20260704120000_batch_24e_master_data_loom_guardrails.sql`.

Verification commands:

- `git diff --check` -> passed.
- `jq empty output/qa/batch24e/BATCH24E-master-data-guardrails-proof.json` -> passed.
- `npx vitest run __tests__/batch24e-master-data-guardrails.test.ts` -> passed, 1 test file and 9 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx eslint app/\(dashboard\)/owner/actions.ts app/\(dashboard\)/supervisor/actions.ts components/MachineManagement.tsx lib/master-data-loom-guardrails.ts __tests__/batch24e-master-data-guardrails.test.ts` -> passed.
- `npx vitest run __tests__/batch24c-factory-today-analytics-state.test.ts __tests__/production-mode.test.ts __tests__/p1-payroll-config-onboarding.test.ts __tests__/phase1-scope.test.ts` -> passed, 4 test files and 21 tests.

Data safety:

- At original Batch 24E source closeout, the migration was not applied. A later production DB push incident reportedly applied the revised trigger-backed migration and is documented in the Batch 24E/24G production reconciliation entry below.
- No Supabase db push, migration repair, db pull, direct SQL, `--include-all`, production mutation, npm audit, package install, lockfile change, env-file staging, Supabase temp-file staging, or browser/runtime pass promotion was used.

Resolution status:

- `MASTER-002` and `MASTER-005` are documented as `code_verified` in the active QA matrix, not pass.
- Matrix movement is fail -2 and `code_verified` +2: total 377, pass 195, fail 17, blocked 22, `code_verified` 142, `not_applicable` 1, `not_run` 0.

## Batch 24F - Production Worker Assignment Policy Closeout

Date/time: 2026-07-05 IST. Branch `codex/batch-24f-production-worker-assignment-policy`.

Scope:

- `PROD-002`
- `PROD-004`

Rows promoted to `code_verified`, not pass:

- `PROD-002`: selected-shift worker assignment policy is source-fixed. Day-shift/day-only production no longer requires a night worker, supervisor setup data no longer hides active day-only looms, and setup/checklist/activation no longer falsely fail only because the night worker is absent. Night-shift positive production without a night worker returns an actionable selected-shift accountability error. The code does not fake a night worker or silently assign the day worker as the night worker.
- `PROD-004`: substitute/actual-worker mismatch is source-fixed by explicit blocking. Because the current logging path has only `production_logs.worker_id`, no unsafe substitute persistence model was added. If a submitted positive-production worker differs from the selected standing shift worker, the server returns `SUBSTITUTE_REASSIGNMENT_REQUIRED` and instructs reassignment before logging the substitute, preserving payroll and loom accountability.

Rows explicitly not closed:

- `SIGNOFF-01` dependency is improved only. It remains fail/open because current-run owner sign-off/browser proof has not been collected.
- `SIGNOFF-02`, `AUTH-008`, `SEC-009`, `SEC-015`, `SEC-017`, `MASTER-014`, TECH/audit/dependency rows, `PAY-027`, `DASH-003`, WA/OFF rows, Golden rows, and all unapproved rows remain unchanged.

Evidence:

- Evidence artifact: `output/qa/batch24f/BATCH24F-production-worker-assignment-policy-proof.json`.
- Focused source test: `__tests__/batch24f-production-worker-assignment-policy.test.ts`.
- Related source tests: `__tests__/batch24c-factory-today-analytics-state.test.ts`, `__tests__/batch22-production-order-boundary-hardening.test.ts`.
- Implementation files: `lib/production-worker-assignment-policy.ts`, `app/(dashboard)/supervisor/actions.ts`, `app/(dashboard)/owner/actions.ts`, `components/MachineManagement.tsx`, `components/factory-today/SetupPanel.tsx`, and `lib/factory-today-checklist.ts`.

Verification:

- `git diff --check` -> passed.
- `jq empty output/qa/batch24f/BATCH24F-production-worker-assignment-policy-proof.json` -> passed.
- `npx vitest run __tests__/batch24f-production-worker-assignment-policy.test.ts` -> passed, 1 test file and 7 tests.
- `npx vitest run __tests__/batch24c-factory-today-analytics-state.test.ts` -> passed, 1 test file and 7 tests.
- `npx vitest run __tests__/batch22-production-order-boundary-hardening.test.ts` -> passed, 1 test file and 6 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- Targeted ESLint on touched source/tests -> passed.
- Related production/supervisor/assignment/payroll regression pack -> passed, 9 test files and 79 tests.

Data safety:

- No migration was created or applied.
- No RPC/database work occurred.
- No production mutation occurred.
- No Supabase db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, env-file staging, Supabase temp-file staging, or browser/runtime pass promotion was used.

Resolution status:

- `PROD-002` and `PROD-004` are documented as `code_verified` in the active QA matrix, not pass.
- Browser/runtime QA proof is still required before pass: day-only/day-shift logging, night-shift missing-worker accountability, substitute/reassignment behavior, and current-run owner sign-off.
- Matrix movement is fail -2 and `code_verified` +2: total 377, pass 195, fail 15, blocked 22, `code_verified` 144, `not_applicable` 1, `not_run` 0.

## Batch 24E/24G - Production DB Push Reconciliation

Date/time: 2026-07-06 IST. Branch `codex/batch-24g-security-audit-guardrails`.

Incident context:

- A Supabase DB push occurred before this reconciliation while the local project was linked to production ref `vzhwahudircrpgtitwzd`.
- This closeout reconciles repository, docs, matrix, and proof artifacts to that production-applied migration reality. It is not normal QA migration proof.
- Reported production remote migration history includes `20260704120000`, `20260705100000`, and `20260705182406`.
- No rollback was attempted.
- No additional Supabase command, DB push, DB pull, migration repair, direct SQL, `--include-all`, or production mutation was run during this reconciliation.

Rows promoted to `code_verified`, not pass:

- `SEC-015`: settings audit source coverage is fixed by migration `20260705100000_batch_24g_security_audit_guardrails.sql`, and follow-up migration `20260705182406_harden_settings_audit_function.sql` hardens SECURITY DEFINER helper search paths and revokes direct PUBLIC/anon/authenticated execute grants. Production application is recorded as reported evidence, but controlled settings-change audit-row proof with redacted payloads is still required before pass.
- `SEC-009`: owner data export is source-fixed with active settings UI wiring, owner-only server action access, server-derived `profile.org_id` scoping, export audit logging before payload delivery, fail-closed audit behavior, and sensitive-field exclusion/redaction. Browser/security export proof and audit-log EXPORT proof are still required before pass.

Rows explicitly not closed:

- `SEC-017` remains fail/open pending worker age/consent product/legal policy and implementation proof.
- `AUTH-008` remains fail/open pending join-code brute-force/rate-limit architecture and controlled QA proof.
- `MASTER-002` remains `code_verified`, not pass. Production DB-boundary evidence improved after the trigger-backed migration reportedly blocked a duplicate `LOOM C` probe, but controlled QA/browser/runtime duplicate-flow proof is incomplete.
- `MASTER-005` remains `code_verified`, not pass. Browser lifecycle proof for protected delete/deactivate/unlink and unused-loom behavior is still required.

Batch 24E migration reconciliation:

- Migration `20260704120000_batch_24e_master_data_loom_guardrails.sql` changed from a retroactive normalized unique index to a trigger-backed guard.
- Existing duplicate production data, including reported `loom c` / `Loom C` rows, is preserved.
- New normalized duplicate looms are blocked by the remote DB guard according to the reported production duplicate probe.
- The migration review remains non-destructive: no `DROP TABLE`, `TRUNCATE`, `DELETE FROM`, or destructive `UPDATE`/backfill.

Evidence:

- Batch 24E artifact: `output/qa/batch24e/BATCH24E-master-data-guardrails-proof.json`.
- Batch 24G artifact: `output/qa/batch24g/BATCH24G-security-audit-guardrails-proof.json`.
- Active matrix: `output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md`.
- Focused tests: `__tests__/batch24e-master-data-guardrails.test.ts`, `__tests__/batch24g-security-audit-guardrails.test.ts`.

Verification:

- `git diff --check` -> passed.
- `jq empty output/qa/batch24e/BATCH24E-master-data-guardrails-proof.json` -> passed.
- `jq empty output/qa/batch24g/BATCH24G-security-audit-guardrails-proof.json` -> passed.
- `npm test -- __tests__/batch24e-master-data-guardrails.test.ts __tests__/batch24g-security-audit-guardrails.test.ts` -> passed.
- `npx tsc --noEmit --pretty false` -> passed.
- Targeted ESLint on touched source/test files -> passed.

Resolution status:

- No row was marked pass-ready.
- `SEC-015` and `SEC-009` are documented as `code_verified/source-fixed`.
- `SEC-017` and `AUTH-008` remain open.
- `MASTER-002` and `MASTER-005` remain `code_verified/source-fixed`, not pass.
- Matrix movement is fail -2 and `code_verified` +2: total 377, pass 195, fail 13, blocked 22, `code_verified` 146, `not_applicable` 1, `not_run` 0.

## Runtime Proof Loop - PROD-029 Browser Copy Closeout

Date/time: 2026-07-06 IST. Branch `codex/runtime-proof-loop-code-verified-to-pass`.

Scope:

- `PROD-029`

Row promoted to `pass`:

- `PROD-029`: QA-env browser/runtime proof confirmed public landing/pricing/FAQ copy and the authenticated supervisor production logging surface use shift-meter / shift-total terminology and do not claim raw opening/closing counter proof while the active production model stores synthetic opening/closing values from shift totals.

Evidence:

- Runtime proof artifact: `output/qa/runtime-proof-loop/GROUP_A-runtime-proof-20260706-PROD-029.json`.
- Screenshots: `output/qa/runtime-proof-loop/PROD-029-landing.png`, `output/qa/runtime-proof-loop/PROD-029-pricing.png`, `output/qa/runtime-proof-loop/PROD-029-faq.png`, and `output/qa/runtime-proof-loop/PROD-029-supervisor-dashboard-loaded.png`.
- Active matrix: `output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md`.

Verification:

- Supabase CLI guard `cat supabase/.temp/project-ref` printed the QA ref `eutycrtzzxmlkcpipgod`.
- QA env file `.env.qa.local` contained the QA ref and did not contain the production ref by sentinel grep checks.
- Local app was started with `.env.qa.local` explicitly sourced before `npm run dev`.
- Browser console warning/error checks were clean on the exercised public and supervisor surfaces.
- `jq empty output/qa/runtime-proof-loop/GROUP_A-runtime-proof-20260706-PROD-029.json` passed.
- Sanitized artifact scan for secret-like URL/key/header/cookie/password patterns passed.

Safety:

- No production mutation occurred.
- No production Supabase command, direct SQL, DB push, DB pull, migration repair, `--include-all`, npm audit, package install, lockfile change, or env-file staging was used.
- No env values, secrets, auth headers, tokens, cookies, request bodies, service-role keys, Supabase keys, or DB URLs were printed or captured.
- `PROD-013`, `PROD-023`, `PROD-022`, `SETUP-011`, `DASH-004`, `EST-017`, `PROD-002`, `PROD-004`, and all Group B rows remain unchanged.

Resolution status:

- Matrix movement is pass +1 and `code_verified` -1: total 377, pass 196, fail 13, blocked 22, `code_verified` 145, `not_applicable` 1, `not_run` 0.
