# Base Production Core scope

**Decision date:** 29 August 2026
**Status:** Sprint 7 machine-first implementation applied
**Primary actor:** Owner

> The next-phase design for worker-to-machine assignment and machine-first daily production entry is documented in the [Base Operational Loop Sprint Plan](base-operational-loop-sprint-plan.md). This document describes the original small Production Core baseline; the Sprint 7 implementation extends it with machine allocation and costing-aware payroll.

Base now gets a small operating loop so the costing has a practical next step:

```text
    saved costing → production job → owner records machine metres → worker piece-rate pay
```

## Included in Base

- Create a lightweight production job from an active saved costing. The job keeps a snapshot of the costing label, version, planned cost, and planned price.
- Track a target, start/due dates, a short reference, progress, and a simple planned-cost total.
- Maintain a small piece-rate worker roster with name, current rate per metre, and active/inactive state.
- Record production once per assigned machine with the worker and costing populated automatically, plus a worker roll-up and optional short note.
- Save the costing/machine rate snapshot on each allocation so later rate or assignment changes do not rewrite past earnings.
- Record worker advances and settle the current piece-rate period using gross metres × saved rate.
- Apply the existing 50% advance-recovery cap and carry the unpaid balance forward.
- Mark a settlement as paid with a basic payment mode: cash, bank transfer, UPI, or cheque.

All of these actions are owner-only. Base now supports dated shift assignment, machine-first daily correction before settlement/finalization, and machine/costing payroll allocation; there is still no supervisor login, inventory movement, or Full Suite correction console.

## Kept for Full Suite

- Formal party-backed quotations and orders.
- Market runs, inventory/godown stock, sales, dispatch, and commercial receivables.
- Supervisor or production-recorder access, day/night shift workflows, loom assignments, downtime, and floor accountability.
- Full Suite worker master data, attendance, fixed salary, statutory deductions, payslips, and payroll controls.
- Factory Today, analytics, automated alerts, WhatsApp, and operational reporting.

## Boundary and upgrade rules

- Base uses separate `base_production_*`, `base_worker_advances`, and `base_payroll_settlements` tables. It does not write to Full Suite `production_logs`, `workers`, or `payroll_settlements`.
- A Base production job is not a party order and does not create stock, dispatch, receivables, or a customer quotation lifecycle.
- Costing economics remain planned economics; Base does not claim actual stock margin or order profitability.
- A Full Suite customer may use the smaller Base workspace, but the Full Suite navigation remains the place for the formal factory workflow.
- A supervisor login becomes a future product decision only if owner-only entry stops working for a real factory—for example, multiple shifts, multiple sites, or too many daily records—not as part of the initial Base release.

See the implementation at [`/owner/production`](<../app/(dashboard)/owner/production/page.tsx>) and the migration at [`20260829090000_base_production_core.sql`](<../supabase/migrations/20260829090000_base_production_core.sql>).
