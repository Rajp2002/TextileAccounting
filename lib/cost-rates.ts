import type { CostRateCategory, CostRateUnit } from '@/app/(dashboard)/owner/rates/actions'
import {
    formatYarnRateUsageNotes,
    YARN_RATE_DISCOVERY_SOURCE_LABELS,
    type YarnRateDiscoverySource,
} from './yarn-rate-reconciliation'
import { formatToSurat } from './time'

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
    is_active?: boolean
    /** A discovered rate is persisted for convenience, but is not trusted until the owner saves/reviews it. */
    is_reviewed?: boolean
    /** Derived from the current saved qualities/costings; it is not part of the financial rate snapshot. */
    discovery_source?: YarnRateDiscoverySource | null
    /** Current fabric names using this yarn, derived from saved quality/costing recipes. */
    fabric_names?: string[]
    /** Number of active Saved Qualities whose yarn layer matches this rate. */
    saved_quality_count?: number
}

export type RateReviewStatus = 'needs_review' | 'current' | 'due_soon' | 'overdue'

export type RateHistoryEventKind = 'recorded' | 'reviewed' | 'changed' | 'archived' | 'restored'

const DAY_MS = 24 * 60 * 60 * 1000

export function getRateReviewDueDate(rate: Pick<CostRateRow, 'last_reviewed_at' | 'review_interval_days'>) {
    const due = new Date(`${rate.last_reviewed_at}T00:00:00Z`)
    due.setUTCDate(due.getUTCDate() + Number(rate.review_interval_days))
    return due
}

export function getRateReviewStatus(
    rate: Pick<CostRateRow, 'last_reviewed_at' | 'review_interval_days' | 'is_reviewed'>,
    now = new Date(),
): RateReviewStatus {
    if (rate.is_reviewed === false) return 'needs_review'
    const dueAt = getRateReviewDueDate(rate).getTime()
    const [year, month, day] = formatToSurat(now, 'yyyy-MM-dd').split('-').map(Number)
    const today = Date.UTC(year, month - 1, day)
    if (dueAt < today) return 'overdue'
    if (dueAt - today <= 14 * DAY_MS) return 'due_soon'
    return 'current'
}

export function formatRateValue(value: number, unit: CostRateUnit) {
    const suffix = unit === 'per_kg' ? '/kg' : unit === 'per_m' ? '/m' : '%'
    const prefix = unit === 'percent' ? '' : '₹'
    return `${prefix}${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`
}

export type RatePriceDelta = {
    difference: number
    percentChange: number | null
    direction: 'increased' | 'decreased' | 'unchanged' | 'initial'
    formattedDifference: string
    formattedPercent: string | null
    previousValueFormatted: string | null
}

export function getRatePriceDelta(
    currentValue: number,
    previousValue: number | null | undefined,
    unit: CostRateUnit = 'per_kg',
): RatePriceDelta {
    if (previousValue == null || !Number.isFinite(Number(previousValue))) {
        return {
            difference: 0,
            percentChange: null,
            direction: 'initial',
            formattedDifference: 'Initial rate',
            formattedPercent: null,
            previousValueFormatted: null,
        }
    }

    const curr = Number(currentValue)
    const prev = Number(previousValue)
    const prevFormatted = formatRateValue(prev, unit)
    const rawDiff = Number((curr - prev).toFixed(4))

    if (Math.abs(rawDiff) < 0.0001) {
        return {
            difference: 0,
            percentChange: 0,
            direction: 'unchanged',
            formattedDifference: 'Unchanged',
            formattedPercent: null,
            previousValueFormatted: prevFormatted,
        }
    }

    const percentChange = prev > 0 ? Number(((rawDiff / prev) * 100).toFixed(2)) : null

    if (rawDiff > 0) {
        return {
            difference: rawDiff,
            percentChange,
            direction: 'increased',
            formattedDifference: `+${formatRateValue(rawDiff, unit)}`,
            formattedPercent: percentChange != null ? `+${percentChange.toFixed(1)}%` : null,
            previousValueFormatted: prevFormatted,
        }
    }

    return {
        difference: rawDiff,
        percentChange,
        direction: 'decreased',
        formattedDifference: `-${formatRateValue(Math.abs(rawDiff), unit)}`,
        formattedPercent: percentChange != null ? `${percentChange.toFixed(1)}%` : null,
        previousValueFormatted: prevFormatted,
    }
}


export function getCostRateDisplaySource(rate: Pick<CostRateRow, 'source' | 'discovery_source'>) {
    return rate.discovery_source
        ? YARN_RATE_DISCOVERY_SOURCE_LABELS[rate.discovery_source]
        : rate.source
}

export function getCostRateDisplayNotes(rate: Pick<CostRateRow, 'notes' | 'fabric_names'>) {
    return rate.fabric_names?.length
        ? formatYarnRateUsageNotes(rate.fabric_names)
        : rate.notes
}

/**
 * Present explicit activity events from the tenant-scoped Rate Book history.
 * The adjacent-value fallback keeps older history rows understandable after
 * the event columns are added.
 */
export function getRateHistoryEventKind(
    value: number,
    previousValue: number | null | undefined,
    eventType?: RateHistoryEventKind | null,
): RateHistoryEventKind {
    if (eventType) return eventType
    if (previousValue == null) return 'recorded'
    return Number(value) === Number(previousValue) ? 'reviewed' : 'changed'
}

export function getRateHistoryEventLabel(
    value: number,
    previousValue: number | null | undefined,
    unit: CostRateUnit,
    eventType?: RateHistoryEventKind | null,
) {
    const kind = getRateHistoryEventKind(value, previousValue, eventType)
    if (kind === 'reviewed') return 'Value reviewed — no rate change'
    if (kind === 'changed') return previousValue == null ? 'Rate changed' : `Changed from ${formatRateValue(Number(previousValue), unit)}`
    if (kind === 'archived') return 'Rate archived from active Rate Book'
    if (kind === 'restored') return 'Rate restored to active Rate Book'
    return 'Value recorded'
}

export function filterCostRates<T extends CostRateRow>(
    rates: T[],
    options: { query: string; category: CostRateCategory | 'all'; status: RateReviewStatus | 'all' },
    now = new Date(),
) {
    const query = options.query.trim().toLocaleLowerCase('en-IN')
    return rates.filter(rate => {
        const searchText = [
            rate.name,
            getCostRateDisplaySource(rate),
            getCostRateDisplayNotes(rate),
            rate.source,
            rate.notes,
            ...(rate.fabric_names ?? []),
        ].filter(Boolean).join(' ')
        const matchesQuery = !query || searchText.toLocaleLowerCase('en-IN').includes(query)
        const matchesCategory = options.category === 'all' || rate.category === options.category
        const reviewStatus = getRateReviewStatus(rate, now)
        const matchesStatus = options.status === 'all'
            ? true
            : options.status === 'needs_review'
                ? reviewStatus !== 'current'
                : reviewStatus === options.status
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
