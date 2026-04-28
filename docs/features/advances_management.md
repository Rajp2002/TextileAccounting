# Feature Analysis: Advances Management

## Overview
In the Indian textile industry, "Advances" are interest-free loans given to workers for personal needs. Weavly tracks these advances, provides receipts to workers, and manages the automatic recovery of these loans during payroll.

## Why It's Needed
Worker advances are a massive hidden liability. Owners often lose track of who owes what, leading to financial leakage. Workers also need clarity on their outstanding balance to avoid feelings of being "cheated" by the factory.

## Pain Points Solved
- **Balance Confusion**: Both owner and worker can see the current "Outstanding Balance" at any time.
- **Manual Deduction Errors**: No more forgetting to deduct an advance during the monthly settlement.
- **Audit Trails**: Every advance given and every rupee recovered is logged with a timestamp and reason.

## Old Workflow Translation
- **Old way**: A small notebook (Chopdi) where the owner writes "Rs 5000 given to Ramesh". When Ramesh gets paid, the owner tries to remember to subtract it and crosses it out.
- **Weavly way**: Owner records a "New Advance" in the app. Ramesh gets a WhatsApp confirmation. During payroll, Weavly automatically calculates the deduction and updates the balance.

## Value Provided
- **Cash Flow Control**: Real-time visibility into the total "Money on the Floor" (sum of all worker debts).
- **Reduced Friction**: Automated deductions remove the need for "negotiation" during payday.
- **Worker Stability**: Clear debt tracking helps workers manage their finances better.

## User Interaction
1.  **Issuance**: Owner enters worker name, amount, and category (e.g., "Medical", "Travel").
2.  **Notification**: System sends a WhatsApp "Advance Receipt" to the worker.
3.  **Recovery**: During the "Settle" action in the Payroll module, the system suggests a deduction amount.
4.  **Tracking**: Owner views the "Advances Ledger" to see a history of all loans and repayments for a specific worker.

## Technical Logic
- **Ledger-based Tracking**: Advances are stored as debits in a worker-specific ledger.
- **Settlement Bridge**: The `settle_worker_payroll` RPC looks up the current `total_outstanding` for the worker and applies the deduction logic.
- **Reversal Safety**: If a payroll settlement is "Unsettled", the system automatically reverts the advance recovery, restoring the worker's debt balance.

## Relation to Other Features
- **Payroll**: The primary mechanism for advance recovery.
- **Workers**: Advances are linked to the worker profile.
- **WhatsApp Integration**: Sends instant receipts for every advance transaction.

## Output/Result
- **Advance Record**: Timestamped entry in the `worker_advances` table.
- **WhatsApp Receipt**: Confirmation message sent to the worker.
- **Outstanding Balance**: A real-time number shown on the worker's profile and payroll card.
