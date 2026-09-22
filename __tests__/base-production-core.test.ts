import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
    calculateBaseDailyProductionSummary,
    calculateBaseEntryGrossPay,
    calculateBaseJobSummary,
    calculateBaseWorkerPayables,
    getBasePayrollPeriod,
    reconcileBaseProductionJobStatuses,
    type BaseProductionJob,
    type BaseProductionAllocation,
    type BaseProductionEntry,
    type BaseProductionWorker,
} from '../lib/base-production-core'

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')

const worker: BaseProductionWorker = {
    id: 'worker-1',
    name: 'Ramesh',
    rate_per_meter: 10,
    shift_availability: 'both',
    is_active: true,
}

function entry(overrides: Partial<BaseProductionEntry> = {}): BaseProductionEntry {
    return {
        id: 'entry-1',
        job_id: 'job-1',
        worker_id: 'worker-1',
        production_date: '2026-08-20',
        meters: 100,
        worker_rate_snapshot: 8,
        notes: null,
        created_at: '2026-08-20T10:00:00.000Z',
        ...overrides,
    }
}

describe('Base Production Core calculations', () => {
    it('totals a daily worker sheet once and keeps blank, zero, and absent distinct', () => {
        expect(calculateBaseDailyProductionSummary([
            { worker_id: 'worker-1', meters: 160, status: 'entered' },
            { worker_id: 'worker-2', meters: null, status: 'blank' },
            { worker_id: 'worker-3', meters: 0, status: 'zero' },
            { worker_id: 'worker-4', meters: 0, status: 'absent' },
        ])).toEqual({
            total_meters: 160,
            entered_count: 1,
            zero_count: 1,
            absent_count: 1,
            outstanding_count: 1,
        })
    })

    it('keeps job progress bounded and never returns negative remaining metres', () => {
        const summary = calculateBaseJobSummary(
            {
                id: 'job-1',
                target_meters: 100,
                planned_cost_per_meter: 20,
                planned_price_per_meter: 30,
            },
            [entry({ meters: 65 }), entry({ id: 'entry-2', meters: 50 })],
        )

        expect(summary.produced_meters).toBe(115)
        expect(summary.remaining_meters).toBe(0)
        expect(summary.excess_meters).toBe(15)
        expect(summary.progress_percent).toBe(100)
        expect(summary.planned_cost_total).toBe(2000)
        expect(summary.planned_value_total).toBe(3000)
    })

    it('treats recorded output as authoritative evidence that a planned job started', () => {
        const plannedJob = {
            id: 'job-1',
            status: 'planned',
        } satisfies Pick<BaseProductionJob, 'id' | 'status'>
        const completedJob = {
            id: 'job-2',
            status: 'completed',
        } satisfies Pick<BaseProductionJob, 'id' | 'status'>

        expect(reconcileBaseProductionJobStatuses(
            [plannedJob, completedJob],
            [entry({ job_id: 'job-1', meters: 100 }), entry({ id: 'entry-2', job_id: 'job-2', meters: 20 })],
        )).toEqual([
            { id: 'job-1', status: 'active' },
            completedJob,
        ])
    })

    it('activates a planned job from machine allocations but not zero-output records', () => {
        const jobs = [
            { id: 'job-1', status: 'planned' as const },
            { id: 'job-2', status: 'planned' as const },
        ]

        expect(reconcileBaseProductionJobStatuses(
            jobs,
            [entry({ job_id: 'job-1', meters: 0 })],
            [{ job_id: 'job-2', meters: 1 }],
        )).toEqual([
            { id: 'job-1', status: 'planned' },
            { id: 'job-2', status: 'active' },
        ])
    })

    it('recovers ₹300 from ₹600 wages and carries ₹200 of a ₹500 advance forward', () => {
        const result = calculateBaseWorkerPayables({
            workers: [worker],
            entries: [entry({ worker_rate_snapshot: 6 })],
            advances: [{
                id: 'advance-1',
                worker_id: 'worker-1',
                amount: 500,
                recovered_amount: 0,
                description: null,
                status: 'pending',
                created_at: '2026-08-01T10:00:00.000Z',
            }],
            settlements: [],
            periodEnd: '2026-08-31',
        })[0]

        expect(result.gross_pay).toBe(600)
        expect(result.max_advance_recovery).toBe(300)
        expect(result.advance_recovery).toBe(300)
        expect(result.net_payout).toBe(300)
        expect(result.remaining_debt).toBe(200)
    })

    it('recovers nothing and leaves full gross pay due when there is no advance balance', () => {
        const result = calculateBaseWorkerPayables({
            workers: [worker],
            entries: [entry()],
            advances: [],
            settlements: [],
            periodEnd: '2026-08-31',
        })[0]

        expect(result.gross_pay).toBe(800)
        expect(result.pending_advance).toBe(0)
        expect(result.advance_recovery).toBe(0)
        expect(result.net_payout).toBe(800)
    })

    it('calculates machine-specific costing rates once in the worker payable', () => {
        const dailyEntry = entry({
            id: 'daily-1',
            job_id: '',
            meters: 320,
            worker_rate_snapshot: 2.75,
            allocation_mode: 'machine_breakdown',
        })
        const allocations: BaseProductionAllocation[] = [
            {
                id: 'allocation-1',
                entry_id: 'daily-1',
                worker_id: 'worker-1',
                assignment_id: 'assignment-1',
                machine_id: 'machine-1',
                job_id: 'job-a',
                meters: 160,
                worker_rate_snapshot: 2.5,
                machine_label: 'Rapier #1',
                job_label: 'Job A',
                assignment_snapshot: {},
                created_at: '2026-08-20T10:00:00.000Z',
            },
            {
                id: 'allocation-2',
                entry_id: 'daily-1',
                worker_id: 'worker-1',
                assignment_id: 'assignment-2',
                machine_id: 'machine-4',
                job_id: 'job-b',
                meters: 160,
                worker_rate_snapshot: 3,
                machine_label: 'Rapier #4',
                job_label: 'Job B',
                assignment_snapshot: {},
                created_at: '2026-08-20T10:00:00.000Z',
            },
        ]

        expect(calculateBaseEntryGrossPay(dailyEntry, allocations)).toBe(880)

        const result = calculateBaseWorkerPayables({
            workers: [worker],
            entries: [dailyEntry],
            allocations,
            advances: [],
            settlements: [],
            periodEnd: '2026-08-31',
        })[0]

        expect(result.meters).toBe(320)
        expect(result.gross_pay).toBe(880)
        expect(result.net_payout).toBe(880)

        const changedWorkerRate = calculateBaseWorkerPayables({
            workers: [{ ...worker, rate_per_meter: 99 }],
            entries: [dailyEntry],
            allocations,
            advances: [],
            settlements: [],
            periodEnd: '2026-08-31',
        })[0]

        expect(changedWorkerRate.gross_pay).toBe(880)
    })

    it('counts machine-breakdown allocations once in each costing job summary', () => {
        const dailyEntry = entry({
            id: 'daily-2',
            job_id: '',
            meters: 320,
            worker_rate_snapshot: 2.75,
            allocation_mode: 'machine_breakdown',
        })
        const allocations: BaseProductionAllocation[] = [
            {
                id: 'allocation-a',
                entry_id: 'daily-2',
                worker_id: 'worker-1',
                assignment_id: 'assignment-a',
                machine_id: 'machine-a',
                job_id: 'job-a',
                meters: 160,
                worker_rate_snapshot: 2.5,
                machine_label: 'Rapier #1',
                job_label: 'Job A',
                assignment_snapshot: {},
                created_at: '2026-08-20T10:00:00.000Z',
            },
            {
                id: 'allocation-b',
                entry_id: 'daily-2',
                worker_id: 'worker-1',
                assignment_id: 'assignment-b',
                machine_id: 'machine-b',
                job_id: 'job-b',
                meters: 160,
                worker_rate_snapshot: 3,
                machine_label: 'Rapier #4',
                job_label: 'Job B',
                assignment_snapshot: {},
                created_at: '2026-08-20T10:00:00.000Z',
            },
        ]

        expect(calculateBaseJobSummary(
            { id: 'job-a', target_meters: 160, planned_cost_per_meter: 10, planned_price_per_meter: 12 },
            [dailyEntry],
            allocations,
        )).toMatchObject({ produced_meters: 160, remaining_meters: 0, excess_meters: 0, progress_percent: 100 })
        expect(calculateBaseJobSummary(
            { id: 'job-a', target_meters: 100, planned_cost_per_meter: 10, planned_price_per_meter: 12 },
            [dailyEntry],
            allocations,
        )).toMatchObject({ produced_meters: 160, remaining_meters: 0, excess_meters: 60, progress_percent: 100 })
        expect(calculateBaseJobSummary(
            { id: 'job-b', target_meters: 320, planned_cost_per_meter: 10, planned_price_per_meter: 12 },
            [dailyEntry],
            allocations,
        )).toMatchObject({ produced_meters: 160, remaining_meters: 160, excess_meters: 0, progress_percent: 50 })
    })

    it('starts a new payable period after a prior settlement', () => {
        const result = calculateBaseWorkerPayables({
            workers: [worker],
            entries: [
                entry({ id: 'old', production_date: '2026-08-10', meters: 100 }),
                entry({ id: 'new', production_date: '2026-08-20', meters: 25 }),
            ],
            advances: [],
            settlements: [{
                id: 'settlement-1',
                worker_id: 'worker-1',
                period_start: '2026-08-01',
                period_end: '2026-08-15',
                gross_pay: 800,
                advance_deducted: 0,
                net_payout: 800,
                payment_mode: 'cash',
                paid_at: '2026-08-15T18:00:00.000Z',
            }],
            periodEnd: '2026-08-31',
        })[0]

        expect(result.period_start).toBe('2026-08-16')
        expect(result.meters).toBe(25)
        expect(result.gross_pay).toBe(200)
        expect(result.status).toBe('unsettled')
    })

    it('returns a calendar-month start for the first Base pay period', () => {
        expect(getBasePayrollPeriod('2026-08-29')).toEqual({ start: '2026-08-01', end: '2026-08-29' })
    })
})

describe('Base Production Core boundary contracts', () => {
    it('keeps Base production tables and settlement access separate from Full Suite records', () => {
        const migration = read('supabase/migrations/20260829090000_base_production_core.sql')
        const hardeningMigration = read('supabase/migrations/20260830000000_base_production_core_security_hardening.sql')
        const operationalMigration = read('supabase/migrations/20260830100000_base_operational_loop.sql')
        const machineFirstMigration = read('supabase/migrations/20260830110000_base_machine_first_production.sql')
        const workerShiftMigration = read('supabase/migrations/20260829203707_add_base_worker_shift_availability.sql')
        const actions = read('app/(dashboard)/owner/production/actions.ts')
        const client = read('app/(dashboard)/owner/production/BaseProductionClient.tsx')
        const dailySheet = read('app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx')
        const assignments = read('app/(dashboard)/owner/production/BaseAssignmentWorkspace.tsx')
        const sidebar = read('lib/owner-navigation.ts')
        const operationsPage = read('app/(dashboard)/owner/assignments/page.tsx')
        const payrollPage = read('app/(dashboard)/owner/payroll/page.tsx')

        expect(migration).toContain('base_production_core_access')
        expect(migration).toContain('base_production_jobs')
        expect(migration).toContain('base_production_entries')
        expect(migration).toContain('settle_base_worker_payroll')
        expect(migration).toContain('public.estimator_quotes(org_id, id)')
        expect(migration).not.toContain('require_premium_tenant_mutation')
        expect(migration).toContain("status text NOT NULL DEFAULT 'pending',")
        expect(migration.match(/base_worker_advances_status_check/g)).toHaveLength(1)
        expect(actions).toContain('worker_rate_snapshot: worker.rate_per_meter')
        expect(actions).toContain("supabase.rpc('settle_base_worker_payroll_reviewed'")
        expect(migration).toContain('NEW.worker_rate_snapshot := v_worker_rate')
        expect(migration).not.toContain('machine_label')
        expect(migration).not.toContain('shift text')
        expect(migration).not.toContain('auth.role()')
        expect(hardeningMigration).toContain('CREATE SCHEMA IF NOT EXISTS private')
        expect(hardeningMigration).toContain('private.base_production_core_access')
        expect(hardeningMigration).toContain('REVOKE ALL ON FUNCTION public.base_production_core_access(uuid)')
        expect(client).toContain('Piece-rate pay uses saved machine rates.')
        expect(client).not.toContain('outside the current Lite and Base catalog')
        expect(client).toContain('No advance to recover. Full gross pay is due this period.')
        expect(client).not.toContain('Up to {formatINR(payable.max_advance_recovery')
        expect(operationalMigration).toContain('base_production_machines')
        expect(operationalMigration).toContain('base_worker_machine_assignments')
        expect(operationalMigration).toContain('base_production_batches')
        expect(operationalMigration).toContain('base_daily_production_entries')
        expect(operationalMigration).toContain('save_base_daily_production')
        expect(operationalMigration).toContain('pg_advisory_xact_lock')
        expect(operationalMigration).toContain('private.base_production_core_access')
        expect(operationalMigration).toContain('entry_status')
        expect(operationalMigration).toContain('assignment_snapshot')
        expect(operationalMigration).toContain('UNION ALL')
        expect(actions).toContain("supabase.rpc('save_base_daily_production_reviewed'")
        expect(actions).toContain("supabase.rpc('upsert_base_worker_machine_assignment'")
        expect(dailySheet).toContain('Enter shift metres, not cumulative meter readings.')
        expect(dailySheet).toContain('Save shift')
        expect(dailySheet).toContain('Editing is locked to prevent accidental changes.')
        expect(dailySheet).toContain('Edit saved log')
        expect(dailySheet).toContain('Unlock editing')
        expect(dailySheet).toContain('Save correction')
        expect(dailySheet).toContain('Worker review')
        expect(dailySheet).not.toContain('Select a job')
        expect(machineFirstMigration).toContain('base_daily_production_allocations')
        expect(machineFirstMigration).toContain('worker_rate_per_meter')
        expect(machineFirstMigration).toContain('allocation_mode')
        expect(machineFirstMigration).toContain('worker_rate_snapshot')
        expect(machineFirstMigration).toContain('SUM(allocation.meters * allocation.worker_rate_snapshot)')
        expect(machineFirstMigration).toContain('assert_base_daily_production_allocation_totals')
        expect(workerShiftMigration).toContain('shift_availability')
        expect(workerShiftMigration).toContain("CHECK (shift_availability IN ('day', 'night', 'both'))")
        expect(workerShiftMigration).toContain('ALTER COLUMN rate_per_meter SET DEFAULT 0')
        expect(workerShiftMigration).not.toContain('UPDATE public.base_production_workers')
        expect(assignments).toContain('onPointerMove')
        expect(assignments).toContain('data-machine-node')
        expect(assignments).toContain('connectorPath')
        expect(assignments).toContain('<MachineTypeFilters')
        expect(assignments).not.toContain('placeholder="Search machines"')
        expect(assignments).toContain('Assignment workspace view')
        expect(assignments).toContain("mobileView === 'machines'")
        expect(read('app/(dashboard)/owner/production/BaseMachineJobs.tsx')).toContain('Production job for ${machine.custom_label || machine.name}')
        expect(dailySheet).toContain('aria-controls="base-payroll-rollup"')
        expect(dailySheet).toContain("isPayrollExpanded ? 'block' : 'hidden'")
        expect(dailySheet).toContain('assignedWorkers.map')
        const costingGuardMigration = read('supabase/migrations/20260901100000_require_active_costing_for_machine_assignment.sql')
        expect(costingGuardMigration).toContain('This machine does not have an active costing')
        const assignmentMessageMigration = read('supabase/migrations/20260905090000_clarify_base_assignment_job_error.sql')
        expect(assignmentMessageMigration).toContain('This machine has no active production job. Create or select one before assigning a worker.')
        expect(costingGuardMigration).toContain('public.set_base_machine_job_context')
        expect(actions).toContain('This machine has no active production job. Create or select one before assigning a worker.')
        expect(assignments).toContain('currentJobByMachine.has(machine.id)')
        expect(assignments).toContain('No production job')
        expect(assignments).toContain('has no active production job')
        expect(sidebar).toContain("'/owner/production'")
        expect(sidebar).toContain("'/owner/assignments'")
        expect(operationsPage).toContain('view="operations"')
        expect(payrollPage).toContain('view="payroll"')
        expect(client).not.toContain("<TabsList")
        expect(client).toContain('grid-cols-2')
    })
})
