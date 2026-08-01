# Fix Log

This log starts from the completed pre-pilot QA artifacts. No application fix has been made or verified by this remediation operating-system step.

Rules for entries:

- Do not mark a failure resolved from source review alone.
- `code_verified` is not resolved.
- Runtime probes must use an isolated QA tenant, rollback-only transaction, or disposable environment.
- Each entry must link the invariant, tests, runtime evidence, and matrix rows changed.

## UX-012 amended-criteria closeout — 2026-07-14

- Recorded the product-owner-approved requirement amendment without representing it as factory-supervisor approval.
- Implemented the approved terminology baseline across navigation, forms/helpers, validation, owner/supervisor screens, English/Gujarati locales, payslip/PDF, CSV/data exports, WhatsApp outputs, documentation, and help.
- Added nine UX-012 terminology regression tests plus updated affected product assertions. Full local result: 93 files, 662 passed, 1 skipped; TypeScript and optimized build passed. Remote production result: 93 files, 663 passed and build passed.
- Production commit `93c2622026824494dfcf0eb52cba0106ef577ad7`; deployment `dpl_2fRVGdqnpqhx1415kBcb1mDrzhBy` is `READY` and aliased to the canonical URL.
- Representative authenticated owner and supervisor route evidence is recorded under `output/qa/pilot-gate-closure/2026-07-14/UX-012/`.
- Matrix effect: only `UX-012` changed, from `blocked` to `pass`; counts are 368 pass, 0 fail, 6 blocked, 3 not applicable.
- Actual pilot-user feedback/correction/reconfirmation remains OPEN as a pilot operating control.

## Current Resolution State

| Cluster | Status | Notes |
| --- | --- | --- |
| `SEC-A` mutable profile authorization | Closed in Batch 1 / pass | `SEC-002` through `SEC-005` have post-fix test/runtime evidence below and active matrix rows are promoted to pass. |
| `SEC-B` privileged action/lockdown enforcement | Partially closed through runtime remediation / open remainder | Batch 1 closed `SEC-006` and `AUTH-016`; Batch 21D closed payroll RPC boundary rows `PAY-018` and `PAY-020`; the runtime-remediation campaign closed `AUTH-008` with fail-closed source coverage and fresh QA Redis proof. Other blocked privileged-action evidence remains open. |
| `SEC-C` webhook/export/compliance fail-closed | Pilot implementation closed / external assurance retained | Batch 9 closed `SEC-016`; Batch 15 closed `SEC-014`; runtime remediation closed `TECH-009` and `SEC-017`. `WA-008` is now a named post-pilot signed-webhook requirement with no PASS credit. Counsel review and live Sentry payload inspection retain their exact external prerequisites. |
| `PROD-A` production correction/stock atomicity | Closed in Batch 2 / pass-ready | `PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, and `SIGNOFF-05` have post-fix test/runtime evidence below and active matrix rows are promoted to pass. |
| `PROD-B` production boundary validation | Partially source-fixed through Batch 24F / open remainder | Batch 22 moves `ORDER-005`, `ORDER-009`, and `PROD-011` from fail to `code_verified`; Batch 24C source-fixes `SETUP-011`; Batch 24E source-fixes `MASTER-002` and `MASTER-005`; Batch 24F source-fixes `PROD-002` and `PROD-004`. Runtime/API, browser, or migration/DB-boundary proof is still required before those rows can pass. Runtime remediation closed `MASTER-014`, `SIGNOFF-01`, and `SIGNOFF-02` with isolated concurrency/rollback/RLS and current-run dashboard attribution proof. |
| `STOCK-A` stock lifecycle/archive policy | Closed through blocked-row B12 / pass | Earlier batches closed archive and protected-history rows; B11 closed `STOCK-011`, and blocked-row B12 closed `MARKET-009`, `MARKET-010`, source integrity, concurrent mutation, dispatch/receipt, and Golden B stock lifecycle with QA and production proof. |
| `ECON-A` estimator/quote/order/date snapshot correctness | Closed for current formal rows through blocked-row B13 | Estimator costing and boundary batches closed formula/manual, snapshots, confirmations, and validation. B11 closed Start Party Order atomicity and protected order history. B13 closed decimal operator-rate and historical payroll snapshot rows with QA/production proof. |
| `DISP-A` multi-batch dispatch identity | Closed in Batch 3 / pass | `DISP-003`, `GOLDEN-B-09`, `DASH-007`, and `SIGNOFF-07` have post-fix runtime/test/migration evidence below and active matrix rows are promoted to pass. `SIGNOFF-10` received partial dispatch/package evidence here and was closed later by Batch 8C clean deployed browser/server/Sentry evidence. |
| `DISP-B` receipt-state coherence | Closed through Batch 12 / pass | `DISP-007`, `DISP-010`, `DISP-019`, and `SIGNOFF-08` have post-fix runtime/test/migration evidence below and active matrix rows are promoted to pass. Batch 12 closes `DISP-013` with focused local dispatch archive proof. |
| `COMM-A` sales/receivables/profit boundary | Closed through Batch 6 / pass | Batch 3 closes `SALE-015`. Batch 4 closes `COMM-002`, `COMM-010`, `COMM-012`, `COMM-014`, `COMM-016`, `SIGNOFF-06`, and `SIGNOFF-09` with runtime/test/migration evidence. Batch 5 closes `STOCK-016` and `STOCK-017`. Batch 6 closes the Golden A order-linked sale, dispatch, receipt, receivable, payment, and order-archive follow-ons `GOLDEN-A-13`, `GOLDEN-A-15`, `GOLDEN-A-16`, `GOLDEN-A-17`, `GOLDEN-A-18`, `GOLDEN-A-19`, `GOLDEN-A-20`, and `GOLDEN-A-24`. Broad timezone/offline rows and release/Sentry proof remain open separately. |
| `DASH-A` dashboard/sign-off read-model truth | Closed for current formal rows through blocked-row B14 | Earlier batches closed dispatch, receipt, commercial, empty-state, historical, and deployed signoff rows. B13 closed Factory Today source truth; B14 closes realtime refresh, reconnect recovery, independent pace, large-range timing, and distinct dashboard states with QA browser/runtime and production proof. |
| `PAY-A` payroll/kharchi ledger integrity | Closed for current formal core rows through blocked-row B13 | Earlier batches closed payslip/export, statutory preview equality, settlement authorization/reversal, and online-only boundaries. B13 closes the remaining decimal rate, historical snapshot, cap, final settlement, adjustment, cycle, concurrency, reversal, exit, Kharchi, and Golden payroll rows with QA runtime/browser and production runtime proof. Provider/offline failures remain tracked under their own clusters. |
| `IDEMP-A` mutation idempotency/unknown outcome | Closed for the formal pilot row | `OFF-009` now has delayed-response runtime proof: unknown outcome, authoritative reconciliation, immediate resubmission guard, and exactly one persisted row. Other domain-specific idempotency rows retain their own existing evidence. |
| `OFF-A` offline/cache/PWA claims | Pilot-critical rows closed / optional install evidence retained | Batch 9 closes `OFF-002`, `OFF-005`, `OFF-006`, `OFF-008`, and `SEC-016`; runtime remediation closes `OFF-007`; B15 proves manifest/icon/scope/start/update readiness. `OFF-009` and `OFF-010` now pass production-targeted delayed/throttled runtime proof. `OFF-001` remains optional, non-gating physical-device install evidence. |
| `REL-A` release gates | Free-tier backup control implemented / real artifact and restore still blocked | Earlier batches closed `TECH-007`, `TECH-010`, `TECH-013`, and deployed signoff evidence. Runtime remediation closed clean install/audit gates `TECH-001`, `TECH-005`, `TECH-006`, and missing-environment fail-closed gate `TECH-009`. B18 closed rollback/forward-fix and proved sanitized restore mechanics. The 2026-07-14 focused sprint adds a daily encrypted Supabase CLI backup and ephemeral restore drill, but `TECH-011` remains blocked until owner configuration produces a scheduled artifact and that exact artifact restores/reconciles. |

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

## Remaining-gate campaign — 2026-07-14

Status: internal implementation and proof closed; external pilot gates precisely retained.

- Rows: `WA-008`, `WA-010`, `OFF-009`, `OFF-010`, plus scope/classification review of `TECH-011`, `OFF-001`, `SEC-011`, `SEC-018`, `UX-012`, `GOLDEN-A-03`, and `SIGNOFF-04`.
- Root changes: the WhatsApp provider now defaults to `disabled`, only explicit `simulate` or `meta` enables provider behavior, disabled mode never calls Meta, and supervisor access-code requests return truthful manual-owner-handoff state without creating an inaccessible code. The production fixture cleanup now refuses a QA/production target mismatch and supports an exact `QA-OFF009-*` reconciliation path.
- Regression: `__tests__/pilot-whatsapp-disabled-readiness.test.ts`, `__tests__/b16-whatsapp-provider-boundaries.test.ts`, and `__tests__/off-009-mutation-outcome.test.ts` passed 15 tests; TypeScript and targeted lint passed; the optimized build passed 92 files / 653 tests plus 1 intentional skip.
- Runtime: `OFF-009` passed one 42 m delayed-response write with authoritative saved-state reconciliation; `OFF-010` passed one 21 m constrained-3G mobile write and four core screens. Both had immediate duplicate-submit guards, exactly one database row, zero browser warnings/errors, and exact fixture-prefix cleanup to zero.
- Matrix: `OFF-009` and `OFF-010` promoted to pass. `WA-008` and `WA-010` moved to non-gating post-pilot `not_applicable` with named backlog items; no PASS was claimed. Final counts: 367 pass, 0 fail, 7 blocked, 3 not applicable.
- Evidence: `output/qa/remaining-gate-campaign/OFF-009-OFF-010-runtime.json`, `output/playwright/prepilot-remaining-gates/`, `docs/pilot-remediation/REMAINING_GATE_REPORT.md`, and `docs/pilot-remediation/POST_PILOT_BACKLOG.md`.
- Production: commit `5a66eca6ab80fb9d0a00abe3c3cf00a44a0ee4d5` is live on READY deployment `dpl_3yvQ3zWGTpEB6xw1EYgvwbvgRaLL`. Vercel passed 92 files / 654 tests, TypeScript, optimized build, and Sentry release upload. Nine dependent Edge functions are ACTIVE with provider disabled. Deployed supervisor proof showed the manual owner-handoff toast, no access-code hash/expiry, no delivery row, four public-route HTTP 200s, zero post-deploy error/5xx logs, and zero fixture residue.

## Focused TECH-011 / UX-012 preparation sprint — 2026-07-14

Status: implementation prepared; both canonical rows remain `blocked`.

- `TECH-011`: added a scheduled private-repository backup workflow, manual disposable restore workflow, encrypted dump/restore scripts, sanitized inventory SQL, runbook and post-pilot hardening item. The official Supabase sequence covers roles, schema, data including Auth records/Storage metadata, and separate migration history. `age` encrypts before upload; payload/cipher hashes, source project/commit and UTC times are recorded; private Actions retention is 14 days; failures create/update a repository issue.
- Production read-only inventory: project healthy on Free/Postgres 17; migration history count 211 and head `20260714040018`; installed `pg_cron`/`pg_net` are captured by the extension check; Storage has zero buckets, objects and bytes. No active application Storage client was found. The workflow fails closed if an object appears because metadata is not object-byte recovery.
- Credential boundary: the private GitHub repository had no Actions workflows, secret names or variable names before this sprint. The linked environment has no database password/URL suitable for non-interactive `supabase db dump`. Required owner names are `SUPABASE_PRODUCTION_DB_URL`, `SUPABASE_PRODUCTION_PROJECT_REF`, `BACKUP_AGE_RECIPIENT`, and `BACKUP_AGE_IDENTITY`; no values were read or printed.
- Restore proof: not run. No scheduled artifact exists, no dump was retained, and production was never a restore target. `TECH-011` therefore remains `BLOCKED`.
- `UX-012`: added a 42-concept owner/supervisor/mobile/docs/export inventory, proposed glossary, high-risk decision-only additions, and expanded screenshot instructions. No isolated typo was changed because every observed conflict also chooses factory vocabulary, financial meaning or unit convention. No application deployment was required.
- Approval boundary: no named factory-supervisor approval or change request exists. `UX-012` remains `BLOCKED`; product-owner preference alone cannot satisfy the exact row unless that person truthfully signs in the required factory-supervisor role.
- Deferred boundary: `GOLDEN-A-03` was not edited or reclassified.
- Evidence: `output/qa/remaining-gate-campaign/TECH-011-UX-012-preparation.json` plus the referenced workflow/script/closure-pack paths.
- Validation: actionlint, ShellCheck, Bash syntax, YAML/JSON parsing, missing-secret fail-closed test, production read-only inventory SQL, changed-Markdown link validation and `git diff --check` passed. `npm ci`, ESLint, 92 Vitest files/653 passed plus 1 intentional skip, optimized Next build, and both high/critical audit gates passed; two pre-existing moderate advisories remain.
- Matrix: no row or count changed; formal totals remain 367 pass, 0 fail, 7 blocked, and 3 not applicable.

## TECH-011 scheduled inventory-output remediation — 2026-07-15

Status: `fixed_pending_runtime_proof`; canonical `TECH-011` status remains `blocked`.

- Scheduled evidence: GitHub Actions run `29368765626` was triggered by `schedule` from `main` commit `5c77dd69473cb1a60e924fb591982b2ada03e2c8`. Required configuration validation and the five ordered logical dumps completed. Sanitized inventory parsing then failed with `jq: parse error: Invalid numeric literal at line 2, column 0`; artifact upload and SHA-256/encryption completion were skipped. The run produced zero artifacts and is not restorable.
- Root cause: `sanitized_inventory.sql` returned multiline `jsonb_pretty` text while `psql` used its default aligned display format. The JSON file therefore received psql display formatting instead of one raw JSON value. The ephemeral candidate was removed by the existing cleanup trap; neither `jq` nor the workflow log printed its database-derived contents.
- Correction: the SQL now returns one compact `jsonb` object; shared capture runs `psql` with no user psqlrc, tuples-only, unaligned, quiet and `ON_ERROR_STOP`, isolates stderr, requires exactly one JSON document, validates the expected envelope and non-negative integer `bucket_count`, `object_count` and `total_bytes`, and refuses every non-zero Storage inventory before artifact creation.
- Regression: `npx --no-install vitest run __tests__/backup-sanitized-inventory.test.ts` passed 1 file / 13 tests covering zero Storage, non-zero objects, aligned/malformed output, missing fields, multiple JSON rows, invalid numeric values, stderr isolation and query failure, unusual whitespace/Unicode, required psql flags, source shape and credential non-echo. Bash syntax, ShellCheck, actionlint, workflow YAML parsing, focused ESLint and TypeScript also passed before closeout.
- Security: no database URL, credential, age identity, JWT, dump content, raw Storage metadata or production record was captured in the remediation evidence. Encryption, checksums, 14-day retention, cleanup and no-partial-artifact behavior remain unchanged.
- Next proof: merge the focused PR after repository checks, run one `workflow_dispatch` canary as supporting validation only, then wait for the next `event=schedule` run. Only a newly scheduled artifact may enter the formal restore/reconciliation/timing/cleanup/verifier flow.
- Matrix: no row, status or count changes. `TECH-011` remains `blocked`.

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

## Runtime Rerun Closeout - Rows 1-16

Date/time: 2026-07-10 22:09 IST. Branch `codex/estimator-production-readiness-20260710` at repository commit `cfeca96` with an already-dirty, mid-flight worktree.

Scope:

- Re-executed the first 16 rows from the 145-row setup-cascade queue against QA-prefixed test tenants on production project ref `vzhwahudircrpgtitwzd`, as explicitly authorized because the production database contains test accounts only.
- Runtime ledger: `output/qa/runtime-rerun-20260710/results.json`.
- Checkpoint: `output/qa/runtime-rerun-20260710/CHECKPOINT.json`.
- QA record prefix: `RERUNPRODQA-20260710-13CC5C47AD`.

Rows promoted from `code_verified` to `pass`:

- `AUTH-003`, `AUTH-006`, `AUTH-013`, `SETUP-001`, `SETUP-002`, `SETUP-010`, and `MASTER-001`.

Rows proven `fail`:

- `AUTH-012`: an Org A authenticated client could read the guessed Org D organization row. Cross-org machine reads and updates remained isolated, but the organization metadata read violated the row expectation.
- `MASTER-006`: the runtime Add Piece Rate Worker form has no decimal-rate field. Current runtime behavior places production rates on costing/quality context, so the matrix scenario cannot be completed through the stated worker path.

Rows recorded `blocked`, not pass:

- `AUTH-005`: generic reset request and a valid recovery form were proven, but expired/reused-token rejection and final password mutation were not fully exercised.
- `SETUP-007`: no controlled network-failure injection was available in the active browser session.
- `SETUP-011`: Factory Today was refresh-stable for the partial fixture, but the estimate-created precondition was absent.
- `SETUP-012`: rename and code regeneration persisted, but the old code was not submitted through a fresh join attempt.
- `MASTER-002`: manual duplicate protection passed, but the specified bulk-add duplicate path was not executed.
- `MASTER-003`: name/type edits persisted, but the loom lacked assignment and production history.
- `MASTER-005`: no active-order/history fixture was available for protected lifecycle proof.

Evidence:

- `output/qa/runtime-rerun-20260710/evidence/AUTH-012-cross-org-production.json`.
- `output/qa/runtime-rerun-20260710/evidence/SETUP-001-market-onboarding-production.json`.
- `output/qa/runtime-rerun-20260710/evidence/SETUP-002-order-onboarding-production.json`.
- `output/qa/runtime-rerun-20260710/evidence/SETUP-010-mode-switch-production.json`.
- `output/qa/runtime-rerun-20260710/evidence/SETUP-011-factory-today-production.json`.
- `output/qa/runtime-rerun-20260710/evidence/SETUP-012-factory-identity-production.json`.
- `output/qa/runtime-rerun-20260710/evidence/MASTER-001-add-loom-production.json`.
- `output/qa/runtime-rerun-20260710/evidence/MASTER-002-duplicate-loom-production.json`.
- `output/qa/runtime-rerun-20260710/evidence/MASTER-003-edit-loom-production.json`.

Data safety:

- All created records were strongly QA-prefixed test records. No real client, billing purchase, payment, WhatsApp send, backup/restore, or broad load action was used.
- QA trial entitlements were fixture-only rows; no Razorpay payment was performed.
- No Supabase migration, DB push, repair, pull, or schema mutation occurred during this documentation closeout.
- The QA fixtures remain available for the next runtime batch and require targeted cleanup when the campaign finishes.

Resolution status:

- Runtime checkpoint: pass 7, fail 2, blocked 7, not run 129.
- Formal matrix movement for these 16 rows: pass +7, fail +2, blocked +7, `code_verified` -16.
- Updated matrix totals: total 377, pass 203, fail 15, blocked 29, `code_verified` 129, `not_applicable` 1, `not_run` 0.

### Runtime Rerun Batch 2 Continuation - Queue 17-20

- `MASTER-008` moved to `pass`: one present attendance day for a QA Day-to-Day worker with ₹30,000 monthly salary produced ₹1,000 gross/net, matching `min(monthly salary, monthly salary / 30 × present days)` and staying below the monthly cap. Evidence: `output/qa/runtime-rerun-20260710/evidence/MASTER-008-daily-attendance-payroll-production.json`.
- `MASTER-009` moved to `fail`: after authenticated tenant-scoped deactivation, Machines still displayed the inactive worker on both shifts and the loom as Active, while Factory Today still marked worker assignment complete. Evidence: `output/qa/runtime-rerun-20260710/evidence/MASTER-009-deactivate-assigned-worker-production.json`.
- `MASTER-011` and `MASTER-012` moved to `blocked`: two workers, two active contexts, a linked loom, and standing assignments were prepared, but two Save shift logs attempts returned `UPDATE requires a WHERE clause`; zero `production_logs` rows were created, preventing substitute-payroll and historical-context proof. Evidence: `output/qa/runtime-rerun-20260710/evidence/MASTER-011-substitute-worker-blocker-production.json` and `output/qa/runtime-rerun-20260710/evidence/MASTER-012-replace-context-blocker-production.json`.
- Additional deployed-boundary finding: application activation checks allow at least one day or night assignment, while authenticated database activation returned constraint `23514` until both shifts were assigned.
- Updated runtime checkpoint: pass 8, fail 3, blocked 9, not run 125. Updated formal matrix totals: total 377, pass 204, fail 16, blocked 31, `code_verified` 125, `not_applicable` 1.

### Runtime Rerun Batch 3 - Queue 21-30

- Promoted `MASTER-013`, `MASTER-015`, `EST-002`, `EST-004`, `EST-006`, `EST-007`, `EST-008`, `EST-009`, `EST-010`, and `EST-013` from `code_verified` to `pass` using production-backed, QA-prefixed browser and database proof.
- Order cancellation unlinked and inactivated only the related loom. Worker phone changes required consent reconfirmation, updated the one consent row to the latest non-routable QA number, and created no WhatsApp delivery rows.
- Estimator proof covered exact blended-row arithmetic, 254 cm ↔ 100 inch equivalence and draft refresh, sizing, optional-cost gates, override replacement, capacity/idle cost, repeated fixed-worker merge/save, and the full org-scoped template lifecycle through cleanup.
- The first-run baseline modal was completed before button/radio classification; intercepted clicks before setup completion were discarded as invalid evidence, not failures.
- Evidence: `output/qa/runtime-rerun-20260710/evidence/batch-03-master-estimator-production.json` and `output/qa/runtime-rerun-20260710/batch-03-summary.json`.
- Updated runtime checkpoint: pass 18, fail 3, blocked 9, not run 115. Updated formal matrix totals: total 377, pass 214, fail 16, blocked 31, `code_verified` 115, `not_applicable` 1.

## Runtime Remediation — AUTH-012 Production Closeout

Date: 2026-07-13 IST. Branch `codex/estimator-production-readiness-20260710`.

- Root cause: production `organizations` had a public permissive `Lookup org by join code` SELECT policy with predicate `true`, which OR-composed around tenant isolation.
- Compatibility/safety: the identified real account's auth user, owner profile, organization, and organization owner ID were internally consistent with the replacement policy. Its tenant was excluded from mutation.
- Migration: applied only `20260710210828_close_public_organization_join_code_policy.sql`; recorded exact remote migration history `20260710210828`. No other pending migration was deployed.
- Catalog proof: post-deployment `organizations` policies are exactly authenticated tenant SELECT and authenticated owner tenant UPDATE. The post-deployment advisor returned no finding targeting `organizations`.
- Runtime proof: fixture `AUTH012-1783901124790-D5DAFB55` passed own organization read/update; cross-tenant organization/profile/machine non-disclosure; cross-tenant organization/machine mutation denial; and service-role persistence checks proving target rows were unchanged.
- Cleanup: exact production organizations, profiles, machine, and both auth users reconciled to zero. The real tenant was untouched.
- Validation: focused AUTH tests passed 6/6; targeted ESLint and TypeScript passed; full Vitest passed 75 files with 579 passed and 1 intentional skip; JSON/matrix consistency and `git diff --check` passed.
- Formal result: `AUTH-012` moved from `fail` to `pass`. Matrix totals are 253 pass, 3 fail, 120 blocked, and 1 not applicable.
- Remaining failures: `WA-008`, `OFF-009`, `OFF-010`.

## OFF-009 unknown-outcome boundary (2026-07-13)

- Status: `code_verified_but_not_runtime_verified`; the formal matrix remains `fail`.
- Added `lib/mutation-outcome.ts` so a client response timeout is represented as an unknown mutation outcome rather than a definite failure. Supervisor shift submission now performs an authoritative shift-state lookup before allowing the timeout path to resolve as success, and otherwise tells the operator not to resubmit until the shift is checked.
- Added focused coverage in `__tests__/off-009-mutation-outcome.test.ts` for normal completion, timeout classification, and exact persisted replacement-state reconciliation. Updated the Batch 24D source assertion for the wrapped submit call.
- Local proof passed: `npx vitest run __tests__/off-009-mutation-outcome.test.ts __tests__/batch24f-production-worker-assignment-policy.test.ts` (2 files, 10 tests); targeted ESLint; `npx tsc --noEmit`; and the production-environment build gate (77 files, 584 tests, followed by a successful Next.js 16.2.10 build).
- Production browser proof used disposable tenant `OFF009-1783902723451-ED3AE8` behind a one-shot 17-second response-delay proxy. At the 15-second client boundary, the UI did not report a definite failure and displayed: “We could not confirm whether this shift was saved. Do not submit it again yet; refresh and check the shift first.” Evidence: `output/qa/runtime-remediation-20260711/OFF-009-timeout-reconciled.png`.
- The committed-state reconciliation branch remains unproven because the existing production shift-log write path returns `UPDATE requires a WHERE clause` even without the delay and creates zero `production_logs` rows. This is the existing production-write blocker, not a timeout-classification failure.
- Data safety: the exact disposable production fixture and auth user were removed by `node scripts/qa/off-009-browser-fixture.mjs cleanup --production`, which returned `cleaned: true`. The protected `ambob9182@gmail.com` tenant was not used.

## Formal blocked-row Batch 2 closeout (2026-07-13)

- Status changes: `SETUP-012`, `DASH-001`, `BILL-002`, `UX-004`, and `UX-011` moved from `blocked` to `pass`.
- Fixture/proof: `scripts/qa/formal-batch2-fixture.mjs` created isolated active Premium and Base tenants plus a Premium supervisor against QA project `eutycrtzzxmlkcpipgod`. Browser proof covered empty Factory Today, plan gating with Billing reachable, 390x844 navigation/logout, reciprocal supervisor copy/redirects, and old-versus-current join-code behavior.
- Database reconciliation: the empty tenant had zero rows across machines, both worker tables, orders, market runs, production, stock, dispatch, receivables, advances, and payroll settlements. Subscription tiers/statuses and role membership matched the rendered access boundaries.
- Evidence: `output/qa/runtime-remediation-20260711/RUNTIME_EVIDENCE.md` and the five durable screenshot artifacts in that directory.
- Data safety: no production data was used; both subscriptions, three profiles, two organizations, all three auth users, and the private credential file were deleted and independently reconciled to zero/removed. Browser tabs and the local QA server were closed.
- Open finding: the fresh Premium Settings route rendered a blank main region without a browser-console error. `SEC-009` remains blocked and is categorized under `Needs formal audit/debugging`; no export pass credit was claimed.
- Formal matrix after this batch: total 377, pass 258, fail 3, blocked 115, not applicable 1, code verified 0, not run 0.

## Formal blocked-row Batch 3 closeout (2026-07-13)

- `UX-003`: clean isolated join validation retained entered name, email, and phone after an exact phone-length error; no relevant console issue or partial account/tenant row appeared.
- `BILL-008` defect/fix: `applyReferralCode` attempted an authenticated INSERT where `referral_uses` has no INSERT policy. The module is now explicitly server-only and uses the admin client only after signup/API call sites derive the referee org from trusted owner context. Self-referral remains blocked before insert and the unique referee constraint remains the duplicate-use boundary.
- `AUTH-015` defect/fix: revocation markers were written but never consulted. `getCachedSession` now checks `isUserRevoked(user.id)` before profile/role authorization is loaded.
- Runtime: valid referral application returned 200; self and duplicate applications were rejected; database count was exactly one cross-org use and zero self uses. Two independent authenticated sessions returned 200 before revocation and were both denied afterward while their JWTs still validated.
- Tests: `npx vitest run __tests__/bill-008-referral-boundary.test.ts __tests__/auth-015-session-revocation.test.ts` passed 2 files / 5 tests; targeted ESLint passed.
- Safety/cleanup: QA-only fixture; referral records, Redis marker, all tenant/auth records, credentials, browser tabs, and server were removed and reconciled.
- Formal matrix: total 377, pass 261, fail 3, blocked 112, not applicable 1.

## Formal blocked-row Batch 4 closeout (2026-07-13)

- `MASTER-002`, `MASTER-003`, and `MASTER-005` moved from `blocked` to `pass` using isolated QA owner browser proof plus tenant-scoped database reconciliation.
- `MASTER-002`: two Jacquard groups in one onboarding bulk request persisted as exactly `Jacquard 1` and `Jacquard 2`; trim/case duplicate insert and rename returned the normalized-name 23505 boundary; same-name cross-tenant and same-type different-name controls succeeded; no normalized duplicate remained.
- `MASTER-003`: one active loom with an active target, two standing assignments, a dated assignment, and 10m production history was renamed and changed to Water Jet. Refresh and database checks preserved the same target and every reference.
- `MASTER-005`: owner deactivate/delete attempts were rejected and the visible message listed active target, active assignments, dated assignment history, and production history. The loom remained active with all references intact; a separate unused loom delete succeeded.
- Evidence: `output/qa/runtime-remediation-20260711/evidence/MASTER-002-formal-batch4.json` and `output/qa/runtime-remediation-20260711/evidence/MASTER-003-005-formal-batch4.json`.
- Regression proof: `npx vitest run __tests__/batch24e-master-data-guardrails.test.ts` passed 1 file / 9 tests; targeted ESLint and probe syntax checks passed.
- Safety: QA project `eutycrtzzxmlkcpipgod` only. Exact production log, assignments, order, worker, machines, subscriptions, profiles, organizations, auth users, private credential file, browser tabs, and local server were removed or closed and reconciled.
- Formal matrix: total 377, pass 264, fail 3, blocked 109, not applicable 1. Readiness remains No-Go.

## Formal blocked-row Batch 5 closeout (2026-07-13)

- `SETUP-011` moved from `blocked` to `pass` after an isolated complete-setup rerun exposed and verified a real client lifecycle fix.
- Defect: `FactoryTodayClient` started the deferred 13-query checklist request inside an effect, but Strict Mode cleanup marked its completion inactive while the one-request guard prevented a usable replacement subscription. The server action completed successfully, yet the setup panel could remain absent without a console error.
- Fix: retain one in-flight checklist promise and do not cancel its state completion during effect cleanup. React safely ignores a state update after a real unmount; repeated Strict Mode callbacks are idempotent because they apply the same payload.
- Runtime: one persisted estimate, active order, active linked loom, active piece-rate and fixed workers, day/night assignments, supervisor, payroll config, and active Premium plan rendered `11 of 14 steps complete · Order or market-run path`; `Log first production` remained the correct next step before and after refresh, with zero browser console errors/warnings.
- Database reconciliation: exactly one fixture machine, piece-rate worker, fixed worker, estimate, order, and payroll config; two assignment shifts; one supervisor; one active subscription; linked loom active.
- Evidence: `output/qa/runtime-remediation-20260711/evidence/SETUP-011-formal-batch5.json`.
- Regression proof: `npx vitest run __tests__/batch3b-factory-today-query-fanout.test.ts __tests__/batch24c-factory-today-analytics-state.test.ts` passed 2 files / 12 tests; targeted ESLint and fixture syntax checks passed.
- Safety: QA project `eutycrtzzxmlkcpipgod` only. Exact business rows, subscriptions, profiles, organizations, auth users, private credential files, browser tabs, and local server were removed or closed and reconciled.
- Formal matrix: total 377, pass 265, fail 3, blocked 108, not applicable 1. Readiness remains No-Go.

## Formal blocked-row Batch 6 closeout (2026-07-13)

- `SETUP-007` moved from `blocked` to `pass` after a controlled same-origin failure proxy supplied the missing runtime condition and exposed a real retry-state defect.
- Defect: a rejected `addMachinesBulk` promise bypassed the original `setSaving(false)` path, leaving the setup save action disabled indefinitely. The machine form now catches rejected requests, shows `Unable to save machines. Check your connection and try again.`, and always clears saving state in `finally`.
- Runtime: exactly one `POST /onboarding` was intercepted with a controlled 503 before the application mutation. The step stayed incomplete at 2/5, the retry toast appeared, `Save 1 machine` re-enabled, and the tenant still had zero machines.
- Retry and persistence: the unchanged form was retried through the healthy upstream; the database contained exactly one `Jacquard 1`, and a fresh page load showed 3/5 with `Add your machines` marked `Done ✓`. The final exercised browser window had zero warnings/errors.
- Evidence: `output/qa/runtime-remediation-20260711/evidence/SETUP-007-formal-batch6.json`.
- Regression proof: `npx vitest run __tests__/setup-007-onboarding-network-retry.test.ts __tests__/batch24c-factory-today-analytics-state.test.ts` passed 2 files / 8 tests; targeted ESLint and proxy syntax checks passed.
- Migration/deployment: none. This batch changed only the client retry boundary, focused regression coverage, the disposable local proxy, and formal evidence/docs.
- Safety: isolated QA project `eutycrtzzxmlkcpipgod`; the created machine and the complete fixture/auth set were deleted by exact tenant/fixture cleanup, and local servers/browser tabs/private credentials were removed or closed.
- Formal matrix: total 377, pass 266, fail 3, blocked 107, not applicable 1. Readiness remains No-Go.

## Production checkpoint deployment (2026-07-13)

- Source checkpoint: commit `40b414a6ed7b9285048045c118074d8e0d010065` on `codex/estimator-production-readiness-20260710` was pushed to `origin` before deployment.
- Release gate: full Vitest passed 80 files with 589 passed and 1 intentional skip; ESLint, TypeScript, `git diff --check`, QA proxy syntax, and the Next.js 16.2.10 production build passed. The Vercel remote build repeated the test/build gate and uploaded Sentry source maps successfully.
- Production database: preflight dry-run identified exactly five pending migrations. Production impact inspection found 13 active machines, with zero rows and zero organizations affected by the loom-deactivation reconciliation. Migrations `20260710211355`, `20260711061412`, `20260711134000`, `20260711172126`, and `20260711180000` were then applied in order. Post-deployment migration listing shows local and production aligned through `20260711180000`.
- Edge function: `whatsapp-webhook` was deployed to production as active version 16 with JWT verification disabled as required by its signed Meta webhook boundary.
- Web deployment: Vercel production deployment `dpl_4pP8ovMPoS1tCwAcp9RZQL5gNfnY` is Ready and aliased to `https://textile-accounting.vercel.app`.
- Live smoke: `/`, `/login`, `/privacy`, `/terms`, and `/manifest.webmanifest` returned HTTP 200. Unauthenticated `/owner/today` and `/supervisor/dashboard` returned HTTP 307 to `/login`.
- Formal audit/debugging follow-up: production schema lint still reports six legacy stored-function errors in `lockdown_tenant`, `link_batch_to_machine`, `get_daily_brief_stats`, `replace_shift_production_logs`, `settle_worker_payroll`, and `get_yield_alert`. These were not represented as deployment passes and require isolated formal audit/debugging before remediation.
- Matrix state is unchanged by deployment: total 377, pass 266, fail 3, blocked 107, not applicable 1. Readiness remains No-Go while live testing proceeds.

## Formal blocked-row Batch 7 closeout (2026-07-13)

- Status changes: `PROD-002`, `PROD-004`, and `MASTER-012` moved from `blocked` to `pass` after isolated production browser and database proof.
- Reproduced defect: a loom with one active day worker and no night worker was rejected by the legacy database activation function, contradicting the selected-shift application policy.
- Fix: migration `20260713124500_allow_single_shift_machine_activation.sql` changes loom readiness to require an active order plus at least one active day/night meter-worker assignment. The selected-shift production boundary still requires the chosen shift's worker. The migration only replaces functions; it rewrites no business rows.
- Migration evidence: production dry-run listed exactly `20260713124500`; apply succeeded; local and remote migration histories align through `20260713124500`. The migration was applied before this batch's source commit, so the repository was intentionally mid-flight only during runtime proof.
- `PROD-002`: isolated production first had exactly one day assignment and zero night assignments. The loom activated, the supervisor submitted 40m, and refresh restored the log. Readback proved Worker A, ₹2.50/m snapshots, one 40m order-reserved stock grain, and ₹100 payroll basis.
- `PROD-004`: the owner linked Context B and used the explicit operator editor to assign Worker B to night shift at ₹3.25/m. The supervisor saw Worker B and Context B and saved 55m with matching assignment, worker, rate, stock, and payroll attribution.
- `MASTER-012`: the day log retained Context A, Worker A, ₹2.50, and its assignment ID after the loom moved to Context B. The new night log used Context B, Worker B, ₹3.25, and the new assignment ID. Total production was 95m and snapshot-derived gross was ₹278.75.
- Browser proof: owner/supervisor production flows produced zero console warnings/errors. Evidence: `output/qa/runtime-remediation-20260711/evidence/FORMAL-BATCH7-production-prerequisites.json` and `.png`.
- Regression proof: `npx vitest run __tests__/prod-002-single-shift-activation.test.ts __tests__/batch24f-production-worker-assignment-policy.test.ts __tests__/master-009-worker-deactivation-readiness.test.ts` passed 3 files / 12 tests; targeted ESLint, TypeScript, script syntax, JSON validation, and `git diff --check` passed.
- Safety: production fixture `FORMAL-B7-1783944614148-779128` used only prefixed QA records. Cleanup returned organizations, profiles, machines, production logs, and both auth users to zero; the private credential file was removed and browser tabs were closed.
- New finding: `NEEDS-AUDIT-004` records that a selected historical production date reverted to today when entry state changed. Dated assignment/correction/time rows remain blocked pending a focused repair; no pass credit was claimed for them.
- Formal matrix: total 377, pass 269, fail 3, blocked 104, not applicable 1. Readiness remains No-Go.

## Formal blocked-row Batch 8 closeout (2026-07-13)

- `MASTER-011` moved from `blocked` to `pass` after production browser, persistence, refresh, stock, and payroll proof.
- Fixes: dated `shift_assignments.worker_id` now overrides standing/operator assignment only for its selected date/shift; the server validates that persisted dated worker instead of accepting an arbitrary client substitute; dated `rate_per_m` becomes the operator/payroll snapshot; the historical order boundary uses `orders.start_date`, not `created_at`; and explicit previous/next production-day controls commit date state without relying on a native picker.
- Runtime: Worker A remained the standing day worker, Worker B loaded only for 2026-07-12, 32m saved and restored after refresh, the correction-window overwrite persisted Worker B at ₹3.25/m, stock reconciled to 32m, and owner payroll showed Worker B only with Gross/Net ₹104.
- Release: production deployment `dpl_43n5khAYXGcCtp64SBowPZirjaUG` delivered the dated-rate fix for commit `649380d5dfbcbb89d8c10cad7763448ac42c6f2c`; alias `https://textile-accounting.vercel.app` was Ready.
- Verification: full Vitest/prebuild gate passed 81 files / 595 tests; focused Batch 24D/24F tests, TypeScript, targeted ESLint, and `git diff --check` passed. No migration was required.
- Safety: isolated `QA-FORMAL-B7-1783960232554-52BF61` production fixture only; exact business rows, profiles, organization, auth users, credential file, and browser tabs were removed and reconciled to zero.
- Evidence: `output/qa/runtime-remediation-20260711/evidence/FORMAL-BATCH8-master-011-dated-substitute.json` and `.png`.
- Formal matrix: 270 pass, 3 fail, 103 blocked, 1 not applicable. Readiness remains No-Go.

## Blocked-row campaign B09 closeout — production resilience

Date: 2026-07-14 IST. Deployment commit `812512c599b3659cc399495a674e8b3e50066e60`.

- Status changes: `PROD-005`, `PROD-006`, `PROD-007`, `PROD-010`, `PROD-011`, `PROD-013`, `PROD-014`, `PROD-022`, `PROD-023`, `PROD-024`, `PROD-025`, `PROD-026`, `PROD-027`, `PROD-030`, `OFF-003`, `OFF-004`, and `UX-001` moved from `blocked` to `pass` after direct runtime proof.
- Defects fixed: breakdown persistence previously returned success after a zero-row update; the action now validates the tenant/date/shift/machine grain and performs a verified update-or-insert with unique-race recovery. Copy previous was hidden by placeholder assignment rows and now follows the actually assigned count. The loom sheet now supplies the required accessible title.
- Runtime boundaries: invalid missing-order, missing-worker, zero-rate, and negative payloads were rejected without mutation; Other-without-note stayed disabled; 10,000 m required explicit confirmation; date/shift and refresh drafts remained isolated; offline submit made no success claim; a 17-second delayed response reconciled one 22.22 m log and stock lot; and two distinct supervisors produced one success plus one atomic duplicate rejection.
- Mobile proof: the 390×844 workflow rendered 20 independently labelled metre inputs without horizontal overflow, preserved distinct first/middle/last values, and kept the fixed Save control reachable.
- Production proof: Vercel deployment `dpl_EPGVy9PMbaLLphgssXvBq9HgD5yB` is Ready, production-targeted, aliased to `https://textile-accounting.vercel.app`, and identifies the exact commit. Production Copy previous moved Night from 0/20 to 1/20 with Worker B. The deployed H2-labelled sheet persisted Service + Mechanical + the exact note into a new dated row.
- Release gates: local optimized build passed 82 files / 598 tests with 1 intentional skip; the Vercel build passed 82 files / 599 tests and uploaded release source maps. Production migration history remains aligned through `20260713124500`; B09 added no migration.
- Safety: one prefixed production tenant, three auth users, 20 looms, and associated assignments/logs/stock were removed; organizations, profiles, machines, production logs, and auth users all reconciled to zero.
- Evidence: `output/qa/blocked-row-campaign/B09-production-resilience.json`, `B09-concurrent-supervisors.json`, `B09-production-deploy-proof.json`, and `B09-mobile-20-looms.png`.
- Formal matrix: 287 pass, 3 fail, 86 blocked, 1 not applicable. Readiness remains No-Go.

## Blocked-row campaign B10 closeout — protected date and calendar boundaries

Date: 2026-07-14 IST. Production commit `fd1c367665455ca2bc66ca54d81a9cc259147284`.

- Status changes: `PROD-017`, `PROD-018`, `PROD-019`, `PAY-006`, `PAY-022`, `COMM-013`, `TIME-003`, and `TIME-004` moved from `blocked` to `pass` after exact production browser and database proof.
- Database boundary: migration `20260714005500_b10_enforce_attendance_date_lockdown.sql` removed broad attendance policies that bypassed date restrictions. It was applied in QA and production; production recorded history version `20260713193455`. The migration changes policies/functions only and rewrites no business rows.
- Application fixes: India month boundaries now derive both endpoints from one instant; attendance has deterministic previous/next-day controls; and access-code retry copy converts an absolute reset epoch into remaining seconds instead of displaying epoch seconds.
- Correction proof: an expired correction window showed no unguarded edit path. Invalid, expired, and consumed owner codes rejected without mutation; a fresh code changed the eligible historical production value from 10m to 12m and was consumed; a settled payroll grain rejected a fresh valid code and remained 10m.
- Attendance proof: future attendance remained unavailable, the supervisor navigated to 2026-07-12, a valid owner code saved `absent`, and refresh restored the locked past-date state. The applied policy prevents broad supervisor writes outside the supported date boundary.
- Calendar/commercial proof: the India-month total was exactly ₹333.33, including 2026-07-01 and 2026-07-14 while excluding 2026-06-30 and 2026-08-01. Deterministic tests covered year rollover and leap-day payroll/calendar boundaries.
- Release: Vercel deployment `dpl_5rKpnNLwszpfgfzkn8VBh291wyS6` is Ready and aliased to `https://textile-accounting.vercel.app`; the Sentry release identifies the exact production commit. The remote gate passed 85 files / 611 tests and the local gate passed 85 files / 610 tests with 1 intentional skip, focused ESLint, and the optimized production build.
- Safety: the prefixed production tenant, both correction grains, attendance, payments, profiles, and auth users reconciled to zero; the private production credential file was removed.
- Evidence: `output/qa/blocked-row-campaign/B10-qa-boundaries.json`, `B10-production-boundaries.json`, and `B10-production-runtime.json`.
- Formal matrix: 295 pass, 3 fail, 78 blocked, 1 not applicable. Readiness remains No-Go.

## Blocked-row campaign B11 closeout — quote/order protected history

Date: 2026-07-14 IST. Production commit `dc76b17f38eb111ef3dad0a5a9f809b17168cda5`.

- Status changes: `QUOTE-007`, `ORDER-005`, `ORDER-007`, `ORDER-009`, `ORDER-010`, `ORDER-011`, `ORDER-012`, `ORDER-013`, `ORDER-014`, `ORDER-015`, `STOCK-011`, and `GOLDEN-A-23` moved from `blocked` to `pass` after direct QA lifecycle and production Estimator proof.
- Defect fixed: the atomic `start_party_order_from_estimator` boundary existed but Estimator exposed only quote saving. A primary Start Party Order action now creates the accepted quote, active order, and yarn requirement together and routes to the created order.
- QA lifecycle: 34 assertions proved over-target rejection without mutation, target completion and loom unlinking, paid-payroll correction protection, cancellation with retained history, physical-delete restriction, order-reserved stock lineage, partial dispatches, exact/short receipts, discrepancy/claim creation, independent receivable settlement, and a second-session reconciliation.
- Production proof: deployment `dpl_HQbasVXv3NDZjrtVjoXjpebgtbGV` is Ready and aliased. The UI created and opened a 100m B11 order; database readback proved exactly one accepted quote and active order, reciprocal links, and one yarn requirement linked to both.
- Release gates: local and Vercel gates passed 85 files / 611 tests with 1 intentional skip, TypeScript, targeted ESLint, and the optimized Next.js build. Required order/dispatch migrations were verified deployed.
- Safety: disposable QA and production tenants and their scoped quote/order/yarn/production/stock/dispatch/commercial/payroll records, profiles, auth users, and private credential file were removed and reconciled.
- Evidence: `output/qa/blocked-row-campaign/B11-qa-order-lifecycle.json` and `B11-production-runtime.json`.
- Formal matrix: 307 pass, 3 fail, 66 blocked, 1 not applicable. Readiness remains No-Go.

## Blocked-row campaign B12 closeout — market stock lifecycle

Date: 2026-07-14 IST. Production commit `bc1e9cbfab1609adf461c405e41d6fca65b304ee`.

- Status changes: `MARKET-009`, `MARKET-010`, `MARKET-013`, `STOCK-005`, `STOCK-009`, `DISP-017`, `DISP-018`, `COMM-015`, `GOLDEN-B-12`, and `GOLDEN-B-17` moved from `blocked` to `pass` after matching QA and production lifecycle proof.
- Defects fixed: stock-lot source IDs were checked only in server actions, leaving direct authenticated writes able to reference another tenant or a mismatched quote/order. Migration `20260714033000_b12_enforce_stock_source_integrity.sql` adds a database trigger for organization and relationship integrity. `market_run_summary.sales_count` counted only legacy direct market sales; migration `20260714034500_b12_include_stock_sales_in_market_summary.sql` now includes current stock-lot sales.
- Runtime: both environments passed 17 assertions covering rejected cross-tenant/mismatched sources, sold-out pending dispatch, two exact 60m/40m dispatch receipts, closed archive totals, honest above/below-threshold compliance states, distinct duplicate-name party IDs and receivables, real concurrent sale-vs-adjustment serialization, non-negative stock, 26-run performance, and second-session freshness.
- Release: Vercel deployment `dpl_q1bQa4dHd9bFKFU8ZphcVQNcE2d1` is Ready and aliased to `https://textile-accounting.vercel.app`; the deployment and Sentry release identify the exact commit. Local and remote gates passed 86 files / 617 tests, TypeScript, targeted ESLint, and the optimized Next.js build.
- Database: both migrations were applied in QA and production. Production history recorded versions `20260713211109` and `20260713211113`; catalog inspection and runtime probes verified the trigger and revised view.
- Safety: each QA and production run used disposable owner/adversary tenants. Organizations, profiles, stock lots, auth users, and all dependent market/production/sale/dispatch/receipt/commercial rows were removed; reconciliation returned zero with no cleanup errors.
- Evidence: `output/qa/blocked-row-campaign/B12-qa-market-stock.json` and `B12-production-market-stock.json`.
- Formal matrix: 317 pass, 3 fail, 56 blocked, 1 not applicable. Readiness remains No-Go; B13 is active.

## Blocked-row campaign B13 closeout — payroll and worker-money lifecycle

Date: 2026-07-14 IST. Production commit `d42d5138fba22758f1d11218c59deb6c3ad876a3`.

- Status changes: `MASTER-006`, `PAY-002`, `PAY-010`, `PAY-011`, `PAY-012`, `PAY-014`, `PAY-017`, `PAY-019`, `PAY-021`, `PAY-025`, `PAY-026`, `PAY-027`, `DASH-003`, `GOLDEN-A-21`, `GOLDEN-A-22`, and `GOLDEN-B-18` moved from `blocked` to `pass` after direct QA runtime/browser and production runtime proof.
- Defects fixed: concurrent first settlement calls could both succeed and split/deduct the same advance twice; deducted advances could be deleted directly; exiting-worker settlement and deactivation were separate operations; and Factory Today selected a nonexistent `market_run_summary.meters_produced` column. Migration `20260714043000_b13_harden_payroll_settlement_lifecycle.sql` adds per-grain advisory locking, explicit already-settled rejection, protected advance deletion, authorized reversal scope, and atomic final-exit settlement/deactivation. Factory Today now reads `total_meters_produced`.
- Runtime: QA and production each passed 11 persisted assertions for one-winner concurrency, a gross ₹1,000 / capped ₹500 recovery / ₹500 net / ₹300 carry result, protected delete, exact ₹800 reversal restoration, historical 2.75/3.125/3.00 rate snapshots, server-derived gross ₹675, itemized inam/kapaat, shared immutable Golden A/B payslip, atomic final exit, Kharchi 500→380 plus ₹120 advance, and a 50m × ₹4 dashboard source.
- Browser: Factory Today showed 50m, 4/4 active looms, partial shifts, two work-at-risk items, ₹1.2k pending advances, and overdue payroll. Payroll showed the three historical rate snapshots, gross ₹675, recovered/net ₹375, carry ₹125, PDF Slip action, plus the final-exit badge and ₹200 remaining debt. Warning/error logs were empty.
- Release: Vercel deployment `dpl_EBYTZG33aozbGbPLpYeAWQcF4JJD` is Ready and aliased to `https://textile-accounting.vercel.app`; deployment metadata and Sentry release identify the exact commit. Local and remote gates passed 87 files / 621 tests, TypeScript, targeted ESLint, and the optimized Next.js build.
- Database: the migration is applied in QA and production. Production history version is `20260713214539`; catalog inspection verified one delete-guard trigger, the exit RPC, settlement advisory lock, and reversal bypass. The migration rewrote no existing business rows.
- Safety: disposable QA and production payroll tenants, profiles, settlements, advances, production dependencies, auth users, credentials, tabs, and local server were removed or stopped; reconciliation returned zero with no cleanup errors.
- Evidence: `output/qa/blocked-row-campaign/B13-boundary-probe.json`, `B13-qa-browser.json`, `B13-qa-factory-today.png`, `B13-qa-payroll.png`, and `B13-production-payroll.json`.
- Formal matrix: 333 pass, 3 fail, 40 blocked, 1 not applicable. Readiness remains No-Go; B14 is active.

## Blocked-row campaign B14 closeout — realtime dashboard recovery

Date: 2026-07-14 IST. Production commit `6f80eac94d950460bf559583dbb18ef434afde00`.

- Status changes: `DASH-005`, `DASH-006`, `DASH-008`, `DASH-010`, and `UX-010` moved from `blocked` to `pass` after direct QA runtime/browser and exact-deployment production proof.
- Defects fixed: fulfilled Supabase results containing `error` were silently treated as empty data; the worker-breakdown RPC referenced removed `production_logs.created_at`; reconnect reused a topic while its prior channel was leaving; realtime refresh could invite double counting; zero-production orders were treated as on track; future critical deadlines were labeled overdue; and dashboard failure/offline/loading states lacked clear actions. The actions now unwrap result errors, migration `20260714053000_b14_repair_worker_breakdown_timestamp.sql` uses `submitted_at`, reconnect topics carry an epoch, event refresh replaces authoritative slices, order health distinguishes waiting/critical/overdue, and dashboard states expose retry controls.
- Runtime/browser: QA proved 20m/₹80 → 45m/₹180 from an authenticated second-session insert without reload or duplication, then recovered a disconnected 15m mutation as authoritative 60m/₹240. Injected RPC failure reached the error boundary and recovered. Offline, historical empty, critical, at-risk, reconnecting, and live states were distinct; warning/error logs were empty after repair.
- Performance/math: the complete 90-day/1,800-log range returned in 822.3 ms in QA and 585 ms in production. Both showed 1,800 produced, 3,200 remaining, five days, required 640m/day, trailing 20m/day, pace 0.03, plus an explicit zero-production waiting risk.
- Release: Vercel deployment `dpl_3Xb6mYaqnG5FRpye7ULVWcxq9ttq` is Ready and aliased to `https://textile-accounting.vercel.app`; metadata and Sentry release identify the exact commit. Local and remote gates passed 88 files / 625 passed plus 1 intentional skip, TypeScript, targeted ESLint, and the optimized Next.js build.
- Database: the migration is applied in QA and production. Production history version is `20260713222345`; catalog inspection verified `submitted_at`, absence of `created_at`, and Realtime publication. Existing production logs remained at 88 across the schema-only change.
- Safety: disposable QA and production dashboard tenants, profiles, auth users, 1,800-log fixtures, credentials, tab, and local server were removed or stopped; reconciliation returned zero with no cleanup errors.
- Evidence: `output/qa/blocked-row-campaign/B14-qa-dashboard.json`, `B14-qa-browser.json`, and `B14-production-dashboard.json`.
- Formal matrix: 338 pass, 3 fail, 35 blocked, 1 not applicable. Readiness remains No-Go; B15 is active.

## Blocked-row campaign B15 closeout — authentication, privacy, audit, adversarial UX, and PWA

Date: 2026-07-14 IST. Production commit `2e3254f75502ca56192d015c06bba4f7972518aa`.

- Status changes: `AUTH-005`, `AUTH-014`, `AUTH-018`, `SEC-009`, `SEC-010`, `SEC-012`, `SEC-013`, `SEC-015`, `UX-006`, and `UX-009` moved from `blocked` to `pass`. `OFF-001` remains `blocked` with the precise install/standalone capability gap.
- Defects fixed: the last-activity cookie expired before the one-hour enforcement path could observe staleness; proxy IP parsing was duplicated; export was presentation-gated and hidden at narrow widths; worker erasure was not one atomic tenant/actor-validated operation and retained historical PII/client IP; custom cards and icon actions lacked complete keyboard/name semantics; and privacy-only history changes retriggered production boundary logic. The proxy, shared privacy panel, semantic controls, atomic erasure RPC, audit redaction, and column-scoped triggers now enforce those boundaries.
- Runtime/browser: valid/used/expired recovery links, one-hour idle redirect without sensitive content, foreign-Origin server-action rejection without mutation, tenant isolation, owner-only erasure, audited export, deletion/write-off/settings audit context, inert stored hostile markup, keyboard activation/names, and three core routes at a 200%-equivalent viewport all passed.
- PWA: production `/login`, manifest scope `/`, standalone display, exact 192/512 icons, update-capable service worker, visible update notice, and refresh activation passed. The in-app browser exposes no install/standalone mode and the Chrome extension was unavailable after retry, so actual install/reopen is not claimed.
- Release: Vercel deployment `dpl_CmFozomMsAhE36kvGUMQiPwJpsFr` is Ready and aliased to `https://textile-accounting.vercel.app` at the exact implementation commit. Local and remote gates passed 89 files / 633 passed plus 1 intentional skip, TypeScript, targeted ESLint, and the optimized Next.js build.
- Database: migrations `20260714063000_b15_atomic_worker_erasure.sql` and `20260714064500_b15_scope_production_log_triggers.sql` are applied in QA and production. Production history versions are `20260713232352` and `20260713232354`; catalog inspection verified old/new client-IP redaction and business-column-only triggers. Existing historical production/payroll basis is retained.
- Advisors: the production linter remains at its pre-existing broad backlog shape. The new authenticated security-definer erasure RPC is intentional and validates `auth.uid()`, actor identity, owner role, and organization internally; it is not granted to anonymous callers. See the [Supabase security linter reference](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- Safety: all disposable QA and production tenants, profiles, recovery users, worker/production/audit/export fixtures, credentials, temporary harness copy, and local server were removed or reconciled to zero.
- Evidence: `output/qa/blocked-row-campaign/B15-qa-security.json`, `B15-qa-browser.json`, `B15-qa-http.json`, and `B15-production-security.json`.
- Formal matrix: 348 pass, 3 fail, 25 blocked, 1 not applicable. Readiness remains No-Go; B16 is active.

## Blocked-row campaign B16 closeout — WhatsApp simulation and provider boundaries

Date: 2026-07-14 IST. Production commit `ee2af23a31e648880bdf3810f9cacb545cefcedd`.

- Status changes: `WA-001`, `WA-002`, `WA-003`, `WA-004`, `WA-005`, `WA-006`, `WA-007`, and `WA-009` moved from `blocked` to `pass` after nine direct disposable-QA runtime assertions. `WA-010` remains `blocked` because its exact expectation requires a controlled live Meta rejection or expired-token event against a consented recipient.
- Defects fixed: missing-phone skips were not persisted; consent lookup could drift from the exact tenant/person/phone; retry reset historical attempt fields and was not safely targetable; daily, monthly, and deadline cooldowns could interfere; access-code snapshots could retain plaintext; daily skip counts were inaccurate; and provider failure modes lacked deterministic non-production exercise. The simulator is now available only when `WHATSAPP_PROVIDER=simulate`, while shared-secret internal calls accept current and legacy admin keys during rotation.
- Runtime: the QA harness passed opted-in advance delivery, opted-out/missing-consent/missing-phone skips, provider timeout with the core write intact, worker-and-phone-bound summary/itemized payslips with no mismatch PII leak, owner-only access codes without plaintext snapshots, independent daily/monthly/deadline idempotency, one targeted retry recovery with capped/stale rows untouched, and deterministic rejection/expired-token fallback logging.
- Release: Vercel deployment `dpl_HSVWPpa4zPnR3gfEqXB1h3c55p4y` is Ready and aliased to `https://textile-accounting.vercel.app`; deployment metadata identifies the exact implementation commit. The full local gate passed 90 files / 641 passed plus 1 intentional skip, TypeScript, ESLint, and the optimized Next.js build; the remote gate passed 90 files / 642 tests and build.
- Database/functions: migration `20260714073000_b16_whatsapp_delivery_boundaries.sql` is applied in QA and production; production history version is `20260713235949`. Production catalog inspection verified canonical delivery/skip states, retry count `0..3`, `daily`/`monthly` brief types, the unique organization/date/type cooldown grain, and zero invalid rows. `send-advance-receipt` v17, `send-payslip` v18, `send-access-code` v18, `retry-failed-messages` v16, `send-daily-brief` v21, and `monthly-brief` v22 are active.
- Provider safety: production retained its Meta provider configuration. No live Meta message was sent, and simulated rejection was not used to satisfy `WA-010`.
- Advisors: the production security advisor retained its broad pre-existing backlog shape; no B16-specific finding was introduced.
- Safety: the disposable QA organization, profile, auth user, consent, core business records, delivery logs, credentials, and fixtures reconciled to zero after the run.
- Evidence: `output/qa/blocked-row-campaign/B16-qa-whatsapp.json` plus the exact production deployment, migration history, catalog, and function-version checks recorded in the campaign checkpoint.
- Formal matrix: 356 pass, 3 fail, 17 blocked, 1 not applicable. Readiness remains No-Go; B17 is active.

## Blocked-row campaign B17 closeout — Razorpay lifecycle and entitlement boundaries

Date: 2026-07-14 IST. Production commit `57caa6e6f15f25b6e26654a1d3cfc4b431452e9b`.

- Status changes: `BILL-003`, `BILL-004`, `BILL-005`, `BILL-006`, `BILL-007`, `BILL-009`, `BILL-010`, and `SEC-007` moved from `blocked` to `pass` after hosted Razorpay TEST checkout, 18 QA assertions, and 9 exact-deployment production assertions.
- Defects fixed: webhook validation and claim were not one fail-closed boundary; same event IDs could not distinguish replay from body conflict; payment/subscription updates could regress on late events; failed renewal and cancellation could incorrectly lose paid-period access; referral conversion/refund work was not claimed before provider activity; and refund requests lacked a stable provider idempotency key. Atomic claims, canonical provider fetch, monotonic lifecycle rules, preserved paid-period access, direct provider refund idempotency, and database-serialized referral claims now enforce those boundaries.
- Provider runtime: hosted Razorpay TEST checkout used Netbanking and Bank of Baroda. Initial capture, mock-bank renewal failure, later renewal success, two captured payments, one failed payment, and one 10% TEST refund reconciled. No real money moved.
- Webhook/runtime: valid HMAC, same-body replay, same-ID body conflict, invalid HMAC, order.paid/payment.captured convergence, late failure, cancellation/recovery/expiry, failed-to-captured reconciliation, anchored 365-day renewal, one referral conversion/refund, refund replay, and expiry access loss with account/history preservation passed in QA and at the production alias boundary.
- Release: Vercel deployment `dpl_AjR5NjfcewVpx9kS2cNXBU89v8fw` is Ready and aliased to `https://textile-accounting.vercel.app` at the exact implementation commit. The full local gate passed 91 files / 649 passed plus 1 intentional skip, TypeScript, ESLint, and optimized build; the remote gate passed 91 files / 650 tests with no runtime error cluster.
- Database: migration `20260714090000_b17_harden_razorpay_lifecycle.sql` is applied in QA and production; production history version is `20260714040018`. The CLI dry-run correctly refused unrelated remote/local history drift, so no repair or pull was attempted; only B17 was applied through the scoped migration API. Production catalog verification found four RPCs, both activation wrappers, six subscription columns, three indexes, and service-role-only refund claim execution.
- Safety: the disposable QA tenant and both prefixed production boundary tenants, profiles/auth users, subscriptions, payments, webhook events, refunds, credentials, and temporary environments reconciled to zero or were removed.
- Evidence: `output/qa/blocked-row-campaign/B17-qa-razorpay.json` and `B17-production-runtime.json`.
- Formal matrix: 364 pass, 3 fail, 9 blocked, 1 not applicable. Readiness remains No-Go; B18 is active.

## Blocked-row campaign B18 closeout — recovery restore and rollback

Date: 2026-07-14 IST. Recovery exercise only; production source remains `57caa6e6f15f25b6e26654a1d3cfc4b431452e9b`.

- Status changes: `TECH-012` moved from `blocked` to `pass`. `TECH-011` remains `blocked` solely because production lacks an automated retained or approved off-site backup schedule.
- Restore runtime: a sanitized logical backup containing one organization, two users, one production record, one stock record, one receivable, and one payroll record restored into isolated QA. Backup and restored canonical digests both equal `257b65a8a164dda1f2f4b5d2ae45c63832930c8a8cec0ac881f8af70b5bb1e6a`; four reconciliation assertions and restored-owner sign-in passed in 2,478.4 ms.
- Application rollback: two actual builds of the B17 source were deployed to disposable Vercel project `weavly-b18-rollback-20260714`. Native rollback returned the alias from candidate `dpl_7BQpDXn2pBdXY3Kfm7YCp4GZ5J7o` to marked last-known-good `dpl_4W61veVnHqTyGDU19qC5dUBm2V14` in two provider-reported seconds; the release marker matched the exact source commit and `/privacy` returned 200.
- Database forward-fix: inside a rollback-only QA transaction, the rehearsal dropped a legacy column, added its canonical replacement, backfilled it from preserved JSON recovery provenance, reconciled the row, rolled back, and verified the temporary contract was absent.
- Schedule finding: production backup inspection reports WAL-G enabled, PITR disabled, and zero retained backups. Free-plan branching was unavailable and the two-active-project limit rejected a new disposable Supabase project without creating a resource or charge. The isolated restore proves mechanics, not schedule retention.
- Safety: production data, schema, deployment, and alias were untouched. All prefixed QA database/auth fixtures, private backup material, temporary database work, the disposable Vercel project, and the disposable worktree were removed or reconciled to zero.
- Evidence: `output/qa/blocked-row-campaign/B18-qa-backup-restore.json` and `B18-recovery-runtime.json`.
- Formal matrix: 365 pass, 3 fail, 8 blocked, 1 not applicable. Readiness remains No-Go; B19 is active.

## Blocked-row campaign B19 closeout — external evidence review

Date: 2026-07-14 IST. No production change and no status promotion.

- Rows reviewed: `SEC-011`, `SEC-018`, `UX-012`, `GOLDEN-A-03`, and `SIGNOFF-04` remain `blocked`, each with an individually named external dependency.
- Sentry: production DSN, organization, and project keys are present. The current shell and `.env.production.local` contain no read-only `SENTRY_AUTH_TOKEN`, and no live Sentry event-payload artifact exists. Repository/client/log scans and redaction tests are supporting evidence only; direct API payload inspection is still required.
- Legal: no dated qualified-counsel approval or redline was found for DPDP, breach, grievance, retention, offline-storage, or minor/child wording.
- Factory acceptance: no named supervisor terminology approve/change register, business-accepted real-fabric truth sheet, or dated supervisor shift register was found.
- Integrity: no external artifact was invented, no row inherited source-test credit, no secret value was recorded, and no runtime/provider resource was mutated.
- Evidence: `output/qa/blocked-row-campaign/B19-external-evidence-review.json`.
- Formal matrix: 365 pass, 3 fail, 8 blocked, 1 not applicable. All blocked-row batches B08–B19 have been reviewed; no independent executable batch remains. Readiness remains No-Go.

## Remaining pilot gate evidence-pack preparation

Date: 2026-07-14 IST. Documentation preparation only; application baseline `5a66eca`, documentation baseline `bb0380f`.

- Added closure-ready packs for `TECH-011`, `UX-012`, `GOLDEN-A-03`, and `SIGNOFF-04` under `docs/pilot-remediation/closure-packs/`.
- Each pack records the exact canonical requirement, current evidence, responsible-party fields, required artifacts, acceptance criteria, exact row-only matrix procedure, and outstanding human/laptop actions.
- The UX pack identifies all required terms, source/product locations, plain-language meanings, alternatives, screenshot instructions, and dated approve/change/re-review fields.
- The Golden A pack freezes the independent reference before Weavly entry and captures every input, formula/method, intermediate, tolerance, line-level variance, downstream snapshot, reviewer identity, and dated approval.
- The SIGNOFF pack makes limited-pilot authorization conditional on `TECH-011`, `UX-012`, and `GOLDEN-A-03` being formally `PASS`; it retains the canonical first-shift Today/register reconciliation as the only way to close `SIGNOFF-04`.
- Fresh read-only Supabase evidence still reports organization plan Free, production WAL-G enabled, PITR disabled, and no retained backup. No remote setting, billing plan, secret, schema, data, backup, or restore was changed. No restore proof is claimed.
- Status changes: none. Formal matrix remains **367 pass, 0 fail, 7 blocked, and 3 not applicable**; all four requested rows remain `blocked`.
## Performance release candidate and migration reconciliation — 2026-07-15

Branch `codex/performance-campaign-20260715-upstream`; code commits `8d4d767`, `341f151`, and `6626cfa`. Web push/merge/deployment was pending when this pre-push entry was recorded.

- Performance: non-English language resources and the payroll PDF engine are deferred from initial route graphs. Identical production-manifest measurements removed 32.4%–43.1% initial gzip across five routes, including a 46.3% payroll gzip reduction and two fewer initial JavaScript requests.
- Supervisor defect: production read-only smoke reproduced a loaded dashboard whose shift helper remained loading and whose save control stayed disabled after 15 seconds. The dashboard now waits for the tenant/user draft key before requesting setup data, ignores stale completions, settles the active request in `finally`, and exposes retry feedback. No production shift submit was used to prove or reproduce the defect.
- Migration history: nine production versions were reconciled to their one-to-one repository versions only after migration-name/content and live-catalog comparison. `supabase migration repair` changed history metadata only; it did not replay schema or mutate business rows. `supabase migration list --linked` now reports all 212 local/remote versions aligned through `20260715113013`.
- Fresh replay: `supabase db diff --from migrations --to linked --schema public --use-pg-schema` initially exposed the historical `organizations.join_code` ordering defect. `20260403000000_f1_auth_onboarding.sql` now creates the already-deployed column shape idempotently before referencing it; the full 212-migration shadow replay completes with an empty public-schema diff.
- Security migration: `20260715113013_harden_summary_views_security_invoker.sql` sets `security_invoker=true` on `order_progress_summary`, `party_ledger_entries`, `yarn_lot_stock_summary`, `order_yarn_variance_summary`, `market_run_summary`, and `order_dispatch_summary`. Every underlying table was confirmed RLS-enabled before apply. Production apply succeeded; the security advisor changed from six `security_definer_view` errors to zero.
- Tenant/runtime proof: owner-scoped reads succeeded for all six view surfaces. Negative `org_id` probes returned zero cross-tenant rows where the view exposes `org_id`; the dispatch summary's two non-null order IDs both matched owner-visible orders, with zero unmatched IDs. Owner core routes rendered, and a supervisor request for `/owner/today` redirected to `/supervisor/dashboard` with no owner content.
- Rollback: the view change is metadata-only and can be reversed with the six documented `ALTER VIEW ... RESET (security_invoker)` statements. The historical replay fix is idempotent and matches the deployed column; no destructive rollback or business-data rewrite is required.
- Release gates: `npm run lint` passed; `npm test` passed 99 files with 697 passed and one intentional skip; the Next.js 16.2.10 production build passed TypeScript and generated 43 static pages; migration dry-run reported `Remote database is up to date`; `git diff --check` passed.
- Known follow-up: schema lint still reports the six pre-existing legacy stored-function errors in `lockdown_tenant`, `link_batch_to_machine`, `get_daily_brief_stats`, `replace_shift_production_logs`, `settle_worker_payroll`, and `get_yield_alert`. They were not suppressed or rewritten and remain subject to the existing isolated formal audit.
- Formal matrix: no status or count changed. This batch adds performance/security/release evidence but does not supply new business-row proof for a formal matrix promotion.

### Production deployment and runtime closeout

- PR `#18` merged with history preserved at commit `9c0a4c2415aa7d10e1b6b8aef179cf76184e82dc`.
- Vercel deployment `dpl_2dhb5j87YkJQCZ1pVe54Gtrda4nY` is production-targeted, Ready, and aliased to `https://textile-accounting.vercel.app`.
- The PWA correctly announced the new build; after activating it, five hard reloads of the authenticated supervisor dashboard all reached the ready marker with no loading text in 5,024–6,543 ms (p50 5,450 ms; nearest-rank p95 6,543 ms). The pre-fix reproduction never settled within 15 seconds, so the deployed p95 improvement is at least 56.4% without inventing an exact uncensored baseline.
- Supervisor access to `/owner/today` redirected to `/supervisor/dashboard` with no owner content. The owner session rendered Factory Today, Party Orders, Market Runs, Godown Stock, Party Ledger, Dispatches, and Worker Hisaab read-only with no application alert.
- No production form, shift log, payroll, stock, order, quotation, dispatch, receipt, account, or financial record was created or changed during deployment verification.
- Migration state remains aligned and the database dry-run remained up to date before merge. The six legacy stored-function lint findings remain open formal-audit work and received no pass claim.
- Formal matrix and pilot-readiness counts remain unchanged.

## Repository-grounded architecture and remaining-gate release candidate

Date: 2026-07-17 IST.

- Added the original Narola commercial/technical proposal and a faithful
  technical summary under `docs/reference/`.
- Added the repository-grounded current-state map, concept assessment,
  idempotency matrix, golden journeys, recommendation/rejection registers,
  sprint plan, implementation plan and verification summary under
  `outputs/architecture-enhancement/`.
- Integrated backup comparison/restore fixes that report sanitized mismatches
  safely and accept only the documented compatible `pg_net` runtime-version
  variance.
- TECH-011 evidence now records scheduled run `29451202680`, encrypted artifact
  `8357639557`, exact-artifact restore run `29494683840`, 128-second RTO,
  required reconciliation, zero restored jobs and successful cleanup.
- Added authenticated UX-012 owner/supervisor screenshots and Raj's explicit
  Founder reconfirmation. UX-012 remains `pass`; actual-user review of populated
  English contexts and exact Gujarati wording remains an open first-pilot-run
  control.
- Formal matrix status/count change: none. Counts remain **368 pass, 0 fail,
  6 blocked and 3 not applicable**. TECH-011 remains blocked for release
  governance: named independent-verifier approval and deferred second
  recovery-identity confirmation. GOLDEN-A-03 remains the other pilot gate.
- Safety: the repository-root recovery identity was explicitly excluded from
  Git. No production data/schema mutation or billing action occurred during
  candidate preparation.

### Production release closeout

- PR `#20` merged with history preserved at commit
  `5f8d0c8355c89f3a24e0f127fc0c87ca91e89b57`.
- Production deployment `dpl_8CXejpq4oQpDbjQ3EnbKpZC21MAJ` reached `READY`
  and serves the canonical alias `https://textile-accounting.vercel.app`.
- The exact merge commit passed GitHub/Vercel status checks. Public smoke checks
  returned HTTP 200 for `/`, `/login`, `/privacy`, `/manifest.webmanifest` and
  `/sw.js`.
- Clean integration validation passed lint, TypeScript, the production build
  and the full test suite: 100 files, 700 passed and one environment-dependent
  `jq` shell-integration suite skipped in the Vercel build image. The same
  focused backup suite passed all 16 tests locally with system `jq`.
- No production database/schema/data mutation was performed during release or
  smoke verification. The recovery identity remained untracked and excluded.
- Formal matrix status/count change: none. Counts remain **368 pass, 0 fail,
  6 blocked and 3 not applicable**.

## Estimator physical-iPhone remediation release

Date: 2026-07-19 IST. Status: `pass`.

- Physical iPhone Safari passed the 24-row Estimator matrix after three scoped
  fixes: browser-safe UUID request IDs, a mobile-only 16 px text-control rule,
  and a reachable compact `New Quality` action.
- Runtime values matched the independent expectations: `40 Ne` → `132.875 D`;
  `1,000 m` tape → approximately `952 m` beam capacity and `2` beams. Save and
  reopen succeeded, keyboard dismissal worked, and no blocking overflow or
  final focus zoom remained.
- Integrated `origin/main` proof passed 102 test files / 708 tests with one
  intentional skip, TypeScript, ESLint and the production-environment Next.js
  build with 43 generated routes/pages.
- Both disposable QA tenants were removed; organization, profile,
  subscription and Auth user reconciliation returned zero.
- PR `#24` merged as `60005bc1db5d07a8655d3dc2e61d8a9080b47c27`.
  Vercel deployment `dpl_92ja3kPm6xb2idwWa84NzaC3Feya` is `READY` on the
  canonical production alias.
- Disposable Base production run `ESTPROD-1784461234425-CB8F64` passed sign-in,
  calculation, Save, persistence, Load Specs reopen, and Update Cost Estimate
  readiness. The database contained exactly one costing before cleanup.
- Cleanup reconciled the disposable organization, profile, subscription,
  costing and Auth user to zero. Production deployment error logs contained
  zero errors in the smoke window, and four public routes returned HTTP 200.
- Formal wider-pilot matrix status/count change: none; this promotes only the
  scoped Estimator release proof from candidate to production pass.
- Detailed evidence: `closure-packs/ESTIMATOR_IPHONE_READINESS_2026-07-19.md`.

## Base Estimator go-readiness implementation — 2026-07-22

- Batch: `BASE-ESTIMATOR-GO-READINESS`; result: `conditional_go` for a controlled factory pilot.
- Implemented financial-label consistency, saved-costing revision identity, Base Rate Book entitlement/RLS, canonical paid-through access, safe checkout loading, factory-cost validation, owner post-expiry export, responsive controls, and linked-database lockdown repair.
- Production runtime used exact disposable prefix `BASEGO-1784662022802-4412AD`: Base authentication, overhead setup, representative 50D/9000-end/68-PPI costing, saved quality, saved snapshot, Saved Costings breakdown, Rate Book access, and data-export preparation were exercised. The displayed production cost was ₹26.50/m in both owner surfaces.
- The runtime pass found a zero-placeholder Rate Book defect after a saved quality existed. Commit `31cac88` promotes zero placeholders from positive saved-quality rates and adds an exact production fixture/cleanup harness. Final production deployment `dpl_5gKkpg8GgyXRDxCnSeUEUJ3igDyQ` displayed ₹120/kg for both yarns with Saved qualities provenance; no false pass was recorded before that correction.
- Local gates passed: ESLint, TypeScript, full Vitest (110 files, 745 passed, one intentional skip), optimized Next build (45 static pages), and high runtime dependency audit. Migration `20260721183000` is applied and local/remote history is aligned.
- Residuals: rate propagation is explicit but not atomic; production PDF file inspection, current-release Sentry payload proof, self-serve signup/email-confirmation UX, and paid lifecycle proof remain open. Five database lint errors belong to removed Premium/legacy schema paths, not the Base owner workflow.

## Base Estimator atomicity and costing-only follow-up — 2026-07-22

- Implementation commit `dfd49b3` replaces Rate Book multi-write propagation with tenant-scoped SECURITY DEFINER RPC `save_cost_rate_atomic`; migration `20260721203000_atomic_base_rate_updates.sql` is applied and local/remote migration history aligns through that version.
- Production failure injection on `BASEGO-1784707134907-67E9DE` removed the factory profile mid-proof. The RPC failed and reconciliation returned `rateRows=0` and `historyDelta=0`. After restoring the profile, the same RPC committed ₹321.25 to one rate row, one history row, the factory default, and one matching saved quality; the RPC reported one synced quality.
- First-run Base setup now collects overhead plus warping, sizing, processing, finishing, commission, transport, warp crimp, and default yarn waste. Positive optional defaults enable their sections and all values remain editable in Settings.
- Base now presents Save Costing as the primary action, omits production-use panels and language from Saved Costings, renders ten weft formula inputs as two 2XL rows of five, and removes the quantity-triggered Scenario Analysis panel while retaining break-even.
- Local gates passed: focused ESLint, TypeScript, 110 test files with 748 passed and one intentional skip, Next 16.2.11 optimized build with 45 static pages, and `git diff --check`.
- Browser proof on `BASEGO-1784675775346-874401` verified onboarding persistence, Base-only actions/copy, no Scenario Analysis, a two-row weft layout at 1600px, and zero console warnings/errors. Both disposable tenants reconciled organizations, profiles, subscriptions, and Auth users to zero.
- Pilot status becomes Go. Razorpay TEST mode is the accepted pilot boundary; live Razorpay credentials are deferred until incorporation. First external signup and physical PDF inspection remain monitored pilot checks.
- Deployment closeout: commit `e51261795fd7156ed0e6c643852f6d789b29f8fe` completed GitHub Production deployment `5551926974`. Exact deployed smoke `BASEGO-1784707590569-013A77` verified the new wizard, Base-only actions, Scenario Analysis removal, two-row weft layout, and a clean browser console before zero-residue cleanup.

## Base pilot blocker sprint — 2026-07-24

- Batch: `BASE-PILOT-BLOCKERS-20260724`; state: `fixed_pending_runtime_proof`.
- Hardened `public.log_export_event` in migration `20260724161732_harden_export_audit_boundary.sql`: empty search path, explicit actor validation, organization/admin authorization, revocation from PUBLIC/anon/authenticated, and service-role-only execution.
- Replaced three ad hoc download paths with `lib/browser-download.ts`. PDF and JSON downloads now dispatch through one tested helper, defer object-URL revocation, return an observable filename, and include that filename in success feedback.
- Resolved the independent TypeScript failure, aligned Base saved-quality actions to `Start From`, corrected landing saved-costing language, and described referral credit against the next annual payment.
- Pinned patched transitive runtime versions for DOMPurify, fast-uri, PostCSS, and Sharp without accepting npm audit's forced Next.js downgrade.
- Verification passed: ESLint; `npx tsc --noEmit`; 114 Vitest files with 770 passed and one intentional skip; optimized Next 16.2.11 build with 45 static pages; `npm audit --omit=dev --audit-level=high` with zero vulnerabilities; `git diff --check`; linked migration list and push dry-run naming only the new migration.
- The full audit still reports three moderate and nine high findings confined to dev tooling (`shadcn`/MCP/Hono and ESLint/minimatch paths). They do not ship in the runtime dependency tree and remain dependency-maintenance backlog.
- No deployment or production schema mutation was performed. Promotion remains blocked on reviewed migration apply, exact candidate deployment, Base browser rerun, and physical inspection of both PDFs plus organization JSON.

## Base P0 failed-checkout renewal-price remediation — 2026-07-30

- Failure ID: `BASE-BILL-RETRY-PRICE`; formal Base row: `BILL-006`.
- Production evidence before the fix: a fresh Base checkout failed through
  Razorpay TEST Netbanking, correctly produced one `halted` subscription and
  one `failed` payment with no active entitlement, but the next checkout
  rendered the ₹2,360 renewal price instead of the ₹8,260 first-year price.
- Root cause: application paid-history classification treated bare `halted`
  and `cancelled` statuses as proof of a paid plan. The original atomic
  activation guard used the same over-broad status set.
- Source correction: `lib/billing-lifecycle.ts` now requires a captured payment,
  a subscription-level payment ID, a positive paid lifecycle state, or a
  provider subscription ID paired with a real start/end service period.
- Database backstop:
  `20260730214000_reject_unearned_billing_renewal_pricing.sql` adds a
  tenant/tier-scoped trigger that rejects renewal-priced order insertion or
  activation without distinct captured or otherwise proven paid history.
- Regression proof: focused billing suite passed 17/17; full prebuild suite
  passed 786 tests with one intentional skip; focused and full ESLint passed;
  TypeScript and the optimized Next.js build passed; production dependency
  audit found zero vulnerabilities; `git diff --check` passed.
- Data safety: no production schema or business row has been changed by this
  local implementation. The failed-checkout QA account and evidence remain
  retained for the exact deployed retry proof.
- Status: `fixed_pending_runtime_proof`. Do not promote `BILL-006` or
  `BILL-003` to pass before the reviewed migration is applied and the exact
  deployed commit proves ₹8,260 retry pricing, one captured TEST payment, and
  exactly one active Base entitlement.

### Production closeout — 2026-07-30

- Implementation commit `ed6e32a` was pushed to `main`. Vercel deployment
  `dpl_7aJizgchjx96eLG8pQzvCxGw1UhL` reached `READY` and serves the canonical
  production alias `https://textile-accounting.vercel.app`.
- Reviewed migration
  `20260730214000_reject_unearned_billing_renewal_pricing.sql` was applied to
  the linked production database. Local/remote migration history aligns and a
  follow-up dry-run reports the remote database is up to date.
- The retained failed-checkout account displayed the preserved failed
  Netbanking invoice at ₹8,260, `₹8,260 / first year`, and
  `Pay ₹8,260 & Activate`. It did not display the former ₹2,360 renewal offer.
- Opening the replacement Razorpay TEST checkout created a new `created`
  subscription/order alongside the prior `halted` attempt. Reconciliation
  confirmed the prior payment remains `failed`, there is no captured payment,
  and there is no active entitlement.
- `BASE-BILL-RETRY-PRICE` is closed and `BILL-006` is promoted to `pass` for
  truthful failed-payment state, correct retry pricing, and absence of false
  access. `BILL-003` remains `blocked`: the automation harness could not expose
  Razorpay's mock-bank Success/Failure window, so successful capture and
  activation are not claimed.
- The isolated QA account and prefixed records remain retained as requested.
- Data safety: only reviewed migration `20260721183000` and exact prefixed disposable QA records were permitted. Both the main `BASEGO-1784662022802-4412AD` fixture and failed-signup `BASEGO-20260722-VK6WBT MILL` reconciled organizations, profiles, subscriptions where applicable, and Auth users to zero.

## Sprint 2 — calculation safety and validation — 2026-08-01

- Candidate commit: `3c14bfb` (`feat(estimator): harden calculation safety and validation`), rebased onto the current `origin/main` checkpoint `e807fa1` so the Sprint 3–6 release work already on main remains intact.
- Customer problem addressed: a Surat grey-fabric owner must not receive a plausible-looking costing, quote, or profit number when a rate, denier, width, percentage, or prerequisite is missing, malformed, physically implausible, or still being edited.
- Source changes harden shared numeric validation, field-specific prerequisite checks, width-unit conversion, unusual-value warnings and explicit acknowledgement, layer labels, derived-result readiness, save/export/order guards, and Indian phone/password feedback. Server-authoritative costing, rounding, immutable snapshots, and tenant boundaries remain unchanged.
- Local proof: the full Vitest suite passed `129` files / `844` tests with `1` intentional skip; TypeScript, ESLint, the focused Sprint 0–3/5/6 regression set (`27/27`), and the optimized Next.js production build passed. The build used process-only Razorpay placeholders and made no external payment call.
- Database proof: `supabase migration list --linked` aligned local and linked production history through `20260801173845_sprint5_rate_activity_and_legacy_audit.sql`. `supabase db push --linked --dry-run --yes` reported `Remote database is up to date.` Sprint 2 has no migration and made no schema or business-row mutation.
- Release state: `fixed_pending_runtime_proof`. Do not promote Sprint 2 to production PASS until the exact merged commit has a READY production deployment and the targeted estimator/auth browser scenarios in `RETEST_PLAN.md` pass without stale money figures, invalid saves/exports, or misleading feedback.

## Sprint 1 Save, Versioning, and Trust — 2026-08-01

- Batch: `SPRINT1-SAVE-TRUST`; state at this checkpoint:
  `code_verified_but_not_runtime_verified`.
- Customer problem: Rajesh must be able to tell whether he changed a reusable
  quality, created a new costing version, or only changed an unsaved estimate.
  The release therefore makes the following boundary explicit: `Update Quality`
  changes the saved recipe/template only and never creates or edits a costing
  snapshot; `Save New Costing Version` creates the next immutable snapshot; and
  `Use as Starting Point` detaches a new costing from the prior quality identity.
- Historical economics are protected. A saved snapshot retains the rates,
  transport, margin, quantity, overhead inputs, breakdown, quality/group
  identity, version, and creation context that Rajesh used at save time. A
  changed factory overhead baseline is recorded for future estimates and does
  not back-propagate into existing snapshots.
- Save feedback now distinguishes success, no-change, duplicate/retry,
  stale-edit, validation, authorization, and server failure outcomes. The
  editor identifies the costing group, saved quality, version, timestamp, and
  whether the visible values are saved or still being edited.
- Source changes include the estimator server actions and client, Saved
  Costings/quotation context, factory-cost profile, draft/export helpers,
  Gujarati/Hindi/English trust copy, the shared save-trust helper, and the
  focused Sprint 1 regression contract.
- Reviewed migration: `20260801174038_sprint1_save_trust_v2.sql`. It adds the
  atomic revision/save paths and database guards for snapshot immutability,
  request replay protection, quality/template separation, and future-only
  factory-baseline provenance. Linked production history now records this
  migration, and the post-merge dry-run reports the remote database is up to
  date; no additional migration is pending for this release candidate.
- Local source evidence before promotion: `npm test -- --run --reporter=dot`
  passed 126 files / 823 tests with one intentional skip; `npx tsc --noEmit`,
  `npm run lint`, and `git diff --check` passed. The production build and
  linked-database/runtime proof remain release gates.
- Data safety: no production business-row mutation is claimed by this source
  checkpoint. The reviewed schema migration is already present in linked
  production; exact deployed save/reopen/version/compare/export proof remains
  a runtime gate.
