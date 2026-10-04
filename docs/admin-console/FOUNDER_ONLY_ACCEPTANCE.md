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

Raj's provided SQL result identifies an existing confirmed Auth user, a missing profile, and one owned organization. Raj authorized removal of that test factory while preserving the existing login and making it founder-only. No new Auth account or password is necessary. The actual organization UUID/dependency inventory has not yet been provided.

1. Confirm that the SQL editor is for the same Supabase project used by the deployed app.
2. Run [FOUNDER_TEST_FACTORY_INSPECT.sql](FOUNDER_TEST_FACTORY_INSPECT.sql) as `postgres`. It runs a read-only transaction, asserts the supplied confirmed UUID/email, requires exactly one owned organization, and reports the exact target and bounded dependency counts in SQL notices/messages. No records are deleted or changed.
3. Review that output using [FOUNDER_TEST_FACTORY_CLEANUP_REVIEW.md](FOUNDER_TEST_FACTORY_CLEANUP_REVIEW.md). Prepare the exact factory-only deletion once actual linked records are known. The old account-erasure routine deletes member Auth users and cross-factory referrals; it cannot preserve this login. Do not replace it with a broad cascade/sweep.
4. Once reviewed factory removal is complete, verify zero remaining owned organizations and run the migration precheck, then the reviewed [FOUNDER_SELF_SETUP.sql](FOUNDER_SELF_SETUP.sql) in the correct project. Setup refuses surviving ownership, revoked/mismatched grants or customer profiles; it creates only the dedicated admin profile/grant/audit, never credentials, MFA or a fake organization.
5. Complete [PRODUCTION_FOUNDER_SETUP.md](PRODUCTION_FOUNDER_SETUP.md) for the separate real-provider/security acceptance and approved deployment/enrollment window. Keep every gate closed until its requirements are met.

Factory deletion is still blocked on the target/dependency evidence. No destructive cleanup transaction is supplied while that scope remains unknown. Retained financial/formal data, other identities and shared Free-subject history require explicit record dispositions rather than being erased as a side effect of removing a factory.

## Rollback and release limits

No schema migration was added by this auth follow-up. The SQL files are manual operator templates and the inspector is read-only. Existing production founder/security/migration flags were not opened. Real Auth/MFA/recovery, actual applied schema and production release acceptance remain unverified.

If a later release fails, disable new server capabilities first and preserve grants/audit/support/reporting records. Revert the reviewed code through the normal release process without reopening a permissive legacy route. Factory deletion needs its own verified recovery point, reviewed scoped transaction and rollback rehearsal. Disabling these auth code changes does not authorize restoring customer access to the founder identity.
