import type { BaseProductionAllocation, BaseProductionEntry, BaseWorkerPayable } from '../../lib/base-production-core'

/** Synthetic two-shift history. Never connects to a database. */
export function payrollReadinessFixture(workerCount: number, days: number, seed = 0) {
    const payables: BaseWorkerPayable[] = Array.from({ length: workerCount }, (_, index) => ({
        worker_id: `worker-${index}`, worker_name: `Synthetic ${index}`,
        period_start: '2026-08-01', period_end: '2026-08-31',
        meters: 120, gross_pay: index % 13 === 0 ? 0 : 900,
        pending_advance: 0, advance_recovery: 0, max_advance_recovery: 450,
        remaining_debt: 0, net_payout: 900,
        status: index % 7 === 0 ? 'paid' : 'unsettled', settlement_id: null, paid_at: null,
        pay_type: index % 11 === 0 ? 'fixed_monthly' : 'piece_rate',
    }))
    const entries: BaseProductionEntry[] = []
    const allocations: BaseProductionAllocation[] = []
    for (let day = 0; day < days; day++) {
        const date = new Date(Date.UTC(2026, 7, 31 - day)).toISOString().slice(0, 10)
        for (let worker = 0; worker < workerCount; worker++) {
            for (let shift = 0; shift < 2; shift++) {
                const index = entries.length + seed
                const row: BaseProductionEntry = {
                    id: `entry-${entries.length}`, worker_id: `worker-${worker}`, job_id: 'job',
                    production_date: date, created_at: `${date}T12:00:00Z`, notes: null,
                    meters: index % 19 === 0 ? 0 : 120.01,
                    worker_rate_snapshot: index % 17 === 0 ? 0 : 7.5,
                    shift: shift === 0 ? 'day' : 'night',
                    entry_status: index % 23 === 0 ? 'absent' : 'entered',
                    allocation_mode: index % 3 === 0 ? 'worker_total' : 'machine_breakdown',
                }
                entries.push(row)
                if (row.allocation_mode === 'machine_breakdown' && index % 29 !== 0) {
                    allocations.push({
                        id: `allocation-${entries.length}`, entry_id: row.id,
                        worker_id: index % 31 === 0 ? 'wrong-worker' : row.worker_id,
                        assignment_id: null, machine_id: 'machine', job_id: index % 37 === 0 ? '' : 'job',
                        meters: index % 41 === 0 ? 100 : row.meters,
                        worker_rate_snapshot: row.worker_rate_snapshot,
                        machine_label: 'Synthetic machine', job_label: 'Synthetic costing',
                        assignment_snapshot: {}, created_at: row.created_at,
                    })
                }
            }
        }
    }
    return { payables, entries, allocations }
}
