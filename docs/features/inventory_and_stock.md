# Inventory and Stock

Last analyzed from the active codebase on May 6, 2026.

## Phase 1 Status

Split status:

- `/owner/stock` is active Phase 1 support for expected godown ledger stock, dispatch reconciliation, adjustments, and movements.
- In market-run mode, Stock Inward is not a required Phase 1 workflow. Production creates expected stock; dispatch verifies actual stock.
- `/owner/inventory` is archived/deferred for Phase 1 and covers deeper yarn/beam inventory.

## What Active Stock Does

The active stock board helps owners track what should be available in godown according to production and commercial records. It supports manual/opening stock, order-linked stock, market-run expected stock, adjustments, sales recording, discrepancy review, and movement history. It is focused on "Maal kya hona chahiye?" and "dispatch pe kya actual nikla?", while profit and receivables belong to Commercials.

## User Workflow

1. Owner opens `/owner/stock`.
2. Owner sees expected available takas/meters, ledger value at cost, and movement history.
3. Market-run production contributes to expected stock automatically from production records.
4. Owner sells/dispatches stock and records actual dispatched meters during the dispatch check.
5. If actual dispatched meters differ from expected/sale quantity, Weavly records a shortage or excess as a stock discrepancy with `needs_review` status.
6. Owner can use adjustments for traceable corrections such as sample cutting, damage, measurement correction, returns, or internal adjustment.
7. Pending inward drafts may remain for direct/legacy/order-based workflows, but are not mandatory for market-run Phase 1.

## Existing Workflow Translation

Old workflow:

- Godown takas are counted on paper or from memory, usually when dispatch-ready rather than every shift.
- Owner may know the selling rate but not the exact production cost basis.
- Stock produced for market is hard to connect to original costing.

Weavly workflow:

- Each ledger stock lot has source, cost, units, meters, godown, and movement history.
- Market-run stock is expected stock until dispatch or owner adjustment reconciles reality.
- Sales compute revenue, cost, and gross profit.
- Dispatch checks compare expected meters, sale/dispatch meters, actual dispatched meters, and stock difference.

## Pain Points Solved

- Unclear godown quantity.
- Lost taka-level stock memory.
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
- Dispatch reconciliation and discrepancy math should be tested because it feeds owner trust.
