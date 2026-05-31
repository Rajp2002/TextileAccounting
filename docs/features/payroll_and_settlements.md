# Payroll and Settlements

Last analyzed from the active codebase on May 31, 2026.

## Phase 1 Status

Core Phase 1 pillar.

## What It Does

Payroll converts production logs, worker rates, fixed-worker setup, attendance, advances, PF/ESI settings, manual adjustments, and payment mode into settlement records and payslips. Payroll timing is configured through cycle start day, pay date day, and reminder window.

## User Workflow

1. Owner opens `/owner/payroll`.
2. Owner selects a payroll cycle month (can navigate up to the current in-progress month and view live/current month payroll details).
3. Owner sees cycle status: in progress, scheduled, approaching, due today, or overdue.
4. Owner sees the Pay Date Overview panel showing status, bounds, and quick actions for the current/previous payroll cycle.
5. Owner reviews meter workers and fixed workers (visible at any time once the cycle has started to track live payroll/wage updates).
6. Meter workers show meters, machine/order rows, rate, gross pay, advances, deductions, manual adjustments, and net pay.
7. Fixed workers show role, salary/daily earnings, attendance where applicable, advances, deductions, manual adjustments, and net pay.
8. Owner expands a worker row to inspect itemization.
9. Owner toggles final settlement if the worker is exiting.
10. Owner selects payment mode and verifies the payout.
11. Owner settles or un-settles (normal settlement is gated and only enabled when the pay window is open near the configured pay date; final settlement is always allowed).
12. Owner generates a payslip PDF or sends the WhatsApp payslip.

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
- Pay-window gating prevents normal settlement execution before the configured pay date approaches, but the owner can view and track live data for the current month at any time.
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
- Configurable cycle start day, pay date, and reminder window via `payroll_configs`.
- Normal settlement is gated and disabled if the payroll window is not open, displaying a clear validation reason (e.g., normal settlement opens near the configured pay date).
- The dashboard highlights the active pay date cycle with a dedicated `PayDateOverview` component, supporting direct toggle payment state and settlement actions.
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
