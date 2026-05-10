# Inventory and Stock

Last analyzed from the active codebase on May 6, 2026.

## Phase 1 Status

Split status:

- `/owner/stock` is active Phase 1 support for physical taka/godown stock, inward drafts, adjustments, and movements.
- `/owner/inventory` is archived/deferred for Phase 1 and covers deeper yarn/beam inventory.

## What Active Stock Does

The active stock board helps owners track physical fabric in godown. It supports manual/opening stock, order-linked stock, market-run stock, inward drafts, adjustments, sales recording, and movement history. It is focused on "Maal kya pada hai?", while profit and receivables belong to Commercials.

## User Workflow

1. Owner opens `/owner/stock`.
2. Owner sees available takas/meters and stock value at cost.
3. Owner confirms pending inward drafts from order or market-run output.
4. Owner adds stock lots manually when needed.
5. Owner records source, quality, godown, units, meters per unit, unit label, cost per meter, and notes.
6. Owner adjusts stock if physical counts differ.
7. Owner records stock sale (which feeds Commercials receivables).

## Existing Workflow Translation

Old workflow:

- Godown takas are counted on paper or from memory.
- Owner may know the selling rate but not the exact production cost basis.
- Stock produced for market is hard to connect to original costing.

Weavly workflow:

- Each stock lot has source, cost, units, meters, godown, and movement history.
- Sales compute revenue, cost, and gross profit.
- Market-run and order output can become inward drafts.

## Pain Points Solved

- Unclear godown quantity.
- Lost taka-level stock memory.
- Profit uncertainty on stock sales.
- Manual reconciliation between production and sale.

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

Deferred:

- `app/(dashboard)/owner/inventory`
- `yarn_lots`
- `beam_cards`
- `yarn_movements`
- `beam_card_lots`
- `order_yarn_requirements`

## Readiness Notes

- Stock should help owners decide and sell; it should not become a full inventory ERP in Phase 1.
- Inward draft and sale math should be tested because it feeds commercials.
