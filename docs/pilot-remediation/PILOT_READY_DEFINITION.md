# Pilot Ready Definition

Pilot-ready means the product can be used by a Surat grey-fabric factory without known critical or high risk to tenant security, production quantities, stock, dispatch/receipt, receivables, payroll, or release recoverability.

## Non-Negotiable Gates

1. No critical `fail` rows remain in active pilot scope.
2. No high `fail` rows remain in active pilot scope unless the feature is hidden, disabled, or explicitly unsupported for pilot.
3. No critical/high `blocked` rows remain without either evidence or de-scope.
4. `code_verified` is not counted as pass. Critical/high pilot paths require runtime or test evidence.
5. Every resolved cluster has regression tests or a documented runtime-only proof reason.
6. No destructive production mutation is used as proof outside an isolated QA tenant, rollback-only transaction, or disposable environment.

## Domain Gates

Security:

- Profile role/org mutation is impossible for authenticated users.
- Owner/supervisor/server authorization survives direct API attempts and token refresh.
- Access-code, join-code, locked-tenant, and webhook paths fail closed.

Production and stock:

- Production logs reconcile with generated stock after create, edit, downtime correction, duplicate submit, and refresh.
- Negative, cancelled-order, over-target, wrong-assignment, and unsupported day-only/substitute-worker cases are blocked or explicitly unsupported.

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
| Day-only factories | Production logging requires both day/night assignments. | Limit pilot to factories with both shifts configured or fix support. |
| Substitute worker logging | Actual substitute cannot be logged without remapping assignment. | Document unsupported or add intentional substitute flow. |
| Owner data export | Not wired/audited/redaction-reviewed. | Keep hidden until audited and runtime-tested. |
| Public DPDP/legal claims | Requires qualified counsel review. | Do not rely on public legal readiness until review exists. |
| Backup restore/rollback | Not exercised. | No pilot until exercise is completed. |
| Archived modules | Historical archived routes exist. | Keep hidden/archived and do not market as pilot features. |

Batch 8 note: `TECH-007` migration-head alignment is closed for repository head `20260628185344` by supplied Supabase migration-list evidence. Batch 8B note: `TECH-010` Sentry release/source-map proof is closed by fresh production release `2538da25b2fa` with 529 source-map artifacts. Batch 8C note: `SIGNOFF-10` clean deployed signoff is closed by post-DSN browser smoke, Vercel runtime/server logs, and Sentry production release `7c6449a59061` no-error evidence. These do not satisfy live Sentry payload inspection, backup restore, rollback/forward-fix, audit, clean install, or deployed WhatsApp webhook proof.

Batch 9 note: `OFF-002`, `OFF-005`, `OFF-006`, `OFF-008`, `SEC-016`, and `PAY-028` are closed by public offline fallback proof, awaited auth-boundary cache cleanup, IndexedDB queue cleanup, privacy/public copy truth, and truthful online-only offline kharchi de-scope. `OFF-007` and `OFF-010` remain partial, and `OFF-009` remains open.

Batch 10 note: `EST-003`, `EST-019`, `ORDER-001`, `ORDER-002`, `QUOTE-010`, and `QUOTE-003` are closed by focused estimator/quote/order snapshot and lifecycle proof. Worker-rate snapshots are Decimal-normalized across estimator-origin quote/order paths, quote restore warns before replacing another local draft, and quote lifecycle transitions are explicit. At Batch 10 closeout, `EST-011`, `QUOTE-007`, `ORDER-006`, and `ORDER-008` remained open under distinct validation, atomicity/idempotency, order edit audit, and below-target completion roots.

Batch 11 note: `EST-011` and `ORDER-006` are closed by focused estimator/order lifecycle proof. Estimator quote/order artifact paths now share server-boundary validation for empty, zero, negative, non-finite, and extreme warp/weft inputs; target/deadline edits reject targets below already-produced meters and rely on existing audit-trigger history evidence. At Batch 11 closeout, `ORDER-008` was source-fixed and `code_verified` pending runtime/browser proof. `QUOTE-007` remains open because strict Start Party Order atomicity needs database/RPC transaction work.

Batch 21B note: `ORDER-008` is closed by disposable QA browser/runtime proof in `output/qa/batch21b/BATCH21B-order-008-runtime-proof.json`. The proof confirmed below-target and pending-dispatch completion both require explicit confirmation and do not complete silently, while normal completion works without a warning. `QUOTE-007` remains open because strict Start Party Order atomicity needs database/RPC transaction work.

Batch 12 note: `STOCK-012` and `DISP-013` are closed by focused local proof in `output/qa/batch12/BATCH12-code-verified-proof-sweep.json`. `npx vitest run __tests__/p1-stock-lifecycle.test.ts` passed 10 tests for closed/sold-out zero-meter market-run archive eligibility, and `npx vitest run __tests__/dispatch-archive.test.ts` passed 7 tests for delivered-complete dispatch group archive eligibility. `ORDER-008`, `GOLDEN-B-12`, `STOCK-011`, `STOCK-013`, `MARKET-009`, and `MARKET-010` remain open/partial under their exact proof requirements.

Batch 13 note: `EST-001`, `EST-005`, and `EST-012` are closed by focused local estimator proof in `output/qa/batch13/BATCH13-code-verified-proof-sweep.json`. `npx --no-install vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts __tests__/production-mode.test.ts` passed 3 test files and 39 tests for the single warp/weft cost stack, paise-per-pick 100x guard, and invalid commission-plus-margin boundary. `EST-004`, `SETUP-001`, `SETUP-002`, `BILL-002`, `PAY-017`, `TIME-003`, and `TIME-004` remain partial/code-verified under their exact proof requirements.

Batch 15 note: `PAY-023`, `PAY-024`, and `SEC-014` are closed by focused payroll document/export/statutory proof in `output/qa/batch15/BATCH15-payroll-doc-export-consistency-proof.json`. `npx vitest run __tests__/batch15-payroll-doc-export-consistency.test.ts` passed 1 test file and 7 tests; the 7-file payroll regression pack passed 40 tests; `npx tsc --noEmit --pretty false`, targeted ESLint, `git diff --check`, and `npm run build` passed. `PAY-013`, `PAY-015`, and `DASH-003` moved to `code_verified`, not pass, until disposable runtime/browser proof could confirm high-gross payroll settlement equality and after-shift Factory Today wage updates.

Batch 21C note: `PAY-013` and `PAY-015` are closed by disposable QA payroll preview/settlement runtime proof in `output/qa/batch21c/BATCH21C-payroll-preview-settlement-runtime-proof.json`. Enrolled Rs. 20000 gross matched PF Rs. 1800, ESI Rs. 150, net Rs. 18050; not-enrolled Rs. 20000 gross matched PF/ESI Rs. 0, net Rs. 20000; preview, paid row, and Past settlements history matched, and reopened history stayed unchanged after the stale window. `DASH-003` remains `code_verified`, not pass, until disposable after-shift Factory Today wage proof is captured.

Batch 21D note: `PAY-018` and `PAY-020` are closed by disposable QA payroll boundary runtime proof in `output/qa/batch21d/BATCH21D-payroll-boundary-runtime-proof.json`. Missing payment/owner verification was blocked in the UI; hardened settlement RPC calls rejected missing payment mode and missing owner verification; valid UI settlement succeeded; legacy direct settlement RPC was permission denied; empty reversal code kept reversal disabled; invalid code was rejected while settlement stayed paid; a valid one-time code reversed to pending; consumed-code reuse was rejected; and legacy direct unsettle RPC was permission denied. `PAY-027`, `DASH-003`, Golden rows, and all other rows remain unchanged.

Batch 20 note: `PAY-018`, `PAY-020`, and `PAY-027` are source-fixed by focused payroll RPC hardening and online Kharchi atomicity proof in `output/qa/batch20/BATCH20-payroll-rpc-kharchi-atomicity-proof.json`. The Batch 20 verification set passed focused Vitest, TypeScript, targeted ESLint, `git diff --check`, JSON validation, and `npm run build` with the full prebuild Vitest gate. Batch 21D later closes `PAY-018` and `PAY-020`; `PAY-027` remains unresolved for pilot readiness until disposable QA runtime proof confirms online Kharchi atomicity.

## Pilot Sign-Off Evidence Package

Final sign-off must include:

- Updated `TEST_MATRIX.md` with no unresolved critical/high pilot blockers.
- Updated `results.json`.
- A final report replacing the No-Go verdict.
- Evidence logs for each closed cluster.
- Release metadata: deployed URL, commit, migration head, Sentry release, CI run, backup restore, rollback/forward-fix exercise.
- A list of de-scoped features shown to the pilot customer.
