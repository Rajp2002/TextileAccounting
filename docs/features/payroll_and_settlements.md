# Feature Analysis: Payroll & Settlements

## Overview
Weavly's Payroll module automates the complex task of calculating and paying wages for both piece-rate (meter-based) weavers and fixed-salary staff. It handles statutory deductions, advance recoveries, and delivery of itemized payslips.

## Why It's Needed
Payroll is the biggest friction point in factory management. Disputes over meters, missing advances, and "over-payment" are common. Owners need a transparent, audit-ready system that the workers can trust.

## Pain Points Solved
- **Advance Recovery Stress**: Automatically calculates how much to deduct from a worker's salary to pay back their advances, while respecting the 50% legal cap.
- **Meter Disputes**: Since wages are derived directly from the supervisor-logged meters, there is a single "Source of Truth".
- **Statutory Compliance**: Automatically calculates PF (Provident Fund) and ESI (Insurance) for eligible workers.
- **Messaging Overhead**: No more printing and handing out slips; every worker gets an itemized breakdown on WhatsApp.

## Old Workflow Translation
- **Old way**: Owner sits with a "Parchi" list of meters and an "Advance" book. They manually subtract debts and write a total on a slip of paper.
- **Weavly way**: Owner clicks "Settle" for a worker. The system pulls all meters for the month, calculates gross pay, subtracts advances (up to the cap), adds bonuses/fines, and generates a PDF payslip.

## Value Provided
- **Financial Precision**: Every paisa of wage and debt is tracked.
- **Worker Retention**: Transparency and professional WhatsApp payslips build trust with the workforce.
- **Legal Protection**: Adheres to wage deduction caps and provides an audit trail for all payments.

## User Interaction
1.  **Review**: Owner opens the Payroll dashboard and sees "Pending" settlements for the month.
2.  **Configuration**: Sets the "Cycle Start Day" (e.g., the 1st or 7th of every month).
3.  **Settlement**: Clicks "Settle". A drawer shows the itemized breakdown (Meters x Rate - Advances - PF/ESI + Bonuses).
4.  **Finalize**: Clicks "Confirm Payment". System creates a `payroll_settlements` record and fires a WhatsApp notification.

## Technical Logic
- **Atomic RPC**: `settle_worker_payroll` ensures that the wage payment, advance deduction, and ledger update happen as a single database transaction (ACID compliant).
- **Snapshot Rates**: Uses `worker_rate_snapshot` from production logs to ensure that if a rate changes mid-month, previous production is still paid at the old rate.
- **Deduction Cap**: Logic in `lib/finance.ts` ensures that automatic advance deductions never exceed 50% of the gross wage, preventing worker hardship and legal issues.
- **Edge Functions**: Uses Supabase Edge Functions to generate PDFs and interface with the Meta WhatsApp Cloud API.

## Relation to Other Features
- **Supervisor Dashboard**: Provides the meters used for piece-rate calculations.
- **Advances**: Settlements are the primary way workers pay back their advances.
- **Party Ledger**: (Indirectly) Factory wage expenses are reflected in the overall business health.

## Output/Result
- **Payroll Settlement Record**: An immutable record of the payment.
- **PDF Payslip**: A professional, itemized document.
- **WhatsApp Summary**: A message sent to the worker with their take-home pay and a link to the breakdown.
