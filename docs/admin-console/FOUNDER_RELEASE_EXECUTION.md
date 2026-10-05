# Approved founder release execution

Current checkpoint: 4 October 2026, 22:56 UTC. The approved production deployment is READY and the live login is enabled. Raj can now perform his private password/QR/code test. PR #188 remains open and unmerged. This record supersedes historical pending-publication, deployment and missing-recovery statements in earlier preparation notes; readiness is based on the actual production deployment and live checks below.

## Authority and exact target

- Raj approved the concrete setup request `call_TEubPGXOtdmV1Wv6hnLrhpoA`: ten missing migrations in `vzhwahudircrpgtitwzd`, founder grant for `0fe24cd4-bd20-4050-aa56-0631bd03d9ce`, publication/deployment and controlled authenticator setup with 15-minute idle/eight-hour absolute sessions.
- The originating thread later supplied explicit approval for the temporary CLI login/private backup and superseded the previous no-push restriction. The exact previously rejected push succeeded on its single authorized retry.
- Raj requested keeping PR #188 unmerged until setup is complete. The originating thread subsequently supplied Raj's 21:27 UTC instruction to apply the approved migrations/setup/deployment and report when the actual founder login is ready for his password/QR/code test. Deploy the immutable reviewed branch without merging the PR. Password, QR and code entry remain Raj's responsibility; no account recreation, guessed identity or automated factor enrollment is authorized.
- Fresh read-only checks verify the exact confirmed email/UUID, no profile/owned factory, hosted baseline of 316 migrations and exactly ten pending console migrations. A single public Vercel URL read confirms the production project binding. Preview approval gates remain absent.

## Completed evidence

| Check | Result and limits |
| --- | --- |
| Private recovery archive | 2,869,534 bytes; SHA-256 `cb81a5116ef9b00221f8724b34db26a62587d5fe891934412381f15c865b37d8`; 0600, outside Git. Includes public/private/weavly_private and migration history. Catalogue and full decode passed. |
| Schema recovery | Passed in disposable PostgreSQL 17.11 with local Auth/Storage foundations; all ten pending migrations applied. No real data restored. Does not verify hosted physical/Auth/Storage restore. |
| Real local provider/RPC | 10/10 passed; actual TOTP intent/enrollment/challenge/completion, AAL2/factor binding, AAL1/direct-RPC denial, idle/absolute expiry, polling, revocation/logout replay and provider recovery/re-enrollment. Zero remaining synthetic Auth users. |
| Hosted TOTP configuration | Read-only supported Management API check at 21:36:52 UTC confirms enrollment and verification enabled on the exact production project, maximum ten factors. Existing CLI authorization reused; no credentials/configuration/factors changed. Password/QR/code and the actual founder round trip remain untested until Raj enters them. |
| Independent RPC harness review | No P0/P1/material P2; SHA-256 `67639c8662af8b8ded3c467870ba55b46ad45181ef9e80ee7ee6a867bde77249`. Syntax independently passed. |
| Real built-app browser | 13/13 groups passed against runtime `76e4cc9310737e8a73f0a30989c24a7ff943d552`, desktop/mobile Chromium. Actual QR/OTP/AAL2, denial, offline/cache, four server-confirmed UI logouts, old-cookie replay, protected Back and returning OTP without QR passed. Final synthetic Auth users, CSP violations and outbound requests: zero. |
| Independent browser review | No P0/P1/material P2; script SHA-256 `3efd2ac4796b83fa75c0a207f2d501e640989bc077ad209d0b77044cea181941`; report SHA-256 `d78f22232515acbc36872cfe51614522326259a93162198eded1cf8e41fd7d6c`. Reviewer independently checked syntax, hashes and all final evidence; execution was by the harness owner. |
| Local runtime checks | Lint/typecheck passed; unit 322 files/2,958 passed, one existing optional live test skipped; disposable database 32 files/273 passed. No production targets inherited by test subprocesses. |
| Publication | [PR #188](https://github.com/Rajp2002/TextileAccounting/pull/188), deployed commit `f50af0d168d836e13ed877b90cecc71913d03fea`, open and unmerged. [CI run 37240336661](https://github.com/Rajp2002/TextileAccounting/actions/runs/37240336661) passed types/tests/lint and disposable PostgreSQL; Vercel preview passed. Runtime is unchanged from reviewed `76e4cc93`. |

Private recovery location: `/Users/rajpatel/Library/Application Support/WeavlyRecovery/vzhwahudircrpgtitwzd-20261004/application-recovery.dump`. It is an application recovery backup, not test data. Do not upload, commit or print it. Failed intermediate export files are not recovery evidence; the named verified archive is authoritative.

Runtime evidence: `/tmp/weavly-founder-release-{lint,typecheck,unit,db}.log`, `/tmp/weavly-founder-release-final-lint.log`, `/tmp/weavly-founder-local-provider-smoke.log`, `/tmp/weavly-founder-local-browser-smoke-result.json` (0600), `/tmp/weavly-founder-schema-recovery.log`. Final lint, harness syntax and diff checks pass. Any typography response fixture is staging-only and cannot replace Auth calls or weaken production authorization.

Browser limits: the archived application substitutes only the approved email with `founder@example.test`; cached Inter/Geist and an unused landing-font fallback remove build transport dependencies. Canonical browser `localhost:55330` is hard-pinned by the proxy to TCP127 (no DNS), while build SITE_URL stays127; reset/email/callback flows were not exercised. Physical devices and hosted personal MFA are not inferred from Chromium emulation. Real service workers remain active. Their redirect wrapping can hide the second page-level logout response; the harness records the absent event and requires a fresh upstream303/safe Location, provider/platform sessions0 and current/old-cookie API denial before fixture deletion. No QR screenshots, traces, video, storageState or credential artifacts are written.

The modern disposable source replay lacked historical service-role SELECT on baseline application tables. A read-only hosted catalogue check proved this permission present on each of the following twelve sources; the browser harness mirrors only SELECT locally, with no new/private/client-role permissions: `profiles`, `organizations`, `org_subscriptions`, `subscription_payments`, `billing_checkout_attempts`, `billing_payment_refunds`, `billing_invoices`, `free_account_grants`, `plan_usage_events`, `grievances`, `security_incidents`, `organization_export_runs`. This is managed-foundation parity, not a production grant change. The verifying query is:

```sql
SELECT c.relname AS source,
       has_table_privilege('service_role', c.oid, 'SELECT') AS service_select
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v')
  AND c.relname IN ('profiles', 'organizations', 'org_subscriptions',
    'subscription_payments', 'billing_checkout_attempts',
    'billing_payment_refunds', 'billing_invoices', 'free_account_grants',
    'plan_usage_events', 'grievances', 'security_incidents',
    'organization_export_runs')
ORDER BY c.relname;
```

## Completed production database setup

At 22:25 UTC, ordinary `supabase db push --linked` applied exactly the ten hash-verified approved migrations successfully, without reset/seed/history repair. Hosted history now has 326 versions; all ten version/name checks and twelve object checks pass. Sixteen private tables have RLS and no direct anon/authenticated/service-role table access; three support tables have RLS, no client access and service SELECT only. Nineteen public admin RPCs deny anon/authenticated execution and allow only the guarded service path. Hosted catalog also confirms no anon/authenticated private-schema USAGE. The two legacy public registers retain historical authenticated SELECT ACLs, but RLS is enabled with zero policies, owner is postgres and authenticated cannot bypass RLS; no rows are granted by those ACLs.

The bound setup transaction was executed as the verified `postgres` operator. Independent post-read: exactly one active founder, exact replacement UUID/email grant, dedicated `admin` profile with `org_id=NULL`, no owned factories and one immutable operator provisioning audit. No Auth password, metadata, factor or provider session was created/modified. The founder has zero verified factors and will enter his password and scan the first QR himself.

Advisor delta was reviewed: sixteen intentionally closed private tables and the two retired direct global-admin registers have no public RLS policies; the only additional authenticated security-definer helper is `support_is_requester(uuid)`, a fixed-path, requester/current-owner/nonrevoked/same-org boolean predicate. Existing unrelated Auth warnings remain unchanged. No broad client grant was introduced.

At 22:29 UTC, Vercel confirmed creation of only the four approved founder/enrollment variables as `true`, Production target only: `WEAVLY_ADMIN_ENABLED`, `WEAVLY_ADMIN_PRODUCTION_APPROVED`, `WEAVLY_ADMIN_MFA_ENROLLMENT_ENABLED`, `WEAVLY_ADMIN_MFA_SETUP_APPROVED`. They are active in the fresh production deployment below. Preview/development and support/formal/legacy/payment gates are untouched. Temporary CLI administrative login creation was the separately approved managed credential operation; no credential value is printed or published. No live checkout/payment, backfill, purge, classification or external customer message is included.

## Verified production deployment and live checks

Vercel deployment `dpl_Gnn6iz7reooi7ntzSwzHQMTmSQmG` is READY, target `production`, Git SHA `f50af0d168d836e13ed877b90cecc71913d03fea`, from `codex/founder-only-login`. It was created from the immutable Git revision through the authenticated Vercel API, not a local workspace upload. The production build passed and the verified alias is https://textile-accounting.vercel.app. A fresh read at 22:56 UTC confirms this same deployment/commit. GitHub main remains `872debb7d09ec3e1856375e142cc841589c99af6`; PR #188 is not merged. Subsequent release-record commits contain documentation only and do not change this deployed runtime.

Fresh anonymous Chromium checks against the actual production alias passed:

| Live check | Observed result |
| --- | --- |
| `/admin/login` | Founder email/password form is enabled and reachable. |
| Wrong founder email | Displays “Wrong email. Use the approved founder email to continue.” with no protected data. |
| Normal `/login` with the reserved founder email | Displays “This account is for founder access only. Sign in at /admin/login.”; remains on customer login with no console data. The short-lived toast was observed before dismissal. |
| `/admin/verify` without authentication | Redirects to `/admin/login`, with no QR or private data. |
| Overview/factories/payments/system/audit APIs without authentication | Each returns 401 JSON and `private, no-store, max-age=0, must-revalidate`. |
| Final hosted account check, 22:51:50 UTC | One enabled founder, zero owned factories, zero provider sessions and zero verified factors. The probes did not sign in or enroll the real founder. |

The probes used an unrelated reserved example address or the approved email with dummy text rejected before provider sign-in. No actual password/QR/code, network-body log, screenshot, credential or persisted browser state was collected. The live browser session is closed. Both real local staging scripts cleaned synthetic fixtures; the exact local Supabase project and browser server are stopped, with evidence retained.

The actual founder's positive hosted password/QR/code round trip is **not yet verified** because Raj must enter these privately. No additional SQL, account creation or migration work is needed from him. Open https://textile-accounting.vercel.app/admin/login in a private window, enter `Rajpatel86420@gmail.com` and the password set in Supabase, scan the first QR and enter the authenticator code. Then sign out and sign in again to verify a code challenge without a new QR. Close the two enrollment flags after that verified first/returning login; existing-factor challenges continue under the two console flags.

Rollback: close server capabilities first; preserve additive application/audit records; revoke compromised founder sessions/grant through the approved operator path; roll back application code without reopening a permissive legacy path. The previous READY production deployment is `dpl_4yxj2yF554RhKtzLayG21FAL5Wwq`, main `872debb7d09ec3e1856375e142cc841589c99af6`; it is a recorded rollback candidate, not an instruction to roll back now. The archive supplies pre-migration application recovery evidence, but no blanket production restore is authorized. Use a reviewed forward fix after application writes.
