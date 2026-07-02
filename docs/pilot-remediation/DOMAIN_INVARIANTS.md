# Domain Invariants

Every remediation task must cite the relevant invariant before code changes are proposed.

## Security and Tenant Authority

Role, organization, and permission claims are server-owned facts. A user can update personal profile data only through policies that cannot alter role, org, lock status, or other authorization fields.

Acceptance equation:

```text
effective_authority(user) =
  protected server-side role/org source
  not user-mutable profile input
```

Required proof:

- `authenticated` cannot update `profiles.role` or `profiles.org_id`.
- A supervisor remains supervisor after self-mutation attempts and token refresh.
- Owner-only actions reject supervisor sessions server-side.

## Access Codes, Join Codes, and Locked Tenants

Security controls fail closed. Brute-force protection, expiry, one-time use, and lockout must be enforced by the same server-side path used by every protected action.

Required proof:

- Repeated invalid attempts are counted and blocked.
- Missing Redis/rate-limit dependency does not silently convert a protected action into fail-open behavior.
- Locked organizations cannot mutate pilot write tables.

## Production Logs

A valid production row belongs to exactly one tenant, machine, date, shift, active worker, and active order/run context. Positive meters require a worker-rate snapshot. Zero-meter downtime never creates quantity or wages.

Core equation:

```text
produced meters = sum(valid positive production_logs.meters)
piece-rate gross = sum(log meters x stored worker-rate snapshot)
```

Batch 15 proof note: `DASH-003` is source-fixed and `code_verified`, not pass. Factory Today now computes `grossWagesSoFar` from existing cycle production logs using `sum(nonnegative meters x nonnegative worker_rate_snapshot)` and focused tests cover the helper/source wiring. It still needs disposable after-shift runtime proof before pass.

Batch 22 proof note: `ORDER-005`, `ORDER-009`, and `PROD-011` are source-fixed and `code_verified`, not pass. Migration `20260702121238_batch_22_production_order_boundary_hardening.sql` adds a forward-only nonnegative-meter table check, direct table trigger, and hardened `replace_shift_production_logs` guard so over-target totals, cancelled/completed/stale-assignment order-attributed logs, and negative meters are rejected before production can feed progress, generated stock, or payroll basis. The migration is not applied and disposable QA runtime/API proof is still required before pass.

Required proof:

- No negative meters at UI, server action, RPC, or table boundary.
- No production against cancelled orders or unassigned machines.
- One authoritative row per organization, machine, date, and shift according to the active database constraint/RPC.

## Generated Stock

Generated stock is a projection of current valid production, not an independent stale copy. A correction must update production and generated stock in one transaction.

Core equation:

```text
order generated stock = sum(current valid positive order production logs) - sold order stock
market generated stock = sum(current valid positive market-run logs) - sold market stock
```

Required proof:

- Correction from production to downtime removes or reverses the prior generated lot/movement.
- Re-submit/edit changes downstream stock exactly once.
- Order stock and production logs reconcile after refresh and in a second session.

Batch 6 proof note: `GOLDEN-A-13` is satisfied by disposable runtime proof `output/qa/batch6/BATCH6-20260628185811-golden-a-runtime-proof.json`. The proof corrected Golden A production from 230.75m to 235.75m, verified the exact +5m change, auto-completed the customer order at target, and reconciled generated order-linked stock.

## Stock and Sale

Available stock is computed from opening/produced meters, adjustments, and sales. Manual, market-run, and order-reserved stock must remain distinguishable.

Core equation:

```text
available meters =
  original or produced meters
  + positive adjustments
  - negative adjustments
  - sold meters
```

Required proof:

- Each sale creates one stock decrement and one movement record.
- Duplicate sale submissions do not create duplicate receivables or stock decrements.
- Direct sale paths cannot bypass receivable creation when receivable creation is required.

Batch 3 proof note: `SALE-015` is satisfied for the stock sale/dispatch path by disposable runtime proof that rapid duplicate 80m sale submit created exactly one sale, one receivable where applicable, and one stock movement.

Batch 5 proof note: `STOCK-016` and `STOCK-017` are satisfied by disposable runtime proof `output/qa/batch5/BATCH5-20260628173243-stock-audit-refresh.json`, focused Batch 5 tests, regression tests, and full Vitest. The proof retrieved 506 stock movement rows through cursor pagination as 100, 100, 100, 100, 100, and 6 with no duplicates/missing rows and deterministic newest-to-oldest ordering. It also verified sale-only no-dispatch refresh to 75m available / 25m pending, one stock sale movement, one receivable, and a matching second owner session. No migration was required.

Batch 12 proof note: `STOCK-012` is satisfied by focused local stock lifecycle proof. `npx vitest run __tests__/p1-stock-lifecycle.test.ts` passed 10 tests and directly verifies closed/sold-out market-run lots with zero available/reserved/pending meters and no unresolved discrepancy are non-actionable/archive-eligible. `STOCK-011`, `STOCK-013`, `MARKET-009`, and `MARKET-010` remain open/partial because their exact row wording needs broader proof.

Batch 6 proof note: `GOLDEN-A-15` is satisfied by disposable runtime proof that sold 120m of valid order-linked completed-order stock on credit, created the expected sale/stock/receivable state, and preserved committed refresh/second-session reconciliation.

## Dispatch and Receipt

Dispatch is a batch-level obligation against sold meters. Receipt is a batch-level confirmation. A partial dispatch is not a shortage.

Core equations:

```text
pending dispatch = sold meters - sum(dispatched meters)
receipt variance = received meters - sent meters
```

Required proof:

- Multiple dispatch batches can exist for one sale without package-number collision.
- Delivered status, receipt columns, package lines, and sale summary agree.
- One shortage/excess receipt creates one actionable discrepancy.
- Zero received meters is either blocked or explicitly treated as full shortage by policy and UI.

Batch 3 proof note: the current pilot policy blocks zero and negative received meters. Runtime proof `BATCH3-fc791041` confirms 50m plus 30m dispatch batches for one 80m sale, exact receipt closure, shortage/excess discrepancy creation, duplicate receipt idempotency, archive protection, and dashboard/signoff/second-session reconciliation.

Batch 6 proof note: `GOLDEN-A-16`, `GOLDEN-A-17`, and `GOLDEN-A-18` are satisfied by disposable runtime proof that allowed valid completed-order dispatch, rejected invalid completed-order dispatch state through the RPC gate, recorded a 70m exact receipt with no discrepancy, recorded a 50m dispatch with 45m received, and created exactly one actionable 5m shortage discrepancy plus one open party claim.

Batch 12 proof note: `DISP-013` is satisfied by focused local dispatch archive proof. `npx vitest run __tests__/dispatch-archive.test.ts` passed 7 tests and directly verifies a fully dispatched and confirmed group archives while partial, unconfirmed, disputed, discrepancy, and e-way-gap groups stay active. `GOLDEN-B-12` remains blocked because it requires a full Golden B second-batch exact receipt rerun.

## Commercials

Sales, receivables, payments, and profit are derived from stored sale snapshots. Payment metadata required for pilot collection workflows must be captured.

Core equations:

```text
revenue = sold meters x sale-rate snapshot
cost = sold meters x cost snapshot
gross profit = revenue - cost
balance = receivable total - valid payments
```

Required proof:

- Receivable balance reaches zero only after valid payments equal total.
- Due date starts from the first dispatch under the active product rule.
- Profit filters classify manual, market-run, and order stock by authoritative source fields.

Batch 4 proof note: `COMM-002`, `COMM-010`, `COMM-012`, `COMM-014`, `COMM-016`, `SIGNOFF-06`, and `SIGNOFF-09` are satisfied by disposable runtime proof `BATCH4QA-20260628125203`, migration `20260628121903`, focused Batch 4 tests, and browser evidence. The proof covers exact-once sale receivable creation, duplicate sale submit idempotency, disabled direct market-run sale, partial/full/duplicate payment handling, overpayment blocking, cheque metadata/history, Asia/Kolkata due buckets, Top Parties last-sale/overdue, authoritative profit source fields, Factory Today blockers, and Commercials refresh/second-session reconciliation. Golden A order-linked payments, broad date-only rendering, timeout UX, and release/Sentry proof remain outside Batch 4.

Batch 6 proof note: `GOLDEN-A-19` and `GOLDEN-A-20` are satisfied by disposable runtime proof that closed the Golden A Rs. 7,200 order-linked receivable with Rs. 2,200 partial and Rs. 5,000 final payments, retained two payment receipt records, reached zero balance, and matched first and second owner-session state. Broad date-only rendering, timeout UX, and release/Sentry proof remain outside Batch 6.

Batch 8C proof note: `SIGNOFF-10` is satisfied by clean deployed browser/server/Sentry evidence after the Sentry DSN fix: `/login` and `/privacy` loaded without `/monitoring?...` 403s or CSP `worker-src blob:` errors, Vercel production runtime/server logs showed Warning 0, Error 0, Fatal 0 with no 5xx/server exceptions, and Sentry production release `7c6449a59061` showed 100% crash-free sessions with 0 crashes, 0 new issues, 0 handled issues, and 0 unhandled issues. Live Sentry event payload redaction inspection remains separate `SEC-011` evidence debt.

## Estimator Costing

Estimator costing must be deterministic, explainable, and honest. The engine must not silently tune formula-derived weights to match practical factory weights.

Core equations:

```text
warp formula base kg/100m = denier x beam ends / 90000
weft formula base kg/100m = denier x PPI x effective costing width inches / 90000
warp final kg/100m = base kg/100m x (1 + warp crimp % + waste %)
weft final kg/100m = base kg/100m x (1 + waste %)
cost per meter = final kg/100m x rate per kg / 100
```

Required proof:

- Manual kg/100m mode and formula mode use the same cost engine once base kg/100m is chosen.
- Formula-equivalent manual inputs match formula mode within the business tolerance.
- Formula mode exposes formula-derived kg/100m when it differs from practical/manual consumption.
- Warp crimp applies only to warp; weft receives waste only.
- Blank row waste uses the default, explicit `0` overrides the default to zero, and row waste does not stack with default waste.
- Effective costing width, not finished/market pano, drives weft formula costing.
- Suspicious cm inputs such as `62 cm` surface a width warning before they silently under-cost weft.
- Cost Breakdown and restored quote details show mode, formula/manual base kg, adjustments, final kg, rate, and cost.

Batch 7 proof note: `TIME-002` is satisfied by reusable date-only rendering helpers, affected display-path hardening, and focused tests proving the same date-only value renders unchanged under UTC, Asia/Kolkata, and America/Los_Angeles. Timestamp/datetime fields are intentionally outside that date-only invariant.

Batch 10 proof note: `EST-003`, `EST-019`, `ORDER-001`, `ORDER-002`, `QUOTE-010`, and `QUOTE-003` are satisfied by Decimal-backed worker-rate snapshot normalization, normalized estimator-origin quote/order/market-run writes, quote restore draft-collision handling, and explicit quote lifecycle transitions. Evidence is `output/qa/batch10/BATCH10-estimator-quote-order-snapshots-proof.json`, focused Batch 10 tests, estimator/width tests, TypeScript, targeted ESLint, and `npm run build`. No migration, Supabase command, direct SQL, or production/stock/dispatch/commercial/payroll logic change was used. At Batch 10 closeout, `EST-011`, `QUOTE-007`, `ORDER-006`, and `ORDER-008` remained open under distinct roots.

Batch 11 proof note: `EST-011` and `ORDER-006` are satisfied by server-boundary estimator validation, validator wiring across Save Quote / Start Party Order / market-run estimator quote persistence, target/deadline edits guarded by produced-meter checks, and existing audit-trigger old/new history evidence. Evidence is `output/qa/batch11/BATCH11-estimator-order-lifecycle-proof.json`, focused Batch 11 tests, estimator/width tests, TypeScript, targeted ESLint, and `npm run build`. No migration, Supabase command, direct SQL, RPC change, or production/stock/dispatch/commercial/payroll logic change was used. At Batch 11 closeout, `ORDER-008` was source-fixed and `code_verified` pending runtime/browser proof; `QUOTE-007` remains open pending database/RPC transaction work.

Batch 21B proof note: `ORDER-008` is satisfied by disposable QA browser/runtime proof in `output/qa/batch21b/BATCH21B-order-008-runtime-proof.json`. The local runtime used QA Supabase ref `eutycrtzzxmlkcpipgod`; production ref `vzhwahudircrpgtitwzd` was absent from `.env.qa.local` and rebuilt `.next` cache. Below-target completion and pending-dispatch completion required explicit confirmation and did not complete silently; normal completion completed without a warning. No migration, direct SQL, package install, lockfile change, production mutation, staging, commit, push, or docs closeout beyond Batch 21B was used during proof.

Batch 13 proof note: `EST-001`, `EST-005`, and `EST-012` are satisfied by focused local estimator proof. Evidence is `output/qa/batch13/BATCH13-code-verified-proof-sweep.json`; `npx --no-install vitest run __tests__/estimator.test.ts __tests__/width-field.test.ts __tests__/production-mode.test.ts` passed 3 test files and 39 tests. The proof directly covers representative single warp/weft cost-stack fixtures, paise-per-pick conversion and the old 100x failure mode, and invalid commission-plus-margin boundary behavior. No product code, test code, migration, Supabase command, direct SQL, browser/runtime mutation, package install, lockfile change, or production data mutation was used. `EST-004`, `SETUP-001`, and `SETUP-002` remain `code_verified` because their safe helper proof was supporting rather than exact row proof.

Batch 23 proof note: `QUOTE-007` is source-fixed and moved to `code_verified` by focused atomic transaction boundary database design. Evidence is `output/qa/batch23/BATCH23-start-party-order-transaction-boundary-proof.json`, focused Batch 23 tests in `__tests__/batch23-start-party-order-atomicity.test.ts`, TypeScript, targeted ESLint, and Vitest runs. No migration was applied, and no Supabase command, direct SQL, or production mutation was performed. Pass still requires database migration application and valid Start Party Order runtime proof in QA.


## Payroll and Kharchi

Payroll is derived from production logs, stored rate snapshots, attendance, statutory settings, advances, and manual adjustments. Kharchi must affect worker advance and supervisor float ledgers atomically.

Core equation:

```text
net payout =
  gross
  + inam
  - kapaat
  - advance recovery
  - PF
  - ESI
```

Required proof:

- Preview and persisted settlement use the same PF/ESI and advance formulas.
- Settlement and reversal cannot be executed through legacy bypass RPCs.
- Online kharchi creates both ledger rows or neither.
- Offline kharchi is disabled, de-scoped, or reconciles to authoritative tables.

Batch 15 proof note: `PAY-023` and `PAY-024` are satisfied by focused source/test proof for payslip PDF content and settlement history/CSV statutory extraction. `PAY-013` and `PAY-015` were source-fixed and moved to `code_verified` by Batch 15, pending disposable settlement runtime proof. `SEC-014` is satisfied by deterministic payslip filename sanitization tests.

Batch 21C proof note: `PAY-013` and `PAY-015` are satisfied by disposable QA payroll runtime proof in `output/qa/batch21c/BATCH21C-payroll-preview-settlement-runtime-proof.json`. Enrolled Rs. 20000 gross produced PF Rs. 1800, ESI Rs. 150, and net Rs. 18050; not-enrolled Rs. 20000 gross produced PF/ESI Rs. 0 and net Rs. 20000. Preview, paid payroll rows, and Past settlements history matched, and reopened history values stayed unchanged after the stale window. No production mutation, direct SQL, migration, package install, lockfile change, app-code change, or secret copy was used during closeout.

Batch 21D proof note: `PAY-018` and `PAY-020` are satisfied by disposable QA payroll boundary runtime proof in `output/qa/batch21d/BATCH21D-payroll-boundary-runtime-proof.json`. Missing payment/owner verification was blocked in the UI; hardened settlement RPC calls rejected missing payment mode and missing owner verification; valid UI settlement succeeded; legacy direct settlement RPC was permission denied; empty reversal code kept reversal disabled; invalid code was rejected while settlement stayed paid; a valid one-time code reversed to pending; consumed-code reuse was rejected; and legacy direct unsettle RPC was permission denied. No production mutation, direct SQL, Supabase command, migration, package install, lockfile change, app-code change, or secret copy was used during proof.

Batch 20 proof note: `PAY-018`, `PAY-020`, and `PAY-027` were source-fixed and `code_verified`, not pass. Payroll settlement now requires the hardened owner/payment-mode/verified-owner RPC boundary; payroll reversal now requires hardened database-transaction access-code validation; online Kharchi now inserts the worker advance and supervisor float transaction in one RPC transaction. Batch 21D later closes `PAY-018` and `PAY-020`; `PAY-027` remains `code_verified` pending disposable QA runtime proof.

## Idempotency and Unknown Outcomes

High-value mutations must be retry-safe. A network timeout is an unknown outcome, not a definite failure.

Required proof:

- Client sends an idempotency key for duplicate-prone operations.
- Server stores and enforces one result per operation key.
- Timeout UI checks operation status before inviting retry.

## Offline, Cache, and Account Switching

Persisted local data is tenant-bound and session-bound. Logout or account switch clears sensitive persisted cache, local drafts, and mutation queues unless they are cryptographically inaccessible and scoped to the next same user session.

Required proof:

- No previous org data appears after logout/login to another account.
- IndexedDB mutation queue cannot replay under a different user/org.
- Public privacy/PWA text matches actual implementation.

Batch 9 proof note: `OFF-002`, `OFF-005`, `OFF-006`, `OFF-008`, `SEC-016`, and `PAY-028` are satisfied by public `/offline` and `/_offline` route proof, awaited auth-boundary cleanup, persisted user-cache and IndexedDB queue cleanup, truthful online-only kharchi behavior, and privacy/public copy that no longer claims unsupported offline write sync. `OFF-007` still needs production service-worker update proof with an active draft, `OFF-010` still needs throttled slow/intermittent-network runtime proof, and `OFF-009` remains open for unknown-timeout UX.

## Release Readiness

The pilot build must be reproducible, migrated, tested, observable, backed up, and rollback-ready.

Required proof:

- Clean install succeeds from lockfile.
- Lint, Vitest, build, and audit gates pass or have documented risk acceptance.
- Production migration head equals approved repository migration head.
- Sentry release/source maps exist for the deployed commit.
- Backup restore and rollback/forward-fix are exercised in disposable infrastructure.

Batch 7 proof note: `TECH-013` is satisfied at source level by `test: vitest run`, `prebuild: npm run test`, release-runtime config tests, and a passing `npm run build` that executed the prebuild Vitest gate. Batch 8 proof note: `TECH-007` is satisfied for repository migration head `20260628185344` by supplied Supabase migration-list evidence showing local/remote alignment with no pending, failed, or out-of-order migrations. Batch 8B proof note: `TECH-010` is satisfied by fresh production Sentry release `2538da25b2fa` with 529 source-map artifacts. These do not close clean install, audit, live Sentry payload inspection, restore, rollback, deployed WhatsApp, or final clean signoff evidence rows.
