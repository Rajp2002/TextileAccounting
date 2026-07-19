# Orders and Market Runs

Last analyzed from the active codebase on June 1, 2026.

## Phase 1 Status

Core Phase 1 pillar. Orders and market runs connect commercial intent to loom execution. Production mode controls which workflow is visible: `market_run`, `order_based`, or `both`.

## What It Does

Orders represent committed party-backed production. Market runs represent speculative production for godown stock. Both are tracked through production logs, owner analytics, stock movement, and commercial profit visibility (including receivables and payments).

## User Workflow: Order

1. Owner saves a quote from the estimator.
2. Owner marks the quote accepted in `/owner/quotes`.
3. Owner converts it into an active order with target meters, deadline, and notes (or uses "Start Party Order" fast path from Estimator).
4. Owner opens `/owner/orders`.
5. Owner reviews order cards by status, pace, progress, deadline, cost, and margin.
6. Owner opens the order detail drawer.
7. Owner assigns machines.
8. Supervisor logs production against that order.
9. Owner monitors progress and pace.
10. Owner sells/dispatches order output from sold stock entries when output is ready.
11. Owner marks the order complete or cancelled where appropriate. Completing, cancelling, or deleting an order automatically unlinks any assigned looms/machines and sets them to `inactive` status.

## User Workflow: Market Run

1. Owner opens estimator in market mode or clicks New Run from `/owner/market-runs`.
2. Owner uses the same costing engine but creates a speculative run instead of a party quote.
3. Supervisor logs production against the run/order anchor.
4. Production creates expected godown stock from the production ledger.
5. Owner reviews produced meters, expected in-godown meters, sold meters, revenue, cost, profit, and status.
6. Owner sells market-run stock to a saved or newly captured party, creating a receivable and `party_id` link where available.
7. Owner dispatches pending sold meters in one or more batches and reviews any receipt variance.
8. Owner closes the market run when production is complete. Closing a market run automatically sets all backing orders to completed, unlinks all assigned machines/looms, and sets them to `inactive`.
9. Closed/sold-out market-run stock lots with no saleable meters move out of Active Stock; pending dispatch remains tracked from Dispatches and Party Ledger.

## Existing Workflow Translation

Old workflow:

- Client orders are written on a board or in a register.
- Production progress is manually estimated from rolls or end-of-day updates.
- Speculative market fabric is tracked informally.
- Machine assignment is communicated verbally.

Weavly workflow:

- Orders and market runs are digital production anchors.
- Progress is computed from production logs.
- Pace and deadline risk are visible.
- Market production gets cost and profit visibility.

## Pain Points Solved

- Deadline blindness.
- Machine under-utilization.
- Confusion between client work and market work.
- Inability to know whether speculative production is profitable.
- Manual handoff errors between owner and supervisor.

## User Interaction Details

- Order cards show progress, days remaining, and pace color.
- Order detail includes quote cost stack and total order value.
- Machine assignment is managed inline.
- Protected edits can require owner access code.
- Dispatch summary appears from the order detail.
- Market-run cards show target, produced, godown, profit, and sale count.

## Data and Code

- `app/(dashboard)/owner/orders/OrdersClient.tsx`
- `app/(dashboard)/owner/orders/actions.ts`
- `app/(dashboard)/owner/market-runs/MarketRunsClient.tsx`
- `app/(dashboard)/owner/market-runs/[id]/MarketRunDetailClient.tsx`
- `app/(dashboard)/owner/estimator/actions.ts`
  - `convertAcceptedQuoteToOrder` / `startPartyOrderFromEstimator`
  - `getActiveProductionTargets` — fetches active party orders and in-production market runs for the cost-analysis picker. Queries `orders` and `market_run_summary`. Cached 30 s in `MachineManagement` via TanStack Query `staleTime`.
  - `assignMachineProductionTarget` — links a loom to a cost analysis (party order or market run). For market-run targets, calls `ensureActiveOrderForMarketRun` to auto-create or reactivate the backing `orders` row.
- `components/MachineManagement.tsx` — owner loom management card. Production targets query uses `staleTime: 30_000` and `keepPreviousData` to avoid cold-start blank flicker.
- `orders`
- `market_runs`
- `market_run_sales`
- `machine_assignments`
- `shift_assignments`
- `production_logs`
- `market_run_summary` view (8 correlated subqueries; indexed by migration `20260531050000`)

## Downstream Effects

- Supervisor production log pulls active orders/runs.
- Owner analytics summarizes order health.
- Market-run production contributes to expected stock without requiring daily Stock Inward confirmation.
- Order-based/direct workflows may still use inward drafts where needed.
- Order-linked dispatches attach to orders; public third-party tracking is deferred.
- Market-run stock can be sold and dispatched without creating a fake party order.
- Sell Stock resolves active party identity through selected party, unique exact-name match, or new-party creation with phone/GSTIN where needed.
- Party Ledger aggregates expected and realized profit alongside party dues and payments.
- Completing, cancelling, or deleting an order, or closing a market run, automatically triggers unlinking of assigned machines/looms and sets their status to inactive, ensuring clean loom allocation.

## Readiness Notes

- Order/run selection must be unambiguous for supervisors.
- Pace calculations must be clear enough for owners to trust.
- Market runs should stay distinct from party orders while reusing the same production machinery.
