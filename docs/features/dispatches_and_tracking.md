# Feature Analysis: Dispatches & Tracking

## Overview
The Dispatch module handles the physical movement of fabric from the factory to the Trader. It generates professional "Dispatch Challans" (bills of supply) and provides a public tracking link for the customer.

## Why It's Needed
Once fabric leaves the factory, it enters a "Black Box". Owners need to know if the Trader has received it, if there was a shortage, and when they can expect payment. Traders also appreciate being able to track their orders without calling the factory owner.

## Pain Points Solved
- **The "Has it arrived?" Call**: Traders can check the status themselves via a secure link.
- **Shortage Disputes**: Traders can log "Received Meters" on the tracking portal, allowing the owner to instantly see any discrepancies (Shortages).
- **Manual Billing**: One-click generation of professional Challans with QR codes.

## Old Workflow Translation
- **Old way**: A carbon-copy "Challan Book". One copy goes with the driver, one stays in the book. If the driver loses it, the record is gone.
- **Weavly way**: A digital dispatch record. The Challan is generated as a PDF, and a "Tracking Link" is sent to the Trader via WhatsApp.

## Value Provided
- **Professional Image**: Factory looks tech-forward and reliable to the Trader.
- **Instant Reconciliation**: Shortages are flagged immediately, not weeks later during payment.
- **Logistical Control**: Track which "Transporter" or "Vehicle" was used for each batch.

## User Interaction
1.  **Creation**: Select an Order and pick specific "Available" fabric packages from stock.
2.  **Dispatch**: Click "Confirm Dispatch". System generates a PDF Challan and a unique Tracking Token.
3.  **Sharing**: Send the "Tracking Link" to the Trader.
4.  **Trader Portal**: Trader opens the link, sees the roll list, and clicks "Confirm Receipt" (optionally entering received meters).

## Technical Logic
- **Stock Integration**: Confirming a dispatch moves fabric packages from `available` to `in_transit` status.
- **Public Portal**: A specialized Next.js route `/track/[token]` that provides a read-only (and receipt-confirmable) view of the dispatch without requiring a login.
- **QR Codes**: Every Challan includes a QR code that links directly to the public tracking portal.

## Relation to Other Features
- **Stock Management**: Dispatches consume items from the Grey Stock.
- **Orders**: Updates the "Dispatched Quantity" for the order.
- **Party Ledger**: Automatically creates a debit entry for the value of the dispatched fabric.

## Output/Result
- **Dispatch Challan (PDF)**: A professional document with factory/party details and itemized roll list.
- **Public Tracking Link**: A URL (e.g., `weavly.app/track/xyz`) for the Trader.
- **Shortage Alert**: A notification if the Trader records fewer meters than sent.
