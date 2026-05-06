# Payroll and Settlements

Last analyzed from the active codebase on May 6, 2026.

## Phase 1 Status

Core Phase 1 pillar.

## What It Does

Payroll converts production logs, worker rates, fixed-worker setup, attendance, advances, PF/ESI settings, adjustments, and payment mode into settlement records and payslips.

## User Workflow

1. Owner opens `/owner/payroll`.
2. Owner selects a month.
3. Owner reviews meter workers and fixed workers.
4. Meter workers show meters, machine/order rows, rate, gross pay, advances, deductions, and net pay.
5. Fixed workers show role, salary/daily earnings, attendance where applicable, advances, deductions, and net pay.
6. Owner expands a worker row to inspect itemization.
7. Owner toggles final settlement if the worker is exiting.
8. Owner selects payment mode.
9. Owner settles or un-settles where allowed.
10. Owner generates a payslip PDF or sends the WhatsApp payslip.

## Existing Workflow Translation

Old workflow:

- Owner calculates wages from production register totals.
- Worker advances are deducted from memory or a notebook.
- PF/ESI and final settlement behavior may be handled manually.
- Worker receives a verbal explanation or handwritten note.

Weavly workflow:

- Production logs become wage input.
- Advances become itemized deduction input.
- Settlement records preserve gross, deductions, net, remaining debt, payment mode, and status.
- Payslips can be generated or sent on WhatsApp.

## Pain Points Solved

- Worker wage disputes.
- Manual advance recovery mistakes.
- Preview/final payout drift.
- Lack of payment mode record.
- Weak itemization for statutory deductions.

## Key Behaviors

- Meter-worker gross pay comes from `production_logs`.
- Rate snapshots protect historical payroll from later rate edits.
- Advance deduction caps apply, with final settlement behavior where enabled.
- PF/ESI deductions are computed for enrolled workers.
- Payment mode supports cash, bank transfer, UPI, and cheque.
- WhatsApp payslip sends a summary template plus itemized follow-up.

## Data and Code

- `app/(dashboard)/owner/payroll/page.tsx`
- `app/(dashboard)/owner/payroll/actions.ts`
- `app/(dashboard)/owner/payroll/whatsapp-actions.ts`
- `lib/finance.ts`
- `lib/generate-payslip.ts`
- `lib/wage-config.ts`
- `production_logs`
- `attendance`
- `payroll_settlements`
- `payroll_adjustments`
- `payroll_adjustment_categories`
- `worker_advances`

## Downstream Effects

- Advances are marked deducted through settlement behavior.
- WhatsApp delivery logs record payslip sends.
- Audit log captures sensitive payroll changes where configured.

## Readiness Notes

- Settlement preview and persisted settlement must match.
- Tests should cover caps, final settlement, PF/ESI, payment modes, and advance recovery.
