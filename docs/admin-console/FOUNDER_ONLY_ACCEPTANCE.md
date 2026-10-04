# Founder-only identity follow-up

Reviewed runtime commit: `26a9cb7f`, branch `codex/founder-only-login`, based on merged main `872debb7d09ec3e1856375e142cc841589c99af6`. This follow-up is local. It has not been pushed or deployed and has performed no hosted account, database, MFA, environment or provider changes.

Raj has reserved `Rajpatel86420@gmail.com` for founder access only. Customer login rejects it before password Auth, customer signup cannot create an organization for it, shared tenant/support guards deny it, and independent billing/subscription endpoints reject its fresh verified identity before customer or provider work. Proxy routing rejects stale owner hints, and callback/reset flows return platform identities to `/admin/login`. The separate founder flow still requires email/password, the protected immutable UUID grant, a current admin profile and provider-bound MFA/server session; email does not confer privilege. Normal owner flows and the billing readiness gate remain unchanged.

## Evidence

All commands were run in this isolated worktree, with Node 24.11.1. Database fixtures use disposable loopback PostgreSQL 17.11 and synthetic Auth identities, not a hosted project. Build/browser server environment uses explicit loopback Supabase placeholders and disabled founder/support gates.

| Check | Final result | Command / local evidence |
| --- | --- | --- |
| TypeScript | Passed, nonincremental | `node scripts/performance/isolated-command.mjs node node_modules/typescript/bin/tsc --noEmit --incremental false`; `/tmp/weavly-founder-only-typecheck-final.log` |
| Lint | Passed, zero warnings | `node scripts/performance/isolated-command.mjs npm run lint`; `/tmp/weavly-founder-only-lint-final.log` |
| Unit / prebuild | 322 files, 2,958 passed, one existing optional live-service test skipped | `npm run build` runs the full `vitest run` prebuild; `/tmp/weavly-founder-only-build-final.log` |
| Database | 29 files, 240 passed | `node scripts/performance/isolated-command.mjs npm run test:db`; `/tmp/weavly-founder-only-db-final.log` |
| Production build | Passed | `node scripts/performance/isolated-command.mjs npm run build`; `/tmp/weavly-founder-only-build-final.log` |
| Built-app browser | 20 passed, two explicit real-Auth gates skipped | `npm run test:admin:browser`; `/tmp/weavly-founder-only-browser-final.log` |
| Synthetic auth/recovery browser | 10 passed, desktop and mobile | `npm run test:admin:auth-fixtures`; `/tmp/weavly-founder-only-auth-browser-final.log` |
| Exact manual setup/precheck templates | Nine setup scenarios plus complete/missing-history assertions passed | `node scripts/performance/isolated-command.mjs node scripts/qa/founder-setup-sql-smoke.mjs`; `/tmp/weavly-founder-only-setup-sql.log` |
| Independent review | No outstanding P0/P1 or material P2 in reviewed patch | Reviewer independently passed 93 unit tests across five files, three inspector database tests, nine setup scenarios and precheck assertions, plus `git diff --check` |

The reviewer identified two gaps and verified their fixes: raw-auth billing handlers needed their own fresh-identity denial, and successful founder password reset needed the separate founder login destination. React review found no new hooks/lifecycle issue, persisted sensitive draft, heavy dependency or customer-context serialization in the changed components.

The built-app browser checks demonstrate normal-login rejection on desktop/mobile without a provider password call, anonymous endpoint denial, disabled-console behavior and cache/storage boundaries. Synthetic QR/code and reset components demonstrate UI behavior only. They do not verify hosted Supabase enrollment, actual recovery or a live founder AAL2 session.

## Existing account and test factory

Raj's results identify existing confirmed Auth UUID `d0e56517-29f9-474f-b368-9e63e84da25a`, a missing profile, and owned organization `2420a5a8-d231-4ed2-b9ce-9db986e38879`, name `test`, with zero member profiles. Raj authorized removal of that testing factory while preserving the existing login and making it founder-only. No new Auth account is necessary; use recovery privately if the password is unavailable. A subsequent dependency result confirms nonempty test setup, 18 audit rows, four subscription rows and one payment row. The new admin/support tables are not installed in the supplied project result.

1. Confirm that the SQL editor is for the same Supabase project used by the deployed app.
2. The read-only Results-grid [FOUNDER_TEST_FACTORY_DEPENDENCIES.sql](FOUNDER_TEST_FACTORY_DEPENDENCIES.sql) has been run by Raj. Preserve the output; overlapping reference counts cannot be added. Missing tables remain unavailable. The old NOTICE inspector is reference only.
3. Review the recorded output using [FOUNDER_TEST_FACTORY_CLEANUP_REVIEW.md](FOUNDER_TEST_FACTORY_CLEANUP_REVIEW.md). Run the read-only [payment/Storage follow-up](FOUNDER_TEST_FACTORY_BILLING_STORAGE.sql) to establish the one payment's evidence and term/Storage references. Verify Test/Live provenance in the provider dashboard if local mode is unknown. Prepare exact factory-only removal after disposition and recovery review; the old account-erasure routine deletes member Auth users and cross-factory referrals and cannot preserve this login.
4. Once reviewed factory removal is complete, verify zero remaining owned organizations and run the migration precheck, then the reviewed [FOUNDER_SELF_SETUP.sql](FOUNDER_SELF_SETUP.sql) in the correct project. Setup refuses surviving ownership, revoked/mismatched grants or customer profiles; it creates only the dedicated admin profile/grant/audit, never credentials, MFA or a fake organization.
5. Complete [PRODUCTION_FOUNDER_SETUP.md](PRODUCTION_FOUNDER_SETUP.md) for the separate real-provider/security acceptance and approved deployment/enrollment window. Keep every gate closed until its requirements are met.

Factory removal now waits on payment/Storage disposition, installed schema and recovery evidence. Its target is known. No destructive transaction is supplied for the nonempty factory. Retained financial/formal data, other identities and shared Free-subject history cannot be erased as an unintended cascade. New founder migrations need review/application before the existing founder setup SQL can work.

## Read-only factory evidence follow-up

This subsequent slice adds no runtime behavior or migrations: two manual SELECT reports, synthetic DB regressions and updated setup/cleanup evidence. Raj ran both reports himself and supplied their results. The payment report records one captured ₹17,700 payment with unknown mode/currency, four historical/current subscription rows and zero owner/UUID-prefix Storage matches. Provider Test/Live confirmation remains outstanding. These results are operator-supplied evidence, not an agent production audit.

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript | Passed, nonincremental | `/tmp/weavly-founder-factory-followup-typecheck.log` |
| Lint | Passed, zero warnings | `/tmp/weavly-founder-factory-followup-lint.log` |
| Full database regressions | 31 files, 250 passed | `/tmp/weavly-founder-factory-followup-db.log`; disposable loopback PostgreSQL 17.11, synthetic fixtures |
| Independent review | No outstanding P0/P1 or material P2 in current read-only inspectors; independently passed 10 new DB tests and diff checks | Exact-target preflight, quoted catalogue queries, bounds, unknown mode and missing Storage owner mapping verified |
| Unit/build/browser | Not rerun for this SQL/documentation-only slice | Prior runtime acceptance above remains applicable to unchanged runtime commit `26a9cb7f`; no new live Auth or cleanup acceptance is claimed |

Rollback is removing these manual read-only reports from operator use; they install nothing and write nothing. A locally tested empty-only deletion prototype was withdrawn when the actual nonempty/payment-linked factory was discovered. Its synthetic passes are not cleanup acceptance. Any future concrete removal needs exact record dispositions, writer/Storage serialization, trusted trigger-definition review and its own rollback evidence. No hosted mutation, account/grant/MFA change, payment operation, push or deployment occurred.

## Rollback and release limits

No schema migration was added by this auth follow-up. The SQL files are manual operator templates and the inspector is read-only. Existing production founder/security/migration flags were not opened. Real Auth/MFA/recovery, actual applied schema and production release acceptance remain unverified.

If a later release fails, disable new server capabilities first and preserve grants/audit/support/reporting records. Revert the reviewed code through the normal release process without reopening a permissive legacy route. Factory deletion needs its own verified recovery point, reviewed scoped transaction and rollback rehearsal. Disabling these auth code changes does not authorize restoring customer access to the founder identity.
