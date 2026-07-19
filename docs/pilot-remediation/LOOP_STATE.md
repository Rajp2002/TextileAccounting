# Pilot Remediation Loop State

Run under control: `PILOTQA-20260621-2058-8QIH`

Source-of-truth artifacts:

- `output/qa/PILOTQA-20260621-2058-8QIH/FINAL_REPORT.md`
- `output/qa/PILOTQA-20260621-2058-8QIH/FAILURE_DATA_IMPACT_REPORT.md`
- `output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md`
- `output/qa/PILOTQA-20260621-2058-8QIH/results.json`
- Referenced evidence logs under `output/qa/PILOTQA-20260621-2058-8QIH/logs/`

## Current Verdict

Status: No-Go pending two genuine pilot gates: `TECH-011` and `GOLDEN-A-03`. `UX-012` passes the amended pre-pilot criterion; actual pilot-user terminology validation remains an open operating control.

Current classification after Batch 1 security foundation closeout, Batch 2 documentation closeout, the estimator costing reconciliation closeout, Batch 3 dispatch sale receipt closeout, Batch 4 commercials receivables closeout, Batch 5 stock audit refresh closeout, Batch 6 Golden A runtime closeout, Batch 7 partial release/date closeout, Batch 8 migration-head evidence closeout, Batch 8B Sentry release/source-map evidence closeout, Batch 8C clean deployed signoff closeout, Batch 9 offline/cache truth closeout, Batch 10 estimator/quote/order snapshot closeout, Batch 11 estimator/order lifecycle closeout, Batch 12 code-verified proof sweep, Batch 13 targeted estimator proof sweep, Batch 15 payroll document/export/statutory consistency closeout, Batch 20 payroll RPC/Kharchi source-fix closeout, Batch 21B ORDER-008 runtime proof closeout, Batch 21C payroll preview/settlement runtime proof closeout, Batch 21D payroll boundary runtime proof closeout, Batch 22 production/order boundary source-fix closeout, Batch 23 Start Party Order transaction boundary source-fix closeout, Batch 24A attendance RLS and access-code boundary source-fix closeout, Batch 24B supervisor production UX source-fix closeout, Batch 24C Factory Today setup and historical analytics state closeout, Batch 24D estimator submit and production draft isolation source-fix closeout, and Batch 24E master data loom guardrails source-fix closeout:

| Status | Count | Pilot meaning |
| --- | ---: | --- |
| `pass` | 368 | Formal ledger records pass; legacy pass/Actual semantic reconciliation remains an explicit audit item. |
| `fail` | 0 | No formal failure remains. |
| `blocked` | 6 | Two are pilot-gating; four are optional, deferred, pre-public, or pilot-operational evidence. |
| `code_verified` | 0 | The active formal ledger has no rows in this state. |
| `not_applicable` | 3 | Exact post-pilot/absent capabilities linked to named backlog items; no PASS credit. |
| `not_run` | 0 | Matrix was fully classified. |

Current formal totals are 377 rows. The verdict remains No-Go only because TECH-011 recovery governance and a real-fabric estimator truth comparison are genuine limited-pilot gates. UX-012 passes under explicit Founder approval with actual-user terminology validation retained as a first-pilot-run control. Post-pilot WhatsApp rows, optional PWA install proof, deferred live-Sentry inspection, pre-public counsel review, and first-shift register reconciliation do not independently create a No-Go. `NEEDS-AUDIT-002` remains a separate semantic-reconciliation audit item.

TECH-011 retained-artifact update (2026-07-16/17): scheduled run `29451202680` created encrypted artifact `8357639557`; restore run `29494683840` restored that exact artifact into disposable local Supabase in 128 seconds. Business, Auth, Storage, migration, tenant-boundary and identity-digest reconciliation passed; zero jobs were restored and cleanup passed. The only explained variance was compatible `pg_net` `0.19.5` to `0.20.3`. PR `#20` merged the comparison/restore fixes to `main` at `5f8d0c8`; production deployment `dpl_8CXejpq4oQpDbjQ3EnbKpZC21MAJ` is READY at the canonical alias. TECH-011 remains formally `blocked` only for named independent-verifier approval and confirmation of the deferred second recovery-identity copy. Counts remain 368 pass, 0 fail, 6 blocked and 3 not applicable.

Formal blocked-row Batch 2 (2026-07-13) moved `SETUP-012`, `DASH-001`, `BILL-002`, `UX-004`, and `UX-011` from blocked to pass using isolated active Base/Premium tenants, a Premium supervisor, mobile browser proof, join-code boundary proof, exact service-role reconciliation, and complete fixture cleanup. The Premium Settings blank-content observation did not receive pass credit; `SEC-009` remains blocked under formal audit/debugging.

Formal blocked-row Batch 4 (2026-07-13) moved `MASTER-002`, `MASTER-003`, and `MASTER-005` from blocked to pass. Isolated browser/database proof covered same-type bulk creation with distinct names, normalized insert/rename duplicate rejection, cross-tenant name allowance, editing a history-bearing loom without changing its target/assignment/production links, protected deactivate/delete rejection with all reasons visible, and intentional unused-loom deletion. The exact fixture and auth records were removed and reconciled.

Formal blocked-row Batch 5 (2026-07-13) moved `SETUP-011` from blocked to pass. The deferred Factory Today checklist had a Strict Mode lifecycle defect that could discard a completed server-action payload; one shared request now resolves without an effect-cleanup cancellation gate. An isolated complete setup foundation rendered exactly 11 of 14 Both-mode steps with `Log first production` next before and after refresh, matching persisted estimate, loom, workers, assignments, active target, supervisor, payroll config, and plan rows.

Formal blocked-row Batch 6 (2026-07-13) moved `SETUP-007` from blocked to pass. A same-origin proxy intercepted exactly one onboarding save before mutation with a controlled 503. The step stayed at 2/5, showed the connection retry message, re-enabled its save action, and retained zero machines; retry created exactly one machine and refreshed to 3/5 with the machine step complete. Rejected machine saves now clear loading state in `finally`.

Batch 1 security foundation moved `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`, `SEC-006`, and `AUTH-016` from fail to pass with runtime/test/migration evidence. `AUTH-008`, external webhook/export/compliance security rows, release gates, and unrelated unresolved failures remain open. `PAY-018` and `PAY-020` were source-fixed by Batch 20 and later closed by Batch 21D disposable QA runtime proof.

Batch 2 moved `PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, and `SIGNOFF-05` from fail to pass with runtime/test evidence. Downstream Golden A rows that were not rerun end-to-end remain blocked until a clean order chain is retested or explicitly de-scoped.

Estimator costing reconciliation is complete for the scoped formula/manual/manual-practical sprint with test and browser evidence. The active matrix counts above were unchanged by that sprint because the broader `ECON-A` rows still include server-boundary validation, idempotency, quote/order lifecycle, and date snapshot work outside that scope.

Batch 3 moved `SALE-015`, `DISP-003`, `DISP-007`, `DISP-010`, `DISP-019`, `GOLDEN-B-09`, `DASH-007`, `SIGNOFF-07`, and `SIGNOFF-08` from fail to pass with runtime/test/migration evidence. `SIGNOFF-10` remained open at Batch 3 closeout because Batch 3 supplied partial dispatch/package/receipt runtime evidence only, not release/Sentry/source-map proof; it is closed later by Batch 8C.

Batch 4 moved `COMM-002`, `COMM-010`, `COMM-012`, `COMM-014`, `COMM-016`, `SIGNOFF-06`, and `SIGNOFF-09` from fail to pass with runtime/test/migration/browser evidence. `SIGNOFF-10`, `STOCK-017`, `STOCK-016`, `GOLDEN-A-19`, `GOLDEN-A-20`, `TIME-002`, and `OFF-009` remained open or partial evidence only at Batch 4 closeout; `SIGNOFF-10` is closed later by Batch 8C.

Batch 5 moved `STOCK-016` and `STOCK-017` from fail to pass with runtime/test evidence for stock movement audit pagination beyond 500 rows and sale-only stock refresh/second-session reconciliation. `GOLDEN-A-19`, `GOLDEN-A-20`, `SIGNOFF-10`, `TIME-002`, and `OFF-009` remained open or partial evidence only at Batch 5 closeout; `SIGNOFF-10` is closed later by Batch 8C.

Batch 6 moved `GOLDEN-A-13`, `GOLDEN-A-15`, `GOLDEN-A-16`, `GOLDEN-A-17`, `GOLDEN-A-18`, `GOLDEN-A-19`, `GOLDEN-A-20`, and `GOLDEN-A-24` from blocked to pass with runtime/test/migration evidence for the Golden A customer-order chain. `GOLDEN-A-21`, `GOLDEN-A-22`, `GOLDEN-A-23`, `TIME-002`, `OFF-009`, `SIGNOFF-01`, `SIGNOFF-02`, `SIGNOFF-04`, `TECH-011`, and `TECH-012` remain open or partial evidence only; `SIGNOFF-10` remained partial at Batch 6 closeout and is closed later by Batch 8C.

Batch 7 moved `TIME-002` and `TECH-013` from fail to pass with focused timezone-stability tests, source-controlled release gate evidence, a successful prebuild Vitest/build run, full Vitest evidence, and local production smoke. At Batch 7 closeout, `SIGNOFF-10`, `TECH-007`, `TECH-009`, `TECH-010`, `TECH-011`, `TECH-012`, and `SEC-011` were blocked or partial evidence only because external deployed, Sentry/source-map, restore, rollback, and production migration proof was unavailable.

Batch 8 moved `TECH-007` from fail to pass with supplied Supabase migration-list evidence showing local/remote alignment through repository migration head `20260628185344` and no pending, failed, or out-of-order migrations. Batch 8B moved `TECH-010` from fail to pass with fresh production Sentry release/source-map proof for deployed release `2538da25b2fa` and 529 artifacts. Batch 8C moved `SIGNOFF-10` from fail to pass with clean deployed browser smoke, Vercel runtime/server logs, and Sentry no-error release evidence after the Sentry DSN fix. `TECH-009`, `TECH-011`, `TECH-012`, `SEC-011`, and `WA-008` remain blocked, partial, or open because deployed webhook proof, live Sentry payload inspection, restore, and rollback/forward-fix evidence are still unavailable.

Batch 9 moved `OFF-002`, `OFF-005`, `OFF-006`, `OFF-008`, `SEC-016`, and `PAY-028` from fail to pass with focused source/test/build proof, local HTTP/browser evidence for `/offline`, `/_offline`, `/privacy`, and public copy, and truthful de-scope of unsupported offline kharchi. `OFF-007` remains partial because a production service-worker update with an active draft was not exercised. `OFF-010` remains partial because throttled slow/intermittent-network runtime proof across core mobile screens was not executed. `OFF-009` remains open and out of scope for unknown-timeout UX and status reconciliation.

OFF-009 closeout (2026-07-13): the supervisor shift-log reference flow now classifies a response timeout as unknown, performs an authoritative server-state lookup, and blocks blind resubmission when the commit cannot be confirmed. Focused tests, type checking, lint, and the full production build gate pass. A disposable production browser run proved the safe unknown-outcome message, but production's pre-existing `UPDATE requires a WHERE clause` shift-log failure prevented a committed row and therefore prevented proof of the reconciled-success branch. Status is `code_verified_but_not_runtime_verified`; keep the formal row at `fail`. Next action: repair/deploy the production shift-log safe-update guard, then rerun the same delayed-response fixture and require one persisted 42m row, a reconciled-success message, no duplicate row, and exact cleanup.

Batch 10 moved `EST-003`, `EST-019`, `ORDER-001`, `ORDER-002`, `QUOTE-010`, and `QUOTE-003` from fail to pass with Decimal-backed worker-rate snapshot normalization, quote restore draft-collision handling, explicit quote lifecycle transitions, focused regression tests, TypeScript, targeted ESLint, and a successful production build. At Batch 10 closeout, `EST-011`, `QUOTE-007`, `ORDER-006`, and `ORDER-008` remained open under distinct server-boundary validation, fast-path atomicity/idempotency, order edit audit/produced-meter guard, and below-target completion confirmation roots.

Batch 11 moved `EST-011` and `ORDER-006` from fail to pass with server-boundary estimator validation, produced-meter target edit guards, existing audit-trigger evidence, focused regression tests, TypeScript, targeted ESLint, and a successful production build. `ORDER-008` moved from fail to `code_verified`/source-fixed but remains open pending disposable runtime/browser proof of the below-target completion confirmation. `QUOTE-007` remains fail/open because strict Start Party Order accepted-quote plus active-order atomicity requires combined database/RPC transaction work.

Batch 12 moved `STOCK-012` and `DISP-013` from `code_verified` to pass with exact local proof for closed/sold-out market lot archive eligibility and delivered-complete dispatch group archive eligibility. `ORDER-008` remains `code_verified` because disposable runtime/browser proof is still missing. `GOLDEN-B-12` remains blocked because the active row requires a full Golden B second-batch exact-receipt rerun. `STOCK-011`, `STOCK-013`, `MARKET-009`, and `MARKET-010` remain `code_verified` because Batch 12 proof was partial for their exact row wording.

Batch 13 moved `EST-001`, `EST-005`, and `EST-012` from `code_verified` to pass with exact local estimator proof for the single warp/weft cost stack, paise-per-pick 100x guard, and invalid commission-plus-margin boundary. `EST-004`, `SETUP-001`, and `SETUP-002` remain `code_verified` because their safe helper tests were supporting evidence only and did not directly prove persisted width value or completed-onboarding browser navigation persistence. `BILL-002`, `PAY-017`, `TIME-003`, `TIME-004`, `ORDER-008`, `GOLDEN-B-12`, `QUOTE-007`, external-provider, restore/rollback, Sentry live-event, WhatsApp deployed-callback, production service-worker, throttled mobile, and Batch 12 partial stock/market rows remain unchanged.

Batch 15 moved `PAY-023`, `PAY-024`, and `SEC-014` from fail to pass with deterministic source/test/build proof for payslip PDF content, settlement history/CSV nested statutory extraction, and safe payslip filenames. `PAY-013`, `PAY-015`, and `DASH-003` moved from fail to `code_verified`: their identified source defects were fixed and tested, but exact row closure still needed disposable high-gross settlement proof or after-shift Factory Today runtime proof. No migration, Supabase command, direct SQL, npm audit, package install, lockfile change, production/customer data mutation, stock/dispatch/commercial path change, or production/order boundary change was used.

Batch 20 moved `PAY-018`, `PAY-020`, and `PAY-027` from fail to `code_verified`: payroll settlement now routes through a hardened owner/payment-mode/verified-owner RPC boundary, payroll reversal now requires database-transaction access-code validation through a hardened RPC, and online supervisor Kharchi now routes through an atomic worker-advance plus supervisor-float RPC. At Batch 20 closeout these rows were source-fixed but not pass-ready because migration `20260701105404_batch_20_payroll_rpc_kharchi_atomicity.sql` was not applied and disposable QA runtime/browser proof was not collected. Batch 21D later closes `PAY-018` and `PAY-020`; `PAY-027` remains `code_verified`. `GOLDEN-A-21`, `GOLDEN-A-22`, `GOLDEN-A-23`, `GOLDEN-B-18`, `PAY-013`, `PAY-015`, `DASH-003`, `PAY-006`, production/order boundary rows, stock/dispatch/commercial rows, billing/provider rows, Sentry/WhatsApp/restore/rollback rows, and unrelated rows remain unchanged.

Batch 21B moved `ORDER-008` from `code_verified` to pass with exact disposable QA browser/runtime proof. The local runtime at `http://localhost:3000` was confirmed against QA Supabase ref `eutycrtzzxmlkcpipgod`, with production ref `vzhwahudircrpgtitwzd` absent from `.env.qa.local` and rebuilt `.next` cache. Below-target completion and pending-dispatch completion both required explicit confirmation and did not complete silently; normal completion completed without a warning. `PAY-013`, `PAY-015`, `PAY-018`, `PAY-020`, `PAY-027`, `DASH-003`, and all other rows remained unchanged at Batch 21B closeout.

Batch 21C moved `PAY-013` and `PAY-015` from `code_verified` to pass with exact disposable QA payroll preview/settlement runtime proof. The local runtime at `http://localhost:3000` used QA Supabase ref `eutycrtzzxmlkcpipgod`, and targeted checks found production ref `vzhwahudircrpgtitwzd` absent from `.env.local`, `.env.qa.local`, and rebuilt `.next` cache. `PAY-013` proved enrolled Rs. 20000 gross -> PF Rs. 1800, ESI Rs. 150, net Rs. 18050, and not-enrolled Rs. 20000 gross -> PF/ESI Rs. 0, net Rs. 20000, with settlement/history matching both. `PAY-015` proved preview gross, deductions, adjustments, advance recovery, debt, and net matched persisted settlement/history exactly, and reopened Past settlements after the stale window stayed unchanged. `PAY-018`, `PAY-020`, `PAY-027`, `DASH-003`, and all other rows remain unchanged.

Batch 21D moved `PAY-018` and `PAY-020` from `code_verified` to pass with disposable QA payroll boundary runtime proof in `output/qa/batch21d/BATCH21D-payroll-boundary-runtime-proof.json`. The local runtime at `http://localhost:3000` used QA Supabase ref `eutycrtzzxmlkcpipgod`, and targeted checks found production ref `vzhwahudircrpgtitwzd` absent from `.env.qa.local` and rebuilt `.next` cache. `PAY-018` proved missing payment/owner verification blocked in UI, hardened settlement RPC rejected missing payment mode and missing owner verification, valid UI settlement succeeded, and legacy direct settlement RPC was permission denied. `PAY-020` proved empty code kept reversal disabled, invalid code was rejected while settlement stayed paid, valid one-time code reversed to pending, consumed-code reuse was rejected, and legacy direct unsettle RPC was permission denied. `PAY-027`, `DASH-003`, Golden rows, and all other rows remain unchanged.

Batch 22 moved `ORDER-005`, `ORDER-009`, and `PROD-011` from fail to `code_verified` with source/test/migration proof in `output/qa/batch22/BATCH22-production-order-boundary-hardening-proof.json`. Migration `20260702121238_batch_22_production_order_boundary_hardening.sql` was created but not applied. `ORDER-005` is source-fixed by over-target post-replacement total checks in the replacement RPC and table trigger. `ORDER-009` is source-fixed by active-order/current-loom attribution checks that block cancelled/completed/stale-assignment order-attributed logs and non-active order replacement. `PROD-011` is source-fixed by a forward-only `production_logs_meters_nonnegative` `NOT VALID` check plus RPC/trigger negative-meter guards. `SIGNOFF-02` remains fail/open: the `ORDER-009` dependency is improved, but full current-run owner sign-off attribution runtime proof is still required. `GOLDEN-A-23`, `PAY-027`, `DASH-003`, Golden rows, `QUOTE-007`, and all other rows remain unchanged.

Batch 24B moved `PROD-013`, `PROD-023`, and `PROD-029` from fail to `code_verified` with source/test proof in `output/qa/batch24b/BATCH24B-supervisor-ux-failures-proof.json`. Suspicious large positive shift meters now show a non-blocking confirmation at 10,000m, restored localStorage drafts now show a visible unsaved-draft indicator, and public/setup production copy now uses shift-total/shift-meter terminology instead of raw opening/closing meter-reading proof claims. No row is pass-ready from Batch 24B.

Batch 24D moved `EST-017` and `PROD-022` from fail to `code_verified` with source/test proof in `output/qa/batch24d/BATCH24D-submit-draft-isolation-proof.json`. Estimator rapid double-submit is guarded client-side with a synchronous `saveQuoteLockRef` before Save Quote and Save & Create Market Run actions. Supervisor production drafts are now keyed by org, user, selected date, and shift, with stale date/shift fetch completions ignored and save using the current selected date/shift. Neither row is pass-ready until QA/browser proof is collected.

Batch 24E moved `MASTER-002` and `MASTER-005` from fail to `code_verified` with source/test proof in `output/qa/batch24e/BATCH24E-master-data-guardrails-proof.json`. Duplicate loom names are now blocked on normalized org-scoped add, bulk-add, and rename paths. The Batch 24E migration was later revised from a retroactive unique index to a trigger-backed duplicate guard and reportedly applied during the production DB push incident; existing duplicate rows are preserved while future normalized duplicates are blocked. Protected loom delete, deactivate, supervisor delete-with-code, and null-target unlink now share lifecycle preflight coverage for active targets, assignments, shift-assignment history, and production history. Neither row is pass-ready until controlled QA/browser proof is collected. `MASTER-014` remains fail/open.

Batch 24G moved `SEC-015` and `SEC-009` from fail to `code_verified` during production DB push reconciliation. The reported production ref was `vzhwahudircrpgtitwzd`, and reported remote migration history includes `20260704120000`, `20260705100000`, and `20260705182406`. This records production-applied reality only; it is not pass-ready proof. `SEC-015` still needs controlled settings-change audit-row proof with redacted payloads, `SEC-009` still needs owner export browser/security proof and audit-log EXPORT proof, and `SEC-017`/`AUTH-008` remain fail/open.

## Operating Rules

1. `FINAL_REPORT.md` and `FAILURE_DATA_IMPACT_REPORT.md` decide priority.
2. `code_verified` is unresolved evidence debt until promoted by runtime or test evidence.
3. No item can move to resolved without a regression test, a runtime QA artifact, or a written reason that runtime QA is the only valid proof.
4. Work is grouped by root-cause cluster, not page.
5. Fix order is security, production/stock correctness, dispatch/receipt correctness, payroll/kharchi, idempotency/offline, then release gates.
6. Each cluster starts with the domain invariant, then code or migration design.
7. Production data changes are forbidden except rollback-only probes, isolated QA tenants, or disposable environments.
8. Anything not ready for pilot must be hidden, disabled, de-scoped, or documented as unsupported before pilot.

## Remediation Loop

Each loop batch must follow this sequence:

1. Select a root-cause cluster from `FAILURE_BACKLOG.md`.
2. Copy the relevant invariant from `DOMAIN_INVARIANTS.md` into the implementation ticket.
3. Define the smallest code/migration change that enforces the invariant.
4. Add or update regression tests. If automated coverage is impossible, document the required runtime QA path before implementation starts.
5. Run local commands in `RETEST_PLAN.md`.
6. Execute runtime QA only in the QA tenant or disposable environment.
7. Save evidence under the next QA output folder and reference it in `FIX_LOG.md`.
8. Mark rows resolved only after evidence exists and the matrix rows can be promoted to `pass`, `not_applicable`, or explicitly `unsupported`.

## First Loop Batch

Batch: `BATCH-01A-MUTABLE-PROFILE-AUTHZ`

Root cause: profile authorization fields are mutable by authenticated users, and server authorization/claims depend on those mutable fields.

Priority source:

- `FINAL_REPORT.md`: `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005` are critical failures and security is recommended first.
- `FAILURE_DATA_IMPACT_REPORT.md`: authorization boundary is practical fix priority 1 because it can corrupt all domains.
- `logs/security-review.json`: rolled-back production evidence proved supervisor self-update to owner and custom claim minting.

Failure IDs in batch:

- Critical: `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`
- Deferred from Batch 1A: `SEC-006` and `AUTH-016` were closed later in Batch 1B; `AUTH-012`, `AUTH-013`, and `SEC-013` remain outside Batch 1 security foundation closeout.

Batch 1A objective:

Authenticated users must not be able to mutate role, organization, or any other field used for authorization. Server authorization must remain correct after direct API attempts, token refresh, browser refresh, and owner/supervisor route checks.

Out of scope for Batch 1A:

- `SEC-006` and `AUTH-016`, which were deferred from Batch 1A and closed later in Batch 1B.
- Production correction/stock atomicity.
- Dispatch package numbering and receipt-state repair.
- Payroll legacy RPC removal.
- Offline kharchi and cache clearing.
- Release-gate repair, npm audit, Sentry, and migration-drift repair, except normal verification commands that prove Batch 1A did not regress the app.

## Batch 1A Acceptance Criteria

Batch 1A is accepted only when all of the following are true:

1. `authenticated` has no direct column privilege allowing update of `public.profiles.role`, `public.profiles.org_id`, or equivalent authorization fields.
2. `public.profiles` RLS update policy prevents role/org mutation even if a caller can update allowed personal profile fields.
3. A QA supervisor cannot change self role/org through Supabase client, PostgREST, server action, or RPC path.
4. After a failed self-mutation attempt and token refresh, the supervisor still receives supervisor claims and owner-only server actions remain denied.
5. Owner login, supervisor login, onboarding redirects, and route guards still work.
6. Evidence includes regression test output, SQL metadata output, and browser/runtime QA notes. Source review alone is insufficient.

## Current Batch State

Batch 1A (`SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`) is closed with evidence in `FIX_LOG.md` and active matrix rows promoted to pass.

Evidence captured:

- Pre-fix QA reproduction proved supervisor self-mutation of `profiles.role` and `profiles.org_id`, token refresh claim escalation, and owner route/server-loader access.
- Supabase migration `20260625195248_harden_profile_authorization_boundary.sql` was applied to project `vzhwahudircrpgtitwzd`.
- Post-fix SQL metadata shows `authenticated` cannot update `profiles.id`, `profiles.role`, or `profiles.org_id`.
- Post-fix QA probe shows direct role/org mutations denied, role/org unchanged, token refresh remains supervisor, owner-only RPC denied, and owner login/claims still work.
- Post-fix browser QA shows supervisor is redirected from `/owner/today` to `/supervisor/dashboard`, owner-only API returns 403 for supervisor, and real owner can load `/owner/today`.

Resolution status:

- `SEC-002`, `SEC-003`, `SEC-004`, and `SEC-005` are documented as pass in the active matrix.
- `code_verified` is still not treated as pass.
- `SEC-006` and `AUTH-016` are closed separately by Batch 1B.
- No production/stock, dispatch, payroll, estimator, offline, npm audit, Sentry, release-gate, or migration-drift work was included in Batch 1A.

## Batch 1B-A State

Batch 1B-A targets `SEC-006` only. `AUTH-016` was out of scope for this sub-batch and closed later in Batch 1B-B.

Invariant:

Access-code protected actions must fail closed. Every protected action must use the same server-side validation path, count failed attempts, enforce a real 5 attempts per 10 minutes limit, reject expired or malformed codes, consume a valid code exactly once, and avoid recoverable plaintext access-code storage after the generation response.

Implemented locally:

- Centralized generation/validation/consume in `lib/access-codes.ts`.
- Changed access-code limiter to 5 attempts per 10 minutes.
- Made access-code limiter/lockout/failure recording fail closed when Redis is missing or errors.
- Routed owner order updates, owner worker delete-with-code, owner validate/rotate, owner generation, and supervisor request flows through central helpers.
- Removed owner layout recovery/display of `organizations.last_code_plain`.
- Added non-destructive migration `20260625215612_harden_access_code_fail_closed.sql` to prevent future non-null plaintext writes.
- Added `__tests__/p0-access-code-boundary.test.ts` and `scripts/qa/batch1b-access-code-probe.mjs`.

Evidence captured:

- Focused test: `npx vitest run __tests__/p0-access-code-boundary.test.ts` -> passed, 8 tests.
- Broader relevant auth/security test: `npx vitest run __tests__/p0-authz-boundary.test.ts __tests__/p0-access-code-boundary.test.ts` -> passed, 13 tests.
- Lint for touched Batch 1B-A proof files -> passed.
- `npx tsc --noEmit` -> passed.
- `git diff --check` -> passed.
- Migration safety check classified `20260625215612_harden_access_code_fail_closed.sql` as safe forward-looking hardening: trigger/function/grants/comment only, with no delete, truncate, mass update, plaintext cleanup, table/column drop, or existing production data mutation.
- `npx supabase db push --dry-run` showed only `20260625215612_harden_access_code_fail_closed.sql` pending.
- `npx supabase db push` applied only `20260625215612_harden_access_code_fail_closed.sql` to project `vzhwahudircrpgtitwzd`.
- `npx supabase migration list` now shows local and remote aligned for Batch 1A `20260625195248` and Batch 1B-A `20260625215612`.
- Runtime probe passed owner/supervisor login, missing Redis fail-closed, 5/10 limiter block, invalid-attempt lockout, valid one-time consume, reuse failure, expired failure, wrong-code failure, and plaintext storage trigger rejection using a disposable org.

Data safety:

- No production data cleanup was performed.
- Existing `organizations.last_code_plain` values were not cleared or backfilled.
- Runtime mutation checks used a disposable organization.

Resolution status:

- `SEC-006` is documented as pass in the active matrix.
- `AUTH-016` is closed separately by Batch 1B-B.
- Production/stock, dispatch, payroll business correctness, estimator, offline, release gates, Sentry, npm audit, and lockfile work remain open/out of scope.

## Batch 1B-B State

Batch 1B-B targets `AUTH-016` only. `SEC-006` is not modified further and remains pass-ready from Batch 1B-A.

Invariant:

Locked organizations must fail closed for protected pilot business writes across UI/server actions, direct Supabase table access, RLS, and SECURITY DEFINER RPCs. Enforcement should be layered through centralized server-action guards, RLS predicates, and explicit RPC guards. Trigger enforcement is not the primary mechanism and was not added.

Implemented locally:

- Added centralized locked-organization write guard helpers in `lib/auth.ts`.
- Added server-action lockdown guard coverage for service-role write paths in `app/(dashboard)/supervisor/actions.ts`.
- Added a targeted owner service-role write guard in `app/(dashboard)/owner/actions.ts`.
- Added migration `20260626051352_harden_locked_tenant_writes.sql` for RLS write predicates and explicit RPC lockdown guards on protected business write functions.
- Added static regression tests in `__tests__/p0-locked-tenant-boundary.test.ts`.
- Added runtime probe scaffold `scripts/qa/batch1b-locked-tenant-probe.mjs` for disposable locked/unlocked organization proof after the migration can be applied with approval.

Evidence captured:

- Human operator manually applied `20260626051352_harden_locked_tenant_writes.sql` with `npx supabase db push`. This proof pass did not rerun `npx supabase db push`, migration repair, `db pull`, direct SQL, or `--include-all`.
- `npx supabase migration list` -> local and remote both include `20260626051352`.
- Runtime probe: `node scripts/qa/batch1b-locked-tenant-probe.mjs` -> passed.
- Runtime probe assertions passed: locked owner and supervisor login still work; unlocked owner and supervisor login still work; locked direct writes to `workers`, `fabric_stock_lots`, and `worker_advances` are denied; locked mutating `replace_shift_production_logs` RPC is denied; unlocked representative writes and the unlocked empty-batch RPC still work.
- Focused test: `npx vitest run __tests__/p0-locked-tenant-boundary.test.ts` -> passed, 5 tests.
- Broader relevant security test: `npx vitest run __tests__/p0-authz-boundary.test.ts __tests__/p0-access-code-boundary.test.ts __tests__/p0-locked-tenant-boundary.test.ts` -> passed, 18 tests.
- `npx tsc --noEmit` -> passed.
- Lint for touched Batch 1B-B files -> passed.
- `git diff --check` -> passed.

Data safety:

- No production data cleanup was performed.
- The runtime probe used disposable locked and unlocked organizations and cleaned them up.
- No production/stock, dispatch, payroll business-correctness, estimator, offline, release-gate, Sentry, npm audit, or lockfile work was included.

Resolution status:

- `AUTH-016` is documented as pass in the active matrix.
- Production/stock, dispatch, payroll business correctness, estimator, offline, release gates, Sentry, npm audit, and lockfile work remain open/out of scope.

## Security Foundation Closed

Date/time: 2026-06-26 11:27 IST.

Human decision: security foundation approved. Pass/pass-ready failures documented as pass in the active matrix:

- `SEC-002`
- `SEC-003`
- `SEC-004`
- `SEC-005`
- `SEC-006`
- `AUTH-016`

Committed and pushed security batches:

- Batch 1A authorization boundary: `76a25a3` plus evidence/migration-history closure commits `ff1ddb0` and `704cb54`.
- Batch 1B-A access-code boundary: `77a0382`.
- Batch 1B-B locked-tenant boundary: `e2e0cf1`.
- Security foundation documentation closure: `d98f2f2`.

Supabase migration history:

- `20260625195248_harden_profile_authorization_boundary.sql` aligned locally and remotely.
- `20260625215612_harden_access_code_fail_closed.sql` aligned locally and remotely.
- `20260626051352_harden_locked_tenant_writes.sql` aligned locally and remotely.
- `20260626064830_production_stock_atomicity.sql` aligned locally and remotely after human-approved manual application.

Batch 2 closed on main:

- Batch 2: production correction plus generated stock atomicity.
- Target failures: `PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, `SIGNOFF-05`.
- Repository state: implementation commit `f34b89c8f1f16bd87474737c69941565665f17d0` was fast-forwarded into `main`, and `origin/main` pointed to that commit before this documentation closeout.
- Invariant: production corrections must be transactionally safe; production logs and generated stock must reconcile exactly once; correcting production to downtime must not leave stale saleable stock; if stock has already been sold or dispatched, the correction must be blocked or routed through an explicit owner-authorized adjustment flow.
- Local implementation: migration `20260626064830_production_stock_atomicity.sql`, new internal generated-stock reconciler, updated `replace_shift_production_logs(...)`, safe wrapper for `create_or_refresh_stock_inward_draft(...)`, and removal of app-level post-replacement stock refresh.
- Read-model repair: `getFactoryToday()` now reads `order_progress_summary.total_meters_produced`, matching the deployed view contract. No new migration was needed.
- Migration status: `20260626064830` is aligned locally and remotely after human-approved manual application.
- Runtime QA status: fresh disposable QA tenant proof passed on 2026-06-27. Evidence: 256.00m initial production; correction of stale 25.25m night production to downtime left 230.75m production logs and 230.75m generated stock; no stale 25.25m saleable lot remained; reversal movement was recorded exactly once; retry did not duplicate stock or movements; sale over corrected-away stock was blocked; reduction below sold quantity was blocked and rolled back; dispatch/receipt history blocked automatic correction; Factory Today, stock summary, and signoff expected stock read 230.75m after refresh/second session.
- Local verification passed: targeted Batch 2 Vitest passed 8 tests; broader production/stock pack passed 92 tests; full Vitest passed 287 tests with 1 skipped; `npx tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
- Resolution status: `PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, and `SIGNOFF-05` are pass-ready with runtime/test evidence and are documented as pass in the active QA matrix.

Estimator costing closeout:

- Date/time: 2026-06-28 00:54 IST.
- Scope closed: manual kg/100m override, formula mode, formula-equivalent manual parity, mixed formula/manual semantics, width unit hardening, waste/crimp semantics, Cost Breakdown audit, and quote save/reopen audit preservation.
- Practical manual regression passed at `₹55.91/m` with `₹21.50/m` other cost and `₹56.16/m` with `₹21.75/m` other cost.
- Formula real factory specs passed at `₹55.75/m`.
- Formula-equivalent manual mode matched formula mode with `₹0.00/m` difference.
- Width warning for `62 cm` was observed in the UI; switching to `62 inch` restored expected costing.
- Saved quote restore preserved rows, costing, and audit at `₹56.16/m`.
- Local verification passed: targeted estimator/width Vitest passed 31 tests; full Vitest passed 298 tests with 1 skipped; `npx tsc --noEmit`, `npm run build`, and scoped estimator ESLint passed.
- Repo-wide `npm run lint` remains blocked only by existing unrelated `scratch/*.js` CommonJS `require()` lint errors.
- Active QA matrix rows are not promoted by this closeout because the relevant `ECON-A` rows are broader than estimator costing and still require separate proof.

Still out of scope until explicitly started:

- Remaining Golden A payroll follow-ons `GOLDEN-A-21`, `GOLDEN-A-22`, and `GOLDEN-A-23`.
- Payroll business correctness.
- Remaining `ECON-A` work outside estimator costing: server-boundary estimate validation, estimator save/market-run idempotency, quote/order lifecycle, target/deadline guards, and below-target completion. Batch 7 closes the broader date-only rendering row separately.
- Offline behavior.
- Release gates.
- Sentry.
- npm audit.
- Lockfile work.

## Batch 3 Closed on Main

Date/time: 2026-06-28 13:34 IST.

Batch 3: dispatch sale receipt correctness.

Target failures:

- `SALE-015`
- `DISP-003`
- `DISP-007`
- `DISP-010`
- `DISP-019`
- `GOLDEN-B-09`
- `DASH-007`
- `SIGNOFF-07`
- `SIGNOFF-08`

Repository state:

- Implementation commit `9661f3fcace44b1b44c71002e6d0554a58de8ab6` was fast-forwarded into `main`.
- `origin/main` pointed to `9661f3fcace44b1b44c71002e6d0554a58de8ab6` before this documentation closeout.

Migrations applied and aligned before docs closeout:

- `20260627195152_batch_3_dispatch_sale_receipt_correctness.sql`
- `20260628071340_batch_3_dispatch_tracking_token_contract_fix.sql`
- `20260628073917_batch_3_dispatch_number_returning_contract_fix.sql`

Runtime proof:

- Disposable QA run `BATCH3-fc791041` passed with `production_mode=both`.
- Duplicate 80m sale submit produced exactly one sale, one receivable where applicable, and one stock movement.
- 50m dispatch left 30m pending; second 30m dispatch used a distinct deterministic package identity and left 0m pending.
- Exact receipt closed with synchronized receipt fields and no discrepancy.
- Shortage and excess receipts each created exactly one actionable discrepancy.
- Duplicate receipt submit did not duplicate discrepancy or receipt state.
- Negative and zero receipts were blocked consistently.
- Archive helper protected unresolved obligations and allowed clean reconciled groups.
- Dispatches, Factory Today, stock, Commercials, signoff, and second-session refresh reconciled.
- No runtime path read or wrote `dispatches.tracking_token`.
- No ambiguous `dispatch_number` runtime error remained.

Verification:

- `npx vitest run __tests__/p2-dispatch-sale-receipt.test.ts` -> 7 passed.
- `npx vitest run __tests__/p1-party-first-stock-sale-dispatch.test.ts __tests__/dispatch-archive.test.ts __tests__/p1-production-dispatch-regressions.test.ts` -> 27 passed.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint -> passed.
- `git diff --check` -> passed.
- `npx vitest run` -> 34 files, 306 passed, 1 skipped.

Resolution status:

- `SALE-015`, `DISP-003`, `DISP-007`, `DISP-010`, `DISP-019`, `GOLDEN-B-09`, `DASH-007`, `SIGNOFF-07`, and `SIGNOFF-08` are documented as pass in the active matrix.
- `SIGNOFF-10` remained partial evidence only at Batch 3 closeout and is closed later by Batch 8C.

## Batch 4 Closed on Main

Date/time: 2026-06-28 18:39 IST.

Batch 4: commercials receivables payments correctness.

Target failures:

- `COMM-002`
- `COMM-010`
- `COMM-012`
- `COMM-014`
- `COMM-016`
- `SIGNOFF-06`
- `SIGNOFF-09`

Repository state:

- Implementation commit `d2a464c6f9c3caa470d1fa3bf530333faa2e0d4c` was fast-forwarded into `main` and pushed to `origin/main`.
- `origin/main` pointed to `d2a464c6f9c3caa470d1fa3bf530333faa2e0d4c` before this documentation closeout.

Migration applied and aligned before docs closeout:

- `20260628121903_batch_4_commercials_receivables_payments.sql`

Runtime proof:

- Disposable QA run `BATCH4QA-20260628125203` passed.
- Duplicate stock-sale submit produced one sale and one receivable for the sale idempotency key.
- Payment partial/full/duplicate/overpayment probes reconciled exactly: Rs. 1,200 partial cheque, Rs. 3,800 full bank, two receipts total, paid balance Rs. 0, overpayment blocked.
- Cheque metadata and reference history rendered in Commercials payment history.
- Direct market-run sale RPC was disabled.
- Due today, overdue, future, and paid buckets reconciled to Asia/Kolkata date `2026-06-28`.
- Profit ledger rows used authoritative stock source fields and Manual Stock filter totals reconciled.
- Top Parties showed last sale and overdue values; period source proof distinguished 30d from all-time.
- Factory Today showed unresolved commercial receivables as blockers.
- Commercials reload and second-tab session preserved totals and had no console errors.

Verification:

- Focused Batch 4 Vitest: 32 passed.
- Batch 2/3 guard Vitest: 37 passed.
- Full Vitest: 35 files, 313 passed, 1 skipped.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for touched Batch 4 files -> passed.
- `git diff --check` -> passed.

Resolution status:

- `COMM-002`, `COMM-010`, `COMM-012`, `COMM-014`, `COMM-016`, `SIGNOFF-06`, and `SIGNOFF-09` are documented as pass in the active matrix.
- `STOCK-017`, `STOCK-016`, `GOLDEN-A-19`, and `GOLDEN-A-20` remained partial evidence only or open at Batch 4 closeout and were closed by later batches. `SIGNOFF-10` remained open at Batch 4 closeout and is closed later by Batch 8C. `TIME-002` and `OFF-009` remain open or partial evidence only.

## Batch 5 Closed on Main

Date/time: 2026-06-28 23:07 IST.

Batch 5: stock audit pagination and sale-only stock refresh.

Target failures:

- `STOCK-016`
- `STOCK-017`

Repository state:

- Implementation commit `46ad361fa03d3fb9d561c639e5e3ed6424cb8e03` was fast-forwarded into `main` and pushed to `origin/main`.
- `origin/main` pointed to `46ad361fa03d3fb9d561c639e5e3ed6424cb8e03` before this documentation closeout.

Migration status:

- No migration was required.
- No Supabase db push, repair, db pull, direct SQL, or `--include-all` command was run.

Runtime proof:

- Disposable QA proof `output/qa/batch5/BATCH5-20260628173243-stock-audit-refresh.json` passed.
- 506 stock movement rows were retrieved through cursor pagination as pages of 100, 100, 100, 100, 100, and 6.
- Pagination had no duplicate/missing rows and preserved deterministic newest-to-oldest order.
- Sale-only no-dispatch stock sale refreshed committed state to 75m available and 25m pending dispatch.
- The sale created one stock sale movement and one receivable.
- A second owner session matched the committed stock state.
- Cleanup completed with no cleanup errors.

Verification:

- Focused Batch 5 Vitest: 4 passed.
- Batch 2/3/4 guard regression pack: 85 passed.
- Full Vitest: 36 files, 317 passed, 1 skipped.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for touched Batch 5 files -> passed.
- `git diff --check` -> passed.
- After fast-forwarding `main`, focused Batch 5 Vitest, `npx tsc --noEmit`, and full Vitest passed again.

Resolution status:

- `STOCK-016` and `STOCK-017` are documented as pass in the active matrix.
- `GOLDEN-A-19` and `GOLDEN-A-20` remained partial evidence only or open at Batch 5 closeout and were closed later by Batch 6. `SIGNOFF-10` remained open at Batch 5 closeout and is closed later by Batch 8C. `TIME-002` and `OFF-009` remain open or partial evidence only.

## Batch 6 Closed on Main

Date/time: 2026-06-29 00:36 IST.

Batch 6: Golden A runtime closure.

Target failures:

- `GOLDEN-A-13`
- `GOLDEN-A-15`
- `GOLDEN-A-16`
- `GOLDEN-A-17`
- `GOLDEN-A-18`
- `GOLDEN-A-19`
- `GOLDEN-A-20`
- `GOLDEN-A-24`

Repository state:

- Implementation commit `80e8f8c6ae1318207b0c5b1f45e98c3cfe524f67` was fast-forwarded into `main` and pushed to `origin/main`.
- `origin/main` pointed to `80e8f8c6ae1318207b0c5b1f45e98c3cfe524f67` before this documentation closeout.

Migrations applied and aligned before docs closeout:

- `20260628183500_batch_6_allow_completed_order_stock_dispatch.sql`
- `20260628185344_batch_6_qualify_completed_order_dispatch_returning.sql`

Runtime proof:

- Disposable QA proof `output/qa/batch6/BATCH6-20260628185811-golden-a-runtime-proof.json` passed with 26 assertions and cleanup completed.
- Production was corrected from 230.75m to 235.75m and generated order-linked stock reconciled exactly.
- The customer order auto-completed at target and valid completed-order dispatch was allowed for order-linked sold stock.
- 120m was sold on credit for Rs. 7,200.
- 70m dispatch exact receipt closed with no discrepancy.
- 50m dispatch received as 45m created one 5m shortage discrepancy and one open party claim.
- Rs. 2,200 partial payment plus Rs. 5,000 final payment closed the receivable to zero with two receipt records.
- Second-session state matched committed receivable/payment state.
- Factory Today source reconciliation showed no pending dispatch, no in-transit receipt, no receivable balance, and one deliberate unresolved shortage discrepancy.
- Completed order archive/unlink behavior succeeded.

Verification:

- Focused Batch 6 Vitest: 1 passed.
- Batch 2/3/4/5 guard regression pack: 86 passed.
- Full Vitest: 37 files, 318 passed, 1 skipped.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for Batch 6 touched files -> passed before implementation commit.
- `git diff --check` and `git diff --cached --check` -> passed.

Resolution status:

- `GOLDEN-A-13`, `GOLDEN-A-15`, `GOLDEN-A-16`, `GOLDEN-A-17`, `GOLDEN-A-18`, `GOLDEN-A-19`, `GOLDEN-A-20`, and `GOLDEN-A-24` are documented as pass in the active matrix.
- `GOLDEN-A-21`, `GOLDEN-A-22`, `GOLDEN-A-23`, `TIME-002`, `OFF-009`, `SIGNOFF-01`, `SIGNOFF-02`, `SIGNOFF-04`, `TECH-011`, and `TECH-012` remain partial evidence only or open and are not closed by Batch 6. `SIGNOFF-10` remained partial at Batch 6 closeout and is closed later by Batch 8C.

## Batch 7 Closed on Main

Date/time: 2026-06-29 14:42 IST.

Batch 7: partial release/runtime/date hardening.

Target failures:

- `TIME-002`
- `TECH-013`

Repository state:

- Implementation commit `ff44f46643400c93fea79f361b1911f992be3d5c` was fast-forwarded into `main` and pushed to `origin/main`.
- `origin/main` pointed to `ff44f46643400c93fea79f361b1911f992be3d5c` before this documentation closeout.

Migrations:

- No migration was needed.

Evidence:

- Date-only rendering now uses date-only helpers instead of timezone-shifting `new Date(dateOnly)` parsing across the affected inventory, order, dispatch, archive, market-run, Factory Today, analytics, and payslip display paths.
- Focused date-only tests prove the same date-only value renders unchanged under UTC, Asia/Kolkata, and America/Los_Angeles.
- `package.json` defines `test: vitest run` and `prebuild: npm run test`, so the source-controlled build path cannot accidentally omit Vitest.
- `npm run build` passed and proved the prebuild test gate runs before build.
- Local production smoke on port 3107 returned 200 for `/login`, `/privacy`, and `/manifest.webmanifest`, with no server errors observed.
- Evidence artifacts were committed under `output/qa/batch7/`.

Verification:

- Focused Batch 7 Vitest: 9 passed.
- Full Vitest: 327 passed, 1 skipped.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for Batch 7 touched files -> passed.
- `git diff --check` and `git diff --cached --check` -> passed.
- `npm run build` -> passed with the prebuild Vitest gate.

Resolution status:

- `TIME-002` and `TECH-013` are documented as pass in the active matrix.
- At Batch 7 closeout, `SIGNOFF-10`, `TECH-007`, `TECH-009`, `TECH-010`, `TECH-011`, `TECH-012`, and `SEC-011` were blocked or partial evidence only because external deployed, Sentry/source-map, restore, rollback, and production migration proof was unavailable.
- `OFF-009`, `SIGNOFF-01`, `SIGNOFF-02`, `SIGNOFF-04`, `GOLDEN-A-21`, `GOLDEN-A-22`, and `GOLDEN-A-23` remain open and out of scope for Batch 7.

## Batch 8 Closed on Main

Date/time: 2026-06-29 20:12 IST.

Batch 8: partial release observability and migration-head closeout.

Target failure:

- `TECH-007`

Repository state:

- `origin/main` had advanced to `fb3d4dd98db398aa8aa33f5b6196fa29e536e5b1` for estimator spacing/layout before reconciliation.
- Batch 8 was reconciled on top of latest `origin/main` without force-push.
- Reconciled implementation commit `c169a8ccbb3b544d04aa576e0b03877282d49f35` was fast-forwarded into `main` and pushed to `origin/main`.

Migrations:

- No migration was needed.
- Supabase migration-list evidence showed local and remote aligned through latest repository migration `20260628185344`, with no pending, failed, or out-of-order migrations.
- No Supabase command, db push, migration repair, db pull, direct SQL, or `--include-all` command was run.

Evidence:

- Batch 8 fixed local Sentry tunnel ownership/config consistency: `withSentryConfig` owns `/monitoring`; conflicting manual `/api/sentry-tunnel` was removed.
- Batch 8 added narrow CSP `worker-src 'self' blob:;` for the deployed browser smoke CSP worker failure.
- Batch 8 added explicit Sentry auth-token, release, deploy environment, and source-map upload configuration from environment.
- Batch 8 added release/runtime config tests covering Sentry tunnel ownership, CSP, auth/release config, redaction, and webhook fail-closed checks.
- Evidence artifact was committed at `output/qa/batch8/BATCH8-20260629103146-release-observability-evidence.json`.
- Deployed pre-patch smoke showed `/monitoring?...` 403 and CSP `worker-src blob:` errors, so `SIGNOFF-10` remained blocked/partial at Batch 8 closeout until post-patch deploy proof was clean. It is closed later by Batch 8C.
- Vercel build logs showed no `SENTRY_AUTH_TOKEN`; at Batch 8 closeout, Sentry release/source maps were not created/uploaded and `TECH-010` was still blocked pending fresh deployment evidence.
- Sentry was stale/unverified with no current release/source-map/event payload, so `SEC-011` remains blocked.
- No restore exercise exists for `TECH-011`.
- No rollback/forward-fix exercise exists for `TECH-012`.
- No deployed WhatsApp valid/invalid proof exists, so `TECH-009` remains partial and `WA-008` remains open.

Verification:

- Focused Batch 8 Vitest: 7 passed.
- Full Vitest: 39 files, 331 passed, 1 skipped.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for Batch 8 touched files -> passed.
- `npm run build` -> passed with the prebuild Vitest gate.
- `git diff --check` and `git diff --cached --check` -> passed.

Resolution status:

- `TECH-007` is documented as pass in the active matrix.
- At Batch 8 closeout, `TECH-009`, `TECH-010`, `TECH-011`, `TECH-012`, `SEC-011`, and `SIGNOFF-10` were blocked or partial evidence only. `TECH-010` is superseded by Batch 8B evidence below, and `SIGNOFF-10` is superseded by Batch 8C evidence below.
- `WA-008` remains open.
- Batch 8B must start from latest `origin/main` and capture fresh deployment plus external provider proof.

## Batch 8B Closed on Main

Date/time: 2026-06-29 21:32 IST.

Batch 8B: partial release observability closeout for Sentry release/source-map evidence.

Target failure:

- `TECH-010`

Repository state:

- Batch 8B implementation commit `d4392808690ca47f7f10f9950c82d02d94621e30` was fast-forwarded into `main` and pushed to `origin/main`.

Migrations:

- No migration was needed.
- No Supabase command, db push, migration repair, db pull, direct SQL, or `--include-all` command was run.

Evidence:

- Evidence artifact was committed at `output/qa/batch8b/BATCH8B-20260629153402-release-evidence-monitoring.json`.
- Fresh production deployment after adding `SENTRY_AUTH_TOKEN` completed successfully; Vercel build completed in 3m 38s with no observed build errors.
- Old Sentry missing-auth-token / skipped-release / skipped-source-map warnings were gone from build-log searches.
- Sentry release `2538da25b2fa` exists for project `vastra/javascript-nextjs`, deploy environment `production`, and matches the deployed commit prefix.
- Sentry source maps/artifacts are visible with 529 artifacts.
- No mapped event exists and no live Sentry event payload exists.
- Fresh deployed `/login` and `/privacy` smoke loaded visually and no longer showed the CSP `worker-src blob:` error.
- Fresh deployed `/login` and `/privacy` smoke still showed repeated `/monitoring?...` HTTP 403 console/network errors at Batch 8B closeout, so `SIGNOFF-10` remained blocked/partial until the Batch 8C post-DSN evidence below.
- Batch 8B removed stale manual `/api/sentry-tunnel` route/proxy remnants and updated release-runtime tests to keep them absent.

Verification:

- Focused Batch 8B Vitest: 7 passed.
- Full Vitest: 39 files, 331 passed, 1 skipped.
- `npx tsc --noEmit` -> passed.
- Targeted ESLint for Batch 8B touched files -> passed.
- `npm run build` -> passed with the prebuild Vitest gate.
- `git diff --check` and `git diff --cached --check` passed.

Resolution status:

- `TECH-010` is documented as pass in the active matrix.
- At Batch 8B closeout, `TECH-009`, `TECH-011`, `TECH-012`, `SEC-011`, and `SIGNOFF-10` remained blocked or partial evidence only. `SIGNOFF-10` is superseded by Batch 8C evidence below.
- `WA-008` remains open.
- Next follow-up must verify external Sentry client key, allowed domains, DSN, and project settings for `/monitoring` 403, then capture fresh clean deployed smoke after any provider/config fix.

## Batch 8C Clean Deployed Signoff Closeout

Date/time: 2026-06-30 00:16 IST.

Batch 8C: clean deployed browser/server/Sentry signoff closeout after Sentry DSN fix.

Target failure:

- `SIGNOFF-10`

Repository state:

- Source commit: `7c6449a590617bf0b84811bc71462843a559e34e`.

Migrations:

- No migration was needed.
- No Supabase command, db push, migration repair, db pull, direct SQL, or `--include-all` command was run.

Evidence:

- Evidence artifact was committed at `output/qa/batch8c/BATCH8C-20260629184639-clean-deployed-smoke-after-dsn.json`.
- Vercel `NEXT_PUBLIC_SENTRY_DSN` was updated to the current `javascript-nextjs` Sentry project DSN and redeployed; no raw DSN or secret value was copied.
- Fresh deployed `/login` and `/privacy` smoke loaded visually with no `/monitoring?...` 403s, no CSP `worker-src blob:` error, and no blocking browser console errors.
- Remaining browser messages were non-blocking `.woff2` preload warnings only.
- Vercel production runtime/server logs for deployment `dpl_54VCavyUikrAETiiuZzt7MAW8Kpg` showed Warning 0, Error 0, Fatal 0, no 5xx responses, and no server exceptions during the smoke window.
- Sentry production release `7c6449a59061` for project `vastra/javascript-nextjs` showed 100% crash-free sessions, 0 crashes, 0 new issues, 0 handled issues, 0 unhandled issues, 1K source-map artifacts, and no new issues in the release.
- No Sentry event payload exists or was copied, so `SEC-011` remains blocked for live payload redaction inspection.

Verification:

- `jq empty output/qa/batch8c/BATCH8C-20260629184639-clean-deployed-smoke-after-dsn.json` -> passed.
- `git diff --check` and `git diff --cached --check` passed.

Resolution status:

- `SIGNOFF-10` is documented as pass in the active matrix.
- `SEC-011`, `TECH-009`, `TECH-011`, `TECH-012`, and `WA-008` remain open, blocked, or partial because the required live Sentry payload, deployed WhatsApp callback, restore, and rollback/forward-fix evidence is still unavailable.

## Batch 9 Offline Cache Truth Closeout

Date/time: 2026-06-30 15:15 IST.

Batch 9: offline/cache/public-claims truth cleanup.

Target failures closed:

- `OFF-002`
- `OFF-005`
- `OFF-006`
- `OFF-008`
- `SEC-016`
- `PAY-028`

Repository state:

- Branch: `codex/batch-9-offline-cache-truth-cleanup`.
- Source base: `origin/main` at `bb02aaaa95616b2c6be8ac515c5cf76c23b8135a`.

Migrations:

- No migration was needed.
- No Supabase command, db push, migration repair, db pull, direct SQL, or `--include-all` command was run.

Evidence:

- Evidence artifact: `output/qa/batch9/BATCH9-offline-cache-truth-proof.json`.
- `/offline` and `/_offline` are intentional public routes. The PWA fallback remains `/_offline`, and `/_offline` rewrites to `/offline`.
- Local HTTP proof returned 200 for `/offline`, `/_offline`, `/privacy`, and `/`.
- In-app browser proof for `/_offline` showed the offline page instead of a login redirect or login form, with no blocking console issues.
- Privacy/public copy no longer claims unsupported IndexedDB autosync for production/kharchi/payroll/sale/dispatch/payment writes.
- Logout/account-switch cleanup now clears user-specific persisted React Query cache, user id, fixed-staff skip state, production-meter drafts, estimator drafts, sessionStorage, and the Dexie offline mutation queue.
- Logout prevents the first submit, awaits `clearClientSessionState()`, catches cleanup errors so logout is not permanently blocked, then uses a guarded `requestSubmit()` so the server logout action still executes.
- Offline kharchi is truthfully online-only. The old `kharchi_offline` queue path is removed, and unsupported queued mutations are discarded with explicit error copy instead of being replayed or reported as synced.
- Sentry `/monitoring` remains excluded in the proxy matcher; dashboard/auth gating is unchanged except for the two public offline routes.

Verification:

- `git diff --check` -> passed.
- `jq empty output/qa/batch9/BATCH9-offline-cache-truth-proof.json` -> passed.
- Targeted `npx eslint` for touched Batch 9 files -> passed.
- `npx vitest run __tests__/batch9-offline-cache-truth.test.ts` -> passed, 1 test file, 8 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npm run build` -> passed. Prebuild full Vitest passed with 40 test files, 339 tests passed, and 1 skipped; Next production build completed and generated `/offline` as a static route with PWA document fallback `/_offline`.

Resolution status:

- `OFF-002`, `OFF-005`, `OFF-006`, `OFF-008`, `SEC-016`, and `PAY-028` are documented as pass in the active matrix.
- `OFF-007` remains partial/open because production service-worker update proof with an active draft was not captured.
- `OFF-010` remains partial/open because throttled slow/intermittent-network runtime proof across core mobile screens was not captured.
- `OFF-009` remains open and out of scope for unknown-timeout UX and status reconciliation.
- `SEC-011`, `TECH-009`, `TECH-011`, `TECH-012`, `WA-008`, `WA-010`, billing/external evidence rows, restore/rollback rows, Sentry live payload rows, WhatsApp rows, and production/order/payroll rows outside the approved Batch 9 scope remain unchanged.

## Batch 10 Estimator Quote Order Snapshot Closeout

Date/time: 2026-06-30 16:45 IST.

Batch 10: estimator/quote/order snapshot cleanup.

Target failures closed:

- `EST-003`
- `EST-019`
- `ORDER-001`
- `ORDER-002`
- `QUOTE-010`
- `QUOTE-003`

Repository state:

- Branch: `codex/batch-10-estimator-quote-order-snapshots`.
- Source base: `origin/main` at `2ada670d32efeacdb39cc5827fcbd33cc626022d`.

Migrations:

- No migration was needed.
- No Supabase command, db push, migration repair, db pull, direct SQL, or `--include-all` command was run.

Evidence:

- Evidence artifact: `output/qa/batch10/BATCH10-estimator-quote-order-snapshots-proof.json`.
- Decimal-backed `calcWorkerRateSnapshot` and `normalizeCurrencySnapshot` preserve the two-decimal worker-rate snapshot and cover the `2.5020000000000002` to `2.50` drift regression.
- Estimator quote save, Start Party Order, and market-run quote/order writes all store normalized `worker_rate_per_m`.
- The accepted quote-to-order path continues to use the existing RPC, which copies the normalized quote worker-rate snapshot into `orders.worker_rate_per_m`.
- Quote restore now detects a different recoverable local estimator draft on the shared autosave key and gives Keep draft / Overwrite draft choices.
- Quote lifecycle no longer silently performs `draft -> sent -> accepted`; server and UI now expose `draft -> sent` and `sent -> accepted/rejected` only.
- Production, stock, dispatch, commercial, payroll, Supabase, migration, RPC, and server-boundary hardening areas were not intentionally changed.

Verification:

- `git diff --check` -> passed.
- `jq empty output/qa/batch10/BATCH10-estimator-quote-order-snapshots-proof.json` -> passed.
- Targeted `npx eslint` for touched Batch 10 files -> passed.
- `npx vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts` -> passed, 2 test files, 33 tests.
- `npx vitest run __tests__/batch10-estimator-quote-order-snapshots.test.ts` -> passed, 1 test file, 4 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npm run build` -> passed on review rerun. Prebuild full Vitest passed with 41 test files, 345 tests passed, and 1 skipped; Next compiled successfully, TypeScript finished after 5.2 minutes, static page generation completed, and the command exited 0.

Resolution status:

- `EST-003`, `EST-019`, `ORDER-001`, `ORDER-002`, `QUOTE-010`, and `QUOTE-003` are documented as pass in the active matrix.
- `EST-011` remains open because server-boundary estimator validation is a distinct root.
- `QUOTE-007` remains open because Start Party Order accepted-quote/order atomicity is a distinct transaction/idempotency root.
- `ORDER-006` remains open because target/deadline audit and produced-meter guards are a distinct order edit/audit root.
- `ORDER-008` remains open because below-target completion confirmation and runtime proof are a distinct order completion root.

## Batch 11 Estimator Order Lifecycle Closeout

Date/time: 2026-06-30 20:05 IST.

Batch 11: remaining estimator / quote / order lifecycle cleanup.

Target failures closed:

- `EST-011`
- `ORDER-006`

Rows kept open or partial:

- `QUOTE-007` remains fail/open because Start Party Order still creates the accepted quote before order conversion; strict atomicity needs a combined database/RPC transaction.
- `ORDER-008` is source-fixed and documented as `code_verified`, but not pass, because runtime/browser proof with disposable below-target order data was not collected.

Repository state:

- Branch: `codex/batch-11-estimator-order-lifecycle-cleanup`.
- Source base: `2ecf27c6b0619dec201395c4cc0c52ca9c11ff8c`.

Migrations:

- No migration or RPC change was made.
- No Supabase command, db push, migration repair, db pull, direct SQL, or `--include-all` command was run.

Evidence:

- Evidence artifact: `output/qa/batch11/BATCH11-estimator-order-lifecycle-proof.json`.
- `EST-011`: `validateEstimatorQuoteBoundary` rejects empty warp/weft rows, zero/negative required inputs, non-finite numbers, and extreme yarn/width/rate values at the server boundary.
- `EST-011`: validation is wired before estimator quote persistence in Save Quote, Start Party Order, and market-run creation paths.
- `ORDER-006`: `updateOrderDetails` validates deadlines and rejects a target below already-produced meters using `order_progress_summary` before updating the order.
- `ORDER-006`: existing `audit_orders` trigger and `log_audit_event` old/new data capture target/deadline history without schema work.
- `ORDER-008`: `updateOrderStatus` returns `confirmationRequired` for below-target or pending-dispatch completion, and Orders UI uses a shared confirmation dialog from both card and drawer completion paths.
- Production, stock, dispatch, commercial, payroll, Supabase, migration, RPC, and unrelated order boundary paths were not intentionally changed.

Verification:

- `git diff --check` -> passed.
- `jq empty output/qa/batch11/BATCH11-estimator-order-lifecycle-proof.json` -> passed.
- Targeted `npx eslint` for touched Batch 11 files -> passed.
- `npx vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts` -> passed, 2 test files, 33 tests.
- `npx vitest run __tests__/batch11-estimator-order-lifecycle.test.ts` -> passed, 1 test file, 6 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npm run build` -> passed. Prebuild Vitest passed with 42 test files, 351 tests passed, and 1 skipped; Next compiled successfully, TypeScript completed, static page generation completed for 40 pages, and the command exited 0.

Resolution status:

- `EST-011` and `ORDER-006` are documented as pass in the active matrix.
- `ORDER-008` remains open/partial as `code_verified` pending runtime/browser proof.
- `QUOTE-007` remains open as fail pending database/RPC transaction work.

## Batch 12 Code-Verified Proof Sweep Closeout

Date/time: 2026-06-30 20:29 IST.

Batch 12: proof-only sweep for safe `code_verified` rows.

Target rows closed:

- `STOCK-012`
- `DISP-013`

Rows kept open, partial, or blocked:

- `ORDER-008` remains `code_verified` because Batch 11 source/test evidence does not replace the required disposable runtime/browser proof for below-target, pending-dispatch, and normal completion paths.
- `GOLDEN-B-12` remains blocked because Batch 3 exact-receipt proof is analogous only; the active row requires a full Golden B second-batch exact receipt rerun.
- `STOCK-011`, `STOCK-013`, `MARKET-009`, and `MARKET-010` remain `code_verified` because Batch 12 safe tests did not fully satisfy their exact row wording.

Repository state:

- Branch: `codex/batch-12-code-verified-proof-sweep`.
- Source base: `9b21acd2334cd4048fc999acb3d102926581540e`.

Migrations:

- No migration or RPC change was made.
- No Supabase command, db push, migration repair, db pull, direct SQL, or `--include-all` command was run.

Evidence:

- Evidence artifact: `output/qa/batch12/BATCH12-code-verified-proof-sweep.json`.
- `STOCK-012`: `npx vitest run __tests__/p1-stock-lifecycle.test.ts` passed 10 tests and directly covers closed/sold-out market-run lots with zero available/reserved/pending meters and no discrepancy as non-actionable/archive-eligible.
- `DISP-013`: `npx vitest run __tests__/dispatch-archive.test.ts` passed 7 tests and directly covers a fully dispatched and confirmed group archiving while incomplete, unconfirmed, disputed, discrepancy, or e-way-gap groups stay active.

Verification:

- `git status --short` -> clean before docs closeout.
- `git diff --check` -> passed before docs closeout.
- `jq empty output/qa/batch12/BATCH12-code-verified-proof-sweep.json` -> passed.
- `npx vitest run __tests__/p1-stock-lifecycle.test.ts` -> passed, 1 test file, 10 tests.
- `npx vitest run __tests__/dispatch-archive.test.ts` -> passed, 1 test file, 7 tests.

Resolution status:

- `STOCK-012` and `DISP-013` are documented as pass in the active matrix.
- `ORDER-008`, `GOLDEN-B-12`, `STOCK-011`, `STOCK-013`, `MARKET-009`, and `MARKET-010` remain unchanged/open as listed above.

## Batch 13 Targeted Code-Verified Proof Sweep Closeout

Date/time: 2026-07-01 03:02 IST.

Batch 13: targeted proof-only sweep for safe `code_verified` rows.

Target rows closed:

- `EST-001`
- `EST-005`
- `EST-012`

Rows kept open, partial, or blocked:

- `EST-004` remains `code_verified` because the width helper proof passed, but it did not directly prove persisted estimator/quote width value.
- `SETUP-001` and `SETUP-002` remain `code_verified` because workflow visibility helper proof passed, but completed-onboarding browser navigation persistence was not directly proven.
- `BILL-002`, `PAY-017`, `TIME-003`, and `TIME-004` remain `code_verified` because their exact row wording still needs stronger proof than the inspected local/static evidence.
- `ORDER-008`, `GOLDEN-B-12`, `QUOTE-007`, `SEC-011`, `TECH-009`, `WA-008`, `TECH-011`, `TECH-012`, `OFF-007`, `OFF-010`, `STOCK-011`, `STOCK-013`, `MARKET-009`, and `MARKET-010` remain unchanged under their existing proof requirements.

Repository state:

- Branch: `codex/batch-13-code-verified-proof-sweep`.
- Source base: `40fca35170b5127e6a37eb43f8238f0bf99816fa`.

Migrations:

- No migration or RPC change was made.
- No Supabase command, db push, migration repair, db pull, direct SQL, or `--include-all` command was run.

Evidence:

- Evidence artifact: `output/qa/batch13/BATCH13-code-verified-proof-sweep.json`.
- `EST-001`: `npx --no-install vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts __tests__/production-mode.test.ts` passed 3 test files and 39 tests; the estimator tests directly cover representative single warp/weft cost-stack fixtures through `calcFullTotals` and `calcOrderQuote`.
- `EST-005`: the same proof run directly covers direct wage conversion, paise direct entry, safe weave cost, and the old dangerous 100x paise/rupee failure mode.
- `EST-012`: the same proof run directly covers invalid commission-plus-margin boundary behavior with `isValid=false`, a clear error message, and zero quote price.

Verification:

- `git diff --check` -> passed before docs closeout.
- `jq empty output/qa/batch13/BATCH13-code-verified-proof-sweep.json` -> passed.
- `npx --no-install vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts __tests__/production-mode.test.ts` -> passed, 3 test files, 39 tests.

Resolution status:

- `EST-001`, `EST-005`, and `EST-012` are documented as pass in the active matrix.
- All unproven supporting candidates remain unchanged/open as listed above.

## Batch 15 Payroll Document Export Statutory Consistency Closeout

Date/time: 2026-07-01 04:08 IST.

Batch 15: payroll document/export/statutory consistency with narrow Factory Today wage read-model fix.

Target rows promoted to pass:

- `PAY-023`
- `PAY-024`
- `SEC-014`

Rows kept open as `code_verified`:

- `PAY-013` is source/test fixed for the ESIC wage-ceiling formula but still needs disposable high-gross enrolled settlement proof.
- `PAY-015` is source/test fixed for the preview-versus-settlement statutory mismatch but still needs live persisted-settlement proof.
- `DASH-003` is source/test fixed for gross wage aggregation but still needs after-shift Factory Today runtime/browser proof.

Repository state:

- Branch: `codex/batch-15-payroll-doc-export-consistency`.
- Source base: `origin/main` at `01c2f4d6f63cfe1870919b8678e2742122460608`.

Migrations:

- No migration or RPC change was made.
- No Supabase command, db push, migration repair, db pull, direct SQL, or `--include-all` command was run.

Evidence:

- Evidence artifact: `output/qa/batch15/BATCH15-payroll-doc-export-consistency-proof.json`.
- `PAY-023`: payslip PDFs now render explicit cycle dates, earning lines, manual inam/kapaat adjustments, advance recovery, PF, ESI, net pay, carry-forward debt, and payment mode, and PDF generation is disabled until a paid settlement exists.
- `PAY-024`: settlement history and CSV export read statutory deductions from nested persisted `pf.employee` and `esic.employee` itemization with legacy fallback.
- `SEC-014`: payslip filenames are deterministically sanitized to safe ASCII filename parts.
- `PAY-013` and `PAY-015`: payroll preview statutory deductions now share the same PF/ESIC helper and ESIC wage-ceiling condition as the latest settlement formula, but runtime settlement proof is still missing.
- `DASH-003`: Factory Today gross wages now aggregate existing production log meter/rate snapshots, but runtime dashboard proof is still missing.

Verification:

- `git diff --check` -> passed.
- `jq empty output/qa/batch15/BATCH15-payroll-doc-export-consistency-proof.json` -> passed.
- `npx vitest run __tests__/batch15-payroll-doc-export-consistency.test.ts` -> passed, 1 test file, 7 tests.
- Payroll regression pack -> passed, 7 test files, 40 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- Targeted `npx eslint` for touched Batch 15 files -> passed.
- `npm run build` -> passed. Prebuild full Vitest passed with 43 test files, 358 tests passed, and 1 skipped; Next build exited 0.

Resolution status:

- `PAY-023`, `PAY-024`, and `SEC-014` are documented as pass in the active matrix.
- At Batch 15 closeout, `PAY-013`, `PAY-015`, and `DASH-003` were documented as `code_verified`, not pass, pending disposable runtime/browser proof. Batch 21C later closes `PAY-013` and `PAY-015`; `DASH-003` remains `code_verified`.

## Batch 20 Payroll RPC Hardening and Kharchi Atomicity Closeout

Date/time: 2026-07-01 12:15 IST.

Batch 20: payroll settlement/reversal RPC hardening and online supervisor Kharchi atomicity.

Rows moved from fail to `code_verified`:

- `PAY-018`: settlement payment-mode and owner-verification enforcement is source-fixed at the RPC boundary.
- `PAY-020`: payroll reversal access-code enforcement is source-fixed at the RPC boundary.
- `PAY-027`: online supervisor Kharchi advance plus float ledger atomicity is source-fixed at the RPC boundary.

Rows intentionally not closed:

- `GOLDEN-A-21`, `GOLDEN-A-22`, `GOLDEN-A-23`, and `GOLDEN-B-18` still require later Golden/runtime proof.
- At Batch 20 closeout, `PAY-013`, `PAY-015`, `DASH-003`, and `PAY-006` remained under their existing proof requirements. Batch 21C later closes `PAY-013` and `PAY-015`.
- Production/order boundary rows, stock/dispatch/commercial rows, billing/provider rows, Sentry/WhatsApp/restore/rollback rows, and all unapproved rows remain unchanged.

Repository state:

- Branch: `codex/batch-20-payroll-rpc-kharchi-atomicity`.
- Source base: `origin/main` at `af1d8a59d24796f71abbfa04bac54e32e46d35f2`.
- Evidence artifact: `output/qa/batch20/BATCH20-payroll-rpc-kharchi-atomicity-proof.json`.

Migration:

- Created migration file `supabase/migrations/20260701105404_batch_20_payroll_rpc_kharchi_atomicity.sql`.
- The migration revokes callable API-role execution from historical payroll settle/unsettle bypass overloads.
- The migration adds hardened settlement and reversal wrappers with auth.uid actor, JWT org/owner, org-lock, payment-mode, owner-verification, and database-transaction access-code checks.
- The migration adds `record_supervisor_kharchi` so worker advance and supervisor float transaction insert together or roll back together.
- No migration was applied. No Supabase command, db push, migration repair, db pull, direct SQL, or `--include-all` command was run.

Evidence:

- Owner payroll settlement action now calls `settle_worker_payroll_hardened`.
- Owner payroll reversal action now validates access-code format locally and calls `unsettle_worker_payroll_hardened` with the normalized access code.
- Supervisor `recordKharchi` now calls `record_supervisor_kharchi`; the old split app-side worker advance insert plus best-effort float insert path was removed.
- Source tests assert legacy overload revocation coverage, hardened wrapper requirements, reversal access-code transaction behavior, and removal of split Kharchi inserts.

Verification:

- `git diff --check` -> passed.
- `jq empty output/qa/batch20/BATCH20-payroll-rpc-kharchi-atomicity-proof.json` -> passed.
- `npx vitest run __tests__/batch20-payroll-rpc-kharchi-atomicity.test.ts __tests__/p1-payroll-revert.test.ts` -> passed, 2 test files, 8 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- Targeted `npx eslint` for touched Batch 20 files -> passed.
- `npm run build` -> passed. Prebuild full Vitest passed with 44 test files, 363 tests passed, and 1 skipped; Next build exited 0.

Resolution status:

- At Batch 20 closeout, `PAY-018`, `PAY-020`, and `PAY-027` were documented as `code_verified`, not pass.
- They were not pass-ready because the migration was not applied, callable-role RPC permission proof was not collected, and disposable QA runtime/browser proof of settlement blocking, reversal access-code behavior, and Kharchi atomicity was still required. Batch 21D later closes `PAY-018` and `PAY-020`; `PAY-027` remains `code_verified`.

## Batch 21C Payroll Preview Settlement Runtime Proof Closeout

Date/time: 2026-07-02 16:53 IST.

Batch 21C: payroll preview/settlement exact runtime proof.

Rows moved from `code_verified` to pass:

- `PAY-013`: PF/ESI applied only to the enrolled disposable worker and remained absent for the not-enrolled disposable worker at the same Rs. 20000 gross.
- `PAY-015`: preview gross, deductions, manual adjustments, advance recovery, debt, and net matched paid payroll rows and persisted Past settlements history exactly.

Rows intentionally not closed:

- At Batch 21C closeout, `PAY-018`, `PAY-020`, and `PAY-027` remained `code_verified`, not pass, pending Batch 20 migration application and disposable QA runtime/browser proof. Batch 21D later closes `PAY-018` and `PAY-020`; `PAY-027` remains `code_verified`.
- `DASH-003` remains `code_verified`, not pass, pending after-shift Factory Today runtime/browser proof.
- `PAY-006`, Golden payroll follow-ons, dashboard/signoff rows, production/order boundary rows, stock/dispatch/commercial rows, billing/provider rows, Sentry/WhatsApp/restore/rollback rows, and all unapproved rows remain unchanged.

Repository state:

- Branch: `codex/batch-21c-payroll-preview-settlement-runtime-proof`.
- Source base: `origin/main` at `b78b67806393dd30a84f82db58aadb01369a78c3`.
- Evidence artifact: `output/qa/batch21c/BATCH21C-payroll-preview-settlement-runtime-proof.json`.

Evidence:

- Runtime host: `http://localhost:3000`.
- QA safety checks observed QA Supabase ref `eutycrtzzxmlkcpipgod` and did not observe production ref `vzhwahudircrpgtitwzd` in targeted `.env.local`, `.env.qa.local`, or rebuilt `.next` cache checks.
- Enrolled disposable worker: gross Rs. 20000, PF Rs. 1800, ESI Rs. 150, net Rs. 18050; settlement/history matched.
- Not-enrolled disposable worker: gross Rs. 20000, PF/ESI Rs. 0, net Rs. 20000; settlement/history matched.
- Past settlements was reopened after the stale window and values remained unchanged.

Verification:

- `git status --short` -> clean before closeout edits.
- `git diff --check` -> passed before closeout edits.
- `jq empty output/qa/batch21c/BATCH21C-payroll-preview-settlement-runtime-proof.json` -> passed.
- `npx vitest run __tests__/batch15-payroll-doc-export-consistency.test.ts` -> passed, 1 test file, 7 tests.
- `npx vitest run __tests__/batch20-payroll-rpc-kharchi-atomicity.test.ts __tests__/p1-payroll-revert.test.ts` -> passed, 2 test files, 8 tests.
- `npx tsc --noEmit --pretty false` -> passed.

Resolution status:

- `PAY-013` and `PAY-015` are documented as pass in the active matrix.
- Matrix movement is pass +2 and `code_verified` -2: total 377, pass 193, fail 31, blocked 22, `code_verified` 130, `not_applicable` 1, `not_run` 0.

## Batch 21D Payroll Boundary Runtime Proof Closeout

Date/time: 2026-07-02 17:29 IST.

Scope:

- `PAY-018`
- `PAY-020`

Rows promoted to pass:

- `PAY-018`: missing payment/owner verification blocked in UI; hardened settlement RPC rejected missing payment mode and missing owner verification; valid UI settlement succeeded; legacy direct settlement RPC was permission denied.
- `PAY-020`: empty code kept reversal disabled; invalid code was rejected while settlement stayed paid; valid one-time code reversed to pending; consumed-code reuse was rejected; legacy direct unsettle RPC was permission denied.

Rows explicitly not closed:

- `PAY-027` remains `code_verified`, not pass, pending disposable online Kharchi runtime proof.
- `DASH-003` remains `code_verified`, not pass, pending disposable after-shift Factory Today runtime proof.
- Golden rows, `PAY-006`, production/order boundary rows, stock/dispatch/commercial rows, billing/provider rows, Sentry/WhatsApp/restore/rollback rows, and all unapproved rows remain unchanged.

Repository state:

- Branch: `codex/batch-21d-payroll-boundary-runtime-proof`.
- Source base: `origin/main` at `5e60265554a453cb137201f4d16a0e6fe047cf73`.
- Evidence artifact: `output/qa/batch21d/BATCH21D-payroll-boundary-runtime-proof.json`.

Safety:

- Runtime host: `http://localhost:3000`.
- QA Supabase ref: `eutycrtzzxmlkcpipgod`.
- Production Supabase ref `vzhwahudircrpgtitwzd` was absent from `.env.qa.local` and rebuilt `.next` cache targeted checks.
- Runtime proof used disposable QA payroll/worker/factory data and sanitized identifiers.
- No production mutation occurred, and no secrets were copied.

Verification:

- `git status --short` -> clean before closeout edits.
- `git diff --check` -> passed before closeout edits.
- `jq empty output/qa/batch21d/BATCH21D-payroll-boundary-runtime-proof.json` -> passed.
- `npx vitest run __tests__/batch20-payroll-rpc-kharchi-atomicity.test.ts __tests__/p1-payroll-revert.test.ts` -> passed, 2 test files and 8 tests.
- `npx vitest run __tests__/batch15-payroll-doc-export-consistency.test.ts` -> passed, 1 test file and 7 tests.
- `npx tsc --noEmit --pretty false` -> passed.

Migrations and forbidden actions:

- No migration, Supabase command, db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, app-code change, production/customer data mutation, external provider call, or env/secret copy was used for proof.
- Docs closeout force-adds only the ignored Batch 21D proof artifact and stages only the approved Batch 21D docs, matrix, and proof files.

Resolution status:

- `PAY-018` and `PAY-020` are documented as pass in the active matrix.
- Matrix movement is pass +2 and `code_verified` -2: total 377, pass 195, fail 31, blocked 22, `code_verified` 128, `not_applicable` 1, `not_run` 0.

## Batch 22 Production/Order Boundary Source-Fix Closeout

Date/time: 2026-07-02 18:12 IST.

Scope:

- `ORDER-005`
- `ORDER-009`
- `PROD-011`

Rows promoted to `code_verified`, not pass:

- `ORDER-005`: over-target production is blocked in the replacement RPC and direct table boundary before generated stock, order progress, pace, or payroll basis can be corrupted.
- `ORDER-009`: cancelled/completed/stale-assignment order-attributed logs are blocked in the replacement RPC and direct table boundary; existing history is not migration-mutated.
- `PROD-011`: negative meters are blocked through a forward-only `NOT VALID` table check plus replacement RPC and trigger guards.

Rows explicitly not closed:

- `SIGNOFF-02` remains fail/open. Batch 22 improves its `ORDER-009` dependency, but current-run attribution still requires runtime proof after migration application.
- `GOLDEN-A-23`, `PAY-027`, `DASH-003`, Golden rows, stock/dispatch/commercial rows, billing/provider rows, Sentry/WhatsApp/restore/rollback rows, and all unapproved rows remain unchanged.

Repository state:

- Branch: `codex/batch-22-production-order-boundary-hardening`.
- Source base: `origin/main` at `b0cef34910a255dfb1415bf3c605b09b02c7acc3`.
- Evidence artifact: `output/qa/batch22/BATCH22-production-order-boundary-hardening-proof.json`.
- Migration created but not applied: `supabase/migrations/20260702121238_batch_22_production_order_boundary_hardening.sql`.

Verification:

- `git status --short` -> approved Batch 22 test and migration untracked before docs closeout; proof artifact ignored under `output/qa`.
- `git diff --check` -> passed.
- `jq empty output/qa/batch22/BATCH22-production-order-boundary-hardening-proof.json` -> passed.
- `npx vitest run __tests__/batch22-production-order-boundary-hardening.test.ts` -> passed, 1 test file and 6 tests.
- `npx vitest run __tests__/batch11-estimator-order-lifecycle.test.ts` -> passed, 1 test file and 6 tests.
- `npx vitest run __tests__/p1-production-log-strictness.test.ts __tests__/p1-production-stock-atomicity.test.ts __tests__/p0-atomicity.test.ts __tests__/p2-golden-a-completed-order-dispatch.test.ts __tests__/p1-stock-lifecycle.test.ts` -> passed, 5 test files and 55 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx eslint __tests__/batch22-production-order-boundary-hardening.test.ts` -> passed.

Migrations and forbidden actions:

- No migration was applied.
- No Supabase db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, production/customer data mutation, external provider call, env file staging, Supabase temp-file staging, or secret copy occurred.

Resolution status:

- `ORDER-005`, `ORDER-009`, and `PROD-011` are documented as `code_verified` in the active matrix.
- Matrix movement is fail -3 and `code_verified` +3: total 377, pass 195, fail 28, blocked 22, `code_verified` 131, `not_applicable` 1, `not_run` 0.

## Batch 23 - Start Party Order Transaction Boundary Source-Fix Closeout

Date/time: 2026-07-02 18:58 IST. Source base `origin/main` at `2dddaea39208aa10bb3b06d6ab43a6b3a849428e`.

Scope:

- `QUOTE-007`

Rows promoted to `code_verified`, not pass:

- `QUOTE-007`: Start Party Order fast path is source-fixed at the database boundary. The new atomic RPC `start_party_order_from_estimator` inserts the accepted estimator_quote, active order, quote/order backlinks, and order_yarn_requirements in a single database transaction. If any write fails, the entire transaction is rolled back. The server action `startPartyOrderFromEstimator` is refactored to pre-compute the yarn requirements and invoke this RPC.

Rows explicitly not closed:

- `ORDER-005`, `ORDER-009`, `PROD-011` remain `code_verified`, not pass, pending database migration application and QA runtime proof.
- `PAY-027` remains `code_verified`, not pass, pending disposable online Kharchi float runtime proof.
- `DASH-003` remains `code_verified`, not pass, pending disposable after-shift wage updates runtime proof.
- Golden rows, other payroll rows, stock/dispatch/commercial rows, billing/provider rows, Sentry/WhatsApp/restore/rollback rows, and all unapproved rows remain unchanged.

Repository state:

- Branch: `codex/batch-23-quote-order-transaction-boundary`.
- Source base: `origin/main` at `2dddaea39208aa10bb3b06d6ab43a6b3a849428e`.
- Evidence artifact: `output/qa/batch23/BATCH23-start-party-order-transaction-boundary-proof.json`.
- Migration created but not applied: `supabase/migrations/20260702131500_batch_23_start_party_order_transaction_boundary.sql`.

Verification:

- `git status --short` -> approved Batch 23 test, migration, action and test updates untracked/modified before docs closeout; proof artifact ignored under `output/qa`.
- `git diff --check` -> passed.
- `jq empty output/qa/batch23/BATCH23-start-party-order-transaction-boundary-proof.json` -> passed.
- `npx vitest run __tests__/batch23-start-party-order-atomicity.test.ts` -> passed, 1 test file and 21 tests.
- `npx vitest run __tests__/batch11-estimator-order-lifecycle.test.ts` -> passed, 1 test file and 6 tests.
- `npx vitest run __tests__/batch10-estimator-quote-order-snapshots.test.ts` -> passed, 1 test file and 4 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx eslint __tests__/batch23-start-party-order-atomicity.test.ts` -> passed.

Migrations and forbidden actions:

- No migration was applied.
- No Supabase db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, production/customer data mutation, external provider call, env file staging, Supabase temp-file staging, or secret copy occurred.

Resolution status:

- `QUOTE-007` is documented as `code_verified` in the active matrix.
- Matrix movement is fail -1 and `code_verified` +1: total 377, pass 195, fail 27, blocked 22, `code_verified` 132, `not_applicable` 1, `not_run` 0.

## Batch 24B - Supervisor UX and Production Logging Failure Source-Fix Closeout

Date/time: 2026-07-03 11:23 IST. Source base `origin/main` at `d3aa28c488c280ef3cd54a049518f6d2c6ec80d6`.

Scope:

- `PROD-013`
- `PROD-023`
- `PROD-029`

Rows promoted to `code_verified`, not pass:

- `PROD-013`: suspicious large positive shift meters now show a non-blocking confirmation at 10,000m. The threshold is a warning threshold, not a hard business maximum, and negative-meter validation remains blocking.
- `PROD-023`: restored localStorage shift-meter drafts now show a visible "Restored unsaved draft" indicator saying values were restored from this device and are not saved yet. The state clears on save/reset.
- `PROD-029`: landing/setup copy now uses shift-total/shift-meter terminology and removes raw opening/closing meter-reading proof claims.

Rows explicitly not closed:

- `PROD-022` was outside Batch 24B and is later source-fixed by Batch 24D pending browser/runtime proof.
- `AUTH-008`, `SEC-009`, `SEC-015`, `SEC-017`, `PAY-027`, `DASH-003`, Golden rows, and all unapproved rows remain unchanged.

Repository state:

- Branch: `codex/batch-24b-supervisor-ux-failures`.
- Source base: `origin/main` at `d3aa28c488c280ef3cd54a049518f6d2c6ec80d6`.
- Evidence artifact: `output/qa/batch24b/BATCH24B-supervisor-ux-failures-proof.json`.

Verification:

- `git diff --check` -> passed.
- `jq empty output/qa/batch24b/BATCH24B-supervisor-ux-failures-proof.json` -> passed.
- `npx vitest run __tests__/batch24b-supervisor-ux-failures.test.ts` -> passed, 1 test file and 4 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx eslint __tests__/batch24b-supervisor-ux-failures.test.ts "app/(dashboard)/supervisor/dashboard/page.tsx" components/factory-today/SetupPanel.tsx components/landing/faq.tsx components/landing/features.tsx components/landing/pricing.tsx lib/production-log-validation.ts` -> passed.
- `npx vitest run __tests__/p1-production-log-strictness.test.ts __tests__/p1-production-dispatch-regressions.test.ts __tests__/p1-production-stock-atomicity.test.ts __tests__/p0-atomicity.test.ts __tests__/batch22-production-order-boundary-hardening.test.ts` -> passed, 5 test files and 56 tests.

Migrations and forbidden actions:

- No migration was created or applied.
- No RPC/database work occurred.
- No Supabase db push, migration repair, db pull, direct SQL, `--include-all`, npm audit, package install, lockfile change, production/customer data mutation, external provider call, env file staging, Supabase temp-file staging, or secret copy occurred.

Resolution status:

- `PROD-013`, `PROD-023`, and `PROD-029` are documented as `code_verified` in the active matrix.
- Matrix movement is fail -3 and `code_verified` +3: total 377, pass 195, fail 23, blocked 22, `code_verified` 136, `not_applicable` 1, `not_run` 0.

## Batch 23 - Production Migration Signature Hotfix Closeout

Date/time: 2026-07-03 12:20 IST. Branch `codex/batch-24c-factory-today-analytics-state`.

Scope:

- Batch 23 migration hotfix only.
- Files in scope: `supabase/migrations/20260702131500_batch_23_start_party_order_transaction_boundary.sql` and `__tests__/batch23-start-party-order-atomicity.test.ts`.

Root cause and fix:

- Production migration push was blocked because `start_party_order_from_estimator(...)` had required parameters after earlier defaulted parameters.
- `p_target_meters` and `p_deadline` now default to `NULL` to satisfy PostgreSQL function signature ordering.
- The RPC still rejects `p_target_meters IS NULL OR p_target_meters <= 0`, and now explicitly rejects `p_deadline IS NULL` before inserting into `orders`.

Production migration status:

- Human production action completed outside this closeout: `npx supabase db push` succeeded.
- The production-linked project applied Batch 23 and Batch 24A migrations: `20260702131500` and `20260702191500`.
- Production DB is now migrated through the Batch 24A attendance migration.
- This Batch 23 hotfix note did not itself claim Batch 24C closure. It is superseded for Batch 24C by the recovery closeout below, after the PR #4 squash merge.

Verification:

- Static migration review passed: 44 parameters checked, no non-default parameter appears after a defaulted parameter, target/deadline validation present, and no destructive `DROP`, `TRUNCATE`, or `DELETE` statement introduced.
- Static RPC/test review passed: signature/deadline assertions present and all 44 app RPC payload parameter names match the function.
- `git diff --check` -> passed.
- `npm test -- __tests__/batch23-start-party-order-atomicity.test.ts` -> passed, 1 test file and 21 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx supabase migration list` -> passed as read-only verification and showed remote/local history through `20260702191500`.

Forbidden actions:

- This closeout did not run `npx supabase db push`.
- No direct SQL, production mutation, new migration, package install, npm audit, lockfile change, or merge to main occurred in the Batch 23 hotfix. Batch 24C staging/closure is superseded by the recovery closeout below.

## Batch 24C - Factory Today Setup and Historical Analytics State Recovery Closeout

Date/time: 2026-07-04 IST. Recovery branch `codex/batch-24c-recovery-closeout`.

Context:

- Batch 24C code was squash-merged to `main` through PR #4 at `9eeed018cf88553b37df6f4fc2db5ae3d23a4538`.
- Original implementation commit before squash: `ee0ab46f6fc8dcd2b1c075e0464b77ab952f79eb`.
- The active matrix is `output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md`.
- This recovery closeout commits the ignored proof artifact and promotes only `SETUP-011` and `DASH-004` to `code_verified`.

Scope:

- `SETUP-011`
- `DASH-004`

Rows promoted to `code_verified`, not pass:

- `SETUP-011`: Factory Today setup checklist recognized completed costing, loom targets require active linked orders, worker checks use active rows only, and payroll config checks validate the cycle/pay/reminder bounds. Batch 24F later updates the worker-assignment portion to selected-shift/day-only policy.
- `DASH-004`: Historical date selection clears today's data, aggregates 7-day trend to the selected date, uses full state replacement instead of merging, and restores live dashboard state on return to today.

Rows explicitly not closed:

- `PROD-022` was outside Batch 24C and is later source-fixed by Batch 24D pending browser/runtime proof.
- `AUTH-008`, `SEC-009`, `SEC-015`, `SEC-017`, `PAY-027`, `DASH-003`, Golden rows, and all unapproved rows remain unchanged.

Repository state:

- Recovery branch: `codex/batch-24c-recovery-closeout`.
- Source base: `origin/main` at PR #4 squash merge `9eeed018cf88553b37df6f4fc2db5ae3d23a4538`.
- Evidence artifact: `output/qa/batch24c/BATCH24C-factory-today-analytics-state-proof.json`.

Verification:

- `git diff --check` -> passed.
- `jq empty output/qa/batch24c/BATCH24C-factory-today-analytics-state-proof.json` -> passed.
- `npx vitest run __tests__/batch24c-factory-today-analytics-state.test.ts` -> passed, 1 test file and 7 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx eslint 'app/(dashboard)/owner/actions/dashboard.ts' 'app/(dashboard)/owner/analytics/_components/DashboardClient.tsx' 'app/(dashboard)/owner/today/actions.ts' lib/factory-today-checklist.ts lib/dashboard-trend.ts __tests__/batch24c-factory-today-analytics-state.test.ts` -> passed.

Forbidden actions:

- This closeout did not run `npx supabase db push`.
- No direct SQL, production mutation, new migration, package install, npm audit, lockfile change, or Batch 23 rework occurred.

Resolution status:

- `SETUP-011` and `DASH-004` are documented as `code_verified` in the active matrix.
- Matrix movement is fail -2 and `code_verified` +2: total 377, pass 195, fail 21, blocked 22, `code_verified` 138, `not_applicable` 1, `not_run` 0.

## Batch 24D - Estimator Submit and Production Draft Isolation Closeout

Date/time: 2026-07-04 IST. Branch `codex/batch-24d-submit-draft-isolation`.

Scope:

- `EST-017`
- `PROD-022`

Rows promoted to `code_verified`, not pass:

- `EST-017`: estimator rapid double-submit is source-fixed with a synchronous `saveQuoteLockRef` guard before `createMarketRunFromEstimator` or `saveEstimatorQuoteV3`, save/create buttons disabled while saving, and lock cleanup in `finally`. This does not claim server/database idempotency.
- `PROD-022`: supervisor production draft isolation is source-fixed by scoping localStorage keys to `orgId`, `userId`, selected date, and shift; using `userProfile.org_id` and `userProfile.userId`; avoiding unsafe date/shift-only fallback keys; ignoring stale date/shift fetch completions; restoring only the active draft key; and saving with the currently selected date/shift.

Rows explicitly not closed:

- `AUTH-008`, `SEC-009`, `SEC-015`, `SEC-017`, MASTER rows, `PROD-002`, `PROD-004`, `PAY-027`, `DASH-003`, TECH/audit/dependency rows, WA/OFF rows, SIGNOFF rows, Golden rows, and all unapproved rows remain unchanged.

Repository state:

- Branch: `codex/batch-24d-submit-draft-isolation`.
- Source base: `origin/main` at `37b3ad0dc9516734699cc0137ccb1bc2059908d6`.
- Evidence artifact: `output/qa/batch24d/BATCH24D-submit-draft-isolation-proof.json`.

Verification:

- `git diff --check` -> passed.
- `jq empty output/qa/batch24d/BATCH24D-submit-draft-isolation-proof.json` -> passed.
- `npx vitest run __tests__/batch24d-submit-draft-isolation.test.ts` -> passed, 1 test file and 13 tests.
- `npx vitest run __tests__/batch24b-supervisor-ux-failures.test.ts` -> passed, 1 test file and 4 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx eslint app/\(dashboard\)/owner/estimator/EstimatorClient.tsx app/\(dashboard\)/supervisor/dashboard/page.tsx lib/production-drafts.ts __tests__/batch24d-submit-draft-isolation.test.ts __tests__/batch24b-supervisor-ux-failures.test.ts` -> passed.
- `npx vitest run __tests__/batch11-estimator-order-lifecycle.test.ts __tests__/batch23-start-party-order-atomicity.test.ts __tests__/batch10-estimator-quote-order-snapshots.test.ts __tests__/batch22-production-order-boundary-hardening.test.ts __tests__/p1-production-stock-atomicity.test.ts __tests__/production-mode.test.ts __tests__/p1-production-log-strictness.test.ts __tests__/p1-production-dispatch-regressions.test.ts __tests__/estimator.test.ts` -> passed, 9 test files and 116 tests.

Forbidden actions:

- This closeout did not create migrations, apply migrations, run `npx supabase db push`, run migration repair, run `db pull`, use direct SQL, use `--include-all`, mutate production, run `npm audit`, install packages, touch the lockfile, stage env files, or stage Supabase temp files.
- Browser/runtime proof was not collected, so no pass-ready status is claimed.

Resolution status:

- `EST-017` and `PROD-022` are documented as `code_verified` in the active matrix.
- Matrix movement is fail -2 and `code_verified` +2: total 377, pass 195, fail 19, blocked 22, `code_verified` 140, `not_applicable` 1, `not_run` 0.

## Batch 24E - Master Data Loom Guardrails Closeout

Date/time: 2026-07-05 IST. Branch `codex/batch-24e-master-data-guardrails`.

Scope:

- `MASTER-002`
- `MASTER-005`

Rows promoted to `code_verified`, not pass:

- `MASTER-002`: normalized duplicate loom-name prevention is source-fixed for manual add, bulk add, and rename/update paths. Migration `20260704120000_batch_24e_master_data_loom_guardrails.sql` was later revised from a retroactive unique index to a trigger-backed guard that preserves existing duplicate rows while blocking future normalized duplicates.
- `MASTER-005`: protected loom lifecycle behavior is source-fixed for owner deactivate/delete, supervisor delete-with-code, and cost-analysis null-target unlink. Protected references include current/linked target, active standing worker assignments, dated shift-assignment history, and production history. Null-target unlink no longer silently sets loom status inactive.

Rows explicitly not closed:

- `MASTER-014` remains fail/open because assignment no-mixed-context behavior requires a separate transactional RPC/lock design spanning `shift_assignments`, `machine_assignments`, and `machines.current_order_id`.
- `AUTH-008`, `SEC-009`, `SEC-015`, `SEC-017`, `PROD-002`, `PROD-004`, `PAY-027`, `DASH-003`, TECH/audit/dependency rows, WA/OFF rows, SIGNOFF rows, Golden rows, and all unapproved rows remain unchanged.

Repository state:

- Source base: `origin/main` at `04637f62746e9cbeae5821d944f558c65ec4f07b`.
- Evidence artifact: `output/qa/batch24e/BATCH24E-master-data-guardrails-proof.json`.

Verification:

- `git diff --check` -> passed.
- `jq empty output/qa/batch24e/BATCH24E-master-data-guardrails-proof.json` -> passed.
- `npx vitest run __tests__/batch24e-master-data-guardrails.test.ts` -> passed, 1 test file and 9 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- `npx eslint app/\(dashboard\)/owner/actions.ts app/\(dashboard\)/supervisor/actions.ts components/MachineManagement.tsx lib/master-data-loom-guardrails.ts __tests__/batch24e-master-data-guardrails.test.ts` -> passed.
- `npx vitest run __tests__/batch24c-factory-today-analytics-state.test.ts __tests__/production-mode.test.ts __tests__/p1-payroll-config-onboarding.test.ts __tests__/phase1-scope.test.ts` -> passed, 4 test files and 21 tests.

Forbidden actions:

- This original closeout did not apply the Batch 24E migration, run `npx supabase db push`, run migration repair, run `db pull`, use direct SQL, use `--include-all`, mutate production, run `npm audit`, install packages, touch the lockfile, stage env files, or stage Supabase temp files. A later production DB push incident reportedly applied the revised trigger-backed migration and is documented in the Batch 24E/24G production reconciliation entry below.
- Browser/runtime proof was not collected, so no pass-ready status is claimed.

Resolution status:

- `MASTER-002` and `MASTER-005` are documented as `code_verified` in the active matrix.
- Matrix movement is fail -2 and `code_verified` +2: total 377, pass 195, fail 17, blocked 22, `code_verified` 142, `not_applicable` 1, `not_run` 0.

## Batch 24F - Production Worker Assignment Policy Closeout

Date/time: 2026-07-05 IST. Branch `codex/batch-24f-production-worker-assignment-policy`.

Scope:

- `PROD-002`
- `PROD-004`

Rows promoted to `code_verified`, not pass:

- `PROD-002`: selected-shift worker assignment policy source-fixes day-only production. Day-shift logging no longer requires a night worker, day-only setup/checklist/activation no longer falsely fails for missing night worker, and night-shift logging without a night worker returns an actionable selected-shift accountability error.
- `PROD-004`: substitute-worker accountability source-fixes the unsupported mismatch path by returning explicit reassignment-required behavior. No unsafe substitute persistence field/model was added, and production remains attributable only to the selected standing shift worker.

Rows explicitly not closed:

- `SIGNOFF-01` is dependency-improved only and remains fail/open pending current-run sign-off browser/runtime proof.
- `SIGNOFF-02`, `AUTH-008`, `SEC-009`, `SEC-015`, `SEC-017`, `MASTER-014`, TECH/audit/dependency rows, `PAY-027`, `DASH-003`, WA/OFF rows, Golden rows, and all unapproved rows remain unchanged.

Repository state:

- Source base: `origin/main` at `0fce80a1f7c7dfb202ca24bf3a6808b3ef11fe2a`.
- Evidence artifact: `output/qa/batch24f/BATCH24F-production-worker-assignment-policy-proof.json`.

Verification:

- `git diff --check` -> passed.
- `jq empty output/qa/batch24f/BATCH24F-production-worker-assignment-policy-proof.json` -> passed.
- `npx vitest run __tests__/batch24f-production-worker-assignment-policy.test.ts` -> passed, 1 test file and 7 tests.
- `npx vitest run __tests__/batch24c-factory-today-analytics-state.test.ts` -> passed, 1 test file and 7 tests.
- `npx vitest run __tests__/batch22-production-order-boundary-hardening.test.ts` -> passed, 1 test file and 6 tests.
- `npx tsc --noEmit --pretty false` -> passed.
- Targeted ESLint on touched source/tests -> passed.
- Related production/supervisor/assignment/payroll regression pack -> passed, 9 test files and 79 tests.

Forbidden actions:

- This closeout did not create migrations, modify RPCs, apply migrations, run `npx supabase db push`, run migration repair, run `db pull`, use direct SQL, use `--include-all`, mutate production, run `npm audit`, install packages, touch the lockfile, stage env files, or stage Supabase temp files.
- Browser/runtime proof was not collected, so no pass-ready status is claimed.

Resolution status:

- `PROD-002` and `PROD-004` are documented as `code_verified` in the active matrix.
- Matrix movement is fail -2 and `code_verified` +2: total 377, pass 195, fail 15, blocked 22, `code_verified` 144, `not_applicable` 1, `not_run` 0.

## Batch 24E/24G - Production DB Push Reconciliation

Date/time: 2026-07-06 IST. Branch `codex/batch-24g-security-audit-guardrails`.

Context:

- A Supabase DB push occurred before this reconciliation while linked to production ref `vzhwahudircrpgtitwzd`.
- This is production reconciliation, not normal QA migration proof.
- Reported production remote migration history includes `20260704120000`, `20260705100000`, and `20260705182406`.
- Repository/docs/artifacts are reconciled to the production-applied migration reality.
- No rollback was attempted.
- No additional DB command, Supabase command, direct SQL, DB pull, migration repair, `--include-all`, or production mutation was run during reconciliation.

Rows promoted to `code_verified`, not pass:

- `SEC-015`: settings audit coverage is source-fixed through migration `20260705100000_batch_24g_security_audit_guardrails.sql`; follow-up migration `20260705182406_harden_settings_audit_function.sql` fixes SECURITY DEFINER search_path and direct grants. Pass still requires controlled settings-change audit-row proof with redacted payloads.
- `SEC-009`: owner data export is source-fixed with active UI wiring, owner-only server action, server-derived org scoping, audit-before-return behavior, fail-closed audit logging, and sensitive field exclusion/redaction. Pass still requires browser/security export proof plus audit-log EXPORT proof.

Rows explicitly not closed:

- `SEC-017` remains fail/open.
- `AUTH-008` remains fail/open.
- `MASTER-002` remains `code_verified/source-fixed`, not pass.
- `MASTER-005` remains `code_verified/source-fixed`, not pass.

Batch 24E migration reconciliation:

- Migration `20260704120000_batch_24e_master_data_loom_guardrails.sql` changed from a retroactive unique index to a trigger-backed duplicate guard.
- Existing duplicate production data is preserved, including reported `loom c` / `Loom C` rows.
- New normalized duplicate looms are reportedly blocked by the remote DB guard; the production duplicate `LOOM C` probe was reportedly blocked.
- The proof improved for `MASTER-002`, but controlled QA/browser/runtime proof is still required before pass.

Evidence:

- `output/qa/batch24e/BATCH24E-master-data-guardrails-proof.json`
- `output/qa/batch24g/BATCH24G-security-audit-guardrails-proof.json`
- `output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md`
- `__tests__/batch24e-master-data-guardrails.test.ts`
- `__tests__/batch24g-security-audit-guardrails.test.ts`

Safety:

- No pass-ready promotion was made.
- No secrets, env values, auth headers, tokens, cookies, request bodies, service-role keys, Supabase keys, or DB URLs were printed or committed.
- No env files, Supabase temp files, or lockfiles are part of the approved reconciliation scope.

Resolution status:

- Final matrix counts: total 377, pass 195, fail 13, blocked 22, `code_verified` 146, `not_applicable` 1, `not_run` 0.

## Runtime Proof Loop - PROD-029 Browser Copy Closeout

Date/time: 2026-07-06 IST. Branch `codex/runtime-proof-loop-code-verified-to-pass`.

Scope:

- `PROD-029`

Runtime proof:

- QA env file `.env.qa.local` was selected by filename, verified to contain the QA ref, and verified not to contain the production ref.
- Supabase CLI guard printed QA ref `eutycrtzzxmlkcpipgod` before the browser proof.
- The local app was started by explicitly sourcing `.env.qa.local` before `npm run dev`.
- Browser proof on `/`, `/#pricing`, and `/#faq` found shift meters, shift-total meters, shift meter logs, and log shift totals terminology with no raw opening/closing proof phrases and no console warnings/errors.
- Authenticated supervisor proof on `/supervisor/dashboard` reached the loaded Shift Meter Log surface and found Shift Meters / total metres produced / Save shift logs terminology with no raw opening/closing proof phrases and no console warnings/errors.
- The reusable owner tenant did not render the setup checklist panel because it was already set up; this did not block the row because the active supervisor production surface that stores synthetic readings was runtime-verified.

Evidence:

- `output/qa/runtime-proof-loop/GROUP_A-runtime-proof-20260706-PROD-029.json`
- `output/qa/runtime-proof-loop/PROD-029-landing.png`
- `output/qa/runtime-proof-loop/PROD-029-pricing.png`
- `output/qa/runtime-proof-loop/PROD-029-faq.png`
- `output/qa/runtime-proof-loop/PROD-029-supervisor-dashboard-loaded.png`

Safety:

- No production mutation occurred.
- No production Supabase command, direct SQL, migration application, npm audit, package install, lockfile change, env-file staging, or Supabase temp-file staging was used.
- No env values, secrets, auth headers, tokens, cookies, request bodies, service-role keys, Supabase keys, or DB URLs were printed or captured.

Resolution status:

- `PROD-029` moves from `code_verified` to `pass`.
- All other Group A rows remain `code_verified`.
- Group B remains unattempted in this closeout.
- Final matrix counts: total 377, pass 196, fail 13, blocked 22, `code_verified` 145, `not_applicable` 1, `not_run` 0.

## Runtime Rerun Checkpoint - 2026-07-10

State: active campaign, runtime checkpointed through queue item 20; next runtime row is queue item 21.

- Branch: `codex/estimator-production-readiness-20260710`.
- Repository commit: `cfeca96`.
- Runtime target: production-backed QA test tenants on project ref `vzhwahudircrpgtitwzd`, explicitly authorized by the user.
- Queue source: 145 historical setup-cascade rows from the prior runtime verification campaign.
- Current runtime counts: pass 8, fail 3, blocked 9, not run 125.
- Confirmed open failures: `AUTH-012`, `MASTER-006`, and `MASTER-009`.
- Revisit blockers: `AUTH-005`, `SETUP-007`, `SETUP-011`, `SETUP-012`, `MASTER-002`, `MASTER-003`, `MASTER-005`, `MASTER-011`, and `MASTER-012`.
- Batch 2 findings: `MASTER-008` passed attendance-linked daily payroll; `MASTER-009` failed because an inactive assigned worker remained visibly complete/active; `MASTER-011` and `MASTER-012` were blocked because shift-log submission returned `UPDATE requires a WHERE clause` and created no production row. The deployed activation constraint also requires both day and night assignments while current application checks allow either shift.
- Next action: continue at queue item 21. Do not attempt production-history-dependent promotion until shift-log submission is repaired and re-proven.
- Cleanup state: production QA fixtures remain intentionally present for continuation; cleanup and reconciliation are required at campaign end.

This is not a full-matrix completion or pilot-ready claim. The original 145-row failure result remains a historical setup-blocked cascade; only rows with direct runtime evidence were reclassified. Current formal matrix totals are total 377, pass 204, fail 16, blocked 31, `code_verified` 125, and `not_applicable` 1.

## Runtime Rerun Checkpoint - Batch 3

State: active campaign, checkpointed through queue item 30; next is queue item 31 (`EST-014`).

- Batch 3 moved ten rows to `pass`: `MASTER-013`, `MASTER-015`, `EST-002`, `EST-004`, `EST-006`, `EST-007`, `EST-008`, `EST-009`, `EST-010`, and `EST-013`.
- No Batch 3 row was failed or blocked.
- Runtime counts: pass 18, fail 3, blocked 9, not run 115.
- Formal matrix totals: total 377, pass 214, fail 16, blocked 31, `code_verified` 115, `not_applicable` 1.
- Continue at queue item 31. A shared prerequisite defect remains `blocked`, not `fail`.

## Runtime Rerun Checkpoint - Batch 4

State: active campaign, checkpointed through queue item 40; next is queue item 41 (`ORDER-010`).

- Batch 4 results: pass 5, fail 1, blocked 4.
- Pass: `EST-015`, `EST-017`, `EST-018`, `QUOTE-004`, and `QUOTE-006`.
- Fail: `EST-014`; the unique unsaved estimator quality disappeared after refresh and no restore prompt appeared.
- Blocked: `QUOTE-007`, `ORDER-005`, `ORDER-007`, and `ORDER-009`. `QUOTE-007` has no deployed Start Party Order fast-path UI caller. The order rows require production history that cannot be created while shift-log submission returns `UPDATE requires a WHERE clause`.
- Runtime counts: pass 23, fail 4, blocked 13, not run 105.
- Formal matrix totals: total 377, pass 219, fail 17, blocked 35, `code_verified` 105, `not_applicable` 1.
- Continue at queue item 41. Shared-defect prerequisites remain `blocked`, not `fail`.

## Runtime Rerun Checkpoint - Batch 5

State: active campaign, checkpointed through queue item 50; next is queue item 51 (`PROD-004`).

- Batch 5 results: pass 0, fail 0, blocked 10.
- Blocked: `ORDER-010`, `ORDER-011`, `ORDER-012`, `ORDER-013`, `ORDER-014`, `ORDER-015`, `MARKET-009`, `MARKET-010`, `MARKET-013`, and `PROD-002`.
- Tenant-scoped reconciliation found zero production logs, stock lots, stock sales, dispatches, discrepancies, receivables, and payroll settlements. Orders were all 0m/Pending Setup, the only market run was 0m with no sales, and supervisor runtime showed 0/0 assigned looms with shift submission disabled.
- These rows are blocked by missing runtime prerequisites caused by the deployed production activation/submission defects; none were classified as fail.
- Runtime counts: pass 23, fail 4, blocked 23, not run 95.
- Formal matrix totals: total 377, pass 219, fail 17, blocked 45, `code_verified` 95, `not_applicable` 1.
- Continue at queue item 51 and execute validation-only supervisor rows where the broken persistence prerequisite is not needed.

## Runtime Rerun Checkpoint - Batch 6

State: active campaign, checkpointed through queue item 60; next is queue item 61 (`PROD-019`).

- Batch 6 results: pass 0, fail 0, blocked 10.
- Blocked: `PROD-004`, `PROD-005`, `PROD-006`, `PROD-007`, `PROD-010`, `PROD-011`, `PROD-013`, `PROD-014`, `PROD-017`, and `PROD-018`.
- A prefixed loom was linked to the active QA market run and saved with a substitute day-worker assignment. The owner UI briefly rendered Active, but the database remained `status = inactive`; supervisor runtime consequently remained 0/0 assigned with No looms found and disabled shift submission.
- All row-specific production-entry and correction controls were unreachable because of this deployed activation-persistence defect. Historical rows were also blocked by zero production logs.
- Runtime counts: pass 23, fail 4, blocked 33, not run 85.
- Formal matrix totals: total 377, pass 219, fail 17, blocked 55, `code_verified` 85, `not_applicable` 1.
- Continue at queue item 61. Production form/history rows remain blocked until authoritative loom activation and shift submission are repaired.

## Runtime Rerun Checkpoint - Batch 7

State: active campaign, checkpointed through queue item 70; next is queue item 71 (`STOCK-007`).

- Batch 7 results: pass 1, fail 0, blocked 9.
- `STOCK-004` passed with tenant-scoped opening, manual, market-run, order-reserved, and adjustment source records; source IDs, purposes, quantities, and movement deltas reconciled.
- `STOCK-005` is blocked. The UI omitted other-tenant sources, but an authenticated injected-ID attempt was rejected by the Full Suite subscription gate before cross-org source validation could be observed. No probe row persisted and the disposable QA-org-A order was deleted.
- `PROD-019`, `PROD-022`, `PROD-023`, `PROD-024`, `PROD-025`, `PROD-026`, `PROD-027`, and `PROD-030` remain blocked by the activation-persistence defect.
- Runtime counts: pass 24, fail 4, blocked 42, not run 75.
- Formal matrix totals: total 377, pass 220, fail 17, blocked 64, `code_verified` 75, `not_applicable` 1.
- Continue at queue item 71. The new QA stock fixtures enable stock, sale, and dispatch rows that do not require shift production.

## Runtime Rerun Checkpoint - Batch 8

State: active campaign, checkpointed through queue item 80; next is queue item 81 (`DISP-012`).

- Batch 8 results: pass 5, fail 3, blocked 2.
- Pass: `STOCK-007`, `STOCK-010`, `STOCK-013`, `SALE-011`, and `SALE-016`.
- Fail: `SALE-010`, `SALE-012`, and `SALE-014`. Sell & Dispatch silently produced sale-only pending state; no explicit partial-success message appeared. A later dispatch date entered as 2026-07-12 was persisted as 2026-07-11, so the zero-credit due date also started early.
- Blocked: `STOCK-009` because the credential-backed concurrency client could not resolve the browser tenant, and `STOCK-011` because completed/cancelled order-stock policy requires the blocked production lifecycle.
- Runtime counts: pass 29, fail 7, blocked 44, not run 65.
- Formal matrix totals: total 377, pass 225, fail 20, blocked 66, `code_verified` 65, `not_applicable` 1.
- Continue at queue item 81 using the newly created dispatch and receivable fixtures.

## Runtime Rerun Checkpoint - Batch 9

State: active campaign, checkpointed through queue item 90; next is queue item 91 (`PAY-006`).

- Batch 9 results: pass 5, fail 0, blocked 5.
- Pass: `DISP-012`, `COMM-003`, `COMM-009`, `COMM-018`, and `PAY-005`.
- `DISP-012` closed only the selected 40m batch; the 125m batch remained in transit. Commercial totals reconciled to Rs.4,675 revenue/receivable, Rs.3,521 cost, and Rs.1,154 profit. Bank, cash, UPI, cheque, and other receipts normalized correctly.
- Blocked: `DISP-017`, `DISP-018`, `COMM-013`, `COMM-015`, and `PAY-002`. Month-start/end dates were overwritten to the current date, so the boundary test could not be executed and was not failed.
- Runtime counts: pass 34, fail 7, blocked 49, not run 55.
- Formal matrix totals: total 377, pass 230, fail 20, blocked 71, `code_verified` 55, `not_applicable` 1.
- Continue at queue item 91 with payroll boundary and advance scenarios.

## Runtime Rerun Checkpoint - Batch 10

State: active campaign, checkpointed through queue item 100; next is queue item 101 (`PAY-026`).

- Batch 10 results: pass 0, fail 0, blocked 10.
- Blocked: `PAY-006`, `PAY-010`, `PAY-011`, `PAY-012`, `PAY-014`, `PAY-017`, `PAY-019`, `PAY-021`, `PAY-022`, and `PAY-025`.
- Future attendance is capped at today, but the owner QA session cannot prove supervisor past-date access-code behavior. Production logs, worker advances, and payroll settlements remain empty, blocking all settlement/recovery/correction scenarios. February/leap-year cycles are not safely selectable in runtime.
- Runtime counts: pass 34, fail 7, blocked 59, not run 45.
- Formal matrix totals: total 377, pass 230, fail 20, blocked 81, `code_verified` 45, `not_applicable` 1.
- Continue at queue item 101 with worker-exit, Kharchi, dashboard, and realtime scenarios.

## Runtime Rerun Checkpoint - Batch 11

State: active campaign, checkpointed through queue item 110; next is queue item 111 (`DASH-010`).

- Batch 11 results: pass 2, fail 1, blocked 7.
- Pass: `DASH-002` and `DASH-009`. Factory Today reflected current state without false production, and the cancelled order was excluded from active Health Index cards.
- Fail: `DASH-004`. Selecting 10 Jul retained Today 11 Jul live values, current active cards, a trend ending 11 Jul, and Today's workers.
- Blocked: `PAY-026`, `PAY-027`, `DASH-001`, `DASH-003`, `DASH-005`, `DASH-006`, and `DASH-008`. The live feed remained in reconnecting state and production-dependent fixtures remain unavailable.
- Runtime counts: pass 36, fail 8, blocked 66, not run 35.
- Formal matrix totals: total 377, pass 232, fail 21, blocked 88, `code_verified` 35, `not_applicable` 1.
- Continue at queue item 111 with large-range dashboard and WhatsApp scenarios.

## Runtime Rerun Checkpoint - Batch 12

State: active campaign, checkpointed through queue item 120; next is queue item 121 (`BILL-004`).

- Batch 12 results: pass 0, fail 0, blocked 10.
- Blocked: `DASH-010`, `WA-001`, `WA-002`, `WA-003`, `WA-004`, `WA-005`, `WA-006`, `WA-007`, `WA-009`, and `BILL-002`.
- No live WhatsApp, access-code delivery, or provider failure was attempted. Safe simulator/business fixtures are unavailable. Billing is reachable and shows an active Full Suite annual plan, but no Base-tier QA tenant exists for the comparison matrix.
- Runtime counts: pass 36, fail 8, blocked 76, not run 25.
- Formal matrix totals: total 377, pass 232, fail 21, blocked 98, `code_verified` 25, `not_applicable` 1.
- Continue at queue item 121 with webhook, referral, offline, and timezone rows.

## Runtime Rerun Closeout - Batches 13-15

State: complete. All 145 runtime-rerun queue rows now have a terminal `pass`, `fail`, or `blocked` result; no `not_run` or formal `code_verified` rows remain.

- Batch 13: 0 pass, 0 fail, 10 blocked (`BILL-004`, `BILL-005`, `BILL-008`, `OFF-001`, `OFF-003`, `OFF-004`, `TIME-003`, `TIME-004`, `SEC-007`, `SEC-009`). Live payment-webhook/security probes were not run, offline/calendar fixtures were unavailable, and the export control was not stable in the hydrated Settings DOM.
- Batch 14: 2 pass (`UX-002`, `UX-005`), 0 fail, 8 blocked (`SEC-010`, `SEC-012`, `SEC-013`, `SEC-015`, `UX-001`, `UX-003`, `UX-004`, `UX-006`). Destructive or adversarial production-backed probes remained blocked; exact correction/reversal/deletion/write-off audit coverage was not safely reproducible.
- Batch 15: 1 pass (`UX-008`), 1 fail (`UX-007`), 3 blocked (`UX-009`, `UX-010`, `UX-011`). `UX-007` failed because critical Settings rate spinbuttons and optional-section switches were unnamed in the accessibility tree.
- Final runtime ledger: pass 39, fail 9, blocked 97, not run 0.
- Final formal matrix: total 377, pass 235, fail 22, blocked 119, `code_verified` 0, `not_applicable` 1.
- Evidence: `output/qa/runtime-rerun-20260710/results.json`, `QUEUE.md`, `CHECKPOINT.json`, `batch-13-summary.json`, `batch-14-summary.json`, `batch-15-summary.json`, and `evidence/batches-13-15-final-security-ux.json`.
- Safety: no live payment purchase, webhook replay/signature attack, WhatsApp send, destructive erasure, stored-XSS payload, CSRF attack, backup/restore, or broad load test was executed.

The runtime-rerun campaign is complete as a classification exercise. It is not a pilot-ready claim: the nine runtime failures require repair/retest, and blocked rows require safe prerequisites, disposable fixtures, external access, or explicit de-scope.

## Runtime Remediation Campaign - UX-007 Closeout

Date/time: 2026-07-11 02:55 IST. Branch `codex/estimator-production-readiness-20260710`.

- `UX-007` moved from fail to pass after fresh QA browser proof.
- `components/settings/factory-cost-profile.tsx` now programmatically associates every rate label with its number input and every section label/description with its switch.
- Browser proof on `/owner/settings` found four named spinbuttons and five named switches; the Winding switch changed `unchecked → checked → unchecked`; console warnings/errors were empty.
- Evidence: `output/qa/runtime-remediation-20260711/RUNTIME_EVIDENCE.md` and `UX-007-settings-accessible-controls.png`.
- Isolated QA fixture was deleted by exact IDs after proof.
- Validation: focused Vitest 2/2, targeted ESLint, TypeScript, and `git diff --check` passed.
- Formal matrix: total 377, pass 236, fail 21, blocked 119, not applicable 1, code verified 0, not run 0.

## Runtime Remediation Campaign - EST-014 Closeout

Date/time: 2026-07-11 03:24 IST. Branch `codex/estimator-production-readiness-20260710`.

- `EST-014` moved from fail to pass after fresh isolated QA browser proof.
- A unique customer value survived the autosave debounce and page refresh; the `Unsaved draft` prompt appeared, and Restore repopulated the exact value.
- Evidence: `output/qa/runtime-remediation-20260711/RUNTIME_EVIDENCE.md` and `EST-014-draft-restore.png`.
- The isolated QA subscription, profile, organization, auth user, and temporary credential file were deleted by exact IDs after proof.
- Formal matrix: total 377, pass 237, fail 20, blocked 119, not applicable 1, code verified 0, not run 0.

## Runtime Remediation Campaign - MASTER-009 Closeout

Date/time: 2026-07-11 11:47 IST. Branch `codex/estimator-production-readiness-20260710`.

- `MASTER-009` moved from fail to pass after fresh QA database and browser proof.
- Deactivating the assigned day worker changed the loom from active to inactive while retaining both standing assignment rows; the active/inactive assignment split became 1/1.
- `/owner/machines` displayed the loom Inactive, the day slot as Assign Worker, and the active night worker unchanged. Factory Today reported zero active looms.
- Evidence: `output/qa/runtime-remediation-20260711/RUNTIME_EVIDENCE.md` and `MASTER-009-worker-deactivation.png`.
- Exact fixture cleanup was verified at zero rows before deleting the isolated tenant and authentication fixture.
- Validation: focused Vitest 16/16, targeted ESLint, TypeScript, migration runtime proof, and advisor review passed for the change.
- Formal matrix: total 377, pass 238, fail 19, blocked 119, not applicable 1, code verified 0, not run 0.

## Runtime Remediation Campaign - SALE-010 / SALE-012 Closeout

Date/time: 2026-07-11 12:06 IST. Branch `codex/estimator-production-readiness-20260710`.

- `SALE-010` and `SALE-012` moved from fail to pass after clean-build isolated QA browser and database proof.
- The restored Dispatch now path created one sale and one dispatch atomically. A 2026-07-12 dispatch date for a 2026-07-11 sale persisted in both records, and two credit days produced a 2026-07-14 receivable due date.
- The corrected transaction reconciled 20m sold, 20m dispatched, 0m pending, ₹1,600 receivable, and the expected stock decrement.
- Evidence: `output/qa/runtime-remediation-20260711/RUNTIME_EVIDENCE.md` and `SALE-010-012-corrected-dispatch-date.png`.
- Exact fixture cleanup was verified at zero business rows before deleting the isolated tenant/auth fixture.
- `SALE-014` remains fail: the defensive recoverable warning is source-tested but has not yet been exercised with an injected post-sale dispatch failure.
- Formal matrix: total 377, pass 240, fail 17, blocked 119, not applicable 1, code verified 0, not run 0.

## Runtime Remediation Campaign - DASH-004 Closeout

Date/time: 2026-07-11 12:31 IST. Branch `codex/estimator-production-readiness-20260710`.

- `DASH-004` moved from fail to pass after clean-build isolated QA browser proof.
- Selecting 2026-07-10 produced a Selected Date · 10 Jul KPI, a trend bounded exactly to 4–10 Jul, and Workers · 10 Jul wording.
- Live-only Today KPI, quick actions, current order/machine cards, and Today's workers wording were absent. Browser warnings/errors were empty.
- Evidence: `output/qa/runtime-remediation-20260711/RUNTIME_EVIDENCE.md` and `DASH-004-historical-date.png`.
- The exact isolated tenant/auth fixture was deleted after proof.
- Formal matrix: total 377, pass 241, fail 16, blocked 119, not applicable 1, code verified 0, not run 0.

## Runtime Remediation Campaign - MASTER-006 Contract Disposition

Date/time: 2026-07-11 12:39 IST. Branch `codex/estimator-production-readiness-20260710`.

- `MASTER-006` moved from fail to blocked; it did not receive pass credit.
- The obsolete worker-master rate expectation was rewritten to the authoritative decimal machine-assignment rate → production snapshot → payroll invariant.
- Shared QA lacks the machine-operator payroll schema chain, while applying its broad migration/backfill would exceed the isolated-fixture safety boundary.
- Dependency: `ROOT-QA-MACHINE-OPERATOR-SCHEMA-PARITY`; proof requires a disposable schema-parity environment plus historical-rate immutability verification.
- Formal matrix: total 377, pass 241, fail 15, blocked 120, not applicable 1, code verified 0, not run 0.

## Runtime Remediation Campaign - SALE-014 Closeout

Date/time: 2026-07-11 13:57 IST. Branch `codex/estimator-production-readiness-20260710`.

- `SALE-014` moved from fail to pass after isolated QA dispatch-stage fault injection.
- The browser displayed an explicit atomic rollback message and kept the workflow open for correction.
- Database proof showed the 100m stock lot unchanged and zero sales, dispatches, receivables, stock movements, or parties.
- The exact temporary trigger/function and all business/auth fixtures were verified removed after proof.
- Evidence: `output/qa/runtime-remediation-20260711/RUNTIME_EVIDENCE.md` and `SALE-014-atomic-rollback.png`.
- Formal matrix: total 377, pass 242, fail 14, blocked 120, not applicable 1, code verified 0, not run 0.

## Runtime Remediation Campaign - Release Gate Closeout

Date/time: 2026-07-11 IST. Branch `codex/estimator-production-readiness-20260710`.

- `TECH-001`, `TECH-005`, and `TECH-006` moved from fail to pass.
- The stale package lock was repaired; final `npm ci` installed 1,088 packages successfully.
- Safe non-force advisory remediation removed the high-severity `form-data` and `hono` findings.
- Runtime-only and full audits both passed `--audit-level=high` with zero high/critical findings; two moderate PostCSS/Next entries remain below the gate.
- TypeScript passed, the full suite passed 71 files / 559 tests with 1 intentional skip, and the Next 16.2.10 production build completed successfully after its prebuild test rerun.
- Formal matrix: total 377, pass 245, fail 11, blocked 120, not applicable 1, code verified 0, not run 0.

## Runtime Remediation Campaign - AUTH-008 Closeout

Date/time: 2026-07-11 IST. Branch `codex/estimator-production-readiness-20260710`.

- `AUTH-008` moved from fail to pass.
- Both service-role join-code validation and final supervisor join now use dedicated fail-closed IP rate-limit buckets.
- Focused tests passed 14/14; lint, TypeScript, and diff checks passed.
- Fresh QA Redis proof allowed the first 10 requests for a unique synthetic key and rejected request 11; no tenant or account mutation occurred and the key expires automatically.
- Formal matrix: total 377, pass 246, fail 10, blocked 120, not applicable 1, code verified 0, not run 0.

## Runtime Remediation Campaign - OFF-007 Diagnostic Reproof

Date/time: 2026-07-11 IST. Branch `codex/estimator-production-readiness-20260710`.

- This initial `OFF-007` diagnostic remained fail; no pass credit was taken at this point.
- Production-mode QA builds produced different build IDs and service-worker hashes. The exact active estimator draft survived and was offered for restore after each reload.
- The required App update ready / save-before-refresh notice did not appear in single-client or held-second-client update runs.
- A follow-up source fix now explicitly checks `registration.update()` after attaching lifecycle listeners; focused tests/lint/typecheck pass, but the row remains failed pending a fresh two-build runtime reproof.
- Exact QA fixture cleanup, browser cleanup, and server shutdown were verified.
- Formal matrix at the diagnostic checkpoint remained total 377, pass 246, fail 10, blocked 120, not applicable 1, code verified 0, not run 0.

## Runtime Remediation Campaign - OFF-007 Successful Closeout

Date/time: 2026-07-11 IST. Branch `codex/estimator-production-readiness-20260710`.

- `OFF-007` moved from fail to pass after the active client began explicitly checking `registration.update()` after lifecycle listeners were attached.
- Fresh two-build production-mode QA proof held a second old-version client active and showed App update ready, save-before-refresh guidance, the exact unique draft marker, and Restore together in the fixed primary client.
- The update remained waiting; no forced reload/activation occurred.
- Exact QA fixture cleanup and browser/server shutdown were verified.
- Formal matrix: total 377, pass 247, fail 9, blocked 120, not applicable 1, code verified 0, not run 0.

## Runtime Remediation Campaign - MASTER-014 Closeout

Date/time: 2026-07-11 IST. Branch `codex/estimator-production-readiness-20260710`.

- `MASTER-014` moved from fail to pass.
- A forward transactional RPC now serializes complete dated/standing loom context under a machine row lock and validates tenant, role, lockdown, active worker, and active order boundaries.
- The owner standing-worker path now uses an unconditional unique-key upsert rather than a stale client existence branch.
- Four focused files passed 24 tests; lint, TypeScript, and diff checks passed.
- Fresh isolated QA owner/supervisor concurrency proof produced one complete last-writer context; injected standing-write failure rolled the transaction back without mixed state.
- The RPC now runs as `SECURITY INVOKER` under caller RLS with anon execute denied.
- Exact fixture and temporary fault-object cleanup were verified.
- Formal matrix: total 377, pass 249, fail 7, blocked 120, not applicable 1, code verified 0, not run 0.

## Runtime Remediation Campaign - SEC-017 Closeout

Date/time: 2026-07-11 IST. Branch `codex/estimator-production-readiness-20260710`.

- `SEC-017` moved from fail to pass.
- New worker rows now require durable DOB verification provenance at the database boundary; under-18 and incomplete evidence inserts are rejected.
- Shared dialog, onboarding bulk/manual, supervisor actions, and owner fixed-worker creation all supply provenance atomically with the worker insert.
- Focused tests passed 4/4; lint, TypeScript, and diff checks passed.
- Fresh isolated QA proof created two verified adult workers through the owner UI and read back DOB, method, evidence reference, timestamp, and owner verifier. Under-age and missing-provenance inserts were rejected with zero rows.
- Exact dependency-ordered cleanup verified organization, profile, subscription, machines, workers, orders, and auth user at zero.
- Formal matrix: total 377, pass 248, fail 8, blocked 120, not applicable 1, code verified 0, not run 0.

## Runtime Remediation Campaign - Full Regression Gate

Date/time: 2026-07-11 IST. Branch `codex/estimator-production-readiness-20260710`.

- Full Vitest passed 74 files / 570 tests with 1 intentional skip; Next 16.2.10 production build passed after its full prebuild test rerun.
- Full lint initially exposed ignored scratch utilities and three warnings; the lint boundary/type warnings were repaired.
- Final full `npm run lint` and `git diff --check` passed with zero errors and zero warnings.
- No formal count change; matrix remains total 377, pass 247, fail 9, blocked 120, not applicable 1.

## Runtime Remediation Campaign - TECH-009 Closeout

Date/time: 2026-07-11 IST. Branch `codex/estimator-production-readiness-20260710`.

- `TECH-009` moved from fail to pass after deployed QA webhook v2 proved missing verification/signing configuration fails closed with intentional HTTP 500 responses.
- The fallback verification token was removed and covered by 7 focused tests.
- `WA-008` remains fail because QA lacks `META_APP_SECRET` and valid signed delivery-row update proof.
- Formal matrix: total 377, pass 250, fail 6, blocked 120, not applicable 1, code verified 0, not run 0.

## Runtime Remediation Campaign - SIGNOFF-01 / SIGNOFF-02 Closeout

Date/time: 2026-07-13 IST. Branch `codex/estimator-production-readiness-20260710`.

- `SIGNOFF-01` and `SIGNOFF-02` moved from fail to pass after a Factory Today read-model defect was reproduced and repaired.
- The dashboard had requested nonexistent direct `production_logs.market_run_id` and `production_logs.created_at` columns. It now reads market-run attribution through the order relationship and uses `submitted_at`.
- Fresh isolated QA owner proof displayed 50m and `Factory is clear today.` Database reconciliation proved exactly one active/accounted loom, matching log/loom/dated-assignment order, matching day worker, a valid active order, and complete standing assignments.
- Browser console warnings/errors were empty. Full Vitest passed 75 files / 580 tests; TypeScript and the QA-pinned Next 16.2.10 production build passed.
- Exact fixture rows, auth user, temporary credential file, browser tabs, and local server were cleaned up.
- Formal matrix: total 377, pass 252, fail 4, blocked 120, not applicable 1, code verified 0, not run 0.

## Runtime Remediation Campaign - AUTH-012 Production Closeout

Date/time: 2026-07-13 IST. Branch `codex/estimator-production-readiness-20260710`.

- Production inspection confirmed `Lookup org by join code` was a permissive public organization SELECT policy with predicate `true`.
- The identified real account's auth/profile/organization ownership relationship was compatible with the replacement policy; its tenant was not mutated.
- Applied only migration `20260710210828`, recorded the exact production migration history entry, and verified the organization policy catalog now contains only authenticated tenant SELECT and owner tenant UPDATE.
- Fresh isolated production proof passed own organization read/update, hid guessed cross-tenant organization/profile/machine IDs, denied target organization/machine mutations, and verified target persistence was unchanged.
- Exact fixture cleanup returned organizations, profiles, machines, and auth users to zero.
- `AUTH-012` moved from fail to pass. Formal matrix: total 377, pass 253, fail 3, blocked 120, not applicable 1, code verified 0, not run 0.

## Formal Blocked-Row Batch 2 Closeout

Date/time: 2026-07-13 IST. Branch `codex/estimator-production-readiness-20260710`.

- Passed: `SETUP-012`, `DASH-001`, `BILL-002`, `UX-004`, and `UX-011`.
- Proof: isolated active Base/Premium subscriptions, Premium owner/supervisor role pair, empty-tenant database aggregates, 390x844 mobile navigation/logout, reciprocal role redirect/copy, and real old-versus-current join-code validation.
- Safety: no production data; exact QA subscriptions, profiles, organizations, auth users, and private credential file reconciled to zero/removed; browser and local server closed.
- Blocked/debugging: `SEC-009` remains blocked because the fresh Premium Settings route rendered blank main content without a console explanation. `NEEDS-AUDIT-002` also requires semantic review of legacy pass rows whose Actual text conflicts with the expectation.
- Current formal matrix: total 377, pass 258, fail 3, blocked 115, not applicable 1, code verified 0, not run 0.
- Next action: continue blocked-row batches from isolated-fixture/test-harness candidates while separately debugging the Settings render path and formally reconciling contradictory legacy pass labels before any pilot-ready claim.

## Formal Blocked-Row Batch 3 Closeout

Date/time: 2026-07-13 IST. Branch `codex/estimator-production-readiness-20260710`.

- Passed: `UX-003`, `BILL-008`, and `AUTH-015`.
- Fixes: referral application now performs its guarded server-only insert with the admin client after trusted org derivation; authenticated request handling now enforces the existing one-hour Redis user-revocation marker before loading authorization state.
- Runtime proof: join validation retained name/email/phone with no partial account; referral valid/self/duplicate cases reconciled to exactly one cross-org relationship; two independent sessions moved from protected HTTP 200 to denied 307/401 while their Supabase JWTs still validated.
- Regression: focused 2-file pack passed 5/5; targeted ESLint passed; full TypeScript and closeout consistency checks are recorded in the campaign evidence.
- Safety: QA-only fixture; referral rows/codes, Redis marker, subscriptions, profiles, organizations, auth users, private credential file, browser tabs, and local server all reconciled to zero/removed.
- Current formal matrix: total 377, pass 261, fail 3, blocked 112, not applicable 1, code verified 0, not run 0.
- Next action: select the next isolated-fixture candidates while keeping the Settings render/audit issue and legacy pass-label audit open.

## Production checkpoint — 2026-07-13

- Pushed source commit: `40b414a6ed7b9285048045c118074d8e0d010065` on `codex/estimator-production-readiness-20260710`.
- Production Supabase is aligned through migration `20260711180000`; the five checkpoint migrations were applied after a zero-affected-row reconciliation check for the broad loom-deactivation migration.
- Production `whatsapp-webhook` is active at version 16. Vercel deployment `dpl_4pP8ovMPoS1tCwAcp9RZQL5gNfnY` is Ready at `https://textile-accounting.vercel.app`.
- Public-route and auth-boundary smoke passed. Full tests, lint, TypeScript, production build, remote build, source-map upload, and diff checks passed.
- Six legacy stored functions remain in `Needs formal audit/debugging`; no pass credit was claimed for them.
- Current formal matrix remains total 377, pass 266, fail 3, blocked 107, not applicable 1. Next action is user live testing, followed by the next blocked-row batch.

## Formal blocked-row Batch 7 closeout

Date/time: 2026-07-13 IST. Branch `codex/estimator-production-readiness-20260710`.

- Passed: `PROD-002`, `PROD-004`, and `MASTER-012`.
- Fix/deployment: production migration `20260713124500` replaced the two-shift activation requirement with active order plus at least one active shift worker; dry-run and apply each contained only this migration, and production now aligns through that head.
- Runtime: one day-only loom submitted 40m with Worker A/Context A/₹2.50. The owner then linked Context B and assigned Worker B to night at ₹3.25; the supervisor submitted 55m. Refresh, two independent logs, two matching reserved stock grains, and ₹278.75 payroll basis all reconciled.
- Safety: exact prefixed production tenant, rows, credentials, and browser tabs were removed or closed; organization/profile/machine/log/auth counts returned to zero.
- Audit/debugging: `NEEDS-AUDIT-004` captures the historical-date reset. `MASTER-011` and other dated-shift/correction rows remain blocked until that state overwrite is repaired and re-proven.
- Current formal matrix: total 377, pass 269, fail 3, blocked 104, not applicable 1. Next action is a focused historical-date/draft-state repair batch; readiness remains No-Go.

### Formal blocked-row Batch 8 dated substitution closeout

`MASTER-011` is `PASS`. Production now treats a persisted dated shift assignment as the authoritative worker and rate for that one date/shift, validates it server-side, uses the order business start date for historical logging, and exposes deterministic previous/next production-day controls. Isolated proof saved and refreshed a 2026-07-12 32m Worker B log while Worker A remained standing, reconciled the generated stock, and showed Worker B-only payroll at ₹104. `NEEDS-AUDIT-004` is resolved for this root. `PROD-017`, `PROD-018`, `PAY-006`, `TIME-003`, and `TIME-004` remain blocked under their own unexecuted scenarios. Current counts: 270 pass, 3 fail, 103 blocked, 1 not applicable; No-Go unchanged.

### Blocked-row campaign B09 complete; B10 active

B09 is closed at 17/17 pass on exact production deployment `dpl_EPGVy9PMbaLLphgssXvBq9HgD5yB` / commit `812512c599b3659cc399495a674e8b3e50066e60`. The production fixture and all three auth users reconciled to zero. Current counts are 287 pass, 3 fail, 86 blocked, and 1 not applicable.

The active batch is B10: `PROD-017`, `PROD-018`, `PROD-019`, `PAY-006`, `PAY-022`, `COMM-013`, `TIME-003`, and `TIME-004`. Create a fresh disposable fixture and directly execute correction-window open/closed behavior, access-code use/consume/expiry, settled-period protection, and India month/year/leap-day boundaries. Do not inherit B09 pass credit into any B10 row.

### Blocked-row campaign B10 complete; B11 active

B10 is closed at 8/8 pass on exact production deployment `dpl_5rKpnNLwszpfgfzkn8VBh291wyS6` / commit `fd1c367665455ca2bc66ca54d81a9cc259147284`. Migration `20260714005500_b10_enforce_attendance_date_lockdown.sql` is applied in QA and production, with production history version `20260713193455`. Runtime proof covers expired-window correction, invalid/expired/used/fresh code behavior, settled-payroll protection, past attendance with owner authorization, future-date denial, India month endpoints, year rollover, leap day, and corrected retry wording. Exact fixture cleanup reconciled organizations, profiles, logs, attendance, payments, and auth users to zero.

Current counts are 295 pass, 3 fail, 78 blocked, and 1 not applicable. The active batch is B11. Use the canonical inventory/checkpoint to execute its 12 rows with fresh isolated fixtures and promote only exact runtime-proven outcomes; B10 pass credit must not be inherited.

### Blocked-row campaign B11 complete; B12 active

B11 is closed at 12/12 pass on exact production deployment `dpl_HQbasVXv3NDZjrtVjoXjpebgtbGV` / commit `dc76b17f38eb111ef3dad0a5a9f809b17168cda5`. Production proved the exposed atomic Start Party Order UI plus reciprocal quote/order and yarn-requirement persistence. The isolated QA chain passed 34 lifecycle assertions spanning target enforcement, completion, cancellation, protected deletion, reserved stock, dispatch/receipt discrepancy, commercial settlement, payroll, and reload/session reconciliation. Cleanup removed and reconciled both disposable environments.

Current counts are 307 pass, 3 fail, 66 blocked, and 1 not applicable. B12 is active with 10 stock concurrency, market closure, dispatch compliance, and commercial identity rows; B11 pass credit must not be inherited by those scenarios.

### Blocked-row campaign B12 complete; B13 active

B12 is closed at 10/10 pass on exact production deployment `dpl_q1bQa4dHd9bFKFU8ZphcVQNcE2d1` / commit `bc1e9cbfab1609adf461c405e41d6fca65b304ee`. Matching QA and production runs each passed 17 assertions for source integrity, market sell-out/archive, two-batch dispatch and receipt, honest compliance reminders, duplicate party identity, concurrent stock mutation, and many-run freshness. The stock-source trigger and stock-sale-aware market summary are applied in both environments, and all disposable records/auth users reconciled to zero.

Current counts are 317 pass, 3 fail, 56 blocked, and 1 not applicable. B13 is active with 16 payroll, advances, kharchi, dashboard-wage, and Golden A/B worker-money rows. Build a fresh isolated fixture and promote only directly proven B13 outcomes; B12 pass credit must not be inherited.

### Blocked-row campaign B13 complete; B14 active

B13 is closed at 16/16 pass on exact production deployment `dpl_EBYTZG33aozbGbPLpYeAWQcF4JJD` / commit `d42d5138fba22758f1d11218c59deb6c3ad876a3`. QA runtime/browser and production runtime proved decimal and historical rate snapshots, recovery caps, direct-delete protection, serialized settlement, exact reversal, itemized adjustments, scheduled/overdue cycle state, atomic final exit, supervisor Kharchi, Factory Today wage signals, and the shared Golden A/B payslip. Migration `20260714043000_b13_harden_payroll_settlement_lifecycle.sql` is applied in both environments; all disposable records and auth users reconciled to zero.

Current counts are 333 pass, 3 fail, 40 blocked, and 1 not applicable. B14 is active with `DASH-005`, `DASH-006`, `DASH-008`, `DASH-010`, and `UX-010`. Audit realtime subscription/refetch behavior, disconnect/reconnect recovery, independent pace calculations, large-range timing, and distinct empty/loading/error/offline states; B13 pass credit must not be inherited.

### Blocked-row campaign B14 complete; B15 active

B14 is closed at 5/5 pass on exact production deployment `dpl_3Xb6mYaqnG5FRpye7ULVWcxq9ttq` / commit `6f80eac94d950460bf559583dbb18ef434afde00`. QA runtime/browser proved no-reload realtime refresh without double counting, disconnect/reconnect recovery to authoritative truth, injected source-error recovery, offline/empty/live states, and exact pace arithmetic. QA and production returned the complete 90-day/1,800-log range below two seconds. Migration `20260714053000_b14_repair_worker_breakdown_timestamp.sql` is applied in both environments; all disposable records and auth users reconciled to zero.

Current counts are 338 pass, 3 fail, 35 blocked, and 1 not applicable. B15 is active with eleven authentication, privacy, audit, adversarial UX, and PWA rows. Begin with isolated QA accounts and promote only directly executed outcomes; B14 pass credit must not be inherited.

### Blocked-row campaign B15 executable scope complete; B16 active

B15 closes ten rows on exact production deployment `dpl_CmFozomMsAhE36kvGUMQiPwJpsFr` / commit `2e3254f75502ca56192d015c06bba4f7972518aa`. QA browser/HTTP/database and production database proof covered recovery tokens, idle expiry, proxy rate-limit identity, cross-origin mutation rejection, scoped export/audit, atomic erasure/redaction, stored hostile markup, audit context, keyboard semantics, and 200%-equivalent layouts. Migrations `20260714063000_b15_atomic_worker_erasure.sql` and `20260714064500_b15_scope_production_log_triggers.sql` are deployed in both environments; all disposable records and auth users reconciled to zero.

`OFF-001` remains blocked only because available browser tooling cannot install and reopen the PWA in standalone mode; its manifest, icons, scope, `/login` start route, update notice, and refresh activation passed. Current counts are 348 pass, 3 fail, 25 blocked, and 1 not applicable. B16 is active with nine WhatsApp simulation/provider rows; B15 pass credit must not be inherited.

### Blocked-row campaign B16 executable scope complete; B17 active

B16 closes eight rows on exact production deployment `dpl_HSVWPpa4zPnR3gfEqXB1h3c55p4y` / commit `ee2af23a31e648880bdf3810f9cacb545cefcedd`. Nine disposable-QA runtime assertions proved exact consent/phone binding, durable prerequisite skips, core-write isolation from provider timeout, payslip and access-code privacy, independent daily/monthly/deadline cooldowns, targeted tenant-safe retry, and clear rejection/expired-token fallback logs. Migration `20260714073000_b16_whatsapp_delivery_boundaries.sql` is deployed in QA and production, with production history version `20260713235949`; six production edge functions are active at their recorded B16 versions. All disposable QA records and the auth user reconciled to zero, and no live Meta message was sent.

`WA-010` remains blocked only because its expectation requires a controlled live Meta rejection or expired-token event against a consented recipient; deterministic simulation is supporting evidence, not a substitute. Current counts are 356 pass, 3 fail, 17 blocked, and 1 not applicable. B17 is active with Razorpay checkout, webhook, replay, entitlement, and security rows; B16 pass credit must not be inherited.

### Blocked-row campaign B17 complete; B18 active

B17 is closed at 8/8 pass on exact production deployment `dpl_AjR5NjfcewVpx9kS2cNXBU89v8fw` / commit `57caa6e6f15f25b6e26654a1d3cfc4b431452e9b`. Hosted Razorpay TEST checkout used Netbanking and Bank of Baroda; 18 QA assertions and 9 production-boundary assertions proved capture, signed replay/conflict rejection, invalid HMAC denial, failure/cancel/renewal/expiry monotonicity, exactly one 10% referral refund, and access loss without account/history deletion. Migration `20260714090000_b17_harden_razorpay_lifecycle.sql` is applied in QA and production with production history version `20260714040018`; all disposable records/auth users reconciled to zero and no real money moved.

Current counts are 364 pass, 3 fail, 9 blocked, and 1 not applicable. B18 is active with `TECH-011` and `TECH-012`. Use disposable infrastructure to restore and reconcile a sanitized multi-ledger fixture, then exercise application rollback and a reviewed database forward-fix without production impact; B17 pass credit must not be inherited.

### Blocked-row campaign B18 executable scope complete; B19 active

`TECH-012` is `PASS`. A sanitized six-ledger QA restore matched its backup digest, reconciled four business groupings, authenticated the restored owner, and cleaned to zero; native Vercel rollback restored an actual application build at exact commit `57caa6e6f15f25b6e26654a1d3cfc4b431452e9b`; and a rollback-only database transaction proved a provenance-preserving forward-fix for a non-reversible change. Production was not mutated.

`TECH-011` remains `BLOCKED`: production has WAL-G enabled but PITR disabled and exposes no retained backup. Restore mechanics passed, but closure needs an automated retained or approved off-site production backup schedule. Current counts are 365 pass, 3 fail, 8 blocked, and 1 not applicable. B19 is active with `SEC-011`, `SEC-018`, `UX-012`, `GOLDEN-A-03`, and `SIGNOFF-04`; B18 pass credit must not be inherited.

### Blocked-row campaign B19 externally reviewed; executable campaign scope complete

All five B19 rows were reviewed without status promotion. `SEC-011` is blocked on a local read-only Sentry API token and a live production event payload; `SEC-018` on qualified-counsel approval/redline; `UX-012` on a named factory supervisor's terminology register; `GOLDEN-A-03` on a business-accepted real-fabric truth sheet; and `SIGNOFF-04` on a dated supervisor meter register. No qualifying artifact was found in the repository or QA outputs.

Current counts remain 365 pass, 3 fail, 8 blocked, and 1 not applicable. All B08–B19 blocked-row batches are reviewed. The other precise blockers are `TECH-011` (production backup schedule), `WA-010` (controlled live Meta failure), and `OFF-001` (supported PWA install/standalone reopen). No independent executable blocked-row batch remains; readiness stays No-Go until named external evidence is supplied and the three formal failures are separately resolved or de-scoped.

## Remaining-gate campaign closeout — 2026-07-14

The product scope model now records `release_scope` and `pilot_gating` on every canonical row and names every post-pilot `not_applicable` requirement in `POST_PILOT_BACKLOG.md`. Live WhatsApp account activation, approved templates, real messages, signed status callbacks, and live provider failure drills are post-pilot. The pilot runs safely with the provider absent/disabled; missing or invalid provider configuration cannot call Meta, core writes do not depend on secrets or delivery, and supervisor access-code requests use explicit manual owner handoff instead of creating an inaccessible code.

`OFF-009` passed a production-targeted 17-second delayed-response exercise: the client timed out at 15 seconds, disabled resubmission, reconciled authoritative state, showed the saved-after-check message, and persisted exactly one 42 m row. `OFF-010` passed at 390×844 under constrained 3G: one 21 m submission produced one row and the Shift Meters, Workers, Attendance, and Machines screens remained usable without console issues. The fixture harness now refuses target-mismatched cleanup; the exact production `QA-OFF009-*` prefix reconciled to zero.

`WA-008` moved from fail to `not_applicable` as a requirement-definition correction linked to `PP-WA-002`; `WA-010` moved from blocked to `not_applicable` under `PP-WA-003`. Neither receives PASS credit. `SEC-011` remains unchanged except for its precise owner-physical-laptop prerequisite; Codex did not obtain, expose, fabricate, replace, or request transfer of `SENTRY_AUTH_TOKEN`.

Current counts are **367 pass, 0 fail, 7 blocked, and 3 not applicable**. The limited-pilot verdict is No-Go pending only `TECH-011`, `UX-012`, and `GOLDEN-A-03`. `OFF-001`, `SEC-011`, `SEC-018`, and `SIGNOFF-04` retain honest evidence debt under non-gating scopes; `SIGNOFF-04` becomes a mandatory first-shift operating control.

## Closure-pack preparation — 2026-07-14

The four remaining requested evidence packs are ready under `docs/pilot-remediation/closure-packs/`. They prepare collection and review only: `TECH-011`, `UX-012`, `GOLDEN-A-03`, and `SIGNOFF-04` remain `blocked`, and the formal counts remain **367 pass, 0 fail, 7 blocked, and 3 not applicable**.

The fresh read-only production backup check remains unchanged: the Supabase organization is Free, WAL-G is enabled, PITR is disabled, and no retained managed backup is listed. Paid managed backup/PITR/branching is not mandatory for the pilot. A Free-tier daily encrypted Supabase CLI dump to a private GitHub Actions artifact (14-day interim retention) plus an ephemeral local-Supabase restore drill is implemented, active and configured by setting name. Production Storage had zero buckets/objects/bytes in the preparation check; the workflow fails if object bytes would be uncovered. First scheduled run `29368765626` failed closed during inventory parsing and produced no artifact, so no real artifact or restore proof exists. No billing, secret, production schema/data or restore target was mutated by the remediation.

Exact next TECH-011 actions are to merge the inventory-output correction after checks, use one manual run as canary evidence only, wait for a new scheduled artifact, and restore/reconcile/time/clean up that exact artifact before named-verifier approval. The other external gate actions remain unchanged. Only after all core gates pass may both owners authorize the limited first session; the supervisor register must then reconcile to Today meters before `SIGNOFF-04` can pass.

## Focused TECH-011 / UX-012 sprint — 2026-07-14

The two preparation tracks are complete without status promotion. `TECH-011` now has source-controlled daily backup and restore-drill workflows, standard age encryption, private off-Supabase 14-day artifact retention, failure visibility, sanitized reconciliation and fail-closed Storage coverage. Read-only production checks verified healthy Postgres 17, 211 migration records/head `20260714040018`, and zero Storage buckets/objects/bytes. The repository had no Actions secret/variable names and local access lacked a database password, so no scheduled backup or production-artifact restore could be executed.

`UX-012` now has a complete cross-surface terminology inventory, proposed canonical glossary, decision-only sheet, Gujarati discussion terms and reproducible screenshot/approval flow. Loom/machine, shift total/counter reading, quality/run, party/Commercials, Taka units, sold/sent/received metres, worker types, Upaad/Kharchi/Hisaab and inverse textile units remain genuine human choices. No product wording or application behavior changed, so no Vercel deployment was performed.

Evidence: `output/qa/remaining-gate-campaign/TECH-011-UX-012-preparation.json`. Counts remain **367 pass, 0 fail, 7 blocked, and 3 not applicable**; the verdict remains No-Go pending `TECH-011`, `UX-012`, and unchanged/deferred `GOLDEN-A-03`.

## UX-012 amended-criteria closeout — 2026-07-14

The product owner approved a traceable limited-pilot amendment replacing the pre-pilot brother/supervisor substitute review with a reconciled product-owner baseline plus an open contextual review by the actual pilot user. The approved terminology was implemented across application and output surfaces, tested locally and remotely, and deployed at commit `93c2622` (`dpl_2fRVGdqnpqhx1415kBcb1mDrzhBy`, `READY`). Representative authenticated owner and supervisor routes were inspected without creating or changing production records.

Only `UX-012` changed from `blocked` to `pass`. Counts are **368 pass, 0 fail, 6 blocked, and 3 not applicable**. The verdict remains **No-Go**, now pending `TECH-011` and `GOLDEN-A-03`. Actual pilot-user terminology feedback, correction, and post-change confirmation remains an OPEN operating control. No factory-supervisor approval is claimed or implied.
## Active release closeout — performance, migration alignment, and supervisor readiness (2026-07-15)

- State: `fixed_pending_runtime_proof` for the supervisor endless-loading production reproduction; database reconciliation and security-view runtime checks are complete.
- Branch: `codex/performance-campaign-20260715-upstream`, rebased onto `origin/main` at `f8a47d7` before the final fetch gate.
- Commits: `8d4d767` bundle optimization, `341f151` migration/view hardening, and `6626cfa` supervisor request-race fix, plus campaign evidence commits.
- Database: production-linked local/remote migration history is aligned at 212 versions through `20260715113013`; dry-run reports no pending migrations; full shadow replay yields no public-schema diff. The applied view migration changes no business rows.
- Security: all six target views report `security_invoker=true`; security-advisor error count is zero. Owner reads and tenant-negative checks passed.
- Static gate: lint passed; 99 test files passed with 697 tests and one intentional skip; TypeScript/production build passed with 43 static pages; diff check passed.
- Runtime before fix: production supervisor data rendered, but loading and the disabled save state persisted beyond 15 seconds on a hard reload. No write was attempted.
- Next action: fetch/rebase if `origin/main` advances, push the branch, open a ready PR, require the exact Vercel preview to pass, merge without discarding evidence commits, wait for the exact production deployment, and repeat owner/supervisor role and supervisor-ready-state smoke. Promote the supervisor item only if the deployed helper exits loading and the active route remains tenant-correct.
- Blockers: no source, migration, or static-gate blocker. Exact deployed after timing is intentionally pending the merged web deployment.
- Matrix/readiness: unchanged; no formal row promotion or pilot-count change is claimed.

## Active Estimator physical-iPhone release — 2026-07-19

- State: `fixed_pending_runtime_proof`.
- Branch: `codex/estimator-readiness-production`, based on current
  `origin/main` rather than the stale broad remediation branch.
- Physical-device result: Estimator continued-step matrix is 24 pass, 0 fail,
  0 blocked; Save/reopen, iOS keyboard behavior, no-overflow layout, mobile
  quality action and no-focus-zoom retest all passed.
- Static gate: 102 test files / 708 tests passed with one intentional skip;
  TypeScript, ESLint and the production build passed.
- Data safety: the automated and physical-iPhone QA tenants were deleted and
  their account/tenant records reconciled to zero.
- Next action: commit and push the focused delta, merge the clean PR, wait for
  the exact READY Vercel production deployment, run a disposable Base-account
  save/reopen smoke, delete it, and record deployment plus cleanup evidence.
- Formal wider-pilot matrix/readiness: unchanged.

### Release closed on production

- State: `pass` for the scoped performance release verification; no formal test-matrix row was promoted.
- Source: PR `#18`, merge commit `9c0a4c2`; Vercel deployment `dpl_2dhb5j87YkJQCZ1pVe54Gtrda4nY` is Ready on the canonical production alias.
- Supervisor after evidence: five of five hard reloads reached ready state, no loading text remained, range 5,024–6,543 ms, p50 5,450 ms, nearest-rank p95 6,543 ms. Against the greater-than-15-second censored baseline, deployed p95 improved by at least 56.4%.
- Owner/role evidence: six owner workflow routes plus Factory Today rendered read-only; supervisor owner-route access redirected without exposing owner content.
- Database: 212 migrations aligned through `20260715113013`, no pending dry-run migration, six protected views use invoker security, and no production business row changed.
- Remaining work: deployed Core Web Vitals/waterfalls, cold quotation/dispatch attribution, payroll export click fixture, and the six separately documented legacy stored-function audits. None blocks this scoped release closeout or changes formal pilot-gate counts.
