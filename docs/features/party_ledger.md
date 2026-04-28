# Feature Analysis: Party Ledger

## Overview
The Party Ledger is the financial record-keeping system for interactions with Traders (Parties). it tracks sales (dispatches), payments received, and the running balance for each customer.

## Why It's Needed
Factory owners often deal with dozens of Traders. Keeping track of who owes how much for which batch of fabric is a full-time job. A digital ledger ensures that no bill is missed and every payment is recorded.

## Pain Points Solved
- **Payment Delays**: Clearly see "Overdue" balances and follow up with Traders.
- **Billing Disputes**: Link every ledger entry to a specific Dispatch Challan or Invoice.
- **Tax Readiness**: Export ledger data for accounting and GST filing.

## Old Workflow Translation
- **Old way**: A massive physical ledger book where each page belongs to a Party. Bills are handwritten and stuck into the book.
- **Weavly way**: A clean, digital ledger that auto-populates when a dispatch is confirmed and allows for quick entry of "Payment Received" notes.

## Value Provided
- **Financial Health**: Instant view of "Total Receivables" (money owed to the factory).
- **Professionalism**: Share professional-looking ledger statements with Traders via PDF or WhatsApp.
- **Audit Accuracy**: Every entry is timestamped and linked to an order or dispatch.

## User Interaction
1.  **Selection**: Select a Party to view their specific statement.
2.  **Transaction Entry**: Manually record a "Payment Received" (Cash, Bank, Cheque).
3.  **Automatic Entries**: Dispatches automatically create a "Debit" entry (Party owes money) in the ledger.
4.  **Statement Sharing**: Export the ledger as a PDF to send to the Trader for reconciliation.

## Technical Logic
- **Tabbed Interface**: Organized into "Transactions", "Pending Invoices", and "Analytics" for a comprehensive view.
- **Real-time Totals**: Summarizes debits and credits to show the "Net Balance" at the top of the page.
- **Soft Deletion**: Ledger entries are carefully managed to ensure the audit trail is never broken.

## Relation to Other Features
- **Dispatches**: The primary driver of ledger debits.
- **Orders**: Ledger entries are often tagged with an Order ID for context.
- **Settings**: Party profiles are managed in the central settings/parties area.

## Output/Result
- **Ledger Statement**: A list of all financial interactions.
- **Net Balance**: The current amount owed by or to the Party.
- **PDF Export**: A formal financial document for reconciliation.
