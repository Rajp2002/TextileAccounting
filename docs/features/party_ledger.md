# Commercials and Party Ledger

Last analyzed from the active codebase on May 6, 2026.

## Phase 1 Status

Split status:

- `/owner/commercials` is active Phase 1 support for gross-profit visibility, receivables, and payment tracking.
- `/owner/ledger` is archived/deferred for Phase 1 and represents full accounting/Tally replacement.

## What Active Commercials Does

Commercials gives the owner a source-tagged view of expected and realized profit, as well as receivables and payments across operational work:

- realized order sales/invoices
- expected order quote profit
- market-run sales
- stock sales
- receivables and money to collect
- payment history and receipts

It shows revenue, production cost, gross profit, margin, receivables, and payment status. It is the source of truth for "Paisa" in the factory.

## User Workflow

1. Owner opens `/owner/commercials`.
2. Owner reviews realized revenue, realized profit, expected profit, and filtered profit.
3. Owner filters by all/realized/expected.
4. Owner filters by Orders, Stock, Market Runs, or Expected.
5. Owner searches a quality or reference.
6. Owner reviews row-level revenue, cost, profit, and margin.

## Existing Workflow Translation

Old workflow:

- Owner knows selling price but may not immediately see production cost and gross margin.
- Market-run and stock sale profit is remembered informally.
- Accounting ledger may lag operational decisions.

Weavly workflow:

- Profit is visible from operational sources.
- Expected and realized stages are separated.
- Stock and market-run sales become part of the same profit story.

## Deferred Party Ledger

The archived ledger includes full party ledgers, supplier ledgers, and complex payment allocations. While Commercials handles basic receivables and payment receipts for sales, the full accounting depth of a ledger is deferred.

This is important for future ERP depth but not required for Phase 1 launch readiness.

## Pain Points Solved

- Lack of gross-profit visibility.
- Delayed accounting feedback.
- Poor connection between stock sale and production cost.

## Data and Code

Active:

- `app/(dashboard)/owner/commercials/CommercialsClient.tsx`
- `app/(dashboard)/owner/commercials/actions.ts`
- `fabric_stock_sales`
- `market_run_sales`
- `estimator_quotes`
- `orders`

Deferred:

- `app/(dashboard)/owner/ledger`
- `parties`
- `party_invoices`
- `party_receipts`
- `party_adjustments`
- `payment_allocations`
- `suppliers`
- `supplier_ledger_entries`

## Readiness Notes

- Commercials should remain an operational margin view, not a full accounting promise.
- Ledger reactivation should happen only after Phase 1 core flows are stable.
