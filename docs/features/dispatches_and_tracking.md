# Dispatches and Tracking

Last analyzed from the active codebase on June 1, 2026.

## Phase 1 Status

In scope as a lightweight professionalism and reconciliation layer.

## What It Does

Dispatches record fabric handoff from factory to Party and are the point where sold Godown Stock moves from pending dispatch into shipment. They keep Metres Sold, Metres Dispatched, and Metres Received by Party as separate quantities, alongside status, transport metadata, GST/e-way metadata, Taka lines, owner receipt confirmation from returned Delivery Challans, shortages/extras, and stock discrepancies. Public third-party dispatch verification is deferred.
Weavly records the user's Delivery Challan number as a reference; it does not generate Delivery Challan/PDF paperwork.

## User Workflow

1. Owner opens `/owner/dispatches`.
2. Owner uses Sell Stock to choose source stock, select an existing party or enter a new party, sold meters, sale rate, credit days, sale date, and notes.
3. System creates a stock sale, stock movement, and named Party Ledger receivable.
4. The sale appears as pending dispatch until one or more dispatches leave the factory.
5. Owner confirms dispatch for all or part of the pending quantity using a dispatch date, user-entered Delivery Challan number, vehicle, transporter, and notes.
6. Credit days start from the first dispatch date, not the sale date.
7. The party later sends their challan/confirmation back through WhatsApp, paper, or another channel.
8. Owner records Metres Received by Party from that returned Delivery Challan in `/owner/dispatches`.
9. System marks batches delivered and records shortage/excess discrepancies when received quantity differs from sent quantity.
10. Partially dispatched sales remain available for later batches.

## Existing Workflow Translation

Old workflow:

- Fabric leaves with a challan, phone call, or WhatsApp note.
- The buyer later confirms receipt informally.
- Shortages become payment disputes after the fact.

Weavly workflow:

- Stock sale records party, rate, credit terms, and receivable before dispatch.
- Saved parties prefill phone/GSTIN/credit days. A unique exact-name match can be auto-linked, while ambiguous duplicate names require an explicit selection or phone/GSTIN before a new party is created.
- A dispatch batch records Metres Dispatched when fabric leaves the factory.
- Owner records actual Metres Received by Party only after the Party returns their Delivery Challan or confirmation.
- Stock discrepancy records shortage or excess for owner review when there is a true receipt variance.
- Shortage/extra is captured at receipt time.

## Pain Points Solved

- Missing shortage records.
- Unclear dispatch history by order.
- Professional documentation gap.

## Data and Code

- `app/(dashboard)/owner/dispatches/DispatchesClient.tsx`
- `app/(dashboard)/owner/orders/OrdersClient.tsx`
- `app/(dashboard)/owner/orders/actions.ts`
- `components/dispatches/SellAndDispatchDialog.tsx`
- `components/dispatches/DispatchModals.tsx`
- `lib/dispatch/sell-and-dispatch-types.ts`
- `dispatches`
- `dispatch_package_lines`
- `fabric_packages`
- `fabric_stock_sales`
- `parties`
- `commercial_receivables`
- `party_dispatch_claims`
- `stock_discrepancies`

## Downstream Effects

- Public third-party verification is deferred.
- Shortage analytics.
- Party Ledger receivables and payment status.
- Party ledger/accounting depth in future scope.
- Commercial source records where dispatch/invoice data is used.

## Readiness Notes

- Keep dispatch useful without requiring the full ledger.
- Party-first sale, pending/partial dispatch, direct receipt confirmation, and shortage/excess behavior need manual and automated testing.
- The system is meters-only throughout (takas display has been completely removed to avoid confusion).
