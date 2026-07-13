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

## Audit And Export Boundaries

Security and compliance evidence must be created before sensitive payload delivery or protected settings mutation is considered complete.

Required proof:

- Settings changes create audit rows with actor, org where applicable, action, record, before/after context, timestamp, and redacted sensitive values.
- Owner exports are current-org only, audited before payload delivery, and exclude or redact sensitive worker/profile/runtime fields.
- Runtime secrets, auth headers, cookies, request bodies, service-role keys, Supabase keys, and DB URLs are never emitted in export payloads, logs, docs, or proof artifacts.

Batch 24G production reconciliation note: `SEC-015` and `SEC-009` are source-fixed and `code_verified`, not pass. A production DB push reportedly occurred while linked to production ref `vzhwahudircrpgtitwzd`, applying `20260705100000_batch_24g_security_audit_guardrails.sql` and `20260705182406_harden_settings_audit_function.sql`; no rollback or additional DB command was run during reconciliation. `SEC-015` still needs controlled settings-change audit-row proof with redacted payloads, and `SEC-009` still needs owner export browser/security proof plus audit-log EXPORT proof. Runtime remediation later closed `SEC-017` and `AUTH-008`; the fresh isolated Premium Settings blank-content observation remains a separate `SEC-009` debugging prerequisite.

## Production Logs

A valid production row belongs to exactly one tenant, machine, date, shift, active worker, and active order/run context. Positive meters require a worker-rate snapshot. Zero-meter downtime never creates quantity or wages.

Core equation:

```text
produced meters = sum(valid positive production_logs.meters)
piece-rate gross = sum(log meters x stored worker-rate snapshot)
```

Batch 15 proof note: `DASH-003` is source-fixed and `code_verified`, not pass. Factory Today now computes `grossWagesSoFar` from existing cycle production logs using `sum(nonnegative meters x nonnegative worker_rate_snapshot)` and focused tests cover the helper/source wiring. It still needs disposable after-shift runtime proof before pass.

Batch 22 proof note: `ORDER-005`, `ORDER-009`, and `PROD-011` are source-fixed and `code_verified`, not pass. Migration `20260702121238_batch_22_production_order_boundary_hardening.sql` adds a forward-only nonnegative-meter table check, direct table trigger, and hardened `replace_shift_production_logs` guard so over-target totals, cancelled/completed/stale-assignment order-attributed logs, and negative meters are rejected before production can feed progress, generated stock, or payroll basis. The migration is not applied and disposable QA runtime/API proof is still required before pass.

Batch 24B proof note: `PROD-013`, `PROD-023`, and `PROD-029` are source-fixed and `code_verified`, not pass. Suspicious large positive shift meters now show a non-blocking confirmation at 10,000m, restored localStorage drafts now show a visible unsaved-draft indicator, and public/setup production copy now uses shift-total/shift-meter terminology instead of raw opening/closing meter-reading proof claims. QA/browser proof is still required before pass. `PROD-022` was outside Batch 24B and is later source-fixed by Batch 24D pending browser proof.

Batch 24C established Factory Today setup checklist source rules using persisted costing evidence, active linked loom targets, worker assignments, active workers, and bounded payroll config values; Batch 24F updated the assignment rule to selected-shift/day-only policy. Formal blocked-row Batch 5 closed `SETUP-011` after repairing the deferred checklist request lifecycle: Strict Mode cleanup must not discard a completed shared request. Isolated browser/database proof rendered exactly 11 of 14 Both-mode steps complete before and after refresh, with the three later operational milestones correctly incomplete and `Log first production` next.

Formal blocked-row Batch 6 established the setup mutation failure invariant for `SETUP-007`: a rejected machine-save request must not mark the step complete, create a row, or leave the action permanently disabled. It must report a retryable connection error, clear saving state, and allow the same form to succeed once; the successful retry must create one logical machine and remain complete after refresh.

Batch 24E source note: duplicate loom names are guarded on normalized org-scoped add, bulk-add, and rename paths, and migration `20260704120000_batch_24e_master_data_loom_guardrails.sql` uses a trigger-backed duplicate guard instead of a retroactive unique index. Formal blocked-row Batch 4 later closed `MASTER-002` with isolated browser/database proof: duplicate types generated distinct names, normalized duplicate insert/rename returned 23505, same-name cross-tenant creation remained valid, and same-type different-name creation remained valid. The same batch closed `MASTER-003` and `MASTER-005`: changing a history-bearing loom's name/type preserved its machine ID, active target, two standing assignments, dated assignment, and production log; deactivate/delete remained blocked while unused-loom deletion remained allowed. Runtime remediation separately closed `MASTER-014` with isolated concurrent-editor, rollback, and caller-RLS proof.

Batch 24F proof note: `PROD-002` and `PROD-004` are source-fixed and `code_verified`, not pass. Selected-shift worker policy now allows day-shift/day-only production without requiring a night worker, blocks night-shift production without a night worker with an actionable accountability error, and keeps day-only setup/checklist/activation from falsely failing for missing night worker. Substitute-worker mismatch now returns explicit reassignment-required behavior; no unsafe substitute persistence was added, and production is not silently attributed to the wrong assigned worker. Browser/runtime proof is still required before pass. Runtime remediation later closed `SIGNOFF-01` with current-run loom accountability proof.

Required proof:

- No negative meters at UI, server action, RPC, or table boundary.
- No production against cancelled orders or unassigned machines.
- One authoritative row per organization, machine, date, and shift according to the active database constraint/RPC.

## Dashboard Read Models

Dashboard and Factory Today read models must not mix selected-date facts with current-only operational state. Historical views must either scope their data to the selected date or hide/clear inherently current-only cards.

Batch 24C proof note: `DASH-004` is source-fixed and `code_verified`, not pass. Historical Analytics now returns full selected-date state, scopes the seven-day trend to the selected date, clears current-only today/orders/machines values for historical dates, and replaces client state instead of merging stale current data. Browser/runtime proof is still required before pass.

Formal blocked-row Batch 2 proof note (2026-07-13): a fresh zero-data Premium tenant confirmed the empty Factory Today invariant; active Base/Premium subscriptions confirmed module gates while Billing remained reachable; mobile navigation/logout and reciprocal role copy remained operable; and regenerated-old join codes failed while the current code resolved only the intended organization. These are runtime-confirmed invariants, not source-only claims.

Formal blocked-row Batch 3 proof note (2026-07-13): validation failures must retain operator input without creating partial identity rows; a referral code may create exactly one cross-org relationship and must reject self/duplicate use; and explicit session revocation must be checked on every new authenticated request because otherwise-valid access JWTs can outlive the revocation event. Isolated QA browser/API/database proof satisfied all three invariants.

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

Batch 24A proof note: `PAY-006` is source-fixed and `code_verified`, not pass. Attendance RLS date boundaries are hardened so supervisors can only directly insert/update today's attendance and owners today or past. Future dates are blocked. Supervisor past-date saves route through `savePastAttendance` with save-time owner access-code validation. Database migration exists but is not applied, requiring QA runtime verification before pass.

## Idempotency and Unknown Outcomes

High-value mutations must be retry-safe. A network timeout is an unknown outcome, not a definite failure.

Required proof:

- Client sends an idempotency key for duplicate-prone operations.
- Server stores and enforces one result per operation key.
- Timeout UI checks operation status before inviting retry.

Batch 24D proof note: `EST-017` is source-fixed and `code_verified`, not pass. Estimator Save Quote and Save & Create Market Run now guard the client path with a synchronous `saveQuoteLockRef` before `createMarketRunFromEstimator` or `saveEstimatorQuoteV3`, keep save/create controls disabled while saving, and reset the lock in `finally`. Evidence is `output/qa/batch24d/BATCH24D-submit-draft-isolation-proof.json`, `__tests__/batch24d-submit-draft-isolation.test.ts`, focused Batch 24B compatibility tests, the estimator/quote/order and supervisor/production regression pack, TypeScript, targeted ESLint, JSON validation, and `git diff --check`. This does not claim server/database idempotency; browser rapid double-click proof remains required before pass.

Batch 24D production draft note: `PROD-022` is source-fixed and `code_verified`, not pass. Supervisor production drafts are now scoped by org, user, selected date, and shift through `lib/production-drafts.ts`; the dashboard uses `userProfile.org_id` and `userProfile.userId`, avoids unsafe date/shift-only fallback keys, ignores stale date/shift fetch completions, restores only the active draft, and saves with the currently selected date/shift. Batch 24B restored-draft indicator and large-meter warning behavior remain compatible. Browser proof of org/user/date/shift draft isolation and save payload date/shift remains required before pass.

## Runtime Rerun Invariant Clarifications - 2026-07-10

Tenant isolation invariant: an authenticated member of Org A must not read an Org D organization row by guessed ID unless a narrowly documented pre-membership join-code flow explicitly returns a safe projection. Machine-level isolation passing does not compensate for organization metadata exposure. `AUTH-012` now satisfies this invariant: production migration `20260710210828` removed the public permissive organization lookup policy, and isolated production proof passed own read/update plus cross-tenant organization/profile/machine denial and persisted non-mutation.

Piece-rate ownership invariant: the product must have one documented authoritative source for the rate used by production and payroll. The runtime currently derives rate from costing/quality/order context, while `MASTER-006` expects a decimal rate on the worker master. This is an unresolved contract mismatch, not a proven invariant change. No matrix rewrite should occur until product ownership of the rate is decided.

Assignment lifecycle invariant: deactivating a worker must make current standing assignments non-operational and visibly incomplete without rewriting immutable historical production attribution. Server-rendered, client-rendered, Factory Today, Machines, and supervisor readiness must agree on whether an assignment is current.

Production-write invariant: saving a shift must either atomically persist the complete scoped log set or persist nothing with an actionable error. Every update in that path must be constrained by tenant and record identifiers; a generic `UPDATE requires a WHERE clause` is a blocking runtime failure, not a retry-safe outcome.

Unknown-outcome invariant (OFF-009, 2026-07-13): a client response timeout is not proof that a mutation failed. The UI must label the outcome unknown, avoid blind resubmission, and reconcile against authoritative tenant-scoped state. Success may be reported after a timeout only when the persisted replacement state exactly matches the submitted machine, meter, and zero-reason set; otherwise the operator must be told to refresh and check before retrying.

Activation-rule invariant: application validation and deployed database constraints must enforce the same required shift coverage. A UI rule permitting either day or night cannot coexist with a database rule requiring both without creating false-ready and failed-save states.

## Offline, Cache, and Account Switching

Persisted local data is tenant-bound and session-bound. Logout or account switch clears sensitive persisted cache, local drafts, and mutation queues unless they are cryptographically inaccessible and scoped to the next same user session.

Required proof:

- No previous org data appears after logout/login to another account.
- IndexedDB mutation queue cannot replay under a different user/org.
- Public privacy/PWA text matches actual implementation.

Batch 9 proof note: `OFF-002`, `OFF-005`, `OFF-006`, `OFF-008`, `SEC-016`, and `PAY-028` are satisfied by public `/offline` and `/_offline` route proof, awaited auth-boundary cleanup, persisted user-cache and IndexedDB queue cleanup, truthful online-only kharchi behavior, and privacy/public copy that no longer claims unsupported offline write sync. The 2026-07-11 runtime-remediation campaign closes `OFF-007` with production service-worker update proof while an exact draft remained recoverable. `OFF-010` still needs throttled slow/intermittent-network runtime proof, and `OFF-009` remains open for unknown-timeout UX.

## Release Readiness

The pilot build must be reproducible, migrated, tested, observable, backed up, and rollback-ready.

Required proof:

- Clean install succeeds from lockfile.
- Lint, Vitest, build, and audit gates pass or have documented risk acceptance.
- Production migration head equals approved repository migration head.
- Sentry release/source maps exist for the deployed commit.
- Backup restore and rollback/forward-fix are exercised in disposable infrastructure.

Batch 7 proof note: `TECH-013` is satisfied at source level by `test: vitest run`, `prebuild: npm run test`, release-runtime config tests, and a passing `npm run build` that executed the prebuild Vitest gate. Batch 8 proof note: `TECH-007` is satisfied for repository migration head `20260628185344` by supplied Supabase migration-list evidence showing local/remote alignment with no pending, failed, or out-of-order migrations. Batch 8B proof note: `TECH-010` is satisfied by fresh production Sentry release `2538da25b2fa` with 529 source-map artifacts. These do not close clean install, audit, live Sentry payload inspection, restore, rollback, deployed WhatsApp, or final clean signoff evidence rows.

## Runtime Rerun Batch 3 Invariants

- Cancelling an order must unlink and inactivate only looms whose `current_order_id` matches it.
- A worker phone change requires consent reconfirmation; the worker and single org/person/channel consent row must agree on the latest valid number. Editing contact data must not itself send WhatsApp.
- Every estimator row contributes once; unit conversion preserves the canonical calculation; optional costs are gated; direct overhead replaces itemized overhead; and capacity/idle cost reconciles from visible inputs.
- Saved qualities remain org-scoped across save, rename, rate/full update, apply, refresh, and soft delete.
