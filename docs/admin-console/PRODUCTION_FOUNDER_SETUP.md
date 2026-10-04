# Production founder setup

**Current setup status, 4 October 2026, 22:25 UTC:** approved database setup is complete in `vzhwahudircrpgtitwzd`: all ten console migrations applied (326 history versions), required objects pass, and UUID `0fe24cd4-bd20-4050-aa56-0631bd03d9ce` has the sole email-bound founder grant and dedicated `admin` profile with no organization/factory. One safe operator audit records provisioning. Password is set, email is confirmed, hosted TOTP is enabled and zero founder factors are verified. Do not recreate the account or rerun the old reset. Deployment/Production gates are the next stage; Raj enters his password and scans the private QR himself.

Raj approved the exact setup/deployment and private backup/login scope. Real local Auth/RPC10/10 and desktop/mobile built-app browser13/13 groups pass with zero synthetic Auth users; independent review finds no material issue. Lint/typecheck, unit and database regressions pass. [PR #188](https://github.com/Rajp2002/TextileAccounting/pull/188) remains unmerged; the latest originating instruction authorizes deploying its immutable reviewed branch for Raj's actual login test. See [release execution evidence](FOUNDER_RELEASE_EXECUTION.md) and [the target document](FOUNDER_SETUP_TARGET.md) for precise limits. Older pending statements below describe the historical preparation, not current blockers.

Prepared on 4 October 2026 from branch `codex/founder-admin`, head `6f7ebf1aa02f48bd840370f44964ced2495801be`. PR [#187](https://github.com/Rajp2002/TextileAccounting/pull/187) was merged by Rajp2002 at 15:09:16 UTC as `872debb7d09ec3e1856375e142cc841589c99af6`; current remote main is that merge commit. The Vercel production deployment `dpl_4yxj2yF554RhKtzLayG21FAL5Wwq` is READY on the merge commit. Its verified alias is https://textile-accounting.vercel.app.

The earlier read-only deployment check of https://textile-accounting.vercel.app/admin/login returned 200 and the message “Founder access is awaiting approved identity and security setup.” Vercel environment metadata at that inspection contained no `WEAVLY_ADMIN_*` or `WEAVLY_SUPPORT_*` gates; it has not been rechecked during the replacement-UUID slice. Code was deployed, while database migrations, founder identity/grant and actual MFA acceptance were **not verified**. The fresh database/identity evidence is recorded above.

Raj subsequently authorized deleting the abandoned old account/factory/local history and recreating a fresh identity. Follow the short [reset-and-recreate guide](FOUNDER_RESET_AND_RECREATE.md) first; it supersedes the earlier preserve-UUID approach. No live SQL, account/grant/security change, factor enrollment, environment edit or deployment was performed by the agent. Production migrations/grants/MFA/security/deployment still require their concrete environment/identity approval. Passwords, QR codes, authenticator secrets and OTP entry stay with Raj.

## 1. Confirm the actual environments before setup

In Vercel project `textile-accounting`, Settings → Environment Variables, identify the production `NEXT_PUBLIC_SUPABASE_URL` project reference. Verify its matching Supabase project and operator access. Keep the existing server-only service credential private; do not paste it into chat or put it in a `NEXT_PUBLIC_` variable.

At the earlier environment inspection, the URL variable was one entry targeting **production, preview and development**. Preview isolation remains unverified; treat preview as capable of reaching the live database until exact project references and deployed configurations prove otherwise. A preview hostname or Vercel protection does not create database isolation. Keep preview founder/support flags off; run destructive/reset/fixture operations only in an explicitly isolated project.

Raj has now confirmed the dashboard target `vzhwahudircrpgtitwzd`; the saved production public URL also points there. Although this reference was absent from the connector's initial project list, a subsequent exact-project read-only SQL query and migration listing succeeded. They verify the replacement identity and missing console schema in that target. The Supabase branch list exposes only its default `main`, so an isolated hosted staging branch is not evidenced. Deployed environment binding, provider/security acceptance and recovery still need release verification. Do not choose a similarly named project or treat the repository configuration alone as proof.

## 2. Identify the founder account without changing it

In the confirmed production Supabase project, open **Authentication → Users** and search for `Rajpatel86420@gmail.com`.

- **No matching account:** choose **Add user → Create new user**, enter `Rajpatel86420@gmail.com` and a new strong password privately. For your own account created by you in the trusted dashboard, select **Auto Confirm User** if offered. Confirm that the resulting user is email-confirmed. Copy its **User UID / UUID**. Do not create it through Weavly customer signup, insert passwords into SQL, or create a factory for it.
- **A matching account exists:** reuse that user instead of creating a duplicate. Copy its UUID, verify that it is your account and email-confirmed, and use the supported password-recovery flow if needed. If its profile is an owner/supervisor or linked to a customer organization, stop for the account-separation decision below.

Creating an Auth user alone does not grant admin access. A deleted/recreated account has a new UUID; an old grant must not automatically follow the email. Password entry and confirmation stay with you. The scripts below independently check the UUID, current email and confirmed-email state.

An operator can review the same identity/profile with this **read-only** SQL in that project's SQL editor:

```sql
SELECT u.id AS user_id, u.email, u.email_confirmed_at,
       p.role, p.org_id, p.access_revoked_at
FROM auth.users AS u
LEFT JOIN public.profiles AS p ON p.id = u.id
WHERE lower(btrim(u.email)) = 'rajpatel86420@gmail.com';
```

The intended founder identity has a server-managed `public.profiles` row with `role = 'admin'`, no revoked access and a platform identity path that can have `org_id = NULL`. Do not create a fake organization. If this email currently belongs to a customer owner/supervisor, stop for an explicit account-separation/migration decision: changing that role can break its customer access. Do not create a second same-email account or silently promote an owner.

**Founder-only account policy:** Raj has confirmed that this email is exclusively for founder access. Normal Weavly `/login` and `/signup` must reject it; customer tenant/support guards must also reject it even if old owner metadata remains. The separate `/admin/login` accepts the approved email and password, then requires TOTP. Recovery remains available. Supabase still stores one Auth identity; there is no second password database. This follow-up code must be reviewed and deployed before claiming that normal-login rejection is live. The required setup leaves `role = admin`, `org_id = NULL`, and no owned factory; a profile deletion does not itself remove ownership or customer records.

**Current account decision:** old UUID `d0e56517-29f9-474f-b368-9e63e84da25a` previously owned the abandoned `test` factory `2420a5a8-d231-4ed2-b9ce-9db986e38879`, with zero profiles, saved setup, 18 audit rows, four subscription rows and one recorded captured payment. Raj authorized the local purge and supplied the successful reset result: both `old_auth_exists` and `old_factory_exists` are false. The reset evidence remains operator-supplied. Raj then created replacement UUID `0fe24cd4-bd20-4050-aa56-0631bd03d9ce`; a direct read-only query now verifies its confirmed founder email, missing profile and no owned factory. Do not rerun the reset, recreate the new account or reuse the deleted UUID. Founder setup still needs the ten missing reviewed migrations before the new grant can be provisioned.

There is no founder self-provisioning endpoint, seed or reviewed provisioning CLI. **Do not use `scripts/create-admin.ts`:** it creates credentials from command-line arguments and creates no protected founder grant.

The reviewed generic transaction is [FOUNDER_SELF_SETUP.sql](FOUNDER_SELF_SETUP.sql). For Raj's confirmed replacement identity, use the prepared [FOUNDER_CONFIRMED_SETUP.sql](FOUNDER_CONFIRMED_SETUP.sql), which has no placeholders and includes a final read-only result. **Do not run it while the required tables are missing.** After the migrations and exact grant/security operation are approved and verified, open **SQL Editor → New query**, select the **postgres** role and run the complete prepared transaction. It creates a missing dedicated admin profile and grant plus safe operator audit; it refuses factory ownership even when the profile was deleted, an existing customer/revoked profile, another enabled founder, or a disabled/revoked/mismatched grant. It never creates credentials, confirms email, changes Auth metadata, enrolls MFA, creates an organization, or reactivates revoked access. Successful same-UUID retries are harmless. A failure rolls back the transaction; do not remove the checks to work around an error.

Verify the resulting account with this read-only query:

```sql
SELECT u.id, u.email, u.email_confirmed_at,
       p.role, p.org_id, p.access_revoked_at,
       g.enabled, g.revoked_at, g.login_email
FROM auth.users AS u
LEFT JOIN public.profiles AS p ON p.id = u.id
LEFT JOIN private.platform_founder_grants AS g ON g.user_id = u.id
WHERE lower(btrim(u.email)) = 'rajpatel86420@gmail.com';
```

Expected: one row, your copied UUID, a non-null email-confirmation timestamp, `role = admin`, `org_id = NULL`, `access_revoked_at = NULL`, `enabled = true`, `revoked_at = NULL`, `login_email = rajpatel86420@gmail.com`. Keep the console/enrollment gates closed until the remaining acceptance steps pass.

The exact SQL was verified against the full migration replay in disposable loopback PostgreSQL, substituting reserved synthetic email/UUID fixtures: **9 scenarios passed**, including idempotent repeat, wrong/unconfirmed identity, missing-profile surviving factory ownership, customer/revoked profile, another founder, revoked grant and ordinary-role denial. A provisioned AAL1 session remained denied; AAL2 could establish the platform session. This is not a production execution or real provider acceptance.

Reproduce that verification from the repository root with `node scripts/performance/isolated-command.mjs node scripts/qa/founder-setup-sql-smoke.mjs`. It creates and destroys a local-only PostgreSQL cluster, replays the complete migration set and substitutes synthetic values in the manual templates; it never applies the templates to a hosted project. The separate factory inspector has three database regressions in `__tests__/db/admin-test-factory-inspector.dbtest.ts`.

## 3. Review database history, recovery and all dependencies

Before approving live migrations, record the exact target project, applied history, migration diff and a verified backup/recovery point. Rehearse migration/rollback and real Auth tests in an isolated staging project. Existing CI's PostgreSQL/Auth fixtures are synthetic; they do not establish hosted Supabase compatibility, real MFA or recovery.

The agent's read-only hosted migration comparison has already established the current pending set: precisely the ten console versions below, with no hosted-only versions. Raj need not repeat that diagnostic. After the approved migration application, run [MIGRATION_PRECHECK.sql](MIGRATION_PRECHECK.sql). The first result must show all ten required versions as `recorded_applied = true`; the second checks required objects, the email-binding column and critical RPCs. Revalidate immediately before application; a changed history or missing object is a stop for review, not permission to reset, rerun existing SQL or guess a history repair.

Additional read-only history review, where the standard migration-history table exists:

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

The console's ten additive migrations exist in this exact dependency order:

1. `20261004150000_founder_admin_boundary.sql`
2. `20261004150500_founder_support_workflow.sql`
3. `20261004151000_founder_factory_reporting.sql`
4. `20261004152000_admin_billing_reporting.sql`
5. `20261004153000_admin_data_rights_compatibility.sql`
6. `20261004154000_founder_email_and_mfa_setup.sql`
7. `20261004155000_admin_legacy_read_indexes.sql`
8. `20261004170000_admin_retained_record_review.sql`
9. `20261004180000_admin_formal_case_workflow.sql`
10. `20261004190000_admin_retention_review.sql`

The Supabase CLI installed here is **2.109.0**; these command names and flags were verified with `--help`. For an approved operator using the correct source checkout, the safe preflight is:

```sh
supabase link --project-ref YOUR_CONFIRMED_PROJECT_REF
supabase migration list --linked
supabase db push --linked --dry-run
```

Replace the project-ref placeholder and enter any login/database credentials only in your own trusted terminal. Linking selects the target; it does not apply the migrations. The dry run must match the reviewed pending file list. Actual `supabase db push --linked` is a separate live-migration operation requiring the exact-project migration approval and recovery/staging evidence first. Do not use `--include-seed`, `--include-all`, `db reset`, or migration-repair commands to bypass a mismatch. The database password, Auth login password and API credential are different credentials; none should be pasted into chat.

Compare **all** deployed history against main first. Other pending baseline migrations, including Free-period/recalculation changes, must be reconciled separately; this list is not a command to blindly apply only ten files. No production reset/seed or guessed migration-history repair is appropriate. Keep server gates closed while the approved migration runner applies the reviewed additive set and records history. Factory reads depend on the billing projection, so opening reads after only the first identity migration is insufficient.

## 4. Approve the exact UUID grant and security setup

After schema verification, the approved privileged operator provisions the exact verified UUID's protected grant in `private.platform_founder_grants` with the approved normalized `login_email = 'rajpatel86420@gmail.com'`, meaningful approval/provenance reason, `enabled = true` and `revoked_at = NULL`. `user_id` is the primary key; a partial unique index allows at most one enabled founder. Profile compatibility and current email are independently checked on every request. Existing grants must be reviewed rather than overwritten or disabled implicitly.

Private tables have no customer or application-service direct grants. Use the approved privileged database operator path; do not expose `private`/`auth` schemas, weaken RLS or grant browser table access to make setup work. No manual platform-session insert is required: successful verified MFA establishes the provider-bound session through the guarded server RPC.

Approve the implemented **15-minute interactive inactivity / 8-hour absolute** policy. Verify provider `auth.sessions`/factor compatibility, AAL1 denial, AAL2 success, grant/session revocation, polling not extending idle time and same-origin logout. Ordinary customer sessions still require their organization; platform authorization never weakens that guard.

Choose and rehearse an authenticated operator recovery path before enrollment. The UI cannot issue recovery codes, replace a verified factor or delete interrupted factors. Supabase project-user MFA is distinct from MFA on Raj's Supabase dashboard account. TOTP is normally available by default, but the actual project's enrollment/verification settings still need review. Do not enable project-wide security options speculatively.

Lost-device recovery requires owner identity verification and a separately authorized provider-admin operation. Supabase documents `auth.admin.mfa.deleteFactor`; deleting a verified factor signs out active sessions. This guide intentionally supplies no executable deletion command or factor ID. Emergency recovery closes the console, revokes the grant/platform/provider sessions, then uses the reviewed provider recovery process. If recovery cannot be demonstrated, keep access closed. The first-setup flow can retain interrupted unverified factors; exhaustion also requires reviewed recovery.

## 5. Open a controlled founder enrollment window

Only after the previous security and staging gates pass, approve these **server-only variables for the Vercel Production target**, under project Settings → Environment Variables. A separate approved redeployment is required for the new environment values to take effect. Vercel previews also run with `NODE_ENV=production`; never share the approval flags with previews by accident.

| Variable | Controlled production enrollment |
| --- | --- |
| `WEAVLY_ADMIN_ENABLED` | `true` |
| `WEAVLY_ADMIN_PRODUCTION_APPROVED` | `true` |
| `WEAVLY_ADMIN_MFA_ENROLLMENT_ENABLED` | `true` |
| `WEAVLY_ADMIN_MFA_SETUP_APPROVED` | `true` |

All four are required for first QR setup; the implementation does not offer enrollment while the console gate is off. They do not bypass UUID/profile/email/session authorization, and AAL1 cannot load privileged data.

Raj then personally opens https://textile-accounting.vercel.app/admin/login, signs in with the approved email **and password**, scans the private QR into the chosen authenticator, and enters its current six-digit code. Keep the QR/secret/OTP out of chat, screenshots, logs and browser storage. Sign out and sign in again to confirm the returning flow asks for the authenticator code without a new QR.

After verified first enrollment, close the setup window by setting `WEAVLY_ADMIN_MFA_ENROLLMENT_ENABLED=false` and `WEAVLY_ADMIN_MFA_SETUP_APPROVED=false` through an approved environment update/redeployment. Existing-factor challenges continue to require MFA and work without enrollment enabled. Retain the two console flags only after final acceptance.

## 6. Accept the deployed boundary before wider features

On the exact deployed version, verify anonymous/wrong-email denial and founder rejection on normal customer login. Real staging Auth/RPC and browser acceptance now cover the previously skipped provider cases, including AAL1 denial, AAL2, QR, returning challenge, revocation/replay and back/offline protection. Unit/database customer/Free/billing/tenant regressions pass. Recovery evidence covers private application archive integrity and schema restoration, not a hosted physical/Auth/Storage restore. Raj's personal hosted password/QR/code test remains unperformed until he enters it privately.

Keep these independent scopes off until their own approvals/acceptance:

- Customer support writes: `WEAVLY_SUPPORT_ENABLED` and `WEAVLY_SUPPORT_PRODUCTION_APPROVED`.
- Formal case/review operations: `WEAVLY_ADMIN_FORMAL_ENABLED` and `WEAVLY_ADMIN_FORMAL_PRODUCTION_APPROVED`.
- Legacy registers/controls: `WEAVLY_ADMIN_LEGACY_READS_ENABLED`, `WEAVLY_ADMIN_LEGACY_REFERENCE_ACTIONS_ENABLED`, `WEAVLY_ADMIN_LEGACY_OPERATIONS_ENABLED`. Do not reopen an old role-only path.

Support needs requester-only visibility, in-app delivery, transactional/audit acceptance and retention/data-rights sign-off; no email/WhatsApp delivery or SLA is implied. Formal operations need monitored intake, verified recovery and their retained-record policy/hold acceptance. Numeric retention and concrete disposal/disclosure execution remain unapproved; automatic purge remains disabled. Preserve an approved fallback for still-needed legacy obligations.

Financial and factory views can show unclassified/unverified/partial data honestly. Do not classify production records heuristically, claim complete net collections without capture/refund coverage, enable live payments or run a provider backfill as part of founder setup. `Asia/Kolkata` remains the proposed reporting zone.

## Rollback and next information from Raj

Disable `WEAVLY_ADMIN_ENABLED` first and redeploy the approved closed configuration; close enrollment/support/formal gates as applicable. Independently verify direct endpoints deny access. For compromise, the authorized operator disables the exact UUID grant and revokes platform and provider sessions. Preserve additive tickets/audit/reporting/formal records. Use a reviewed forward schema fix; do not drop populated tables, restore permissive legacy access or reverse payments.

**Resolved:** reset, replacement identity, exact project, password/email readiness, private application recovery, real staging acceptance, all ten production migrations and exact founder provisioning. **Remaining:** final approved deployment/gate verification and Raj's private password/QR/code/returning-login test. No further SQL-editor or factory/payment diagnostic work is requested from Raj. Close the enrollment window after his verified round trip.

Sources: [release gates/recovery](RELEASE_RUNBOOK.md), [founder boundary](AD01_FOUNDER_BOUNDARY.md), [first-TOTP setup](FOUNDER_MFA_SETUP.md), [recorded acceptance limits](DATA_RIGHTS_ACCEPTANCE.md), `lib/admin/founder.ts`, `lib/admin/founder-email.ts`, `app/(admin-auth)/admin/verify/actions.ts`, the migration files above, [Supabase TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp) and [provider factor removal](https://supabase.com/docs/reference/javascript/auth-admin-deletefactor).
