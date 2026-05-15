# Dispatches and Tracking

Last analyzed from the active codebase on May 6, 2026.

## Phase 1 Status

In scope as a lightweight professionalism and reconciliation layer.

## What It Does

Dispatches record fabric handoff from factory to party and are the point where expected stock is checked against reality. They support expected/sent meters, actual dispatched or received meters, status, transport metadata, GST/e-way metadata, package lines, owner receipt confirmation, shortages/extras, stock discrepancies, and public tracking links.

## User Workflow

1. Owner opens `/owner/dispatches` or an order detail dispatch section.
2. Owner chooses an active order.
3. Owner creates a dispatch from expected ledger stock or available output.
4. Owner checks actual dispatched meters and enters optional transport details: vehicle, transporter, distance, e-way details, HSN/GST/taxable values.
5. System creates a dispatch batch and records any stock difference as `needs_review`.
6. Owner shares the public tracking link from the order token.
7. Party or owner records received meters.
8. System marks delivered/disputed depending on receipt variance.
9. Owner sees shortage/extra received and can use it in downstream reconciliation.

## Existing Workflow Translation

Old workflow:

- Fabric leaves with a challan, phone call, or WhatsApp note.
- The buyer later confirms receipt informally.
- Shortages become payment disputes after the fact.

Weavly workflow:

- Dispatch batch records expected/sent and actual received meters.
- Stock difference records shortage or excess for owner review.
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
- `components/dispatches/DispatchModals.tsx`
- `app/(public)/track/[token]/TrackingPortal.tsx`
- `dispatches`
- `dispatch_package_lines`
- `fabric_packages`
- `party_dispatch_claims`
- `stock_discrepancies`

## Downstream Effects

- Public tracking.
- Shortage analytics.
- Party ledger/accounting in future scope.
- Commercial source records where dispatch/invoice data is used.

## Readiness Notes

- Keep dispatch useful without requiring the full ledger.
- Receipt confirmation, actual dispatch check, and shortage/excess behavior need manual testing.
