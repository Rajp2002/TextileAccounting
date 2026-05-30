# Advances Management

Last reviewed against the active documentation pass on May 31, 2026.

## Phase 1 Status

Core Phase 1 pillar because advances/Upaad directly affect worker trust and payroll settlement.

## What It Does

Advances records money given to meter or fixed workers before settlement. Pending advances are visible on the worker profile and are recovered during payroll according to deduction caps and final settlement behavior.

## User Workflow

1. Owner opens `/owner/advances`.
2. Owner searches across active meter and fixed workers.
3. Owner selects a worker.
4. Owner sees pending and deducted advances.
5. Owner sees total pending, total deducted, and debt warnings based on typical monthly pay.
6. Owner records a new advance with amount and description.
7. Payroll later deducts the pending advance.
8. Deducted advances retain settlement history.
9. Owner deletes or writes off records where allowed by the current rules.

## Existing Workflow Translation

Old workflow:

- Owner writes Upaad in a notebook or remembers small advances.
- Worker and owner may disagree on remaining balance.
- Month-end deductions can feel opaque.

Weavly workflow:

- Each advance is a record with amount, description, status, creation date, and deduction metadata.
- Payroll uses pending advances to calculate recovery.
- Worker payslip can show recovered advances and remaining debt.

## Pain Points Solved

- Lost advance memory.
- Over-deduction risk.
- Worker mistrust during settlement.
- Lack of linkage between advance and payroll month.

## Data and Code

- `app/(dashboard)/owner/advances/page.tsx`
- `app/(dashboard)/owner/advances/actions.ts`
- `components/advances/WorkerExitDialog.tsx`
- `worker_advances`
- `payroll_settlements`

## Downstream Effects

- Payroll settlement recovers advances.
- WhatsApp advance receipts can be sent.
- Worker exit/final settlement flows can use remaining debt.

## Readiness Notes

- Advance deduction behavior needs focused tests.
- Write-off and deletion should remain auditable.
- Debt warnings should help owners without becoming legal advice.
