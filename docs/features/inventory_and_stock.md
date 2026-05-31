# Inventory and Stock

Last analyzed from the active codebase on May 31, 2026.

## Phase 1 Status

Split status:

- `/owner/stock` is active Phase 1 support for expected/physical godown ledger stock, source-linked lots, stock sales, pending dispatch context, adjustments, and movements.
- In market-run mode, Stock Inward is not a required Phase 1 workflow. Production creates expected stock; dispatch verifies actual stock.
- `/owner/inventory` is archived/deferred for Phase 1 and covers deeper yarn/beam inventory.

## What Active Stock Does

The active stock board helps owners track what should be available in godown according to production and commercial records. It supports manual/opening stock, order-linked stock, market-run expected stock, adjustments, party-first sales, pending dispatch meters, discrepancy review, and movement history. It is focused on "Maal kya hona chahiye?" and "dispatch pe kya actual nikla?", while profit, receivables, and payment receipts belong to Commercials.

## User Workflow

1. Owner opens `/owner/stock`.
2. Owner sees expected available meters, ledger value at cost, and movement history.
3. Market-run production contributes to expected stock automatically from production records.
4. Owner sells stock to a named party, creating a stock sale and Commercials receivable.
5. Owner dispatches pending sold meters later, either fully or partially.
6. If received meters differ from sent meters, Weavly records a shortage or excess as a stock discrepancy with `needs_review` status.
7. Owner can use adjustments for traceable corrections such as sample cutting, damage, measurement correction, returns, or internal adjustment.
8. Pending inward drafts may remain for direct/legacy/order-based workflows, but are not mandatory for market-run Phase 1.

## Existing Workflow Translation

Old workflow:

- Godown stock is counted on paper or from memory, usually when dispatch-ready rather than every shift.
- Owner may know the selling rate but not the exact production cost basis.
- Stock produced for market is hard to connect to original costing.

Weavly workflow:

- Each ledger stock lot has source, cost, units, meters, godown, and movement history.
- Market-run stock is expected stock until dispatch or owner adjustment reconciles reality.
- Sales compute revenue, cost, gross profit, credit terms, and pending dispatch meters.
- Dispatch checks compare sent meters and received meters, then create discrepancies only for true variance.

## Pain Points Solved

- Unclear godown quantity.
- Lost stock-level memory.
- Profit uncertainty on stock sales.
- Manual reconciliation between production and sale.
- Avoids forcing a daily physical Stock Inward role in market-run factories.

## Deferred Deep Inventory

The archived `/owner/inventory` surface includes or points toward:

- yarn lots
- beam cards
- yarn movements
- beam card lots
- order yarn requirements
- yarn/beam planning workflows

These are useful but not Phase 1 polish priorities.

## Data and Code

Active:

- `app/(dashboard)/owner/stock/TakaStockClient.tsx`
- `app/(dashboard)/owner/stock/actions.ts`
- `fabric_stock_lots`
- `fabric_stock_sales`
- `fabric_stock_movements`
- `fabric_stock_inward_drafts`
- `stock_discrepancies`
- `commercial_receivables`

Deferred:

- `app/(dashboard)/owner/inventory`
- `yarn_lots`
- `beam_cards`
- `yarn_movements`
- `beam_card_lots`
- `order_yarn_requirements`

## Readiness Notes

- Stock should help owners decide and sell; it should not become a full inventory ERP in Phase 1.
- Market-run stock accuracy should not depend on daily stock confirmation.
- Party-first sale, pending/partial dispatch, receipt reconciliation, and discrepancy math should be tested because they feed owner trust.
