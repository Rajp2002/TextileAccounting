# Base Supervisor Daily Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Base owners approve supervisors who join with a factory code. Supervisors record and correct the daily production sheet (metres only, today and yesterday) and see nothing else.

**Architecture:** Supervisors are not tenant members. `profiles.org_id` is NULL and the JWT has no `org_id`, so every existing RLS policy refuses them. Membership lives in `factory_supervisors`, which only new `SECURITY DEFINER` functions read. The daily-save chain derives its org from one helper that accepts an owner or an active supervisor. Owner and supervisor entry points apply their own rules before calling a shared private core.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase Postgres (plpgsql), zod, Vitest, the disposable-PostgreSQL `npm run test:db` harness.

**Spec:** `docs/superpowers/specs/2026-10-07-base-supervisor-daily-sheet-design.md`

## Global Constraints

- **Migrations:** files only. Never `supabase db push`. New functions use `SECURITY DEFINER`, `SET search_path = ''`, and explicit `REVOKE ALL ... FROM PUBLIC, anon, authenticated, service_role` before any `GRANT`.
- **Join code:** matches `^[A-HJ-NP-Z2-9]{8}$`. It is displayed as `XXXX-XXXX`, and input accepts lowercase, spaces, and a hyphen.
- **Date window:** Surat date `today` and `today - 1`, from `(now() AT TIME ZONE 'Asia/Kolkata')::date` in SQL and `getSuratTodayString()` in TS.
- **Correction reason:** 3–240 characters after trim.
- **No money on supervisor surfaces:** no `rate`, `salary`, `price`, `earning`, `gross`, `formatINR`, or `₹` in supervisor payloads or components.
- **Translations:** every new user-facing string is in `lib/i18n/supervisor-access.ts` with `en`, `hi`, and `gu`.
- **Controls:** at least 44px tall on mobile. Primary actions use the ink/loom button, not saffron.
- **Supervisor home:** `/supervisor`. Sheet: `/supervisor/daily-sheet`. Join: `/join`.
- **Builds:** don't run `npm run build` or `npm start` (they load production env).

## Review Focus

1. **A removed or declined supervisor whose JWT is still live opens the app.** Expected: they land on `/login` with no redirect loop. Task 6 adds a proxy test: a revoked or missing profile at `/login` clears the role.
2. **The owner corrects a sheet a supervisor saved, or the reverse.** Expected: both succeed with a reason, and the revision records the correct actor. Task 3 adds a dbtest: supervisor saves, owner corrects, and both revisions are attributed.
3. **A supervisor submits a stale sheet after the owner changed it.** Expected: a 40001 conflict, and the draft is kept. Task 3 adds a dbtest: an expected_updated_at mismatch raises 40001.
4. **The code is typed as `abcd 2345` or `ABCD-2345`.** Expected: both resolve. Task 4 adds unit tests for `normalizeJoinCode`.
5. **Night shift entered after midnight for yesterday's date.** Expected: allowed, while two days ago is refused. Task 3 adds a dbtest: `today - 1` night is allowed and `today - 2` is refused with 22023.

---

### Task 1: Membership schema, helpers, token hook, legacy revocation

**Files:**
- Create: `supabase/migrations/20261007120000_supervisor_membership.sql`
- Test: `__tests__/db/supervisor-membership.dbtest.ts`
- Modify: `__tests__/db/helpers.ts` (add `seedSupervisor`)

**Interfaces:**
- Produces, as SQL:
  - tables `public.supervisor_join_codes(org_id, code, joining_enabled, created_at, updated_at, updated_by)` and `public.factory_supervisors(user_id, org_id, status, requested_at, decided_at, decided_by, updated_at)`
  - `private.org_has_active_base(uuid) → boolean`
  - `private.active_supervisor_org() → uuid`
  - `private.supervisor_org_locked(uuid) → boolean`
  - `private.generate_supervisor_join_code() → text`
  - the `profiles_active_supervisor_has_no_org` CHECK
  - the patched `public.custom_access_token_hook`
- Produces, in TS: `seedSupervisor(db, orgId, status: 'pending'|'approved'|'removed') → { userId }` in helpers. It inserts `auth.users`, a profile (`role='supervisor'`, `org_id NULL`, `access_revoked_at` set when removed), and a `factory_supervisors` row.

- [ ] **Step 1: Write the failing dbtests.**
  - `active_supervisor_org` returns the org only for approved supervisors with active Base. It returns NULL for pending, removed, lite, expired-beyond-grace, and an owner.
  - `org_has_active_base` equals `org_has_subscription_tier(org,'base_production')` evaluated as the owner, for: active base, base within 24h grace, base expired 2 days ago, base starting tomorrow, active lite, halted base with a future end.
  - The hook gives an owner the same claims as before. An active supervisor gets `user_role='supervisor'` and no `org_id` key. A revoked supervisor gets no `user_role`.
  - Inserting a profile with `role='supervisor'`, a non-null `org_id`, and `access_revoked_at NULL` fails with 23514.
  - The legacy revoke runs as part of the migration (asserted by re-running its UPDATE on a seeded legacy row).
  - `generate_supervisor_join_code()` matches the alphabet regex.
- [ ] **Step 2:** Run `npx vitest run --config vitest.db.config.ts __tests__/db/supervisor-membership.dbtest.ts`. Expected: FAIL (relations and functions missing).
- [ ] **Step 3: Write the migration.**
  - Create both tables with RLS enabled, no policies, and all privileges revoked.
  - `factory_supervisors.user_id` references profiles ON DELETE CASCADE. Add an index on `(org_id, status)`.
  - Revoke legacy supervisors: `UPDATE profiles SET access_revoked_at = now() WHERE role='supervisor' AND access_revoked_at IS NULL`.
  - Add the CHECK.
  - Create the helpers. `org_has_active_base` copies the `base_production` subscription predicate verbatim, without the membership clause. `supervisor_org_locked` reads `organizations.is_locked_down`. The code generator uses `gen_random_uuid()` bytes mapped onto the alphabet.
  - Recreate the hook from its live definition, adding a supervisor branch that keeps `user_role` and `full_name` and strips `org_id` and `onboarding_complete`. Keep the existing grant to `supabase_auth_admin` and the revoke from PUBLIC.
- [ ] **Step 4:** Run the same dbtest. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): supervisor membership tables, helpers and token claims`.

### Task 2: Owner, join, and status functions

**Files:**
- Modify: `supabase/migrations/20261007120000_supervisor_membership.sql` (append)
- Test: `__tests__/db/supervisor-access.dbtest.ts`

**Interfaces:**
- Consumes: the Task 1 helpers.
- Produces, granted to `authenticated` unless noted. Owner functions raise 42501 for non-owners or orgs without Base core access, and 42501 when the factory is locked (writes only).
  - `public.get_supervisor_access() → jsonb {joining_enabled boolean, code text|null, pending:[{user_id, full_name, email, phone, requested_at}], approved:[{…, decided_at}]}`
  - `public.set_supervisor_joining(p_enabled boolean) → jsonb` (same shape as `get_supervisor_access`; creates the code row on first enable)
  - `public.regenerate_supervisor_join_code() → text`
  - `public.approve_supervisor(p_user_id uuid) → void` (pending only; otherwise 22023)
  - `public.decline_supervisor(p_user_id uuid) → void` (pending only; deletes the profile)
  - `public.remove_supervisor(p_user_id uuid) → void` (approved only; sets status `removed`, `access_revoked_at`, and `access_revoked_by`)
  - `public.get_supervisor_display_names() → jsonb [{user_id, full_name}]` (every status)
  - `public.get_supervisor_status() → jsonb {status:'none'|'pending'|'approved', org_id, factory_name, plan_active, locked, today}` (caller's own row)
  - service_role only: `public.lookup_supervisor_join_code(p_code text) → jsonb {org_id, factory_name}|null` and `public.register_supervisor_join_request(p_user_id uuid, p_code text, p_full_name text, p_email text, p_phone text) → jsonb {org_id, factory_name}` (raises 22023 'Check the code with your factory owner.' when the code is invalid)

- [ ] **Step 1: Write the failing dbtests.**
  - Owner enables joining, gets a code, regenerates it (the code changes and the old one fails lookup), and disables joining (lookup returns null).
  - Lookup returns null for a lite org, a locked org, or an unknown code.
  - Register creates a pending row and a profile with `org_id NULL`. A second register for the same user fails.
  - An owner from another org can't approve. A supervisor calling `get_supervisor_access` gets 42501.
  - After approve, `get_supervisor_status` returns approved. After decline, the profile is gone. After remove, `access_revoked_at` is set and `active_supervisor_org()` is NULL.
  - `authenticated` can't execute the lookup or register functions (42501).
- [ ] **Step 2:** Run the dbtest. Expected: FAIL.
- [ ] **Step 3:** Implement the functions in the migration file. Codes are normalised with `upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'))`.
- [ ] **Step 4:** Run the dbtest. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): owner supervisor management and join functions`.

### Task 3: Save chain refactor and supervisor read/save functions

**Files:**
- Create: `supabase/migrations/20261007120100_supervisor_daily_sheet.sql`
- Test: `__tests__/db/supervisor-daily-sheet.dbtest.ts`

**Interfaces:**
- Consumes: `private.active_supervisor_org()`, `private.supervisor_org_locked(uuid)`, and `seedSupervisor`.
- Produces:
  - `private.base_daily_sheet_writer_org() → uuid`
  - `private.save_base_daily_production_reviewed_core(date,text,uuid,jsonb,text,timestamptz) → jsonb`, with no client grants
  - `public.save_base_daily_production_reviewed(...)`, an owner wrapper with the same signature and an `authenticated` grant
  - `public.save_supervisor_daily_sheet(p_production_date date, p_shift text, p_client_request_id uuid, p_entries jsonb, p_correction_reason text, p_expected_updated_at timestamptz) → jsonb`
  - `public.get_supervisor_daily_sheet(p_production_date date, p_shift text) → jsonb`, with these keys:
    - `org_id`, `factory_name`, `today`, `min_date`
    - `batch` (`{id, status, updated_at, client_request_id, machine_records}`, or null)
    - `workers` (`[{id, name, is_active, shift_availability, pay_type, operator_eligible, operator_effective_from, start_date, end_date, paid}]`)
    - `machines` (`[{id, label, machine_type, is_active}]`)
    - `assignments` (`[{id, worker_id, machine_id}]`, dated for this shift)
    - `machine_jobs` (`[{machine_id, job_id, job_label}]`)
    - `entries` (`[{id, worker_id, entry_status, meters, notes, machine_id, job_id}]`)
    - `allocations` (`[{entry_id, worker_id, assignment_id, machine_id, job_id, machine_label, job_label, meters}]`)
    - `revisions` (`[{revision_number, change_kind, correction_reason, changed_at, changed_by_name, before_total, after_total, entered_count, zero_count, absent_count}]`)

- [ ] **Step 1: Write the failing dbtests.** Seed using the `workerWithProduction` pattern from `payroll-settlement.dbtest.ts`.
  - Window and save rules:
    - An approved supervisor saves today's day shift. The result has a `batch_id`, and the revision's `changed_by` is the supervisor.
    - Yesterday's night shift is allowed.
    - `today-2` and `today+1` are refused with 22023.
    - Pending, removed, lite, and locked are refused with 42501.
    - The supervisor calling `save_base_daily_production_reviewed` gets 42501.
  - Corrections and conflicts:
    - A correction without a reason is refused with 22023.
    - The owner corrects a supervisor's sheet and the supervisor corrects the owner's sheet, and both revisions are attributed.
    - A stale `expected_updated_at` raises 40001.
  - Paid worker: after owner settlement, changing that worker's record raises 'Paid worker machine records are protected.'
  - Job status: a planned job with metres becomes `active`.
  - Read:
    - The JSON text (lowercased) contains none of `rate`, `salary`, `price`, `earning`, `gross`, or `cost`.
    - It's refused outside the window, for pending supervisors, when Base lapses, and when the factory is locked.
    - `machine_jobs` and `assignments` match the seed.
  - Isolation sweep, for a pending, approved, and removed supervisor:
    - `SELECT count(*)` is 0 on every `public` base table, `estimator_quotes`, `organizations`, `org_subscriptions`, `supervisor_join_codes`, and `factory_supervisors`.
    - Profiles show only the caller's own row.
    - An INSERT into `dispatches` and `production_logs` fails.
    - `pg_policies` has no row mentioning `factory_supervisors` or `supervisor_join_codes`.
  - Owner regression: the existing owner seeding plus `save_base_daily_production_reviewed` still returns a `batch_id`.
- [ ] **Step 2:** Run the dbtest. Expected: FAIL.
- [ ] **Step 3: Write the migration.**
  1. Create `writer_org`.
  2. In a `DO` block, patch the live definitions of `public.save_base_daily_production(date,text,uuid,jsonb)` and `public.save_base_daily_production_with_reason(date,text,uuid,jsonb,text)`. Replace the exact owner-lookup anchor (the `SELECT profile.org_id INTO v_org_id FROM public.profiles AS profile WHERE profile.id = auth.uid() AND profile.role::text = 'owner';` block and its `base_production_core_access` IF) with `v_org_id := private.base_daily_sheet_writer_org(); IF v_org_id IS NULL THEN RAISE … 42501`, and RAISE if the anchor isn't found.
  3. `ALTER FUNCTION public.save_base_daily_production_reviewed(...) SET SCHEMA private`, rename it to `..._core`, patch its one-line owner lookup the same way, then `REVOKE ALL` on it.
  4. Create the public owner wrapper and the supervisor function. The supervisor function checks org, lock, and window; calls the core; then runs `UPDATE base_production_jobs SET status='active'` for planned jobs in allocations with meters > 0.
  5. Create the read function.
- [ ] **Step 4:** Run the new dbtest and the existing `payroll-settlement`, `production-parity`, `base-fixed-operator`, and `admin-factories` dbtests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): supervisor daily-sheet read and save through the shared core`.

### Task 4: Client-safe access module, translations, join rate limit

**Files:**
- Create: `lib/supervisor-access.ts`, `lib/i18n/supervisor-access.ts`
- Modify: `lib/rate-limit.ts`
- Test: `__tests__/supervisor-access.test.ts`

**Interfaces:**
- Produces:
  - `SUPERVISOR_HOME_PATH = '/supervisor'`, `SUPERVISOR_SHEET_PATH = '/supervisor/daily-sheet'`, `SUPERVISOR_JOIN_PATH = '/join'`
  - `normalizeJoinCode(input: string): string`
  - `isValidJoinCode(code: string): boolean`
  - `formatJoinCode(code: string): string` (`ABCD-2345`)
  - `supervisorDateWindow(today: string): { min: string; max: string }`
  - `supervisorText(language: Language, key: SupervisorTextKey, values?: Record<string, string | number>): string`, where `{name}` placeholders are replaced
  - `checkSupervisorJoinRateLimit(ip: string): Promise<number | null>` (20 per 900s, bounded local fallback)

- [ ] **Step 1: Write failing tests.**
  - `normalizeJoinCode(' abcd-2345 ')` returns `'ABCD2345'`.
  - `isValidJoinCode('ABCD2O45')` is false (contains O).
  - `formatJoinCode('ABCD2345')` returns `'ABCD-2345'`.
  - `supervisorDateWindow('2026-10-01')` returns `{min:'2026-09-30', max:'2026-10-01'}`.
  - `en`, `hi`, and `gu` have identical key sets with no empty strings.
  - `supervisorText('en','pendingTitle')` is non-empty.
- [ ] **Step 2:** Run `npx vitest run __tests__/supervisor-access.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. In `lib/rate-limit.ts`, give `checkLocalAuthRateLimit` a `limit` parameter (default `AUTH_LIMIT`) and add the join limiter with the `supervisor-join:${ip}` key.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: supervisor access constants, copy and join rate limit`.

### Task 5: Supervisor session guard

**Files:**
- Create: `lib/supervisor-session.ts` (server-only)
- Test: `__tests__/supervisor-session-contract.test.ts` (source contract)

**Interfaces:**
- Consumes: `getVerifiedIdentity` (lib/auth), `get_supervisor_status`.
- Produces:
  - `type SupervisorSession = { userId: string; fullName: string; status: 'none'|'pending'|'approved'; orgId: string|null; factoryName: string|null; planActive: boolean; locked: boolean; today: string }`
  - `getSupervisorSession(): Promise<SupervisorSession|null>`, wrapped in React `cache`. It returns null unless the profile role is `supervisor`.
  - `requireActiveSupervisor(): Promise<SupervisorSession & { orgId: string }>`. It redirects to `/login` when there is no session and to `/supervisor` unless the supervisor is approved, on an active plan, and not locked.

- [ ] **Step 1:** Write a contract test: the file imports `server-only`, calls `rpc('get_supervisor_status')` with the server client (not `createAdminClient`), and `requireActiveSupervisor` checks `planActive` and `locked`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: supervisor session guard`.

### Task 6: Routing for the supervisor role

**Files:**
- Modify: `proxy.ts`, `lib/auth.ts:21-26`, `app/(auth)/actions/auth.ts:359-419`, `app/auth/callback/route.ts:73`, `app/auth/confirm/page.tsx:40,99`, `app/(auth)/onboarding/page.tsx:36`, `app/(auth)/onboarding/base/page.tsx:36`
- Test: `__tests__/supervisor-routing.test.ts`, plus the existing proxy tests

**Interfaces:**
- Consumes: `SUPERVISOR_HOME_PATH`.

- [ ] **Step 1: Write failing tests,** following the pattern of the existing proxy tests (`__tests__/admin-proxy-routing.test.ts`) that mock Supabase.
  - A supervisor claim on `/` redirects to `/supervisor`.
  - A supervisor on `/owner/estimator` redirects to `/supervisor`.
  - An owner on `/supervisor` redirects to `/owner/estimator`.
  - An anonymous user on `/join` passes through.
  - A signed-in supervisor on `/join` redirects to `/supervisor`.
  - At `/login`, a revoked profile row clears the role (no redirect).
  - `getRoleHomePath('supervisor') === '/supervisor'`.
  - Source contract: no `'/feature-archived'` string remains for supervisors in auth.ts, callback, confirm, or onboarding.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `signIn`: `needsOrganization` covers owners only. The DB fallback selects `access_revoked_at`. A revoked profile is signed out and fails with `This account no longer has access. Ask the factory owner.` Supervisors succeed to `/supervisor`.
- [ ] **Step 4:** Run the new test plus `npx vitest run __tests__/admin-proxy-routing.test.ts __tests__/proxy-terminal-session-recovery.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: route supervisors to their home`.

### Task 7: Join page and actions

**Files:**
- Create: `app/(auth)/join/page.tsx`, `app/(auth)/join/join-form.tsx`, `app/(auth)/actions/supervisor-join.ts`, `lib/schemas/supervisor-join.ts` (or a new export in `lib/schemas.ts`)
- Test: `__tests__/supervisor-join.test.ts`

**Interfaces:**
- Consumes: Task 2's service-role functions, Task 4's limiter and copy, `PasswordSchema`, `isValidIndianPhone`/`normalizeIndianPhone`, `LEGAL_DOCUMENTS`, and `AuthLayout`.
- Produces:
  - `checkSupervisorJoinCode(code: string): Promise<{ valid: true; factoryName: string } | { valid: false; error: string }>`
  - `joinFactoryAsSupervisor(input: { code; fullName; email; phone; password; confirmPassword; acceptedLegal: boolean }): Promise<{ error: string } | never>`, which redirects to `/supervisor` on success
  - `SupervisorJoinSchema` (zod)

- [ ] **Step 1: Write failing tests.**
  - `SupervisorJoinSchema` rejects mismatched passwords, a missing legal acceptance, a name shorter than 2 characters, and an invalid code.
  - Source contract on the actions file:
    - it calls `checkSupervisorJoinRateLimit`
    - it rolls back with `deleteUser` on a register failure
    - it calls `register_supervisor_join_request`
    - it inserts `legal_document_acceptances`
    - it never returns different errors for an unknown versus a disabled code
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - A two-step form with a code input (`autoCapitalize="characters"`, auto-check at 8 characters).
  - Errors use one generic code message.
  - On success: sign in with password, then redirect to `/supervisor`.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: supervisor join page`.

### Task 8: Pure supervisor sheet model

**Files:**
- Create: `lib/supervisor-daily-sheet.ts`
- Test: `__tests__/supervisor-daily-sheet.test.ts`

**Interfaces:**
- Consumes: `isBaseOperatorAvailable`, `machineReadingState`, `machineWorkerStatus`, and `compareMachineLabels`.
- Produces:
  - `parseSupervisorSheet(raw: unknown): SupervisorSheetData` (zod)
  - `type SupervisorMachineRow = { machineId; machineLabel; workerId: string|null; workerName: string|null; jobId: string|null; jobLabel: string|null; paid: boolean }`
  - `buildSupervisorSheet(data, date, shift): { rows: SupervisorMachineRow[]; workers: SheetWorker[]; baseline: Record<string, DraftRow> }`, with the precedence saved allocation, then saved register record, then current Setup, as in the owner sheet
  - `buildSupervisorSavePayload(...)`, producing the `p_entries` shape the save function accepts: `[{worker_id, entry_status, meters, notes, machine_records:[{machine_id,state}], allocations:[{machine_id, job_id, meters}]}]`

- [ ] **Step 1: Write failing tests.**
  - A saved allocation overrides a changed assignment.
  - A machine with no worker yields `workerId: null`.
  - An absent worker gets every machine state `absent`.
  - `meters` is the sum of allocations rounded to 2 decimals.
  - A worker who isn't available and isn't saved is excluded.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: supervisor daily-sheet model`.

### Task 9: Supervisor shell, status page, daily sheet

**Files:**
- Create: `app/supervisor/layout.tsx`, `app/supervisor/page.tsx`, `app/supervisor/daily-sheet/page.tsx`, `app/supervisor/daily-sheet/actions.ts`, `components/supervisor/SupervisorDailySheet.tsx`, `components/supervisor/supervisor-status-view.tsx`
- Test: `__tests__/supervisor-sheet-contract.test.ts`

**Interfaces:**
- Consumes: Tasks 4, 5, and 8, plus `get_supervisor_daily_sheet` and `save_supervisor_daily_sheet`.
- Produces: `saveSupervisorDailySheet(input) → { success: true; totalMeters: number; idempotent: boolean } | { error: string }`

- [ ] **Step 1: Write failing contract tests.**
  - The component and page files contain none of `formatINR`, `₹`, `rate`, or `salary`.
  - Every `t(`/`supervisorText(` key exists.
  - The actions file calls `requireActiveSupervisor` and `rpc('save_supervisor_daily_sheet'`.
  - The page calls `rpc('get_supervisor_daily_sheet'` and clamps the date to the window.
  - `renderToStaticMarkup` of `SupervisorStatusView` for `pending` contains the pending copy.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The layout uses `LanguageSwitcher` and `LogoutButton variant="header"`.
  - The sheet follows the owner UX minus money, print, tour, and owner links.
  - The date picker is two buttons (Today / Yesterday) plus a Day / Night toggle.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: supervisor daily sheet`.

### Task 10: Owner Settings supervisor card

**Files:**
- Create: `components/settings/supervisors/SupervisorAccessCard.tsx`, `app/(dashboard)/owner/settings/supervisor-actions.ts`
- Modify: `components/settings/plan-aware/plan-aware-settings-view.tsx` (render after `PayrollCycleSettingsCard` when `tier === 'base'`)
- Test: `__tests__/supervisor-settings-contract.test.ts`

**Interfaces:**
- Produces:
  - `getSupervisorAccessAction()`
  - `setSupervisorJoiningAction(enabled)`
  - `regenerateSupervisorCodeAction()`
  - `approveSupervisorAction(userId)`
  - `declineSupervisorAction(userId)`, which deletes the auth user with the admin client after the RPC
  - `removeSupervisorAction(userId)`, which calls `revokeUserSession`

  Each returns `{ data } | { error }`.

- [ ] **Step 1: Write failing contract tests.**
  - The settings view renders `SupervisorAccessCard` only under `tier === 'base'`.
  - Every write action calls `requireWritableOrg(['owner'])` and checks `hasCapability(tier, 'production')`.
  - Decline uses `auth.admin.deleteUser` and remove uses `revokeUserSession`.
  - The card has confirm dialogs for regenerate, decline, and remove.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement the card with TanStack Query, plus loading, empty, and error states.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(settings): owner manages supervisors`.

### Task 11: Owner sheet shows who saved

**Files:**
- Modify: `app/(dashboard)/owner/production/loaders.ts` (add `supervisorNames: Record<string, string>` via `rpc('get_supervisor_display_names')`; on error, an empty object), `app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx:1164`
- Test: `__tests__/supervisor-attribution-contract.test.ts`

- [ ] **Step 1:** Write a failing contract test: the loader calls `get_supervisor_display_names`, and the sheet uses `initialData.supervisorNames`.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement. The label is `${name} (supervisor)`, and the `you` and `owner` fallbacks are unchanged.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(production): attribute supervisor saves`.

### Task 12: Full verification

- [ ] Run `npx tsc --noEmit`. Expected: exit 0.
- [ ] Run `npm run lint`. Expected: 0 errors, 0 warnings.
- [ ] Run `npm test`. Expected: all pass, with 1 skipped (the live Supabase test).
- [ ] Run `npm run test:db`. Expected: all pass.
- [ ] Add a line to `docs/general/README.md` linking the spec.
- [ ] Commit: `docs: index supervisor daily-sheet spec`.
