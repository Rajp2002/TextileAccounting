# Confirmed founder setup target

Prepared from read-only evidence on 4 October 2026; subsequently approved and executed as recorded in [FOUNDER_RELEASE_EXECUTION.md](FOUNDER_RELEASE_EXECUTION.md).

**Subsequent approval:** Raj answered “Approve the prepared setup” to the exact-project request covering the ten migrations, replacement UUID grant, founder-only login publication/deployment and controlled authenticator window with 15-minute idle/eight-hour absolute sessions. That approval remains conditional on required recovery/staging checks and does not approve payment operations, support/formal/legacy gates or automatic factor enrollment. Do not re-request this same production scope once the named checks pass.

**Reconnection approval:** the originating thread supplied the user's explicit approval of the temporary CLI database login/private backup and confirmed that the earlier no-push restriction is superseded for this approved publication. The same previously rejected push was retried once and succeeded. [PR #188](https://github.com/Rajp2002/TextileAccounting/pull/188) remains open and unmerged. Deployed commit `f50af0d168d836e13ed877b90cecc71913d03fea` has green CI, preview and production build. Raj's later instruction authorized the immutable branch deployment for his private login test while preserving the unmerged PR.

**Execution status, 22:56 UTC:** all ten approved migrations applied through ordinary history (326 versions). Every required-object check passes. The bound founder setup is complete: one exact UUID/email grant, dedicated `admin` profile with no organization, no owned factories and one safe operator provisioning audit. The four approved Production founder/enrollment gates are enabled; production deployment `dpl_Gnn6iz7reooi7ntzSwzHQMTmSQmG` is READY on `f50af0d168d836e13ed877b90cecc71913d03fea`. Live founder-login availability, wrong-email rejection, customer-login founder rejection and anonymous API denial passed. No actual founder MFA factor has been enrolled; Raj can now enter his password and scan the QR. The private recovery archive at `/Users/rajpatel/Library/Application Support/WeavlyRecovery/vzhwahudircrpgtitwzd-20261004/application-recovery.dump` is 0600, 2,869,534 bytes, SHA-256 `cb81a5116ef9b00221f8724b34db26a62587d5fe891934412381f15c865b37d8`. Catalogue/decode and schema-only restoration with all ten migrations passed. No real data was restored as fixtures. This is application recovery evidence, not hosted physical/Auth/Storage recovery or bank reconciliation.

**Staging acceptance:** real local Auth/RPC10/10 and real built-app desktop/mobile browser13/13 groups passed, including rendered QR→OTP→AAL2, denial, logout/replay/back/offline, returning OTP without QR, idle/absolute expiry and recovery/re-enrollment. Synthetic Auth cleanup proved zero users. Independent review found no material issue. Lint/typecheck, 2,958 unit and273 database tests pass; one existing optional live test remains skipped. A read of the single public Vercel Supabase URL confirmed the production project binding. Hosted TOTP enrollment/verification are already enabled; the actual founder password/QR/code round trip remains Raj's private test.

## Initial read-only hosted snapshot before approved execution

- Exact project: `vzhwahudircrpgtitwzd`, confirmed by Raj's dashboard link.
- Replacement Auth UUID: `0fe24cd4-bd20-4050-aa56-0631bd03d9ce`.
- Current normalized email: `rajpatel86420@gmail.com`; email-confirmed.
- No profile and no owned factory. The old reset is already complete; do not rerun it.
- Hosted migration history: 316 versions, ending at `20261004120000` (`estimator_quote_input_basis`). Every hosted version exists in this checkout. The only local versions absent from hosted history are the ten listed below.
- Founder grant/session/audit tables and both founder session/MFA-setup RPCs are absent. No grant can be provisioned until the required schema is installed.
- Supabase branch listing exposes only default `main`; no isolated hosted staging branch is evidenced by that result.
- At this initial snapshot, GitHub main was `872debb7d09ec3e1856375e142cc841589c99af6` and production did not include the founder-only normal-login changes. The subsequent completed deployment is recorded above; main remains unchanged.

These checks select only identity confirmation, profile/access fields, existence and migration/branch metadata. No password, token, OTP, factor secret, customer business record or gateway credential was read. No hosted data/configuration change was performed.

## Exact additive migration set (now applied)

Apply in the order shown using the approved migration runner, recording ordinary migration history. Do not paste concatenated migrations into SQL Editor or use history repair, reset, seed or a forced include-all operation. Reread history immediately before any approved application and stop if the pending set differs. Existing synthetic migration/DB passes do not establish hosted provider compatibility or a verified recovery point.

| Migration | SHA-256 |
| --- | --- |
| [20261004150000_founder_admin_boundary.sql](../../supabase/migrations/20261004150000_founder_admin_boundary.sql) | `14021dd9351bf9d40e402618d7191706a99d5806cc801711062e2fec53c37e6c` |
| [20261004150500_founder_support_workflow.sql](../../supabase/migrations/20261004150500_founder_support_workflow.sql) | `0079c6d0086d1b61a3d7465fdb03bf1021c2f830d655e8f45a1180d77d579b9a` |
| [20261004151000_founder_factory_reporting.sql](../../supabase/migrations/20261004151000_founder_factory_reporting.sql) | `865974495552f74e60f9cd56aa727169a9f9d3e3b2e7404bfb003b6f6049e3bd` |
| [20261004152000_admin_billing_reporting.sql](../../supabase/migrations/20261004152000_admin_billing_reporting.sql) | `67a506c6fcc5b5a1eb494ed878912729435c8b2c2268ddde538cc58eea7368aa` |
| [20261004153000_admin_data_rights_compatibility.sql](../../supabase/migrations/20261004153000_admin_data_rights_compatibility.sql) | `254c2dcb78b0f6ed3d6b602d240d957399cdaf2ba1de24bdbf6f287d4f07bdcf` |
| [20261004154000_founder_email_and_mfa_setup.sql](../../supabase/migrations/20261004154000_founder_email_and_mfa_setup.sql) | `0f8011072b2278830036b1d29a7b42ffda227996f6131a4e477124081571c92e` |
| [20261004155000_admin_legacy_read_indexes.sql](../../supabase/migrations/20261004155000_admin_legacy_read_indexes.sql) | `317caa5332ffcd28e328c63326149e091e06157ba166096c2a1086af78159380` |
| [20261004170000_admin_retained_record_review.sql](../../supabase/migrations/20261004170000_admin_retained_record_review.sql) | `3cbb19c7eb455630d92ec5de6b9320d3f362c2984c10b69054e4dc9a31284139` |
| [20261004180000_admin_formal_case_workflow.sql](../../supabase/migrations/20261004180000_admin_formal_case_workflow.sql) | `d2c77662b7bf8300c31e6ee3b69408123442a5dc2c2a784f27d427d0a9d3af35` |
| [20261004190000_admin_retention_review.sql](../../supabase/migrations/20261004190000_admin_retention_review.sql) | `0e99155556ea80e26d5225e55ae77e4263ea173a8f9be9c311682e65ac9b234c` |

The exact production migration/grant/security/deployment scope and private backup/login are approved. Staging browser acceptance, production database setup, deployment and live negative-access verification are complete. Raj's private hosted password/QR/code and returning-login test is next. Installing these objects does not approve support/formal writes, retention/purge, financial backfills or live payments.

## Prepared provisioning and login sequence

1. Keep founder, enrollment, support, formal and legacy gates closed while the approved operator verifies recovery/staging and applies the exact migrations. Run [MIGRATION_PRECHECK.sql](MIGRATION_PRECHECK.sql) afterward; all ten history rows and required-object checks must pass.
2. After the exact-identity grant approval, run the complete [FOUNDER_CONFIRMED_SETUP.sql](FOUNDER_CONFIRMED_SETUP.sql) as `postgres` in this project. It has no placeholders. It creates only the dedicated `admin` profile with `org_id=NULL`, the single email-bound UUID grant and required safe audit. It never creates credentials, changes Auth metadata, enrolls a factor or creates a factory. The final SELECT verifies provisioning; a successful retry preserves the original grant/audit.
3. Publish/deploy the reviewed founder-only follow-up only with explicit approval; verify the deployed commit and normal customer-login rejection. Main's earlier deployment alone does not establish this restriction.
4. Following real-provider/session/recovery checks and approval, set the four server-only Production flags `WEAVLY_ADMIN_ENABLED`, `WEAVLY_ADMIN_PRODUCTION_APPROVED`, `WEAVLY_ADMIN_MFA_ENROLLMENT_ENABLED`, `WEAVLY_ADMIN_MFA_SETUP_APPROVED` to `true` and redeploy the approved configuration. Do not enable preview or other support/formal/legacy/payment gates. The session policy is 15 minutes of interactive inactivity and eight hours absolute; polling does not extend it.
5. Raj opens https://textile-accounting.vercel.app/admin/login in a fresh private window and enters his email and password. On the first MFA setup, scan the private QR in an authenticator app and enter its six-digit code. Keep the password/QR/secret/code private. On later logins enter email/password, then the existing authenticator code; no new QR is needed. Verify sign-out, direct denial and account switching against the deployed commit. [Supabase's documented TOTP flow](https://supabase.com/docs/guides/auth/auth-mfa/totp) distinguishes enrollment from the later factor challenge.
6. After verified enrollment, close the setup window by setting the two MFA-enrollment/setup flags to `false` through an approved environment update/redeployment. Existing-factor challenges remain available under the two console flags. Do not remove the factor or invent a recovery credential.

Raj's remaining manual work is password entry, authenticator enrollment/code entry and any owner-only recovery confirmation. The agent can handle permitted preparation and separately approved deployment/database operations; no further broad factory/payment inventory is requested.

Preparation verification: nine local synthetic setup scenarios passed; the bound transaction is identical to the previously reviewed template after UUID/comment substitution. All ten migration hashes match. Independent review found no P0/P1 or material P2. The later runtime, real-provider, recovery, hosted migration and deployment evidence supersedes the historical pending entries: see [FOUNDER_RELEASE_EXECUTION.md](FOUNDER_RELEASE_EXECUTION.md). Only Raj's personal hosted MFA round trip remains unperformed.

Rollback: disable new server capabilities before code rollback, revoke an affected founder grant/session through the approved recovery path, and preserve additive audit/support/reporting records. No table drops, payment reversal, permissive legacy route or restored founder customer access.
