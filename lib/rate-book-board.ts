import { getRateReviewDueDate, getRateReviewStatus, type CostRateRow } from '@/lib/cost-rates'

/**
 * Figures for the Rate Book board: the month's price moves, the coming review dates and each yarn's price trail.
 * Pure so the page and its tests read the same numbers.
 */

/** One recorded price for a yarn, on the date it applied from. */
export type PricePoint = { date: string; value: number }

/** A yarn whose price changed this month, measured from the price before. */
export type PriceMove = { id: string; name: string; difference: number; percent: number }

const DAY_MS = 24 * 60 * 60 * 1000

/** YYYY-MM-DD of a rate's next review (review dates are stored as UTC calendar dates). */
export function reviewDueDate(rate: Pick<CostRateRow, 'last_reviewed_at' | 'review_interval_days'>) {
    return getRateReviewDueDate(rate).toISOString().slice(0, 10)
}

/** Whole days from `today` to `date` (both YYYY-MM-DD); negative when the date has passed. */
export function daysUntil(date: string, today: string) {
    return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS)
}

/** Price changes that took effect in `month` (YYYY-MM), largest first, with how many went up, down or stayed. */
export function priceMovesInMonth(rates: readonly CostRateRow[], month: string) {
    const moves: PriceMove[] = []
    for (const rate of rates) {
        const previous = Number(rate.previous_value)
        const current = Number(rate.current_value)
        if (!rate.effective_date.startsWith(month) || rate.previous_value == null || !(previous > 0)) continue
        const difference = Number((current - previous).toFixed(4))
        if (Math.abs(difference) < 0.0001) continue
        moves.push({ id: rate.id, name: rate.name, difference, percent: (difference / previous) * 100 })
    }
    moves.sort((left, right) => Math.abs(right.percent) - Math.abs(left.percent) || left.name.localeCompare(right.name, 'en-IN'))
    const up = moves.filter(move => move.difference > 0).length
    const down = moves.length - up
    return { moves, up, down, unchanged: rates.length - moves.length }
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
