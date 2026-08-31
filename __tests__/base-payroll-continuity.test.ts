import { describe, expect, it } from 'vitest'
import { calculateBaseWorkerPayables, type BasePayrollSettlement, type BaseProductionEntry } from '../lib/base-production-core'

const worker = { id: 'worker-1', name: 'Worker', rate_per_meter: 8, shift_availability: 'both' as const, is_active: true }
function entry(date: string, meters = 100): BaseProductionEntry {
    return { id: date, worker_id: worker.id, job_id: 'job-1', production_date: date, meters, worker_rate_snapshot: 8, notes: null, created_at: `${date}T10:00:00Z` }
}
function payable(periodEnd: string, entries: BaseProductionEntry[], settlements: BasePayrollSettlement[] = []) {
    return calculateBaseWorkerPayables({ workers: [worker], entries, settlements, advances: [], periodEnd })[0]
}

describe('outstanding Base payroll', () => {
    it.each(['2026-09-01', '2027-01-01'])('retains unpaid earnings through %s', (end) => {
        expect(payable(end, [entry('2026-08-31')])).toMatchObject({ period_start: '2026-08-31', meters: 100, gross_pay: 800, net_payout: 800 })
    })

    it('continues the last settlement without a calendar-month clamp', () => {
        const settlement: BasePayrollSettlement = { id: 'paid-1', worker_id: worker.id, period_start: '2026-08-01', period_end: '2026-08-15', gross_pay: 800, advance_deducted: 0, net_payout: 800, payment_mode: 'cash', paid_at: '2026-08-15T10:00:00Z' }
        expect(payable('2026-09-01', [entry('2026-08-10'), entry('2026-08-31', 25)], [settlement])).toMatchObject({ period_start: '2026-08-16', meters: 25, gross_pay: 200 })
    })

    it('excludes future work and retains saved rates after a worker rate change', () => {
        expect(calculateBaseWorkerPayables({ workers: [{ ...worker, rate_per_meter: 99 }], entries: [entry('2026-08-31'), entry('2026-09-02')], settlements: [], advances: [], periodEnd: '2026-09-01' })[0]).toMatchObject({ meters: 100, gross_pay: 800 })
    })

    it('makes a reversed payment outstanding again while retaining its saved production rate', () => {
        const settlement: BasePayrollSettlement = { id: 'reversed', worker_id: worker.id, period_start: '2026-08-01', period_end: '2026-08-31', gross_pay: 800, advance_deducted: 0, net_payout: 800, payment_mode: 'cash', paid_at: '2026-08-31T10:00:00Z', status: 'reversed' }
        expect(payable('2026-09-01', [entry('2026-08-31')], [settlement])).toMatchObject({ period_start: '2026-08-31', gross_pay: 800, status: 'unsettled' })
    })

    it('does not use another worker or a blank historical row to extend the period', () => {
        expect(payable('2026-09-01', [entry('2026-01-01', 0), { ...entry('2025-01-01'), worker_id: 'another-worker' }])).toMatchObject({ period_start: '2026-09-01', gross_pay: 0 })
    })
})
