# Feature Analysis: Dispatches & Tracking

## Overview
The Dispatch module handles the physical movement of fabric from the factory to the Trader. For normal Surat grey fabric sales, dispatch is also the sale event, so the generated document is a **Tax Invoice cum Delivery Challan**, not a standalone Delivery Challan. It provides a compliant invoice, a movement document, and a public tracking link for the customer.

## Why It's Needed
Once fabric leaves the factory, it enters a "Black Box". Owners need to know if the Trader has received it, if there was a shortage, and when they can expect payment. Traders also appreciate being able to track their orders without calling the factory owner.

## Pain Points Solved
- **The "Has it arrived?" Call**: Traders can check the status themselves via a secure link.
- **Shortage Disputes**: Traders can log "Received Meters" on the tracking portal, allowing the owner to instantly see any discrepancies (Shortages).
- **Manual Billing**: One-click generation of professional Tax Invoice cum Delivery Challans with QR codes.
- **GST Compliance Risk**: Dispatch documents include GSTIN, HSN 5407, GST split, taxable value, and sequential invoice number for GSTR-1 filing.

## Old Workflow Translation
- **Old way**: A carbon-copy bill/challan book. One copy goes with the driver, one stays in the book. If the driver loses it, the record is gone.
- **Weavly way**: A digital dispatch record. The Tax Invoice cum Delivery Challan is generated as a PDF, and a "Tracking Link" is sent to the Trader via WhatsApp.

## Value Provided
- **Professional Image**: Factory looks tech-forward and reliable to the Trader.
- **Instant Reconciliation**: Shortages are flagged immediately, not weeks later during payment.
- **Logistical Control**: Track which "Transporter" or "Vehicle" was used for each batch.

## User Interaction
1.  **Creation**: Select an Order and pick specific "Available" fabric packages from stock.
2.  **Dispatch**: Click "Confirm Dispatch". System generates a Tax Invoice cum Delivery Challan PDF and a unique Tracking Token.
3.  **Sharing**: Send the "Tracking Link" to the Trader.
4.  **Trader Portal**: Trader opens the link, sees the roll list, and clicks "Confirm Receipt" (optionally entering received meters).
5.  **Shortage Adjustment**: If received meters are lower than sent meters, prompt the owner: "Create adjustment for {shortage_meters}m shortage?". On confirmation, create a linked credit note entry in the party ledger.

## Technical Logic
- **Stock Integration**: Confirming a dispatch moves fabric packages from `available` to `in_transit` status.
- **Invoice Document**: Dispatch generates a "Tax Invoice cum Delivery Challan" with:
  - Factory GSTIN and Trader GSTIN.
  - HSN Code `5407` for synthetic filament woven grey fabric.
  - Taxable value as `meters * rate_per_meter`.
  - GST at 5%.
  - CGST 2.5% + SGST 2.5% when the Trader state matches the factory state, otherwise IGST 5%.
  - Total invoice value including GST.
  - Sequential invoice number suitable for GSTR-1 filing.
- **Ledger Debit**: The automatic party ledger debit is the total invoice value including GST. The ledger stores base taxable value and GST amount separately for reconciliation.
- **E-Way Bill Awareness**: If total invoice value exceeds `50000`, show a non-blocking banner: "This dispatch requires an E-Way Bill before the vehicle departs. Generate on the GST portal." Link to `https://ewaybillgst.gov.in`, and allow the owner to save an optional `eway_bill_number` on the dispatch record.
- **Shortage Credit Note**: When a shortage is confirmed by the Trader portal or owner-side receipt entry, the owner can create a one-tap credit note for `shortage_meters * rate_per_meter + GST`. The credit note is linked to the original dispatch invoice and labelled with i18n key `ledger.creditNote.shortageAdjustment`.
- **Public Portal**: A specialized Next.js route `/track/[token]` that provides a read-only (and receipt-confirmable) view of the dispatch without requiring a login.
- **QR Codes**: Every invoice/challan includes a QR code that links directly to the public tracking portal.

## Relation to Other Features
- **Stock Management**: Dispatches consume items from the Grey Stock.
- **Orders**: Updates the "Dispatched Quantity" for the order.
- **Party Ledger**: Automatically creates a debit entry for the full invoice value, with taxable value and GST tracked separately.

## Output/Result
- **Tax Invoice cum Delivery Challan (PDF)**: A professional GST-compliant document with factory/party details and itemized roll list.
- **Public Tracking Link**: A URL (e.g., `weavly.app/track/xyz`) for the Trader.
- **Shortage Alert + Credit Note Prompt**: A notification if the Trader records fewer meters than sent, followed by an optional linked ledger credit note.
