# Domain Invariants

Every remediation task must cite the relevant invariant before code changes are proposed.

## Terminology and business-event separation

Operator-facing wording must preserve these non-interchangeable concepts: Counter Reading / Metres Produced This Shift; Fabric Quality / Market Run / Party Order; Cost Estimate / Quotation; Metres Sold / Sent / Received; Sale / Dispatch / Party Receipt Confirmation; Piece-rate / Salaried Worker; Upaad / Kharchi / Hisaab payout / Inam / Kapaat; and `kg/100m` / `m/kg`. A terminology change must propagate to every product/output surface without changing stable technical identifiers or collapsing business events.

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
- Costing width is the estimator's sole fabric-width input and drives weft formula costing.
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

## Production checkpoint invariant note — 2026-07-13

The production migration head is aligned through `20260711180000`, and the checkpoint release is live at `https://textile-accounting.vercel.app`. Deployment alignment alone is not runtime proof for a formal row. In particular, production schema lint still detects six legacy stored functions whose compiled bodies reference incompatible or removed schema contracts. Until isolated audit/debugging proves repair or safe retirement, no workflow depending on those functions may receive pass credit solely from this deployment.

## Single-shift activation and context history — Batch 7

A loom is operationally active when it has an active production target and at least one active assigned shift worker. A factory does not need both day and night assignments merely to run one valid shift; production for an unassigned selected shift remains blocked. Migration `20260713124500` enforces this rule at the database boundary, matching the application setup and selected-shift policy.

Replacing a loom's current production context or assigning another shift operator must affect only new logs. Existing logs retain their order/context ID, worker/operator ID, assignment ID, and rate snapshots. Batch 7 proved this with a 40m day Context A/Worker A/₹2.50 grain and a later 55m night Context B/Worker B/₹3.25 grain, including matching reserved stock and ₹278.75 aggregate payroll basis.

A chosen production date is part of the mutation identity and must not be overwritten by mode, meter, draft-restore, or loading-state changes. `NEEDS-AUDIT-004` records a current violation of this invariant; dated-flow rows remain blocked until repaired.

Batch 8 proof supersedes that violation for production logging. A dated shift assignment is authoritative only for its selected date and shift; it may override the standing worker and rate without mutating the standing assignment. The server must derive this authority from persisted tenant-scoped data, not a client-supplied substitute. Historical production is valid on or after `orders.start_date` regardless of when the order row was created. The dated worker, rate, order, date, shift, production metres, and generated stock must survive refresh and produce payroll for the dated worker only. The 2026-07-12 Worker B / 32m / ₹3.25 / ₹104 proof satisfies this invariant for `MASTER-011`.

## B09 production resilience invariants

- A production row with positive metres requires an authoritative order/run, worker/operator, and positive rate. Missing context and negative metres mutate nothing; zero-metre Other downtime requires a non-empty note.
- A shift draft belongs to one organization, user, date, and shift. Refresh may restore it only under that grain and must visibly label it unsaved. Offline or pre-request failure cannot claim success. Post-request timeout is an unknown outcome until authoritative server state matches the complete submitted set.
- Same-grain submissions are atomic: concurrent supervisors may produce only one accepted initial result, one production grain, and one generated stock grain.
- Copy previous is available when no loom is actually assigned even if placeholder assignment rows exist. It copies only the selected source date/shift and yields one editable target grain without duplicating history.
- Machine status and dated breakdown detail are independent persisted facts. Breakdown save must verify an affected row; if the tenant/date/shift/machine grain is absent, it must insert it, recover safely from a unique race, and never return success for zero affected rows.
- A 20-loom phone workflow must retain unique accessible metre-input names, no horizontal overflow or cross-row value leakage, and a reachable fixed submit action. The loom details dialog must have an accessible title.

## B10 protected date and India calendar invariants

- Production correction after the open window requires a valid, unexpired, unconsumed owner access code. Invalid, expired, and used codes mutate nothing; a successful correction consumes the code exactly once.
- A paid payroll settlement freezes its production grain. Even a fresh valid owner code cannot rewrite production that contributes to a settled payroll period.
- Supervisor attendance writes are date-bound at both application and database policy layers. Future attendance is unavailable; supported past-date changes require owner authorization and must survive refresh as locked history.
- India month/year boundaries must be derived from one authoritative instant and expressed as a half-open interval. The first and last in-month instants are included; adjacent-month instants are excluded without host-timezone drift.
- Year rollover and leap day are valid calendar/payroll boundaries and must not be approximated with fixed day counts.
- A rate-limit reset timestamp is absolute epoch time; user-facing retry text must display remaining duration computed against the current clock, never the epoch value itself.
- Start Party Order is one atomic boundary: the accepted quote, active order, reciprocal links, and yarn requirement either all persist or none do.
- Over-target production must reject before mutating production logs, order progress, generated stock, or payroll basis.
- Completion and cancellation unlink looms without erasing production or source-linked order-reserved stock; protected history must not be physically deleted.
- Order-linked sales and partial dispatches retain party, order, quote, stock-lot, receivable, receipt, discrepancy, and claim lineage.
- Receipt shortage/excess updates dispatch reconciliation and discrepancy state without rewriting original production or generated stock history.
- Customer collections and worker payroll settle independently against the same immutable production history; a paid payroll grain remains correction-protected.

## B12 market stock and dispatch invariants

- A relational stock source is valid only when every referenced market run, order, and quote belongs to the lot organization and the quote/order/market-run relationships agree. Manual/opening stock cannot carry relational source IDs. The database must enforce this for every client, not only application actions.
- Ordinary quantity updates on an already valid lot remain concurrency-safe and are not reinterpreted as source creation; sale and adjustment against the same lot serialize so at most one over-consuming mutation succeeds and stock never becomes negative or double-used.
- Market summaries include both legacy direct market sales and current fabric-stock sales. Sold-out and archived truth must retain produced, sold, godown, and sale-count history after dispatch and receipt.
- Sale, dispatch, and receipt are separate states. A sold-out run may legitimately retain pending dispatch; partial dispatch leaves the remainder actionable; exact receipt changes delivery reconciliation without rewriting original production or stock-sale history.
- E-way, challan, and transporter handling is an advisory checklist unless the required compliance dataset is complete. Above-threshold truth must not falsely claim completion when fields are absent; below-threshold truth must not claim that no legal review is required.
- Party display names are not identities. New receivables retain explicit `party_id`; normalized duplicate names with distinct parties remain separate, with legacy name fallback only where an ID is genuinely absent.
- Market-summary reads must be fresh across authenticated sessions after mutations and remain within the formal two-second budget for at least the exercised 26-run dataset.

## B13 payroll and worker-money invariants

- Payroll gross is server-derived from immutable production meter/rate snapshots. Client-supplied gross is not authoritative, and historical rate changes cannot rewrite prior snapshots.
- Settlement is unique and serialized by organization, worker, worker type, and cycle. Concurrent first-settlement attempts yield exactly one settlement and deduct each advance at most once.
- Standard advance recovery is capped at 50% of gross for the exercised policy; unrecovered debt remains explicit. Inam and kapaat require itemized reasons/notes, and net payout never becomes negative.
- A deducted or settlement-linked advance cannot be deleted directly. Only an authorized reversal transaction may restore it, and the reversal must restore exact prior debt/status while consuming its one-time authorization.
- Final-exit payroll, permitted recovery, explicit remaining debt, and worker deactivation are one transaction. Failure cannot leave a paid active worker or an inactive unsettled worker.
- Supervisor Kharchi is one coherent operation: supervisor float decreases by the same amount that one worker advance increases, or neither mutation persists.
- Factory Today must read current production/market summary fields that exist, and its meters, shift state, work-at-risk, advance, and payroll signals must reconcile to persisted source data without duplicate updates.
- Golden A and Golden B payroll use the same immutable production-backed settlement/payslip history; customer/order/market origin does not permit a second payroll basis for the same production.

## B14 realtime dashboard invariants

- A fulfilled Supabase response that contains an `error` is a failed dashboard source, not empty data. It must reach an actionable error state and retry boundary.
- Realtime events are invalidation signals: refreshed authoritative slices replace current totals. Client code must not add the event payload to a value that the server query already includes.
- A reconnect uses a new channel topic/epoch after the previous channel leaves. Data written while disconnected must appear through an authoritative refetch without duplicate or stale-channel totals.
- Worker breakdowns order by the canonical `production_logs.submitted_at` timestamp and resolve the meter-worker identity consistently; removed columns cannot remain in deployed RPCs.
- Order health derives produced, remaining, days, required pace, and pace index from persisted production. Zero production remains visibly at risk, and a future critical deadline is not labeled overdue.
- Loading/reconnecting, source error, offline, historical empty, and live connected states are distinct and actionable.
- The dashboard must return the complete exercised 90-day/1,800-log range in under two seconds without truncation or UI freeze.

## B15 authentication, privacy, audit, and adversarial UX invariants

- Recovery credentials are single-use and time-bounded: only a fresh unused token may change a password; reused, old-password, and expired paths fail closed.
- The one-hour inactivity boundary must remain observable after the threshold. Its cookie is HttpOnly and SameSite=Lax, and an expired authenticated request redirects without leaking tenant/user content.
- Auth limiter identity is the normalized first forwarded client IP plus route key. One proxy client must not create a global lockout bucket for unrelated clients.
- Owner export is available from the shared responsive Settings flow for every plan, contains only the authenticated organization, and must write its actor/org/record audit before delivery.
- Worker erasure is one owner/actor/tenant-validated database transaction: direct PII is anonymized, the worker is inactive, immutable production/payroll basis remains, and retained old/new audit payloads cannot preserve worker PII or client IP.
- A valid session is insufficient for a cross-origin protected mutation. Foreign-Origin server actions fail without mutation or sensitive response content.
- Stored party, quality, worker, dispatch, note, and template text is rendered as inert data across owner surfaces; markup cannot become an image, event handler, or executable script.
- Custom interactive cards and disclosures support keyboard activation and state semantics; icon-only actions have accessible names. At 200%-equivalent layout, totals and visible actions remain unclipped without horizontal overflow.
- PWA readiness claims are split honestly: manifest/icon/scope/start/update proof does not substitute for observing a real install and standalone reopen.

## B16 WhatsApp delivery invariants

- Deterministic provider simulation is permitted only when `WHATSAPP_PROVIDER=simulate`; production Meta configuration must never enter simulator branches implicitly.
- Consent is bound to the exact organization, recipient identity, and normalized phone. Missing consent, opt-out, missing phone, and phone mismatch are distinct durable skip outcomes.
- A WhatsApp provider timeout or rejection cannot roll back the underlying advance, payroll, or access-code business operation. Delivery history records the communication outcome independently.
- Payslip content is worker-and-phone-bound and cannot leak itemized data on mismatch. Access-code delivery is owner-only, and persisted snapshots cannot retain the plaintext code.
- Retry preserves historical attempts, is tenant/log targeted, uses an atomic claim, never exceeds three attempts, and leaves capped or stale rows untouched.
- Daily, monthly, and deadline briefs use independent idempotency/cooldown grains; one brief type cannot suppress or duplicate another.
- A simulated rejection or expired token proves fallback handling but does not satisfy a matrix row that explicitly requires a live provider event.

## B17 Razorpay lifecycle invariants

- Razorpay HMAC verification precedes event claim or business mutation. An invalid signature creates no event-ledger, payment, subscription, referral, or refund effect.
- Event identity is content-bound: the same provider event ID and body is a successful duplicate; the same ID with a different body is a conflict. Neither path may repeat entitlement, conversion, or refund effects.
- Provider-canonical order/payment state is authoritative. `order.paid` and `payment.captured` converge on one capture, and late failure cannot regress a captured payment.
- Subscription lifecycle is monotonic. A failed renewal and cancellation preserve access through the already-paid period; a successful renewal appends exactly 365 days from the current paid-period end; stale events cannot undo cancellation or expiry.
- Referral conversion and refund reservation are database-serialized before provider activity. Exactly one 10% refund uses a stable provider idempotency key; replay cannot reserve or send another refund.
- Period expiry removes gated access from the current authenticated session without deleting the account, profile, subscription, payment, or referral history.
- Hosted payment proof uses explicit Razorpay TEST mode only. A TEST capture/refund is evidence of provider-boundary behavior, never evidence that real money moved.

## B18 recovery invariants

1. A restore pass requires business reconciliation, not merely a successful import: organization, identity, production, stock, receivable, and payroll grains must match the backup's canonical digest.
2. Restored authentication must be exercised independently; database row restoration alone cannot prove an operable recovery.
3. Backup retention/scheduling and restore mechanics are separate gates. A successful disposable restore does not imply that a recoverable production backup exists.
4. Application rollback proof must identify both candidate and last-known-good deployments, return the active route to the intended source commit, and include an HTTP runtime check.
5. Non-reversible database changes use a reviewed forward-fix with preserved recovery provenance; destructive down-migrations are not an acceptable default.
6. Recovery exercises must use disposable infrastructure, record elapsed recovery time, and reconcile fixtures, private backup material, temporary schema objects, worktrees, and provider projects to zero.
7. No recovery rehearsal may mutate the live production database or production alias unless an incident commander explicitly authorizes that scope.
8. A PostgreSQL dump protects Storage metadata, not Storage object bytes. A database-only backup must fail closed when pilot-critical objects exist unless a separate retained object-byte export is restored and hash-verified.
9. Backup artifacts must identify source project, source commit, capture time, tool version, retention and integrity hashes without disclosing credentials or contents. Plaintext dumps and decrypt identities are never committed.
10. The exact retained scheduled artifact selected for closure must be the artifact restored; a fixture, manual-only run, configuration screenshot, or successful backup without restore cannot substitute.

## B19 external-evidence invariants

1. Source code, unit tests, clean logs, or configuration-key presence cannot substitute for direct inspection when a row explicitly requires a live provider payload.
2. Observability review is read-only. Sentry output must redact PII and must never echo or persist authentication tokens, raw stack traces, email addresses, or IP addresses.
3. Legal-readiness wording requires qualified-counsel evidence; QA may identify the dependency but cannot issue legal approval.
4. Factory terminology approval must identify a human reviewer and capture approve/change decisions for the required terms.
5. A product owner or facilitator cannot substitute for the named factory-supervisor role unless they truthfully perform and sign in that factory-side role.
6. Terms that distinguish money, stock quantity, production measurement or inverse textile units require explicit contextual approval; source consistency alone cannot decide them.
5. A Golden Journey truth comparison needs an independent business-accepted reference containing both inputs and expected totals; application-generated output is not its own oracle.
6. Daily supervisor sign-off needs an independent dated shift register; application totals cannot self-attest.
7. An unavailable external artifact remains an honest blocker with the smallest closure dependency. No external review row inherits PASS from adjacent technical evidence.

## Remaining-gate scope and disabled-provider invariants

1. Every canonical requirement has a `release_scope`; unresolved rows influence the limited-pilot verdict only when `pilot_gating=true`.
2. `not_applicable` is not PASS. It is permitted only for an exact requirement outside pilot scope or an absent capability and must link to a named post-pilot backlog acceptance test.
3. WhatsApp defaults to disabled. Missing, empty, or unrecognized provider configuration cannot call Meta and cannot require provider secrets for a core workflow.
4. A disabled notification path cannot create an inaccessible supervisor access code or claim message delivery; owner/manual handoff must remain truthful and actionable.
5. Signed callback proof, approved templates, account activation, real-message evidence, and live provider failure drills are post-pilot and cannot be smuggled into infrastructure-readiness PASS claims.
6. A timed-out mutation has an unknown outcome until authoritative state is checked. The control remains guarded against blind repeat submission, and a reconciled success requires exactly one matching persisted grain.
7. Slow-network PASS requires usable core mobile screens and repeat-submit prevention; it does not claim offline write queuing or background sync.
8. Fixture cleanup must verify the same target used for setup. QA/production target mismatches fail closed, and an exact disposable prefix must reconcile to zero before evidence is accepted.
9. `TECH-011`, `UX-012`, and `GOLDEN-A-03` remain genuine limited-pilot gates because they protect recovery, operational comprehension, and financial truth respectively.
10. `SIGNOFF-04` is a mandatory first-shift operating control. An unexplained app/register variance pauses pilot operation even though the row does not block the first supervised session.

## Base Estimator invariants — 2026-07-22

1. Production cost is the immutable recipe production stack. Commission, transport, GST, or margin cannot be relabeled as production cost.
2. A costing revision keeps its historical yarn rates, cost breakdown, quantity, selling assumptions, group identity, monotonic version, and creation date after later rate changes.
3. A known positive yarn rate in a saved quality cannot be masked by a pre-seeded zero Rate Book placeholder.
4. Base entitlement semantics are identical in application checks, server actions, routes, and RLS, including start/end times and grace behavior.
5. A reviewed rate update is all-or-nothing across the Rate Book, history, optional factory default, and every matching saved-quality layer. A failure leaves every surface unchanged; partial success is forbidden.
6. Customer PDF output cannot contain internal costs, overhead, margin, break-even, or expected-profit data.
7. Organization export fails if any promised dataset fails and remains owner-accessible after plan expiry without widening tenant scope.
8. Disposable production QA uses an exact `BASEGO-*` identity and must reconcile organizations, profiles, subscriptions, estimator data, rates, audit rows, and Auth users to zero.
9. Export audit writes are server-mediated. PUBLIC, anon, and authenticated clients cannot execute the SECURITY DEFINER logger directly; the service-role caller must supply an existing same-organization owner or an admin actor, and every unauthorized attempt leaves no row.
