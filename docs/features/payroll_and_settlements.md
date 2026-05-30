# Payroll and Settlements

Last analyzed from the active codebase on May 31, 2026.

## Phase 1 Status

Core Phase 1 pillar.

## What It Does

Payroll converts production logs, worker rates, fixed-worker setup, attendance, advances, PF/ESI settings, manual adjustments, and payment mode into settlement records and payslips. Payroll timing is configured through cycle start day, pay date day, and reminder window.

## User Workflow

1. Owner opens `/owner/payroll`.
2. Owner selects a payroll cycle month.
3. Owner sees cycle status: in progress, scheduled, approaching, due today, or overdue.
4. Owner reviews meter workers and fixed workers once the pay window is open or a final settlement is needed.
5. Meter workers show meters, machine/order rows, rate, gross pay, advances, deductions, manual adjustments, and net pay.
6. Fixed workers show role, salary/daily earnings, attendance where applicable, advances, deductions, manual adjustments, and net pay.
7. Owner expands a worker row to inspect itemization.
8. Owner toggles final settlement if the worker is exiting.
9. Owner selects payment mode and verifies the payout.
10. Owner settles or un-settles where allowed.
11. Owner generates a payslip PDF or sends the WhatsApp payslip.

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
- Pay-window gating prevents normal settlement before the configured pay date approaches.
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
- `payroll_configs.pay_date_day` chooses the first configured pay date after cycle close.
- `payroll_configs.pay_reminder_days` opens normal settlement shortly before the pay date.
- Owner verification is required before confirming payroll.
- WhatsApp payslip sends a summary template plus itemized follow-up.

## Data and Code

- `app/(dashboard)/owner/payroll/page.tsx`
- `app/(dashboard)/owner/payroll/actions.ts`
- `app/(dashboard)/owner/payroll/whatsapp-actions.ts`
- `lib/finance.ts`
- `lib/generate-payslip.ts`
- `lib/payroll-cycle.ts`
- `lib/wage-config.ts`
- `production_logs`
- `attendance`
- `payroll_settlements`
- `payroll_adjustments`
- `payroll_adjustment_categories`
- `payroll_configs`
- `worker_advances`

## Downstream Effects

- Advances are marked deducted through settlement behavior.
- WhatsApp delivery logs record payslip sends.
- Audit log captures sensitive payroll changes where configured.

## Readiness Notes

- Settlement preview and persisted settlement must match.
- Tests should cover pay-window gating, caps, final settlement, PF/ESI, payment modes, manual adjustments, and advance recovery.
