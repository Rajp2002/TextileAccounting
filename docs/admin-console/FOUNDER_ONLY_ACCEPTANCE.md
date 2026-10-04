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

Raj's results identify existing confirmed Auth UUID `d0e56517-29f9-474f-b368-9e63e84da25a`, a missing profile, and owned organization `2420a5a8-d231-4ed2-b9ce-9db986e38879`, name `test`, with zero member profiles. The dependency results confirm nonempty test setup, 18 audit rows, four subscription rows and one payment row. The new admin/support tables are not installed in the supplied project result. Raj subsequently authorized deleting the abandoned account and all identified local factory/payment history and creating a fresh founder-only identity. This supersedes the earlier preserve-UUID approach; no further provider-mode lookup is required for this local reset.

1. Follow [FOUNDER_RESET_AND_RECREATE.md](FOUNDER_RESET_AND_RECREATE.md): run the complete targeted [FOUNDER_ACCOUNT_RESET.sql](FOUNDER_ACCOUNT_RESET.sql) in the same project's SQL Editor. It has no placeholders and removes the old Auth user last, inside the reviewed transaction.
2. Create the replacement Auth user privately through Supabase Authentication, with the reserved email and a new password. Copy its new UUID; do not create a customer organization or reuse the old UUID.
3. Verify required migrations and use [FOUNDER_SELF_SETUP.sql](FOUNDER_SELF_SETUP.sql) with the new UUID, then complete [PRODUCTION_FOUNDER_SETUP.md](PRODUCTION_FOUNDER_SETUP.md) for the separate real-provider/security acceptance and approved deployment/enrollment window. Setup creates only the dedicated admin profile/grant/audit, never credentials, MFA or a fake organization.

The reset transaction is concrete and locally tested. Hosted execution and the replacement UUID remain operator steps; nothing has been deleted by the agent. New founder migrations need review/application before founder setup can work. Unknown dependencies make the reset fail closed rather than cascade into other accounts. Provider records, backups, monitoring history and browser caches are outside its scope, and a minimal global reset audit remains.

## Read-only factory evidence follow-up

This earlier slice added no runtime behavior or migrations: two manual SELECT reports, synthetic DB regressions and updated setup/cleanup evidence. Raj ran both reports himself and supplied their results. The payment report records one captured ₹17,700 payment with unknown mode/currency, four historical/current subscription rows and zero owner/UUID-prefix Storage matches. These results are operator-supplied evidence, not an agent production audit. Provider mode remains unknown; the later explicit local-purge instruction removes that lookup as a reset blocker and does not classify the payment as test or live.

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript | Passed, nonincremental | `/tmp/weavly-founder-factory-followup-typecheck.log` |
| Lint | Passed, zero warnings | `/tmp/weavly-founder-factory-followup-lint.log` |
| Full database regressions | 31 files, 250 passed | `/tmp/weavly-founder-factory-followup-db.log`; disposable loopback PostgreSQL 17.11, synthetic fixtures |
| Independent review | No outstanding P0/P1 or material P2 in current read-only inspectors; independently passed 10 new DB tests and diff checks | Exact-target preflight, quoted catalogue queries, bounds, unknown mode and missing Storage owner mapping verified |
| Unit/build/browser | Not rerun for this SQL/documentation-only slice | Prior runtime acceptance above remains applicable to unchanged runtime commit `26a9cb7f`; no new live Auth or cleanup acceptance is claimed |

Rollback for the read-only reports is removing them from operator use; they install nothing and write nothing. A locally tested empty-only deletion prototype was withdrawn when the actual nonempty/payment-linked factory was discovered. Its synthetic passes are not cleanup acceptance. No hosted mutation, account/grant/MFA change, payment operation, push or deployment occurred.

## Authorized delete-and-recreate slice

The final reset SQL deletes only the fixed old identity/factory and reviewed local rows, with exact identity/count assertions, bounded catalogue checks, serialized application/Storage/Auth references, reviewed trigger definitions, external and nested Auth-FK checks, runtime-reference checks and a required minimal operator audit. It neither uses the broad existing account-erasure routine nor calls a provider. Failure rolls the entire transaction back, including earlier local financial deletes. The operator guide uses Supabase's supported private user creation UI for the replacement password and UUID.

| Check | Final result | Evidence |
| --- | --- | --- |
| TypeScript | Passed, nonincremental | `/tmp/weavly-founder-account-reset-typecheck-final.log` |
| Lint | Passed, zero warnings | `/tmp/weavly-founder-account-reset-lint-final.log` |
| Full database regressions | 32 files, 263 passed | `/tmp/weavly-founder-account-reset-db-final.log`; disposable loopback PostgreSQL 17.11, synthetic fixtures |
| Reset-specific database suite | 13 passed | `__tests__/db/admin-founder-account-reset.dbtest.ts`: scoped purge, rollback rehearsal, identity/membership/count drift, other-tenant preservation, Storage, typed/compound/nested Auth references, trigger drift, runtime leftovers and required audit failure |
| Independent review | No outstanding P0/P1 or material P2; all 13 reset tests independently passed | Initial SQL SHA-256 `0fb2dde86f3ae0d51f1f2d051b748415af94a5843fb330d54797bdf7faf1d530`; superseded by the hosted-permission correction below |
| Unit/build/browser | Not rerun for this operator-SQL/test/documentation slice | Runtime is unchanged from reviewed `26a9cb7f`; prior runtime acceptance remains applicable, without implying hosted reset/MFA acceptance |
| Hosted reset, account creation, migrations, grants/MFA and deployment | Not run | Operator action/new UUID and separate approved environment/security setup remain pending |

After a successful COMMIT, code rollback cannot restore deliberately deleted rows. Before COMMIT, every tested refusal or required-audit failure leaves the old records intact. The minimal reset audit survives completion; Razorpay and historical backup/log records are not erased. User recreation never inherits the deleted UUID's privilege or factor enrollment.

## Hosted permission correction

Raj supplied an actual SQL Editor failure: `42501 permission denied for table schema_migrations`, at `LOCK TABLE auth.schema_migrations IN SHARE ROW EXCLUSIVE MODE`. This occurred before the delete loop and aborted the transaction. The earlier superuser-only local stub did not model this provider ledger's permissions; its passing tests did not establish hosted compatibility.

That correction excludes only the unrelated `auth.schema_migrations` ledger. Either identity column name, a UUID or domain-typed column, or any inbound/outbound foreign key prevents the exemption. It does not catch and ignore permission failures on account records or change any hosted grants, ownership or provider schema. Its reviewed SQL SHA-256 was `a6acbb9f691e20a7d9b2bf6b2a2315924cb7bf38fe038a397d2a7711db8eff96`, superseded by the runtime correction below.

The suite now includes a non-superuser operator with explicit account/application privileges and no SELECT/LOCK permission on the provider ledger. It verifies successful scoped reset, unchanged migration history and another tenant's survival, plus refusal/rollback for unexpected UUID, bigint identity, UUID-domain and foreign-key ledger shapes. Final lint/typecheck/DB evidence is recorded in `/tmp/weavly-founder-reset-permissions-{lint,typecheck,db-final}.log`. Hosted retry has not been performed by the agent; runtime unit/build/browser suites are not rerun for this manual SQL/test/documentation correction.

| Check | Final correction result |
| --- | --- |
| Full database regressions | Passed: 32 files, 265 tests, disposable PostgreSQL 17.11 and synthetic fixtures |
| Reset suite | Passed: 15 cases, including restricted operator and protected-ledger shape refusals |
| Lint / TypeScript | Passed: zero-warning lint and nonincremental typecheck |
| Independent final review | Independently passed 15 cases at the final SQL hash above; no outstanding P0/P1 or material P2 |
| Hosted retry / account recreation | Not run by the agent; operator reruns the complete corrected file in the same project |

## Hosted non-FK runtime correction

The next operator screenshot reports `Remaining managed Auth runtime reference in auth.flow_state; transaction rolled back`. It follows the direct user DELETE, and the transaction abort restores all prior factory/payment/Auth changes. No successful hosted reset is claimed.

The current transaction explicitly cleans only two known account-owned runtime roots: `auth.flow_state` (UUID owner) and `auth.refresh_tokens` (UUID or legacy text/varchar owner; integer row identity). It verifies required/optional identifier types, caps matched rows at 1,000 per source, rejects cross-account flow linking, token/session and parent/child token ownership in both directions, and adds both roots to the existing trigger/inheritance/FK dependency graph. External children, cross-account managed children, reachable FK cycles and unknown runtime tables still fail closed. Runtime deletes, user removal and required audit remain one transaction. No hosted permission, ownership, provider schema or credential change is part of this correction.

The reviewed SQL SHA-256 is `d4037d1df14cc8e0ef4bf04bb5229700a727e17472e8ca143d44a012c68511d7`. Final check logs use `/tmp/weavly-founder-reset-runtime-{db-final,lint,typecheck}.log`. The synthetic suite now has 23 cases, including exact-owner runtime removal/peer preservation, runtime restoration on final audit failure, both-direction ownership checks without FKs, external runtime children, unknown triggers, self-FK cascades, bounds and unsupported column types. Real provider tokens and customer records are never fixtures. Runtime application unit/build/browser suites are not rerun for this operator SQL/test/documentation correction; actual hosted success and replacement UUID remain pending.

| Check | Final runtime correction result |
| --- | --- |
| Full database regressions | Passed: 32 files, 273 tests on disposable PostgreSQL 17.11 with synthetic fixtures |
| Lint / TypeScript | Passed: zero-warning lint and nonincremental typecheck |
| Independent review | Independently passed 23 reset cases at the final hash; no outstanding P0/P1 or material P2 |
| Hosted reset | Operator-executed: Raj supplied SQL Editor screenshot with `old_auth_exists=false`, `old_factory_exists=false`; no separate agent hosted audit |
| New identity / founder access | Replacement UUID now supplied and verified by read-only hosted query; required schema/grant/security/deployment setup remains pending, as recorded below |

The successful operator result supersedes the earlier pending-reset entries above. Do not rerun the reset or reuse the deleted UUID. The two displayed postconditions establish current old-user/factory absence; they do not certify provider-record erasure, backups, real MFA, migration readiness or the unpublished normal-login restriction.

## Confirmed replacement identity and migration target

On 4 October 2026 Raj supplied replacement Auth UUID `0fe24cd4-bd20-4050-aa56-0631bd03d9ce` and confirmed dashboard project `vzhwahudircrpgtitwzd`. The agent's exact-target read-only query verified current email `rajpatel86420@gmail.com`, confirmed email, missing profile and no owned factory. Founder grant/session/audit tables and both session/MFA-setup RPCs are absent. Hosted migration history contains 316 baseline versions, ending at `20261004120000`; all match local versions, and exactly ten local console migrations are missing. Branch metadata exposes only default `main`. Latest GitHub main remains `872debb7d09ec3e1856375e142cc841589c99af6`.

[FOUNDER_CONFIRMED_SETUP.sql](FOUNDER_CONFIRMED_SETUP.sql) is an identity-bound copy of the existing reviewed generic transaction, followed by a minimal provisioning result. [FOUNDER_SETUP_TARGET.md](FOUNDER_SETUP_TARGET.md) records the exact target, pending migration hashes and operations still gated. No real user is inserted into test fixtures; no hosted SQL mutation, migration/grant, credential, factor/security or environment/deployment change was performed. The initial connector project-list omission did not prevent the subsequent exact-project read-only queries.

These facts supersede earlier pending-account/unknown-target entries. Account creation is complete; required migrations, approved grant/security window, verified recovery/staging and unpublished follow-up deployment remain the actual blockers. Runtime lint/typecheck/unit/build/browser checks are not rerun for this documentation/template-binding slice; prior runtime evidence remains applicable without establishing live Auth/MFA readiness.

| Current preparation check | Result |
| --- | --- |
| Bound SQL identity and transaction | Passed: transaction matches the reviewed generic template exactly after UUID/comment substitution; final query is read-only. SHA-256 `7accbb832cce0ead424eb0cb40d84438abe8e0bf7e21549e89edf23190cc0a42` |
| Pending migration manifest | Passed: all ten file SHA-256 values match this checkout |
| Manual setup smoke suite | Passed: nine synthetic scenarios plus complete/missing-history assertions, disposable `127.0.0.1` PostgreSQL; `/tmp/weavly-founder-confirmed-setup-sql.log` |
| Independent preparation review | Passed: no P0/P1 or material P2; independently verified exact transaction equivalence, SQL hash, all ten migration hashes/order and the four-flag enrollment/returning-login sequence |
| Diff whitespace | Passed |
| Hosted migrations/grant/MFA, push and deployment | Not run; remain separately gated |

## Rollback and release limits

No schema migration was added by this auth follow-up. The inspectors are read-only; the new explicitly authorized reset is a destructive manual transaction. Existing production founder/security/migration flags were not opened. Real Auth/MFA/recovery, actual applied schema and production release acceptance remain unverified.

If a later release fails, disable new server capabilities first and preserve grants/audit/support/reporting records. Revert the reviewed code through the normal release process without reopening a permissive legacy route. The reset's rollback rehearsal is local synthetic evidence, not a verified hosted recovery point. Raj explicitly abandoned the selected old data; any desired restoration after COMMIT would require a separately verified recovery source. Disabling these auth code changes does not authorize restoring customer access to the founder identity.
