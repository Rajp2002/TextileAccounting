import { getRateReviewDueDate, getRateReviewStatus, type CostRateRow } from '@/lib/cost-rates'

/**
 * Figures for the Rate Book board: the coming review dates, the price review in progress and each yarn's price trail.
 * Pure so the page and its tests read the same numbers.
 */

/** One recorded price for a yarn, on the date it applied from. */
export type PricePoint = { date: string; value: number }

const DAY_MS = 24 * 60 * 60 * 1000

/** YYYY-MM-DD of a rate's next review (review dates are stored as UTC calendar dates). */
export function reviewDueDate(rate: Pick<CostRateRow, 'last_reviewed_at' | 'review_interval_days'>) {
    return getRateReviewDueDate(rate).toISOString().slice(0, 10)
}

/** Whole days from `today` to `date` (both YYYY-MM-DD); negative when the date has passed. */
export function daysUntil(date: string, today: string) {
    return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS)
}

/** A calendar date ("1 Nov") in the reader's language; rate dates are stored as plain dates. */
export function rateDateLabel(date: string, language: string) {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString(`${language}-IN`, { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

const REVIEW_URGENCY = { needs_review: 0, overdue: 1, due_soon: 2, current: 3 } as const

type ReviewOrderFields = Pick<CostRateRow, 'name' | 'last_reviewed_at' | 'review_interval_days' | 'is_reviewed'>

/** Orders due rates for review: a yarn never confirmed, then the longest overdue, then the soonest due, then by name. */
export function compareReviewUrgency(left: ReviewOrderFields, right: ReviewOrderFields, now = new Date()) {
    return REVIEW_URGENCY[getRateReviewStatus(left, now)] - REVIEW_URGENCY[getRateReviewStatus(right, now)]
        || reviewDueDate(left).localeCompare(reviewDueDate(right))
        || left.name.localeCompare(right.name, 'en-IN')
}

/** A due price as the review found it: its value and save stamp, so the review can tell it was checked. */
export type ReviewSnapshot = { value: number; updatedAt: string }

/** The prices a review works through: the ones due when it opened, in the order they were listed. */
export type RateReviewSession = { ids: string[]; before: Record<string, ReviewSnapshot> }

export function startRateReview(rates: readonly CostRateRow[]): RateReviewSession {
    return {
        ids: rates.map(rate => rate.id),
        before: Object.fromEntries(rates.map(rate => [rate.id, { value: Number(rate.current_value), updatedAt: rate.updated_at }])),
    }
}

/**
 * What became of a price since the review opened: still waiting for a check, confirmed at the same price, or changed.
 * A confirm or a new price saves the rate again, so a new save stamp marks it checked even when its interval keeps it due.
 */
export function reviewOutcome(rate: Pick<CostRateRow, 'current_value' | 'updated_at'>, before: ReviewSnapshot, stillDue: boolean) {
    if (stillDue && rate.updated_at === before.updatedAt) return 'waiting' as const
    return Math.abs(Number(rate.current_value) - before.value) < 0.0001 ? 'confirmed' as const : 'changed' as const
}

/** The coming review dates of rates not yet due for a check, soonest first, with how many yarns fall on each. */
export function upcomingReviews(rates: readonly CostRateRow[], now = new Date()) {
    const byDate = new Map<string, number>()
    for (const rate of rates) {
        if (getRateReviewStatus(rate, now) !== 'current') continue
        const date = reviewDueDate(rate)
        byDate.set(date, (byDate.get(date) ?? 0) + 1)
    }
    return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, count]) => ({ date, count }))
}

/**
 * A yarn's prices in date order, one point per date (the last recorded price that day wins), ending with today's
 * current price. Null when there is nothing to draw: fewer than two points or a price that never moved.
 */
export function priceTrail(points: readonly PricePoint[], current: number, today: string): PricePoint[] | null {
    const byDate = new Map<string, number>()
    for (const point of [...points].sort((left, right) => left.date.localeCompare(right.date))) {
        if (point.date <= today && Number.isFinite(point.value)) byDate.set(point.date, point.value)
    }
    byDate.set(today, current)
    const trail = [...byDate.entries()].map(([date, value]) => ({ date, value }))
    if (trail.length < 2 || trail.every(point => Math.abs(point.value - trail[0].value) < 0.0001)) return null
    return trail
}

const fixed = (value: number) => Math.round(value * 10) / 10

/**
 * A stepped price line scaled between the lowest and highest price, so a 128 to 140 change reads as a clear step,
 * not a sliver at the top of a scale that starts at zero.
 */
export function priceTrailPath(trail: readonly PricePoint[], width: number, height: number) {
    if (trail.length === 0) return { line: '', area: '' }
    const times = trail.map(point => Date.parse(`${point.date}T00:00:00Z`))
    const t0 = times[0], span = Math.max(times.at(-1)! - t0, 1)
    const low = Math.min(...trail.map(point => point.value)), high = Math.max(...trail.map(point => point.value))
    const range = Math.max(high - low, 0.0001)
    const top = 4, bottom = height - 6
    const x = (t: number) => fixed(((t - t0) / span) * width)
    const y = (value: number) => fixed(bottom - ((value - low) / range) * (bottom - top))
    let line = `M0 ${y(trail[0].value)}`
    trail.slice(1).forEach((point, index) => { line += ` H${x(times[index + 1])} V${y(point.value)}` })
    line += ` H${width}`
    return { line, area: `${line} V${height} H0 Z` }
}
