# Pilot Ready Definition

Pilot-ready means the product can be used by a Surat grey-fabric factory without known critical or high risk to tenant security, production quantities, stock, dispatch/receipt, receivables, payroll, or release recoverability.

## Non-Negotiable Gates

1. No critical `fail` rows remain in active pilot scope.
2. No high `fail` rows remain in active pilot scope unless the feature is hidden, disabled, or explicitly unsupported for pilot.
3. No critical/high `blocked` rows remain without either evidence or de-scope.
4. `code_verified` is not counted as pass. Critical/high pilot paths require runtime or test evidence.
5. Every resolved cluster has regression tests or a documented runtime-only proof reason.
6. No destructive production mutation is used as proof outside an isolated QA tenant, rollback-only transaction, or disposable environment.
7. UX-012's amended pre-pilot baseline is deployed and regression-tested; the actual pilot-user terminology feedback/correction/reconfirmation action remains an explicit operating control until completed.

## Domain Gates

Security:

- Profile role/org mutation is impossible for authenticated users.
- Owner/supervisor/server authorization survives direct API attempts and token refresh.
- Access-code, join-code, locked-tenant, and webhook paths fail closed.
- Batch 24G source-fixes `SEC-015` and `SEC-009` and reconciles reported production-applied migrations `20260705100000` and `20260705182406`, but those rows remain `code_verified`, not pass. Pilot readiness still requires controlled settings-change audit-row proof with redacted payloads, owner export browser/security proof, and audit-log EXPORT proof.

Production and stock:

- Production logs reconcile with generated stock after create, edit, downtime correction, duplicate submit, and refresh.
- Negative, cancelled-order, over-target, wrong-assignment, missing selected-shift worker, and unsupported substitute-worker persistence cases are blocked or explicitly handled.
- Batch 22 source-fixes negative-meter, cancelled/completed/stale-assignment, and over-target boundaries for `ORDER-005`, `ORDER-009`, and `PROD-011`, but those rows remain `code_verified`, not pass, until the migration is applied in QA and runtime/API proof confirms valid production/correction still reconciles stock, order progress, and payroll basis.
- Batch 24B source-fixes supervisor production UX rows `PROD-013`, `PROD-023`, and `PROD-029`, but those rows remain `code_verified`, not pass, until QA/browser proof confirms suspicious large-meter confirmation, restored-unsaved draft behavior, and shift-total/shift-meter copy truth.
- Batch 24C source-fixed Factory Today setup checklist correctness for `SETUP-011`, and Batch 24F updated selected-shift worker policy. Formal blocked-row Batch 5 subsequently closed the row after repairing the deferred checklist Strict Mode lifecycle and proving the exact persisted setup state before and after refresh in isolated QA.
- Batch 24E source-fixed master-data loom guardrails for `MASTER-002` and `MASTER-005`; formal blocked-row Batch 4 subsequently closed `MASTER-002`, `MASTER-003`, and `MASTER-005` with isolated browser/database proof for normalized duplicates, history-preserving edits, protected lifecycle actions, and unused-loom behavior. Migration `20260704120000_batch_24e_master_data_loom_guardrails.sql` remains the trigger-backed normalized-name database boundary.

Dashboard:

- Historical analytics must not mix selected-date production facts with current-only active order, machine, or today KPI state.
- Batch 24C source-fixes historical Analytics state for `DASH-004`, but the row remains `code_verified`, not pass, until QA/browser proof confirms historical selected-date behavior and current-state restoration when returning to today.

Dispatch and receipt:

- Multi-batch dispatch works for the same sale.
- Receipt state is coherent across dispatch row, package lines, sale summary, discrepancy queue, and dashboard.
- Pending dispatch and difference sign-off cannot falsely clear.

Commercials:

- Sale creates exactly one receivable where required.
- Duplicate sale submission is idempotent.
- Profit filters, due dates, payment metadata, and balances reconcile.

Payroll and kharchi:

- Preview and settlement formulas match.
- Legacy payroll RPC bypasses are removed or hardened.
- Kharchi online is atomic.
- Offline kharchi is fixed or disabled for pilot.

Offline/cache:

- Account switch and logout clear persisted tenant data and mutation queues.
- Offline production/kharchi claims match implementation.
- Unsupported offline flows are removed from public copy and UI affordances.

Release:

- `npm ci`, lint, Vitest, build, runtime audit, and full audit gates pass or have signed risk acceptance for non-runtime advisories.
- Production migration head equals the approved repository head for pilot.
- Sentry release/source maps exist for the deployed commit.
- Backup restore and rollback/forward-fix are exercised in disposable infrastructure.

## Required De-Scopes Before Pilot If Not Fixed

The following must be hidden, disabled, or documented as unsupported before pilot if they are not fixed and retested:

| Feature/surface | Current finding | Required pilot action if unfixed |
| --- | --- | --- |
| Offline production logging | Batch 9 public/privacy/offline copy marks unsupported offline writes as online-only. | Keep auto-sync claims removed unless a real sync path is implemented and retested. |
| Offline kharchi | Batch 9 disables offline kharchi submit/sync and removes the unsupported `kharchi_offline` queue path. | Keep offline kharchi online-only unless a real reconciled queue path is implemented and retested. |
| Direct market-run sale path | Batch 4 disables the direct path so it cannot bypass commercial receivables. | Keep disabled for pilot unless it is routed through the normal receivable-creating sale path and retested. |
| Day-only factories | Batch 24F source-fixes selected-shift day-only support. | Capture browser/runtime proof before relying on it for pilot. |
| Substitute worker logging | Batch 24F blocks mismatches with explicit reassignment-required behavior; no separate substitute persistence exists. | Capture browser/runtime proof for the reassignment-required flow before relying on it for pilot. |
| Owner data export | Batch 24G source-fixes active UI wiring, audit-before-return behavior, org scoping, and redaction review, but runtime export proof is still missing. | Keep unavailable for pilot reliance until controlled export payload and audit-log EXPORT proof are complete. |
| Public DPDP/legal claims | Requires qualified counsel review. | Do not rely on public legal readiness until review exists. |
| Production backup restore | B18 proved sanitized mechanics and rollback, but no retained production artifact has been restored. | No pilot until the implemented Free-tier schedule produces an artifact and that exact artifact restores/reconciles. |
| Archived modules | Historical archived routes exist. | Keep hidden/archived and do not market as pilot features. |

Batch 8 note: `TECH-007` migration-head alignment is closed for repository head `20260628185344` by supplied Supabase migration-list evidence. Batch 8B note: `TECH-010` Sentry release/source-map proof is closed by fresh production release `2538da25b2fa` with 529 source-map artifacts. Batch 8C note: `SIGNOFF-10` clean deployed signoff is closed by post-DSN browser smoke, Vercel runtime/server logs, and Sentry production release `7c6449a59061` no-error evidence. These do not satisfy live Sentry payload inspection, backup restore, rollback/forward-fix, audit, clean install, or deployed WhatsApp webhook proof.

Focused 2026-07-14 note: a Free-plan-compatible daily encrypted Supabase CLI backup and ephemeral restore drill are source-controlled with private GitHub artifact retention, integrity hashes, Storage fail-closed coverage and a runbook. Preparation is not readiness: required Actions settings are absent, no scheduled production artifact exists, and no real artifact has been restored. `TECH-011` and the 367/0/7/3 counts are unchanged.

Batch 9 note: `OFF-002`, `OFF-005`, `OFF-006`, `OFF-008`, `SEC-016`, and `PAY-028` are closed by public offline fallback proof, awaited auth-boundary cache cleanup, IndexedDB queue cleanup, privacy/public copy truth, and truthful online-only offline kharchi de-scope. The 2026-07-11 runtime-remediation campaign also closes `OFF-007` with active-draft production update proof. `OFF-010` remains partial, and `OFF-009` remains open.

AUTH-012 production closeout note (2026-07-13): migration `20260710210828` removed the public `USING (true)` organization SELECT policy. The production catalog now contains only authenticated tenant SELECT and owner tenant UPDATE policies. A disposable two-tenant production probe passed own access, cross-tenant non-disclosure/non-mutation, and exact cleanup. Tenant isolation no longer blocks pilot readiness through `AUTH-012`; current formal failures are `WA-008`, `OFF-009`, and `OFF-010`. The overall readiness decision remains `NO-GO` because 115 rows remain blocked, the legacy pass-status semantic audit remains open, and the three failures retain external-signature, unknown-timeout, and offline-queue gaps.

Batch 10 note: `EST-003`, `EST-019`, `ORDER-001`, `ORDER-002`, `QUOTE-010`, and `QUOTE-003` are closed by focused estimator/quote/order snapshot and lifecycle proof. Worker-rate snapshots are Decimal-normalized across estimator-origin quote/order paths, quote restore warns before replacing another local draft, and quote lifecycle transitions are explicit. At Batch 10 closeout, `EST-011`, `QUOTE-007`, `ORDER-006`, and `ORDER-008` remained open under distinct validation, atomicity/idempotency, order edit audit, and below-target completion roots.

Batch 11 note: `EST-011` and `ORDER-006` are closed by focused estimator/order lifecycle proof. Estimator quote/order artifact paths now share server-boundary validation for empty, zero, negative, non-finite, and extreme warp/weft inputs; target/deadline edits reject targets below already-produced meters and rely on existing audit-trigger history evidence. At Batch 11 closeout, `ORDER-008` was source-fixed and `code_verified` pending runtime/browser proof. `QUOTE-007` remains open because strict Start Party Order atomicity needs database/RPC transaction work.

Batch 21B note: `ORDER-008` is closed by disposable QA browser/runtime proof in `output/qa/batch21b/BATCH21B-order-008-runtime-proof.json`. The proof confirmed below-target and pending-dispatch completion both require explicit confirmation and do not complete silently, while normal completion works without a warning. `QUOTE-007` remains open because strict Start Party Order atomicity needs database/RPC transaction work.

Batch 12 note: `STOCK-012` and `DISP-013` are closed by focused local proof in `output/qa/batch12/BATCH12-code-verified-proof-sweep.json`. `npx vitest run __tests__/p1-stock-lifecycle.test.ts` passed 10 tests for closed/sold-out zero-meter market-run archive eligibility, and `npx vitest run __tests__/dispatch-archive.test.ts` passed 7 tests for delivered-complete dispatch group archive eligibility. `ORDER-008`, `GOLDEN-B-12`, `STOCK-011`, `STOCK-013`, `MARKET-009`, and `MARKET-010` remain open/partial under their exact proof requirements.

Batch 13 note: `EST-001`, `EST-005`, and `EST-012` are closed by focused local estimator proof in `output/qa/batch13/BATCH13-code-verified-proof-sweep.json`. `npx --no-install vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts __tests__/production-mode.test.ts` passed 3 test files and 39 tests for the single warp/weft cost stack, paise-per-pick 100x guard, and invalid commission-plus-margin boundary. At that checkpoint `EST-004`, `SETUP-001`, `SETUP-002`, `BILL-002`, `PAY-017`, `TIME-003`, and `TIME-004` remained partial/code-verified; `BILL-002` was later closed by the 2026-07-13 isolated Base/Premium runtime proof.

Batch 15 note: `PAY-023`, `PAY-024`, and `SEC-014` are closed by focused payroll document/export/statutory proof in `output/qa/batch15/BATCH15-payroll-doc-export-consistency-proof.json`. `npx vitest run __tests__/batch15-payroll-doc-export-consistency.test.ts` passed 1 test file and 7 tests; the 7-file payroll regression pack passed 40 tests; `npx tsc --noEmit --pretty false`, targeted ESLint, `git diff --check`, and `npm run build` passed. `PAY-013`, `PAY-015`, and `DASH-003` moved to `code_verified`, not pass, until disposable runtime/browser proof could confirm high-gross payroll settlement equality and after-shift Factory Today wage updates.

Batch 21C note: `PAY-013` and `PAY-015` are closed by disposable QA payroll preview/settlement runtime proof in `output/qa/batch21c/BATCH21C-payroll-preview-settlement-runtime-proof.json`. Enrolled Rs. 20000 gross matched PF Rs. 1800, ESI Rs. 150, net Rs. 18050; not-enrolled Rs. 20000 gross matched PF/ESI Rs. 0, net Rs. 20000; preview, paid row, and Past settlements history matched, and reopened history stayed unchanged after the stale window. `DASH-003` remains `code_verified`, not pass, until disposable after-shift Factory Today wage proof is captured.

Batch 21D note: `PAY-018` and `PAY-020` are closed by disposable QA payroll boundary runtime proof in `output/qa/batch21d/BATCH21D-payroll-boundary-runtime-proof.json`. Missing payment/owner verification was blocked in the UI; hardened settlement RPC calls rejected missing payment mode and missing owner verification; valid UI settlement succeeded; legacy direct settlement RPC was permission denied; empty reversal code kept reversal disabled; invalid code was rejected while settlement stayed paid; a valid one-time code reversed to pending; consumed-code reuse was rejected; and legacy direct unsettle RPC was permission denied. `PAY-027`, `DASH-003`, Golden rows, and all other rows remain unchanged.

Batch 20 note: `PAY-018`, `PAY-020`, and `PAY-027` are source-fixed by focused payroll RPC hardening and online Kharchi atomicity proof in `output/qa/batch20/BATCH20-payroll-rpc-kharchi-atomicity-proof.json`. The Batch 20 verification set passed focused Vitest, TypeScript, targeted ESLint, `git diff --check`, JSON validation, and `npm run build` with the full prebuild Vitest gate. Batch 21D later closes `PAY-018` and `PAY-020`; `PAY-027` remains unresolved for pilot readiness until disposable QA runtime proof confirms online Kharchi atomicity.

Batch 23 note: `QUOTE-007` is source-fixed and moved to `code_verified` by focused atomic transaction boundary database design in `output/qa/batch23/BATCH23-start-party-order-transaction-boundary-proof.json`. The Batch 23 verification set passed focused Vitest, TypeScript, targeted ESLint, and `git diff --check`. `QUOTE-007` remains unresolved for pilot readiness until database migration application and valid Start Party Order runtime proof are executed in QA.

Batch 24A note: `PAY-006` is source-fixed and moved to `code_verified` by focused attendance RLS date boundary and access-code validation server action design in `output/qa/batch24a/BATCH24A-attendance-rls-boundary-proof.json`. The Batch 24A verification set passed focused Vitest, TypeScript, targeted ESLint, and `git diff --check`. `PAY-006` remains unresolved for pilot readiness until database migration application and valid attendance RLS and access-code UI/database runtime proof are executed in QA.

Batch 24B note: `PROD-013`, `PROD-023`, and `PROD-029` are source-fixed and moved to `code_verified` by focused supervisor production UX proof in `output/qa/batch24b/BATCH24B-supervisor-ux-failures-proof.json`. The Batch 24B verification set passed focused Vitest, TypeScript, targeted ESLint, existing production regression tests, JSON validation, and `git diff --check`. `PROD-013`, `PROD-023`, and `PROD-029` remain unresolved for pilot readiness until QA/browser proof is collected.

Batch 24C note: `SETUP-011` and `DASH-004` are source-fixed and moved to `code_verified` by focused Factory Today setup and historical Analytics state proof in `output/qa/batch24c/BATCH24C-factory-today-analytics-state-proof.json`. The Batch 24C verification set passed focused Vitest, TypeScript, targeted ESLint, JSON validation, and `git diff --check`. `SETUP-011` and `DASH-004` remain unresolved for pilot readiness until QA/browser proof is collected.

Batch 24D note: `EST-017` and `PROD-022` are source-fixed and moved to `code_verified` by focused estimator submit and supervisor production draft isolation proof in `output/qa/batch24d/BATCH24D-submit-draft-isolation-proof.json`. The Batch 24D verification set passed focused Vitest, Batch 24B compatibility tests, the estimator/quote/order and supervisor/production regression pack, TypeScript, targeted ESLint, JSON validation, and `git diff --check`. `EST-017` remains unresolved for pilot readiness until browser rapid double-click proof is collected and does not claim server/database idempotency. `PROD-022` remains unresolved for pilot readiness until browser proof confirms org/user/date/shift draft isolation and current date/shift save payload behavior.

Batch 24E note: `MASTER-002` and `MASTER-005` are source-fixed and moved to `code_verified` by focused master data loom guardrail proof in `output/qa/batch24e/BATCH24E-master-data-guardrails-proof.json`. The Batch 24E verification set passed focused Vitest, TypeScript, targeted ESLint, setup/factory/master regression tests, JSON validation, and `git diff --check`. The migration was later revised from retroactive unique index to trigger-backed duplicate guard and reportedly applied during the production DB push incident. `MASTER-002` remains unresolved for pilot readiness until controlled QA/browser duplicate-flow proof is collected. `MASTER-005` remains unresolved for pilot readiness until QA/browser proof confirms protected delete/deactivate/unlink behavior and unused-loom behavior. `MASTER-014` was later closed by isolated concurrency, rollback, and caller-RLS runtime proof.

Batch 24E/24G production reconciliation note: a Supabase DB push reportedly occurred before reconciliation while linked to production ref `vzhwahudircrpgtitwzd`, applying migration history `20260704120000`, `20260705100000`, and `20260705182406`. The repository, docs, matrix, and proof artifacts are reconciled to that production-applied reality; no rollback or additional DB command was run during reconciliation. No row is pass-ready from this incident. `SEC-015` and `SEC-009` remain `code_verified/source-fixed`; runtime remediation later closed `SEC-017` and `AUTH-008`; `MASTER-002` and `MASTER-005` remain `code_verified/source-fixed`, not pass.

Formal blocked-row Batch 2 note (2026-07-13): `SETUP-012`, `DASH-001`, `BILL-002`, `UX-004`, and `UX-011` are closed by isolated QA browser/database proof and exact cleanup. This lowered blockers to 115 at that checkpoint but did not change the gates: `SEC-009` remains blocked after a blank Premium Settings content observation, and contradictory legacy pass/Actual pairs must be formally re-audited before any Pilot Ready claim.

Formal blocked-row Batch 5 note (2026-07-13): after Batch 4 closed `MASTER-002`, `MASTER-003`, and `MASTER-005`, Batch 5 closed `SETUP-011` with a deferred-checklist lifecycle fix and isolated database/browser refresh proof. The active matrix is 265 pass, 3 fail, 108 blocked, and 1 not applicable. The overall readiness decision remains `NO-GO` under the unchanged non-negotiable gates.

Formal blocked-row Batch 6 note (2026-07-13): `SETUP-007` is closed by a controlled pre-mutation 503, enabled-retry UI proof, zero-row failure reconciliation, exactly-one-row successful retry, and refresh-stable completion. The active matrix is 266 pass, 3 fail, 107 blocked, and 1 not applicable. The overall readiness decision remains `NO-GO`; no readiness criterion or gate changed.


## Pilot Sign-Off Evidence Package

Final sign-off must include:

- Updated `TEST_MATRIX.md` with no unresolved critical/high pilot blockers.
- Updated `results.json`.
- A final report replacing the No-Go verdict.
- Evidence logs for each closed cluster.
- Release metadata: deployed URL, commit, migration head, Sentry release, CI run, backup restore, rollback/forward-fix exercise.
- A list of de-scoped features shown to the pilot customer.

## Production checkpoint evidence — 2026-07-13

- Production source checkpoint: `40b414a6ed7b9285048045c118074d8e0d010065`.
- Production database migration head: `20260711180000`, aligned with the repository at deployment time.
- Production web release: Vercel deployment `dpl_4pP8ovMPoS1tCwAcp9RZQL5gNfnY`, Ready at `https://textile-accounting.vercel.app` with successful Sentry source-map upload.
- Production webhook: `whatsapp-webhook` active at version 16.
- This checkpoint and Batch 7 production proof enable live testing but do not satisfy final Pilot Ready criteria: 3 failures, 104 blocked rows, six legacy schema-lint findings, restore proof, and rollback/forward-fix proof remain open.

Batch 7 additionally proves that day-only operation is a supported production rule, owner-controlled operator remapping preserves payroll attribution, and production context replacement preserves historical snapshots. These are verified invariants, not relaxations of the remaining pilot gates. Dated production remains excluded from pass claims under `NEEDS-AUDIT-004` until its selected-date state is stable.

Batch 8 closes `MASTER-011` with isolated production dated-substitution proof. Worker A remained standing while Worker B was authoritative only for 2026-07-12; the 32m log, ₹3.25 rate, stock grain, refresh state, and Worker B-only ₹104 payroll reconciled. This raises the formal matrix to 270 pass, 3 fail, 103 blocked, and 1 not applicable. Pilot readiness remains `NO-GO`; no non-negotiable gate was relaxed and the other dated/correction/attendance/calendar rows remain individually open.

B10 closes `PROD-017`, `PROD-018`, `PROD-019`, `PAY-006`, `PAY-022`, `COMM-013`, `TIME-003`, and `TIME-004` with exact production correction, owner-code, settlement, attendance, India month, year-rollover, and leap-day proof on commit `fd1c367665455ca2bc66ca54d81a9cc259147284`. Attendance migration `20260714005500_b10_enforce_attendance_date_lockdown.sql` is applied in QA and production, and exact cleanup reconciled the disposable tenant to zero. The formal matrix is now 295 pass, 3 fail, 78 blocked, and 1 not applicable. Pilot readiness remains `NO-GO`; B11 is active and all remaining sign-off gates still apply.

B11 closes `QUOTE-007`, nine order-lifecycle rows, `STOCK-011`, and `GOLDEN-A-23` with exact production atomic Start Party Order proof and a 34-assertion isolated QA lifecycle on commit `dc76b17f38eb111ef3dad0a5a9f809b17168cda5`. The formal matrix is now 307 pass, 3 fail, 66 blocked, and 1 not applicable. Pilot readiness remains `NO-GO`; B12 is active and all remaining security, provider, resilience, restore, rollback, and external sign-off gates still apply.

B12 closes ten market/stock/dispatch/commercial rows with matching 17-assertion QA and production lifecycle proof on commit `bc1e9cbfab1609adf461c405e41d6fca65b304ee`. Database-enforced source integrity and stock-sale-aware market summaries are deployed; the exact production release is `dpl_q1bQa4dHd9bFKFU8ZphcVQNcE2d1`, and disposable cleanup reconciled to zero. The formal matrix is now 317 pass, 3 fail, 56 blocked, and 1 not applicable. Pilot readiness remains `NO-GO`; B13 is active and the remaining worker-money, realtime, security, provider, restore, rollback, and external sign-off gates still apply.

B13 closes sixteen payroll, advance, Kharchi, dashboard-wage, and Golden payroll rows with QA runtime/browser and exact-deployment production proof on commit `d42d5138fba22758f1d11218c59deb6c3ad876a3`. The hardened payroll lifecycle migration is deployed in both environments; production release `dpl_EBYTZG33aozbGbPLpYeAWQcF4JJD` passed 87 files / 621 tests and all disposable cleanup reconciled to zero. The formal matrix is now 333 pass, 3 fail, 40 blocked, and 1 not applicable. Pilot readiness remains `NO-GO`; B14 is active and the remaining realtime, security, provider, restore, rollback, failure, and external sign-off gates still apply.

B14 closes five realtime refresh, reconnect recovery, order-pace, large-range, and dashboard-state rows with QA runtime/browser and exact-deployment production proof on commit `6f80eac94d950460bf559583dbb18ef434afde00`. The worker-breakdown timestamp repair is deployed in both environments; production release `dpl_3Xb6mYaqnG5FRpye7ULVWcxq9ttq` passed 88 files / 625 passed plus 1 intentional skip, and all disposable cleanup reconciled to zero. The formal matrix is now 338 pass, 3 fail, 35 blocked, and 1 not applicable. Pilot readiness remains `NO-GO`; B15 is active and the remaining authentication, privacy, security, provider, restore, rollback, failure, PWA, and external sign-off gates still apply.

B15 closes ten authentication, privacy, audit, adversarial-input, keyboard, and zoom rows with QA browser/HTTP/database and exact-deployment production proof on commit `2e3254f75502ca56192d015c06bba4f7972518aa`. Atomic erasure/redaction and column-scoped production triggers are deployed in both environments; production release `dpl_CmFozomMsAhE36kvGUMQiPwJpsFr` passed 89 files / 633 passed plus 1 intentional skip, and all disposable cleanup reconciled to zero. `OFF-001` remains blocked on actual install/standalone reopen. The formal matrix is now 348 pass, 3 fail, 25 blocked, and 1 not applicable. Pilot readiness remains `NO-GO`; B16 is active and the remaining provider, restore, rollback, formal failure, PWA, and external sign-off gates still apply.

B16 closes eight WhatsApp consent, delivery, privacy, cooldown, and retry rows with a nine-assertion disposable-QA provider simulation on implementation commit `ee2af23a31e648880bdf3810f9cacb545cefcedd`. Production release `dpl_HSVWPpa4zPnR3gfEqXB1h3c55p4y`, migration history version `20260713235949`, catalog constraints, and six active edge-function versions align with that boundary implementation; all QA fixtures reconciled to zero. `WA-010` remains blocked because its exact expectation requires a controlled live Meta rejection or expired-token event, and no live provider message was sent. The formal matrix is now 356 pass, 3 fail, 17 blocked, and 1 not applicable. Pilot readiness remains `NO-GO`; B17 is active and the remaining billing/provider, restore, rollback, formal failure, PWA, and external sign-off gates still apply.

B17 closes eight Razorpay checkout, webhook, entitlement, referral-refund, and webhook-security rows with hosted Razorpay TEST checkout plus 18 QA and 9 exact-deployment production-boundary assertions on implementation commit `57caa6e6f15f25b6e26654a1d3cfc4b431452e9b`. Production release `dpl_AjR5NjfcewVpx9kS2cNXBU89v8fw` passed 91 files / 650 tests; migration `20260714090000_b17_harden_razorpay_lifecycle.sql` is recorded in production as `20260714040018`; no real money moved and all disposable fixtures reconciled to zero. The formal matrix is now 364 pass, 3 fail, 9 blocked, and 1 not applicable. Pilot readiness remains `NO-GO`; B18 is active and restore, rollback/forward-fix, formal failure, PWA, live Meta, Sentry, and human sign-off gates still apply.

B18 closes `TECH-012` with a sanitized six-ledger QA restore, canonical digest reconciliation, restored-owner authentication, native disposable Vercel rollback to exact source commit `57caa6e6f15f25b6e26654a1d3cfc4b431452e9b`, and a rollback-only provenance-preserving database forward-fix. Production was not mutated and all disposable resources cleaned to zero. `TECH-011` remains blocked because production reports no retained backup and PITR is disabled; an automated retained or approved off-site production backup schedule is still a non-negotiable recovery gate. The formal matrix is now 365 pass, 3 fail, 8 blocked, and 1 not applicable. Pilot readiness remains `NO-GO`; B19 is active and formal failures, backup schedule, PWA, live Meta, Sentry, qualified legal, factory-language, truth-sheet, and supervisor sign-off gates still apply.

B19 reviews all five external-evidence rows without manufacturing PASS evidence. `SEC-011` needs a read-only live Sentry payload inspection; `SEC-018` needs qualified-counsel approval/redline; `UX-012` needs a named factory supervisor's terminology register; `GOLDEN-A-03` needs a business-accepted real-fabric truth sheet; and `SIGNOFF-04` needs a dated supervisor meter register. No qualifying artifact was found. All blocked-row batches B08–B19 are now reviewed, with 95 baseline blockers promoted to direct-evidence PASS and eight remaining as precise genuine external blockers. The formal matrix remains 365 pass, 3 fail, 8 blocked, and 1 not applicable. Pilot readiness remains `NO-GO`; the campaign cannot close these external gates or the three formal failures by inference.

## Current limited-pilot decision — 2026-07-14

The canonical matrix is **367 pass, 0 fail, 7 blocked, and 3 not applicable**. Every row now records `release_scope` and `pilot_gating`; post-pilot `not_applicable` rows link to a named acceptance test and receive no PASS credit.

The verdict is **No-Go pending three gates**:

1. `TECH-011`: an automated retained or approved off-site production backup must exist, and its artifact must pass disposable restore/reconciliation.
2. `UX-012`: a named factory supervisor must accept or correct the required operating terminology.
3. `GOLDEN-A-03`: one independent real-fabric truth sheet must reconcile with the estimator and accepted downstream snapshot.

`OFF-001` is optional PWA-install evidence; `SEC-011` is intentionally deferred to a read-only check on the owner’s physical laptop; `SEC-018` gates public legal reliance; and `SIGNOFF-04` is a mandatory first-shift operating control. These four rows retain `BLOCKED` without independently producing a pre-session No-Go. Live WhatsApp provider delivery, signed callbacks, and live failure drills are post-pilot under `PP-WA-001`–`PP-WA-003`; the pilot provider is disabled and no core workflow depends on Meta credentials or delivery.
