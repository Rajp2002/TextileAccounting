import Decimal from 'decimal.js'
import type { BaseProductionWorker } from './base-production-core'
import { DEFAULT_OVERHEAD_ITEMS, type OverheadItem } from './estimator'

export type BaseSalaryRate = { effective_from: string; monthly_salary: number }
export type BaseSalaryLine = { start: string; end: string; days: number; monthDays: number; monthlySalary: number; grossPay: number }

export function readBaseSalaryHistory(value: unknown): BaseSalaryRate[] {
    if (!Array.isArray(value)) return []
    return value.flatMap(item => {
        if (!item || typeof item !== 'object') return []
        const rate = item as Record<string, unknown>
        const salary = Number(rate.monthly_salary)
        return typeof rate.effective_from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rate.effective_from)
            && Number.isFinite(salary) && salary > 0
            ? [{ effective_from: rate.effective_from, monthly_salary: salary }] : []
    }).sort((a, b) => a.effective_from.localeCompare(b.effective_from))
}

function date(value: string) { return new Date(`${value}T00:00:00Z`) }
function iso(value: Date) { return value.toISOString().slice(0, 10) }

/** Round once per salary-rate/calendar-month segment, identically to Postgres. */
export function calculateBaseSalaryLines(worker: BaseProductionWorker, start: string, end: string): BaseSalaryLine[] {
    if (worker.pay_type !== 'fixed_monthly' || !worker.start_date) return []
    const from = [start, worker.start_date].sort().at(-1)!
    const through = worker.end_date && worker.end_date < end ? worker.end_date : end
    if (from > through) return []
    const history = worker.salary_history ?? []
    const lines: BaseSalaryLine[] = []
    for (let index = 0; index < history.length; index++) {
        const rate = history[index]
        const next = history[index + 1]
        const rateEnd = next ? iso(new Date(date(next.effective_from).getTime() - 86400000)) : through
        let cursor = date(rate.effective_from > from ? rate.effective_from : from)
        const stop = rateEnd < through ? rateEnd : through
        while (iso(cursor) <= stop) {
            const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0))
            const segmentEnd = iso(monthEnd) < stop ? iso(monthEnd) : stop
            const days = Math.round((date(segmentEnd).getTime() - cursor.getTime()) / 86400000) + 1
            lines.push({ start: iso(cursor), end: segmentEnd, days, monthDays: monthEnd.getUTCDate(), monthlySalary: rate.monthly_salary,
                grossPay: new Decimal(rate.monthly_salary).times(days).div(monthEnd.getUTCDate()).toDecimalPlaces(2).toNumber() })
            cursor = new Date(date(segmentEnd).getTime() + 86400000)
        }
    }
    return lines
}

export function currentBaseMonthlySalary(worker: BaseProductionWorker, today: string): number {
    if (worker.pay_type !== 'fixed_monthly' || !worker.is_active || !worker.start_date || worker.start_date > today || (worker.end_date && worker.end_date < today)) return 0
    return (worker.salary_history ?? []).filter(rate => rate.effective_from <= today).at(-1)?.monthly_salary ?? 0
}

/** Replace the salary preset, never add salaries on top of the same manual row. */
export function mergeBaseSalaryOverhead(items: OverheadItem[], workers: BaseProductionWorker[], today: string): OverheadItem[] {
    if (!workers.some(worker => worker.pay_type === 'fixed_monthly')) return items
    const source = items.length ? items : DEFAULT_OVERHEAD_ITEMS.map((item, index) => ({ ...item, id: `overhead-${index}` }))
    const salary = workers.reduce((total, worker) => total.plus(currentBaseMonthlySalary(worker, today)), new Decimal(0)).toNumber()
    const remaining = source.filter(item => item.source !== 'base_salary_derived' && !(item.isPreset && item.category === 'admin'))
    return [...remaining, { id: 'base-staff-salary', label: 'Fixed Salary Factory Staff', monthlyAmount: salary,
        source: 'base_salary_derived', category: 'admin', isPreset: true, isLocked: true }]
}
