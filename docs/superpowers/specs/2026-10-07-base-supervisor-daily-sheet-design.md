# Base supervisors: daily sheet access

Date: 2026-10-07. Status: approved in conversation; written for review before planning.

## Goal

A Base-plan owner can let floor supervisors sign in and record the daily production sheet, so the owner no longer types it in. Supervisors see and change nothing else.

## Decisions (from the owner)

| Question | Decision |
| --- | --- |
| What the supervisor sees | Metres only. Workers, machines, qualities, metres / zero / absent / not running. No rates, earnings, payroll summary, costing, or ₹ anywhere, including correction history. |
| Dates and corrections | Today and yesterday (Surat time), both shifts. Can correct any sheet saved inside that window, with a reason. Paid-worker protection and finalized sheets apply as they do for the owner. |
| Sign-in | Email + password on the normal `/login` page, with the normal "forgot password" email. |
| Factory code | One code per factory. Joining creates a pending request; the owner approves or declines in Settings. The owner can regenerate the code or turn joining off. |
| Approach | Two dedicated database functions (read and save). Existing owner-only access rules stay untouched. |

Assumptions: Base only; a lapsed Base plan or a locked factory stops supervisor access to the sheet (reads and saves); a supervisor belongs to one factory; UI in English, Hindi, and Gujarati; phone-first layout.

## Key design choice: supervisors are not tenant members

All 341 existing RLS policies, including 28 legacy policies from the retired Full Suite that still grant writes to `user_role = 'supervisor'` (`dispatches`, `attendance`, `production_logs`, `workers`, `machines`, …), require the caller's `org_id` (JWT claim, `profiles.org_id`, or `get_user_org_id()`) to match the row. Verified by replaying every migration into a disposable database on 2026-10-07.

So a new supervisor's `profiles` row has `org_id = NULL` and its JWT carries no `org_id` claim. The link to the factory lives in a new `factory_supervisors` table that no RLS policy reads. Every existing policy and owner RPC therefore refuses supervisors by construction, and the only way in is the new `SECURITY DEFINER` functions below. A CHECK constraint keeps it that way: an active supervisor profile can never have an `org_id`.

Consequences:
- `getCachedSession()` / `requireRole()` return nothing useful for supervisors (no org), so every existing owner page and action already rejects them. Supervisor pages use a separate guard.
- `org_has_subscription_tier` and `check_org_lockdown` check membership through `profiles.org_id`, so they return false for supervisors. The supervisor functions use their own membership-free checks (below).

## Data model (one migration)

`public.supervisor_join_codes`
- `org_id` PK → organizations, ON DELETE CASCADE
- `code` text UNIQUE, `^[A-HJ-NP-Z2-9]{8}$` (no 0/O/1/I), generated in Postgres
- `joining_enabled` boolean, `created_at`, `updated_at`, `updated_by` → profiles (SET NULL)

`public.factory_supervisors`
- `user_id` PK → profiles, ON DELETE CASCADE (one factory per supervisor)
- `org_id` → organizations, ON DELETE CASCADE
- `status` in `pending | approved | removed`
- `requested_at`, `decided_at`, `decided_by` → profiles (SET NULL), `updated_at`

Both tables: RLS enabled, no policies, all privileges revoked from `anon`, `authenticated`, `service_role`. Only the functions below touch them.

`public.profiles`
- Legacy Full Suite supervisors: `access_revoked_at = now()` for every `role = 'supervisor'` row that is still active. They rejoin with the new code (with a different email, see Limitations).
- New CHECK: `role <> 'supervisor' OR org_id IS NULL OR access_revoked_at IS NOT NULL`.

`custom_access_token_hook`: an active supervisor gets `user_role = 'supervisor'` and `full_name`, and no `org_id` or `onboarding_complete`. Owners, admins, and revoked profiles behave exactly as today.

## Database functions

All functions are `SECURITY DEFINER`, use `SET search_path = ''` (new functions) or keep their existing path (patched ones), and have explicit `REVOKE`/`GRANT`.

Private helpers (no client grants):
- `private.org_has_active_base(org)`: the `base_production` branch of `org_has_subscription_tier` without the membership check. A database test pins it to the same answers as the owner predicate across subscription states.
- `private.active_supervisor_org()`: the caller's org when the profile is `role = 'supervisor'`, not revoked, `factory_supervisors.status = 'approved'`, and the org has active Base. Otherwise NULL.
- `private.base_daily_sheet_writer_org()`: the owner's org (owner role + `base_production_core_access`), else `active_supervisor_org()`.

Save path. Today the owner check (`profiles.role = 'owner'` + core access) is repeated in all three layers of the save chain.
- `save_base_daily_production` and `save_base_daily_production_with_reason` (not callable by clients): the owner lookup is replaced in place with `base_daily_sheet_writer_org()`. The patch uses the repo's existing anchored `pg_get_functiondef` + `replace` technique and raises if the anchor is missing.
- `save_base_daily_production_reviewed`: moved to `private.save_base_daily_production_reviewed_core` with the same patch, so it keeps all register validation, idempotency, conflict checks, paid-worker protection, and receipts.
- New `public.save_base_daily_production_reviewed` with the same signature and grants: an owner-only check, then the core. Owner behaviour is unchanged.
- New `public.save_supervisor_daily_sheet(date, shift, request_id, entries, reason, expected_updated_at)`:
  - Checks that the caller is an active supervisor, the factory is not locked (reads `organizations.is_locked_down` directly), and the date is today or yesterday in Surat time.
  - Calls the core.
  - Moves `planned` jobs that received metres to `active`. The owner does this in TypeScript, but a supervisor can't write that table.
- Revisions record `changed_by = auth.uid()`, so the supervisor is the recorded actor.

Read path:
- `public.get_supervisor_daily_sheet(date, shift)`: active supervisor, factory not locked, plus the date window. Returns:
  - the factory name, `org_id`, `today`, and the earliest allowed date
  - the batch for that date and shift (id, status, `updated_at`, `client_request_id`, `machine_records`)
  - workers on that sheet's candidate list (`id`, `name`, plus `is_active`, `shift_availability`, `pay_type`, `operator_eligible`, `operator_effective_from`, `start_date`, `end_date`, and a `paid` flag through this date). These operator fields let the client reuse `isBaseOperatorAvailable`; none is a ₹ value.
  - active machines and labels
  - the dated assignment per machine for that shift, and the current quality per machine
  - saved entries and allocations for the batch (metres, status, labels)
  - revisions as metres-only summaries (reason, when, who by name, before and after totals, counts)

  It never selects `rate_per_meter`, `monthly_salary`, `worker_rate_snapshot`, costing prices, or payroll amounts.
- `public.get_supervisor_status()`: for the caller, returns `none | pending | approved`, the factory name, `plan_active`, and `locked`. It drives the pending and inactive screens.

Owner functions (owner + Base core access):
- `get_supervisor_access()` returns joining on/off, the code, and the pending and approved lists (name, email, phone, dates).
- `set_supervisor_joining(enabled)` creates the code on first use.
- `regenerate_supervisor_join_code()`.
- `approve_supervisor(user_id)` moves a request from pending to approved.
- `decline_supervisor(user_id)` works on pending requests only. It deletes the profile, which cascades the request. The app then deletes the auth user, so the email can be used again.
- `remove_supervisor(user_id)` moves an approved supervisor to removed and sets `access_revoked_at` and `access_revoked_by`. The account is kept so revisions keep their attribution.
- `get_supervisor_display_names()` returns every supervisor ever linked to the factory (id → name), for "saved by" labels.

Join functions (`service_role` only, called from the join server action):
- `lookup_supervisor_join_code(code)` returns the factory id and name only when the code exists, joining is on, Base is active, and the factory is not locked.
- `register_supervisor_join_request(user_id, code, full_name, email, phone)` re-validates the code and, in one transaction, inserts the supervisor profile (`org_id` NULL) and a pending `factory_supervisors` row.

## Application

Routing (`/supervisor` is the supervisor home):
- [lib/auth.ts](../../../lib/auth.ts) and [proxy.ts](../../../proxy.ts):
  - `getRoleHomePath('supervisor')` changes from `/feature-archived` to `/supervisor`.
  - The proxy stops redirecting `/supervisor/*` for supervisors and redirects everyone else away from it.
  - `/join` becomes a public auth route, so the existing signup rate limit applies to its POSTs and signed-in users are sent home.
  - At `/login`, a revoked or missing profile clears the optimistic role, so a removed or declined supervisor can't bounce between `/login` and `/supervisor`.
- `signIn`, the auth callback, the confirm page, and both onboarding pages send supervisors to `/supervisor`. `signIn` no longer requires an org for supervisors, and its database fallback rejects revoked profiles with "This account no longer has access. Ask the factory owner."

Supervisor pages (`app/supervisor/`):
- `layout.tsx`: a minimal shell with the Weavly mark, factory name, language switcher, and sign out. It requires a supervisor identity, otherwise redirects to `/login`.
- `page.tsx`: the status page.
  - Pending: "Waiting for the owner to approve you", with a Check again button.
  - Plan inactive or factory locked: "The daily sheet is unavailable. Ask the owner."
  - Approved: redirect to `daily-sheet`.
- `daily-sheet/page.tsx` + `actions.ts`: loads `get_supervisor_daily_sheet` and saves through `save_supervisor_daily_sheet`, with the same error mapping as the owner (40001 conflict, 23503 Setup changed, 22023 validation, 42501 access).
- `components/supervisor/SupervisorDailySheet.tsx`, a phone-first sheet:
  - Today and yesterday, day and night shift.
  - Machine rows (machine, quality, worker, metres input, Not running).
  - A Workers panel to mark a worker absent or zero.
  - A progress count (machines accounted for and metres).
  - Save, with an incomplete-shift review.
  - Unlock-to-correct with a reason (3–240 characters).
  - A local draft on the device, keyed by the existing `baseProductionDraftKey`.
  - Conflict handling.
  - A metres-only saved and corrections receipt.
  - Rows without a worker or quality say "Ask the owner to finish Setup".
  - No print sheet, no tour, no links into owner pages.
- `lib/supervisor-daily-sheet.ts`: pure functions. They parse the RPC payload, build machine rows (saved allocation, then saved register record, then current Setup, as on the owner sheet), build the baseline rows, and build the save payload. They are unit-tested.
- `lib/supervisor-access.ts`: client-safe constants plus code normalise, format, and validate. `lib/supervisor-session.ts` (server-only): `getSupervisorSession()` and `requireActiveSupervisor()`.

Join (`app/(auth)/join/`):
- Step 1, the factory code: normalised to uppercase, accepts `ABCD-2345`, and shows the factory name when the code is valid.
- Step 2: name, email, 10-digit mobile, password and confirm (existing `PasswordSchema`), and a Terms and Privacy checkbox.
- The server actions use a dedicated IP rate limit (20 code checks per 15 minutes, bounded local fallback) on top of the proxy limit. They then:
  1. create the auth user (`email_confirm: true`, like owners),
  2. call the register function,
  3. record the legal acceptances against the factory's org,
  4. sign in,
  5. go to `/supervisor`.

  Any failed step rolls back what came before, as owner signup does.
- Errors never reveal whether a code exists beyond "Check the code with your factory owner."

Owner Settings (Base only), `components/settings/supervisors/SupervisorAccessCard.tsx`, placed after the payroll cycle card:
- Joining switch.
- The code (shown as `ABCD-2345`), with Copy and Share on WhatsApp (`wa.me/?text=` with the join link and code) actions, and Regenerate (with a confirm step).
- The waiting list, with Approve and Decline (confirm), and the active list with Remove (confirm).
- Loading, empty, and error states.
- Server actions live in `app/(dashboard)/owner/settings/supervisor-actions.ts`. They use `requireWritableOrg(['owner'])` for writes and check the `production` capability. Decline and Remove also call `revokeUserSession`, and Decline deletes the auth user with the admin client.

Owner daily sheet: the loader adds `supervisorNames` from `get_supervisor_display_names()`, and the history line "Changed by" shows "Ramesh (supervisor)" instead of an id fragment.

i18n: every new string lives in `lib/i18n/supervisor-access.ts` with `en`, `hi`, and `gu`, and the types enforce key parity.

## Testing

Database (`npm run test:db`, new `__tests__/db/supervisor-daily-sheet.dbtest.ts`):
- Join: lookup and register work for a valid code. Invalid, disabled, non-Base, and locked factories are refused. Register is atomic.
- Lifecycle: pending, approve, remove, and decline. Owner functions refuse other factories, non-owners, and supervisors.
- Isolation sweep:
  - A pending, approved, and removed supervisor (seeded with real Base data and a costing) reads zero rows from every Base table, `estimator_quotes`, `organizations`, `org_subscriptions`, the two new tables, and other people's `profiles`.
  - Inserts into the legacy supervisor-writable tables fail.
  - No policy references `factory_supervisors` or `supervisor_join_codes`.
- Read function: the returned JSON contains no rate, salary, price, or earnings keys, and is refused outside the window, for pending supervisors, when Base lapses, and when the factory is locked.
- Save function: a supervisor saves today and yesterday. The day before and future dates are refused. A correction needs a reason. Paid-worker records stay protected. A locked factory is refused. The revision's `changed_by` is the supervisor. A planned job becomes active.
- Owner regression: the owner save is unchanged, including existing `payroll-settlement` and `production-parity` tests. A supervisor calling the owner function is refused.
- The JWT hook claims for owner, active supervisor, and revoked supervisor.
- `org_has_active_base` agrees with `org_has_subscription_tier(…, 'base_production')`.

Vitest:
- Pure-module tests for `lib/supervisor-daily-sheet.ts` and `lib/supervisor-access.ts`.
- Routing tests for the supervisor home in proxy and auth.
- Source-contract tests:
  - The supervisor sheet and loader contain no `rate`, `formatINR`, or `₹`.
  - The migration uses the required function patterns.
  - The i18n file has key parity.

Checks: `npx tsc --noEmit`, `npm run lint` (zero warnings), `npm test`, `npm run test:db`. No `npm run build` (it loads production env).

## Rollout

- The migration is a file only. Per CLAUDE.md, nothing is pushed to Supabase. The owner applies it to production before or with the deploy.
- Ship order is migration first, then app. The migration leaves the owner's behaviour unchanged, so applying it early is safe.

## Limitations (accepted for v1)

- A removed supervisor, or a legacy Full Suite supervisor, can't rejoin with the same email, because the account is kept for attribution. They use another email.
- Founder admin factory views don't list supervisors (their profiles have no org).
- The organization data export doesn't include the supervisor list.
- Out of scope: owner notifications, multiple factories per supervisor, supervisors editing Setup, offline saving, a supervisor cap, and a guided tour.
