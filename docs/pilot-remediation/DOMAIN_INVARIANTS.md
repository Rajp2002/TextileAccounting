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

## Release Readiness

The pilot build must be reproducible, migrated, tested, observable, backed up, and rollback-ready.

Required proof:

- Clean install succeeds from lockfile.
- Lint, Vitest, build, and audit gates pass or have documented risk acceptance.
- Production migration head equals approved repository migration head.
- Sentry release/source maps exist for the deployed commit.
- Backup restore and rollback/forward-fix are exercised in disposable infrastructure.
