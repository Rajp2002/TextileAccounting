import { describe, expect, it } from 'vitest'
import { calculateBaseWorkerPayables, type BaseProductionWorker } from '../lib/base-production-core'

function fixedWorker(overrides: { start_date: string; monthly_salary: number }): BaseProductionWorker {
    return {
        id: 'w1', name: 'Mahesh', rate_per_meter: 0, shift_availability: 'both', is_active: true, pay_type: 'fixed_monthly',
        start_date: overrides.start_date, monthly_salary: overrides.monthly_salary,
        salary_history: [{ effective_from: overrides.start_date, monthly_salary: overrides.monthly_salary }],
    }
}

describe('fixed salary and go-live', () => {
    it('starts fixed salary at go-live for a long-serving worker', () => {
        const [payable] = calculateBaseWorkerPayables({ workers: [fixedWorker({ start_date: '2019-04-01', monthly_salary: 30000 })],
            entries: [], advances: [], settlements: [], periodEnd: '2026-11-30', goLiveDate: '2026-11-01' })
        expect(payable.period_start).toBe('2026-11-01')
        expect(payable.gross_pay).toBe(30000)
    })
    it('keeps a joining date after go-live', () => {
        const [payable] = calculateBaseWorkerPayables({ workers: [fixedWorker({ start_date: '2026-11-10', monthly_salary: 30000 })],
            entries: [], advances: [], settlements: [], periodEnd: '2026-11-30', goLiveDate: '2026-11-01' })
        expect(payable.period_start).toBe('2026-11-10')
        expect(payable.gross_pay).toBe(21000)
    })
    it('is unchanged without a go-live date', () => {
        const [payable] = calculateBaseWorkerPayables({ workers: [fixedWorker({ start_date: '2026-10-01', monthly_salary: 31000 })],
            entries: [], advances: [], settlements: [], periodEnd: '2026-10-31' })
        expect(payable.period_start).toBe('2026-10-01')
        expect(payable.gross_pay).toBe(31000)
    })
})
