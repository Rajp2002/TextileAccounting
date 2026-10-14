import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    calculateBaseWorkerMachineBreakdown,
    calculateBaseWorkerPayables,
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

const dailyMachineEntry: BaseProductionEntry = {
    id: 'daily-1',
    job_id: '',
    worker_id: 'worker-1',
    production_date: '2026-08-20',
    meters: 320,
    worker_rate_snapshot: 2.75,
    notes: null,
    created_at: '2026-08-20T10:00:00.000Z',
    allocation_mode: 'machine_breakdown',
}

const secondDayMachineEntry: BaseProductionEntry = {
    ...dailyMachineEntry,
    id: 'daily-2',
    production_date: '2026-08-21',
    meters: 100,
}

const legacyTotalEntry: BaseProductionEntry = {
    id: 'legacy-1',
    job_id: 'job-1',
    worker_id: 'worker-1',
    production_date: '2026-08-22',
    meters: 50,
    worker_rate_snapshot: 4,
    notes: null,
    created_at: '2026-08-22T10:00:00.000Z',
}

const outsidePeriodEntry: BaseProductionEntry = {
    ...legacyTotalEntry,
    id: 'old-1',
    production_date: '2026-07-31',
    meters: 999,
}

const otherWorkerEntry: BaseProductionEntry = {
    ...legacyTotalEntry,
    id: 'other-1',
    worker_id: 'worker-2',
    meters: 700,
}

function allocation(overrides: Partial<BaseProductionAllocation>): BaseProductionAllocation {
    return {
        id: 'allocation',
        entry_id: 'daily-1',
        worker_id: 'worker-1',
        assignment_id: null,
        machine_id: 'machine-1',
        job_id: 'job-a',
        meters: 0,
        worker_rate_snapshot: 0,
        machine_label: 'Rapier #1',
        job_label: 'Job A',
        assignment_snapshot: {},
        created_at: '2026-08-20T10:00:00.000Z',
        ...overrides,
    }
}

const allocations: BaseProductionAllocation[] = [
    allocation({ id: 'a-1', entry_id: 'daily-1', meters: 160, worker_rate_snapshot: 2.5, machine_label: 'Rapier #1' }),
    allocation({ id: 'a-2', entry_id: 'daily-1', meters: 160, worker_rate_snapshot: 3, machine_id: 'machine-4', machine_label: 'Rapier #4' }),
    allocation({ id: 'a-3', entry_id: 'daily-2', meters: 100, worker_rate_snapshot: 2.5, created_at: '2026-08-21T10:00:00.000Z' }),
]

const entries = [dailyMachineEntry, secondDayMachineEntry, legacyTotalEntry, outsidePeriodEntry, otherWorkerEntry]

describe('calculateBaseWorkerMachineBreakdown', () => {
    it('groups one worker period by machine and snapshotted rate, with legacy worker totals on their own line', () => {
        const breakdown = calculateBaseWorkerMachineBreakdown({
            workerId: 'worker-1',
            fallbackRate: worker.rate_per_meter,
            periodStart: '2026-08-01',
            periodEnd: '2026-08-31',
            entries,
            allocations,
        })

        expect(breakdown.rows).toEqual([
            { machine_label: 'Rapier #1', rate_per_meter: 2.5, meters: 260, pay: 650 },
            { machine_label: 'Rapier #4', rate_per_meter: 3, meters: 160, pay: 480 },
            { machine_label: '', rate_per_meter: 4, meters: 50, pay: 200 },
        ])
        expect(breakdown.meters).toBe(470)
        expect(breakdown.pay).toBe(1330)
    })

    it('reconciles to the worker payable base pay for the same period', () => {
        const payable = calculateBaseWorkerPayables({
            workers: [worker],
            entries,
            allocations,
            advances: [],
            settlements: [],
            periodEnd: '2026-08-31',
        })[0]

        const breakdown = calculateBaseWorkerMachineBreakdown({
            workerId: 'worker-1',
            fallbackRate: worker.rate_per_meter,
            periodStart: payable.period_start,
            periodEnd: payable.period_end,
            entries,
            allocations,
        })

        expect(breakdown.pay).toBe(payable.base_pay)
        expect(breakdown.meters).toBe(payable.meters)
    })

    it('leaves out inapplicable earnings and returns no rows when nothing was produced', () => {
        const inapplicable = calculateBaseWorkerMachineBreakdown({
            workerId: 'worker-1',
            fallbackRate: worker.rate_per_meter,
            periodStart: '2026-08-01',
            periodEnd: '2026-08-31',
            entries: [{ ...dailyMachineEntry, piece_earning_state: 'inapplicable' }],
            allocations,
        })
        expect(inapplicable).toEqual({ rows: [], meters: 0, pay: 0 })

        const empty = calculateBaseWorkerMachineBreakdown({
            workerId: 'worker-3',
            fallbackRate: worker.rate_per_meter,
            periodStart: '2026-08-01',
            periodEnd: '2026-08-31',
            entries,
            allocations,
        })
        expect(empty).toEqual({ rows: [], meters: 0, pay: 0 })
    })

    it('orders looms by number and drops lines with no metres and no pay', () => {
        const breakdown = calculateBaseWorkerMachineBreakdown({
            workerId: 'worker-1',
            fallbackRate: worker.rate_per_meter,
            periodStart: '2026-08-01',
            periodEnd: '2026-08-31',
            entries: [dailyMachineEntry, { ...legacyTotalEntry, meters: 0 }],
            allocations: [
                allocation({ id: 'b-1', meters: 60, worker_rate_snapshot: 8.25, machine_label: 'Loom 10' }),
                allocation({ id: 'b-2', meters: 126.5, worker_rate_snapshot: 8.25, machine_id: 'machine-2', machine_label: 'Loom 9' }),
            ],
        })

        expect(breakdown.rows.map(row => row.machine_label)).toEqual(['Loom 9', 'Loom 10'])
        expect(breakdown.meters).toBe(186.5)
    })
})

describe('payroll worker card breakdown control', () => {
    it('opens the breakdown in a modal from the last action on each card, not inline', () => {
        const client = read('app/(dashboard)/owner/production/BaseProductionClient.tsx')

        const markPaid = client.indexOf("t('payroll.markPaidCard')")
        const breakdownButton = client.indexOf('setBreakdownWorkerId(payable.worker_id)')
        expect(markPaid).toBeGreaterThan(-1)
        expect(breakdownButton).toBeGreaterThan(markPaid)
        expect(client).toContain('<BaseWorkerPayBreakdownDialog')
        expect(client).toContain('payable={breakdownPayable}')
        expect(client).toContain('calculateBaseWorkerMachineBreakdown({')
        expect(client).not.toContain('toggleBreakdown')
        expect(client).not.toContain('aria-expanded={breakdownOpen}')
    })

    it('shows net pay and how it is reached beside the metres by machine', () => {
        const dialog = read('app/(dashboard)/owner/production/BaseWorkerPayBreakdownDialog.tsx')

        expect(dialog).toContain('open={Boolean(payable)}')
        expect(dialog).toContain("sm:max-w-4xl")
        expect(dialog).toContain("tx('Net pay')")
        expect(dialog).toContain("tx('Gross pay')")
        expect(dialog).toContain("tx('Advance recovery')")
        expect(dialog).toContain("tx('Metres by machine')")
        // Piece-rate workers see metres by machine; fixed-salary staff see the attendance calendar.
        expect(dialog).toMatch(/pay_type === 'fixed_monthly' \? \([\s\S]*<BaseStaffAttendanceCalendar[\s\S]*\) : <MachineTable breakdown=\{breakdown\} \/>/)
        // Net pay comes first in reading order, so phones show it before the machine list.
        expect(dialog.indexOf('<PaySummary payable={payable} />')).toBeLessThan(dialog.indexOf('<MachineTable breakdown={breakdown} />'))
    })
})
