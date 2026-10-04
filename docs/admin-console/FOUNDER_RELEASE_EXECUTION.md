# Approved founder release execution

Current checkpoint: 4 October 2026. Supersedes historical pending-publication and missing-recovery statements in earlier preparation notes. No production readiness is inferred from preview success.

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
| Publication | [PR #188](https://github.com/Rajp2002/TextileAccounting/pull/188), head `76e4cc93`, open and unmerged. CI types/tests/lint, disposable PostgreSQL regressions and Vercel preview passed. |

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

## Production database setup and next gate

At 22:25 UTC, ordinary `supabase db push --linked` applied exactly the ten hash-verified approved migrations successfully, without reset/seed/history repair. Hosted history now has 326 versions; all ten version/name checks and twelve object checks pass. Sixteen private tables have RLS and no direct anon/authenticated/service-role table access; three support tables have RLS, no client access and service SELECT only. Nineteen public admin RPCs deny anon/authenticated execution and allow only the guarded service path. Hosted catalog also confirms no anon/authenticated private-schema USAGE. The two legacy public registers retain historical authenticated SELECT ACLs, but RLS is enabled with zero policies, owner is postgres and authenticated cannot bypass RLS; no rows are granted by those ACLs.

The bound setup transaction was executed as the verified `postgres` operator. Independent post-read: exactly one active founder, exact replacement UUID/email grant, dedicated `admin` profile with `org_id=NULL`, no owned factories and one immutable operator provisioning audit. No Auth password, metadata, factor or provider session was created/modified. The founder has zero verified factors and will enter his password and scan the first QR himself.

Advisor delta was reviewed: sixteen intentionally closed private tables and the two retired direct global-admin registers have no public RLS policies; the only additional authenticated security-definer helper is `support_is_requester(uuid)`, a fixed-path, requester/current-owner/nonrevoked/same-org boolean predicate. Existing unrelated Auth warnings remain unchanged. No broad client grant was introduced.

At 22:29 UTC, Vercel confirmed creation of only the four approved founder/enrollment variables as `true`, Production target only. Preview/development and support/formal/legacy/payment gates are untouched. A fresh deployment is still required for this configuration to take effect. Temporary CLI administrative login creation is the separately approved managed credential operation; no credential value is printed or published. No live checkout/payment, backfill, purge, classification or external customer message is included.

Next: publish the reviewed evidence and deploy the immutable branch while PR remains unmerged. Verify the resulting exact deployment before reporting login operational. Close the two enrollment flags after Raj verifies first enrollment/returning login.

Rollback: close server capabilities first; preserve additive application/audit records; revoke compromised founder sessions/grant through the approved operator path; roll back application code without reopening a permissive legacy path. The archive supplies pre-migration application recovery evidence, but no blanket production restore is authorized. Use a reviewed forward fix after application writes.
