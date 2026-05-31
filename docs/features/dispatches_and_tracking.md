# Dispatches and Tracking

Last analyzed from the active codebase on May 31, 2026.

## Phase 1 Status

In scope as a lightweight professionalism and reconciliation layer.

## What It Does

Dispatches record fabric handoff from factory to party and are the point where sold stock moves from receivable to shipment. They support party-first stock sales, pending dispatch meters, partial dispatch batches, sent/received meters, status, transport metadata, GST/e-way metadata, package lines, owner receipt confirmation, shortages/extras, stock discrepancies, and public tracking links for order-linked dispatches.

## User Workflow

1. Owner opens `/owner/dispatches`.
2. Owner uses Sell Stock to choose source stock, enter party details, sold meters, sale rate, credit days, sale date, and notes.
3. System creates a stock sale, stock movement, and named Commercials receivable.
4. The sale appears as pending dispatch until all sold meters are dispatched.
5. Owner confirms dispatch for all or part of the pending quantity using a modernized CreateDispatchModal, which supports partial quantities, dispatch date, challan, vehicle, transporter, and notes.
6. Order-linked dispatches can share a public tracking link from the order token.
7. Owner confirms direct receipt of dispatched batches, entering actual received meters.
8. System marks batches delivered, defers the credit due date relative to the receipt confirmation date, and records shortage/excess discrepancies when receipt quantity differs from sent quantity.
9. Partially dispatched sales remain available for later batches.

## Existing Workflow Translation

Old workflow:

- Fabric leaves with a challan, phone call, or WhatsApp note.
- The buyer later confirms receipt informally.
- Shortages become payment disputes after the fact.

Weavly workflow:

- Stock sale records party, rate, credit terms, and receivable before dispatch.
- Dispatch batch records sent and actual received meters.
- Stock discrepancy records shortage or excess for owner review when there is a true receipt variance.
- Tracking portal gives a buyer-facing status surface.
- Shortage/extra is captured at receipt time.

## Pain Points Solved

- Poor client-facing shipment visibility.
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
- `app/(public)/track/[token]/TrackingPortal.tsx`
- `dispatches`
- `dispatch_package_lines`
- `fabric_packages`
- `fabric_stock_sales`
- `commercial_receivables`
- `party_dispatch_claims`
- `stock_discrepancies`

## Downstream Effects

- Public tracking for order-linked dispatches.
- Shortage analytics.
- Commercials receivables and payment status.
- Party ledger/accounting depth in future scope.
- Commercial source records where dispatch/invoice data is used.

## Readiness Notes

- Keep dispatch useful without requiring the full ledger.
- Party-first sale, pending/partial dispatch, direct receipt confirmation, and shortage/excess behavior need manual and automated testing.
- The system is meters-only throughout (takas display has been completely removed to avoid confusion).
