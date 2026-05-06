# Floor Operations and Supervisor Dashboard

Last analyzed from the active codebase on May 6, 2026.

## Phase 1 Status

Core Phase 1 pillar. `/supervisor/dashboard` is the primary floor workspace, and `/supervisor/production` redirects to it.

## What It Does

The supervisor dashboard combines shift selection, machine assignment, worker selection, order/run selection, machine status, opening/closing meter readings, duplicate protection, and bulk production submission into one mobile-first workflow.

## User Workflow

1. Supervisor signs in and lands on production.
2. Supervisor selects date and shift: day or night.
3. Supervisor reviews machine cards.
4. Supervisor assigns a worker and active order/run to each machine.
5. Supervisor can copy previous shift assignments.
6. Supervisor updates machine status: running, idle, maintenance.
7. Supervisor records breakdown notes/categories when a machine is under service.
8. Supervisor enters closing meter readings.
9. System derives shift meters from latest prior opening reading and the entered closing reading.
10. Supervisor submits shift logs.
11. If a correction or protected action is required, supervisor requests or enters an owner access code.

## Existing Workflow Translation

Old workflow:

- Supervisor carries a production register and writes machine/worker/meter details.
- Owner receives the register later.
- Corrections happen by crossing out entries.
- Machine breakdown reasons are told verbally.

Weavly workflow:

- The phone becomes the shift register.
- Assignments are saved as the shift is configured.
- Meter logs are submitted into production records.
- Corrections are auditable.
- Machine status is visible to owner analytics.

## Pain Points Solved

- Delayed production visibility.
- Manual payroll entry errors.
- Missing order/worker linkage.
- Duplicate shift entries.
- Weak audit trail for corrections.
- Slow repeated shift setup.

## User Interaction Details

- Machine rows show status strip, worker selector, order selector, and production input.
- Missing worker or order disables/confuses logging intentionally so the supervisor fixes setup first.
- Copy Previous Shift reduces repetitive assignment work.
- Owner access-code flow protects sensitive overwrites and past-date corrections.
- Machine status changes are separate from production submission.

## Data and Code

- `app/(dashboard)/supervisor/dashboard/page.tsx`
- `app/(dashboard)/supervisor/actions.ts`
- `components/navigation/supervisor-nav.tsx`
- `machines`
- `workers`
- `shift_assignments`
- `production_logs`
- `audit_log`

## Downstream Effects

- Owner analytics refreshes from production logs.
- Payroll uses production logs and rate snapshots.
- Orders and market runs update progress.
- Stock inward drafts can be created from production output.
- Machine status contributes to utilization signals.

## Readiness Notes

- This screen must stay fast on mobile.
- Validation should cover missing assignment, negative readings, duplicate logs, correction windows, and past-date access-code behavior.
