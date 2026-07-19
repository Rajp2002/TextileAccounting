import type { CostRateCategory, CostRateUnit } from '@/app/(dashboard)/owner/rates/actions'

export type CostRateRow = {
    id: string
    name: string
    category: CostRateCategory
    unit: CostRateUnit
    current_value: number
    previous_value: number | null
    effective_date: string
    last_reviewed_at: string
    review_interval_days: number
    source: string | null
    notes: string | null
    apply_as_default: boolean
    updated_at: string
}

export type RateReviewStatus = 'current' | 'due_soon' | 'overdue'

const DAY_MS = 24 * 60 * 60 * 1000

export function getRateReviewDueDate(rate: Pick<CostRateRow, 'last_reviewed_at' | 'review_interval_days'>) {
    const due = new Date(`${rate.last_reviewed_at}T00:00:00Z`)
    due.setUTCDate(due.getUTCDate() + Number(rate.review_interval_days))
    return due
}

export function getRateReviewStatus(
    rate: Pick<CostRateRow, 'last_reviewed_at' | 'review_interval_days'>,
    now = new Date(),
): RateReviewStatus {
    const dueAt = getRateReviewDueDate(rate).getTime()
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    if (dueAt < today) return 'overdue'
    if (dueAt - today <= 14 * DAY_MS) return 'due_soon'
    return 'current'
}

export function formatRateValue(value: number, unit: CostRateUnit) {
    const suffix = unit === 'per_kg' ? '/kg' : unit === 'per_m' ? '/m' : '%'
    const prefix = unit === 'percent' ? '' : '₹'
    return `${prefix}${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`
}

export function filterCostRates<T extends CostRateRow>(
    rates: T[],
    options: { query: string; category: CostRateCategory | 'all'; status: RateReviewStatus | 'all' },
    now = new Date(),
) {
    const query = options.query.trim().toLocaleLowerCase('en-IN')
    return rates.filter(rate => {
        const matchesQuery = !query || `${rate.name} ${rate.source ?? ''} ${rate.notes ?? ''}`.toLocaleLowerCase('en-IN').includes(query)
        const matchesCategory = options.category === 'all' || rate.category === options.category
        const matchesStatus = options.status === 'all' || getRateReviewStatus(rate, now) === options.status
        return matchesQuery && matchesCategory && matchesStatus
    })
}

export const COST_RATE_CATEGORY_LABELS: Record<CostRateCategory, string> = {
    yarn_warp: 'Warp yarn',
    yarn_weft: 'Weft yarn',
    warping: 'Warping',
    sizing: 'Sizing',
    winding: 'Winding',
    processing: 'Processing',
    finishing: 'Finishing',
    transport: 'Transport',
    commission: 'Commission',
    overhead: 'Overhead',
}
