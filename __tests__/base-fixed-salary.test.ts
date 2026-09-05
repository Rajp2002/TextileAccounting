import { describe, expect, it } from 'vitest'
import { calculateBaseSalaryLines, currentBaseMonthlySalary, mergeBaseSalaryOverhead } from '../lib/base-salary'
import { calculateBaseWorkerPayables, type BaseProductionWorker } from '../lib/base-production-core'
import { buildBasePayrollHistory, buildBasePayrollHistoryCsv } from '../lib/base-payroll-history'
import { buildBasePayrollReadiness } from '../lib/base-payroll-readiness'
import { DEFAULT_OVERHEAD_ITEMS } from '../lib/estimator'

const staff: BaseProductionWorker = { id: 'staff', name: 'Supervisor', role: 'Supervisor', pay_type: 'fixed_monthly', monthly_salary: 30000,
    start_date: '2026-08-01', end_date: null, salary_history: [{ effective_from: '2026-08-01', monthly_salary: 30000 }],
    rate_per_meter: 0, shift_availability: 'both', is_active: true }
const payables = (worker = staff, end = '2026-08-31') => calculateBaseWorkerPayables({ workers: [worker], entries: [], advances: [], settlements: [], periodEnd: end })

describe('Base fixed salaries', () => {
    it('pays a full salary without production and is ready to settle', () => {
        const result = payables()
        expect(result[0].gross_pay).toBe(30000)
        expect(result[0].meters).toBe(0)
        expect(buildBasePayrollReadiness({ payables: result, entries: [], allocations: [] }).readyWorkerCount).toBe(1)
    })
    it('prorates joining/leaving by calendar days, including leap February', () => {
        const worker = { ...staff, start_date: '2024-02-15', end_date: '2024-02-29', is_active: false,
            salary_history: [{ effective_from: '2024-02-15', monthly_salary: 29000 }] }
        expect(payables(worker, '2024-03-31')[0].gross_pay).toBe(15000)
        expect(currentBaseMonthlySalary(worker, '2024-02-28')).toBe(0)
    })
    it('keeps unpaid salary across months and uses dated salary changes', () => {
        const worker = { ...staff, salary_history: [...staff.salary_history!, { effective_from: '2026-09-16', monthly_salary: 36000 }] }
        const lines = calculateBaseSalaryLines(worker, '2026-08-01', '2026-09-30')
        expect(lines.map(line => line.grossPay)).toEqual([30000, 15000, 18000])
        expect(payables(worker, '2026-09-30')[0].gross_pay).toBe(63000)
        expect(currentBaseMonthlySalary(worker, '2026-09-15')).toBe(30000)
        expect(currentBaseMonthlySalary(worker, '2026-09-16')).toBe(36000)
    })
    it('does not add accidental production wages to a salary', () => {
        const result = calculateBaseWorkerPayables({ workers: [staff], entries: [{ id: 'entry', worker_id: staff.id, job_id: 'job', production_date: '2026-08-03', meters: 100, worker_rate_snapshot: 10, notes: null, created_at: '' }], advances: [], settlements: [], periodEnd: '2026-08-31' })
        expect(result[0].gross_pay).toBe(30000)
    })
    it('starts after the last payment and keeps paid totals authoritative', () => {
        const settlement = { id: 'paid', worker_id: staff.id, period_start: '2026-08-01', period_end: '2026-08-31', gross_pay: 30000,
            advance_deducted: 5000, net_payout: 25000, payment_mode: 'cash' as const, paid_at: '2026-08-31T10:00:00Z' }
        const input = { workers: [staff], entries: [], advances: [], settlements: [settlement], periodEnd: '2026-08-31' }
        expect(calculateBaseWorkerPayables(input)[0].net_payout).toBe(25000)
        expect(calculateBaseWorkerPayables({ ...input, periodEnd: '2026-09-30' })[0]).toMatchObject({ period_start: '2026-09-01', gross_pay: 30000 })
        expect(calculateBaseWorkerPayables({ ...input, settlements: [{ ...settlement, status: 'reversed' as const }], periodEnd: '2026-09-30' })[0].gross_pay).toBe(60000)
    })
    it('deducts advances from payroll, never from the overhead salary budget', () => {
        const result = calculateBaseWorkerPayables({ workers: [staff], entries: [], advances: [{ id: 'advance', worker_id: staff.id, amount: 20000, recovered_amount: 0, status: 'pending', description: null, created_at: '' }], settlements: [], periodEnd: '2026-08-31' })
        expect(result[0]).toMatchObject({ gross_pay: 30000, advance_recovery: 15000, net_payout: 15000, remaining_debt: 5000 })
        expect(currentBaseMonthlySalary(staff, '2026-08-31')).toBe(30000)
    })
    it('replaces the manual salary preset once, preserves custom expenses, and clears inactive salary', () => {
        const items = DEFAULT_OVERHEAD_ITEMS.map((item, index) => ({ ...item, id: String(index), monthlyAmount: item.category === 'admin' ? 50000 : 0 }))
        items.push({ id: 'custom', label: 'Internet', category: 'custom', source: 'manual', monthlyAmount: 1000, isPreset: false, isLocked: false })
        const merged = mergeBaseSalaryOverhead(items, [staff], '2026-08-31')
        expect(merged.reduce((sum, item) => sum + item.monthlyAmount, 0)).toBe(31000)
        expect(mergeBaseSalaryOverhead(merged, [staff], '2026-08-31')).toEqual(merged)
        expect(mergeBaseSalaryOverhead(merged, [{ ...staff, is_active: false }], '2026-08-31').find(item => item.source === 'base_salary_derived')?.monthlyAmount).toBe(0)
        expect(items.find(item => item.category === 'admin')?.monthlyAmount).toBe(50000)
    })
    it('does not budget future hires or accrue salary after leaving', () => {
        expect(currentBaseMonthlySalary(staff, '2026-07-31')).toBe(0)
        expect(payables(staff, '2026-07-31')[0].gross_pay).toBe(0)
        expect(payables({ ...staff, end_date: '2026-08-15' })[0].gross_pay).toBe(14516.13)
    })
    it('exports monthly units and keeps salaries out of machine-cost totals', () => {
        const history = buildBasePayrollHistory([{ id: 'paid', worker_id: staff.id, worker_name_snapshot: staff.name, period_start: '2026-08-01', period_end: '2026-08-31', gross_pay: 30000, advance_deducted: 0, net_payout: 30000, payment_mode: 'cash', paid_at: '2026-08-31' }], [{ id: 'line', settlement_id: 'paid', worker_id: staff.id, production_date: '2026-08-01', shift: null, machine_id: null, machine_label: 'Fixed salary', job_id: null, costing_label: '2026-08-01 to 2026-08-31 (31/31 days)', meters: 0, worker_rate_snapshot: 30000, gross_pay: 30000, source_kind: 'fixed_salary' }])[0]
        expect(history.machines).toEqual([])
        expect(history.totalGrossPay).toBe(30000)
        expect(buildBasePayrollHistoryCsv(history)).toContain('per month')
    })
})
