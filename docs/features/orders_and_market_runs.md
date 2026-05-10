# Orders and Market Runs

Last analyzed from the active codebase on May 6, 2026.

## Phase 1 Status

Core Phase 1 pillar. Orders and market runs connect commercial intent to loom execution.

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
10. Owner creates dispatches from the order when output is ready.
11. Owner marks the order complete or cancelled where appropriate.

## User Workflow: Market Run

1. Owner opens estimator in market mode or clicks New Run from `/owner/market-runs`.
2. Owner uses the same costing engine but creates a speculative run instead of a party quote.
3. Supervisor logs production against the run/order anchor.
4. Output moves toward godown stock.
5. Owner reviews produced meters, in-godown meters, sold meters, revenue, cost, profit, and status.
6. Owner records market-run sales and closes runs when appropriate.

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
- `orders`
- `market_runs`
- `market_run_sales`
- `machine_assignments`
- `shift_assignments`
- `production_logs`

## Downstream Effects

- Supervisor production log pulls active orders/runs.
- Owner analytics summarizes order health.
- Stock inward drafts and stock lots can originate from completed production.
- Dispatches and public tracking attach to orders.
- Commercials aggregates expected and realized profit.

## Readiness Notes

- Order/run selection must be unambiguous for supervisors.
- Pace calculations must be clear enough for owners to trust.
- Market runs should stay distinct from party orders while reusing the same production machinery.
