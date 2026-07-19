# Payroll and Settlements

Last analyzed from the active codebase on July 9, 2026.

## Phase 1 Status

Core Phase 1 pillar.

## What It Does

Worker Hisaab converts production logs, worker rates, Salaried Worker setup, attendance, Upaad, PF/ESI settings, manual adjustments, and payment mode into settlement records and payslips. Its timing is configured through cycle start day, pay date day, and reminder window. The page defaults to the current pay period so owners can watch wages accumulate in real time, while still surfacing the active pay-date cycle for settlement.

## User Workflow

1. Owner opens `/owner/payroll`.
2. Owner lands on the current payroll month by default, unless opening a specific `?cycle=YYYY-MM` link.
3. Owner sees cycle status: in progress, scheduled, approaching, due today, or overdue.
4. Owner sees the Pay Date Overview panel showing status, bounds, and quick actions for the current/previous payroll cycle.
5. Owner reviews Piece-Rate Workers and Salaried Workers (visible at any time once the cycle has started to track live wage updates).
6. Piece-Rate Workers show metres, machine/order rows, rate, gross pay, Upaad, deductions, manual adjustments, and net pay.
7. Salaried Workers show role, salary/daily earnings, fixed machine-operator earnings where applicable, attendance where applicable, Upaad, deductions, manual adjustments, and net pay.
8. Owner expands a worker row to inspect itemization.
9. Owner toggles final settlement if the worker is exiting.
10. Owner selects payment mode and verifies the payout.
11. Owner settles or un-settles (normal settlement is gated and only enabled when the pay window is open near the configured pay date; final settlement is always allowed).
12. Owner generates a payslip PDF or sends the WhatsApp payslip.
13. Owner opens **Past settlements** to review paid settlement history for audit or worker questions.
14. Owner filters past settlements by worker/search, payroll month, or settlement date range.
15. Owner opens a historical settlement to see net paid, payment mode, carried debt, manual adjustments, statutory deductions, and the earning basis.
16. For Piece-Rate Workers, the historical earning basis is reconstructed as machine/order lines from `production_logs`: produced metres multiplied by `worker_rate_snapshot`.
17. Owner downloads the filtered settlement audit CSV. The filename uses the factory name and exported pay-cycle/range, for example `AshokTextiles_Jan-01-2026-Jan-31-2026.csv`.

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
- Past settlement history gives owners a banking-style settlement archive with downloadable audit CSVs.
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
- Machine operator payroll is assignment-aware through `machine_operator_assignments`, which keeps `workers` and `fixed_workers` split and stores `worker_type`, `meter_worker_id`, `fixed_worker_id`, `machine_type`, `pay_mode`, `rate`, effective dates, and active state.
- Assignment validation requires exactly one worker reference: meter assignments use `meter_worker_id` with `per_meter`, while fixed assignments use `fixed_worker_id` with `fixed_monthly`, `fixed_daily`, or `fixed_shift`.
- Production logs snapshot operator assignment context through `operator_assignment_id`, `operator_worker_type`, `meter_worker_id`, `fixed_worker_id`, `operator_pay_mode_snapshot`, `operator_rate_snapshot`, and `machine_type_snapshot`.
- `per_meter` assignments pay produced metres multiplied by the rate snapshot.
- `fixed_monthly` machine operators use the fixed monthly salary/rate setup. Production logs are accountability and analytics only.
- `fixed_shift` machine operators are paid once per distinct `operator_assignment_id + production date + shift` with at least one positive production log in the payroll cycle. Multiple logs on the same assignment/date/shift add to production analytics but do not multiply shift wages.
- `fixed_daily` machine operators use fixed-worker attendance where present. If there is no clean attendance source for the operator cycle, the MVP uses distinct positive production dates as the proxy.
- Fixed machine operator production metres never create meter wages.
- Advance deduction caps apply, with final settlement behavior where enabled.
- PF/ESI deductions are computed for enrolled workers.
- Payment mode supports cash, bank transfer, UPI, and cheque.
- Configurable cycle start day, pay date, and reminder window via `payroll_configs`.
- Normal settlement is gated and disabled if the payroll window is not open, displaying a clear validation reason (e.g., normal settlement opens near the configured pay date).
- The dashboard highlights the active pay date cycle with a dedicated `PayDateOverview` component, supporting direct toggle payment state and settlement actions. If all workers for the cycle are settled, the status badge updates to **"Paid"** or **"Clear"** with a green success indicator instead of showing a scheduled/overdue status.
- The `SettlementHistoryDialog` reads paid `payroll_settlements`, resolves Piece-Rate Worker and Salaried Worker names, reconstructs piece-rate earning lines from production logs, reconstructs salaried earning lines from salary/attendance context, and shows an audit breakdown from net revenue before deductions to final payout.
- Past-settlement CSV exports include settlement metadata, worker detail, earning lines, total metres, net revenue before deductions, inam, kapaat, advance recovery, PF/ESI, net paid, carried debt, final/compliance flags, and manual adjustments.
- Settlement export filenames are generated as `FactoryName_CycleStart-CycleEnd.csv` or `FactoryName_DateFrom-DateTo.csv`, with filename-safe date separators.
- Owner verification is required before confirming payroll.
- WhatsApp payslip sends a summary template plus itemized follow-up.

## Data and Code

- `app/(dashboard)/owner/payroll/page.tsx`
- `app/(dashboard)/owner/payroll/actions.ts`
- `app/(dashboard)/owner/payroll/whatsapp-actions.ts`
- `lib/finance.ts`
- `lib/machine-operator-payroll.ts`
- `lib/generate-payslip.ts`
- `lib/payroll-cycle.ts`
- `lib/wage-config.ts`
- `__tests__/payroll-settlement-history.test.ts`
- `__tests__/machine-operator-payroll.test.ts`
- `production_logs`
- `machine_operator_assignments`
- `machine_type_pay_defaults`
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
- MVP limitation: fixed-shift payroll treats a logged production shift as proof of an attended shift. If a fixed operator attends but has no production log due downtime, breakdown, no yarn, maintenance, or factory closure, that needs a later dedicated attendance or adjustment flow.
- MVP limitation: fixed-daily machine operators use distinct production dates only when attendance is not available for that cycle.
