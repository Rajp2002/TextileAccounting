# Commercials and Party Ledger

Last analyzed from the active codebase on June 1, 2026.

## Phase 1 Status

Split status:

- `/owner/commercials` is active Phase 1 support for gross-profit visibility, receivables, dispatch status context, payment tracking, and lightweight party-level sales/profit visibility.
- `/owner/ledger` is archived/deferred for Phase 1 and represents full accounting/Tally replacement.

## What Active Commercials Does

Commercials gives the owner a source-tagged view of expected and realized profit, as well as receivables and payments across operational work:

- realized order sales/invoices
- expected order quote profit
- market-run sales
- stock sales
- receivables and money to collect
- payment history and receipts
- dispatch status and pending dispatch meters for stock-sale receivables
- lightweight party identity for stock-sale customers, including saved party selection, duplicate-name handling, profit leaderboard reporting, and a searchable party directory

It shows revenue, production cost, gross profit, margin, receivables, and payment status. It is the source of truth for "Paisa" in the factory.

## User Workflow

1. Owner opens `/owner/commercials`.
2. Owner reviews realized revenue, realized profit, expected profit, receivables, collected amount, and balance.
3. Owner filters by all/realized/expected and receivable status.
4. Owner filters by Orders, Stock, Market Runs, or Expected.
5. Owner searches a quality, reference, party, or source.
6. Owner reviews row-level revenue, cost, profit, margin, payment status, dispatch status, and pending dispatch meters.
7. Owner opens the Parties tab to review saved/legacy party rows with revenue, profit, meters sold, open dues, and last sale.
8. Owner records payments against receivables and can expand payment history.

## Existing Workflow Translation

Old workflow:

- Owner knows selling price but may not immediately see production cost and gross margin.
- Market-run and stock sale profit is remembered informally.
- Accounting ledger may lag operational decisions.

Weavly workflow:

- Profit is visible from operational sources.
- Expected and realized stages are separated.
- Stock and market-run sales become part of the same profit story.
- Party-first stock sales become named receivables immediately instead of anonymous accounting notes.
- Repeat stock-sale parties can be selected from saved party records so Commercials can group profit, revenue, meters sold, and open dues across multiple sales.
- Party identity is ID-based, not name-based: duplicate names are allowed, but the sale UI asks the user to select the saved party or add phone/GSTIN before creating another same-name party.

## Deferred Party Ledger

The archived ledger includes full party ledgers, supplier ledgers, and complex payment allocations. While Commercials handles saved party selection, basic receivables, payment receipts, and party-level profit visibility for sales, the full accounting depth of a ledger is deferred.

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
- `commercial_receivables`
- `commercial_payment_receipts`
- `parties` for lightweight customer identity in active sales/commercial views

Deferred:

- `app/(dashboard)/owner/ledger`
- `party_invoices`
- `party_receipts`
- `party_adjustments`
- `payment_allocations`
- `suppliers`
- `supplier_ledger_entries`

## Readiness Notes

- Commercials should remain an operational margin view, not a full accounting promise.
- Payment recording is operational collection tracking, not bank reconciliation.
- Ledger reactivation should happen only after Phase 1 core flows are stable.
