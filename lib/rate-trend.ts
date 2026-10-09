import type { RateHistoryEventKind } from './cost-rates'

/**
 * Pure chart maths for the Rate Book price-history modal. Dates are business
 * dates (`yyyy-MM-dd`), so every time here is that date at UTC midnight and
 * ticks are formatted with `timeZone: 'UTC'`; nothing depends on the device zone.
 */

const DAY_MS = 86_400_000

/** The history row fields the chart reads. The Activity sheet's rows satisfy this. */
export type RateTrendRow = {
    id: string
    value: number
    previous_value: number | null
    event_type: RateHistoryEventKind
    effective_date: string
    created_at: string
    source: string | null
}

/** `opening` is not a history row: it is the price before the first logged change. */
export type RateTrendPointKind = 'recorded' | 'changed' | 'reviewed' | 'opening'

export type RateTrendPoint = {
    id: string
    time: number
    date: string
    value: number
    kind: RateTrendPointKind
    source: string | null
    /** Change from the previous point on the chart; null for the first entry. */
    delta: number | null
    deltaPercent: number | null
}

export type RateTrend = {
    points: RateTrendPoint[]
    startTime: number
    endTime: number
    spanDays: number
    stats: {
        first: number
        latest: number
        change: number
        changePercent: number | null
        priceChanges: number
    }
}

const PLOTTED_KINDS = new Set<string>(['recorded', 'changed', 'reviewed'])

function parseDay(value: string) {
    const datePart = /^\d{4}-\d{2}-\d{2}/.exec(value)?.[0]
    return datePart ? Date.parse(`${datePart}T00:00:00Z`) : Number.NaN
}

/**
 * Turns the Rate Book history rows into a series that fits its own history:
 * the axis runs from the first entry to today (or to a later, future-dated
 * entry), so three months of history fills the chart as fully as a year does.
 *
 * A yarn discovered from a Saved Quality is created with no history row, so its
 * first edit is the only row, a `changed` entry whose `previous_value` is the
 * price it started at. That start is added as an `opening` point on the same
 * day (the date it was set is not recorded); without it the chart shows one
 * flat price and no change, while the rate list shows the rise.
 */
export function buildRateTrend(rows: RateTrendRow[], today: string): RateTrend | null {
    const ordered = rows
        .filter(row => PLOTTED_KINDS.has(row.event_type) && Number.isFinite(parseDay(row.effective_date)))
        .sort((a, b) =>
            parseDay(a.effective_date) - parseDay(b.effective_date)
            || Date.parse(a.created_at) - Date.parse(b.created_at)
            || a.id.localeCompare(b.id))
    if (ordered.length === 0) return null

    const firstRow = ordered[0]
    const startedAt = firstRow.event_type === 'changed' && firstRow.previous_value != null ? Number(firstRow.previous_value) : null
    const series: Array<{ row: RateTrendRow; kind: RateTrendPointKind; value: number }> = ordered.map(row => ({
        row,
        kind: row.event_type as RateTrendPointKind,
        value: Number(row.value),
    }))
    if (startedAt !== null && Number.isFinite(startedAt) && startedAt !== series[0].value) {
        series.unshift({ row: { ...firstRow, id: `${firstRow.id}:opening`, source: null }, kind: 'opening', value: startedAt })
    }

    const points: RateTrendPoint[] = series.map(({ row, kind, value }, index) => {
        const previous = index > 0 ? series[index - 1].value : null
        const delta = previous === null ? null : value - previous
        return {
            id: row.id,
            time: parseDay(row.effective_date),
            date: row.effective_date.slice(0, 10),
            value,
            kind,
            source: row.source,
            delta,
            deltaPercent: delta === null || !previous ? null : (delta * 100) / previous,
        }
    })

    const first = points[0]
    const last = points[points.length - 1]
    const todayTime = parseDay(today)
    const startTime = first.time
    const endTime = Number.isFinite(todayTime) ? Math.max(last.time, todayTime) : last.time
    const change = last.value - first.value

    return {
        points,
        startTime,
        endTime,
        spanDays: Math.round((endTime - startTime) / DAY_MS),
        stats: {
            first: first.value,
            latest: last.value,
            change,
            changePercent: first.value ? (change * 100) / first.value : null,
            priceChanges: points.filter(point => point.kind === 'changed').length,
        },
    }
}

/** Position along the time axis, 0 to 1. A same-day history has no span, so it sits in the middle. */
export function timeFraction(trend: Pick<RateTrend, 'startTime' | 'endTime'>, time: number) {
    const span = trend.endTime - trend.startTime
    return span === 0 ? 0.5 : (time - trend.startTime) / span
}

function niceNumber(value: number, round: boolean) {
    const exponent = Math.floor(Math.log10(value))
    const fraction = value / 10 ** exponent
    const nice = round
        ? fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10
        : fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
    return nice * 10 ** exponent
}

const cleanNumber = (value: number) => Math.round(value * 1e9) / 1e9

export type YAxis = { min: number; max: number; ticks: number[] }

/**
 * A value axis padded around the data, with round evenly spaced ticks. It is
 * deliberately not zero-based: a ₹5 move on a ₹285 yarn must stay visible.
 */
export function buildYAxis(values: number[], targetTicks = 4): YAxis {
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = max === min ? Math.max(Math.abs(max) * 0.05, 1) : (max - min) * 0.1
    let low = min - pad
    const high = max + pad
    if (min >= 0) low = Math.max(0, low)

    const step = niceNumber(niceNumber(high - low, false) / (targetTicks - 1), true)
    const niceMin = Math.floor(low / step) * step
    const niceMax = Math.ceil(high / step) * step
    const count = Math.round((niceMax - niceMin) / step)
    const ticks = Array.from({ length: count + 1 }, (_, index) => cleanNumber(niceMin + index * step))
    return { min: ticks[0], max: ticks[ticks.length - 1], ticks }
}

export type TimeTick = { time: number; granularity: 'day' | 'month' }

const DAY_STEPS = [1, 2, 7, 14]
const MONTH_STEPS = [1, 2, 3, 6, 12, 24, 60, 120]

function monthStarts(start: number, end: number, everyMonths: number) {
    const from = new Date(start)
    let index = from.getUTCFullYear() * 12 + from.getUTCMonth()
    if (Date.UTC(Math.floor(index / 12), index % 12, 1) < start) index += 1
    index = Math.ceil(index / everyMonths) * everyMonths
    const times: number[] = []
    for (let time = Date.UTC(Math.floor(index / 12), index % 12, 1); time <= end; index += everyMonths, time = Date.UTC(Math.floor(index / 12), index % 12, 1)) {
        times.push(time)
    }
    return times
}

/**
 * Round tick dates for a time axis of any length: days for a few days, weeks
 * for a few weeks, then calendar month starts thinned to every 2, 3, 6, 12…
 * months so there are never more than `maxTicks` labels to crowd the axis.
 */
export function buildTimeTicks(startTime: number, endTime: number, maxTicks = 5): TimeTick[] {
    if (endTime <= startTime) return [{ time: startTime, granularity: 'day' }]
    const spanDays = (endTime - startTime) / DAY_MS

    for (const step of DAY_STEPS) {
        const count = Math.floor(spanDays / step) + 1
        if (count <= maxTicks) {
            return Array.from({ length: count }, (_, index) => ({ time: startTime + index * step * DAY_MS, granularity: 'day' as const }))
        }
    }
    for (const step of MONTH_STEPS) {
        const times = monthStarts(startTime, endTime, step)
        if (times.length <= maxTicks) return times.map(time => ({ time, granularity: 'month' as const }))
    }
    return monthStarts(startTime, endTime, MONTH_STEPS[MONTH_STEPS.length - 1]).slice(0, maxTicks).map(time => ({ time, granularity: 'month' as const }))
}

export type StepPath = {
    d: string
    /** Total length of the path, so the draw-on animation can be driven by distance travelled. */
    length: number
    /** Distance along the path at which the pen reaches each point (after its riser). */
    stops: number[]
}

const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * A rate holds its value until it changes, so the line runs flat and then steps
 * straight up or down at each change, and finally runs flat on to `endX`.
 */
export function buildStepPath(coords: Array<{ x: number; y: number }>, endX: number): StepPath {
    const [first, ...rest] = coords
    let d = `M${round2(first.x)},${round2(first.y)}`
    let length = 0
    const stops = [0]
    let previous = first
    for (const point of rest) {
        d += ` H${round2(point.x)} V${round2(point.y)}`
        length += Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y)
        stops.push(length)
        previous = point
    }
    if (endX > previous.x) {
        d += ` H${round2(endX)}`
        length += endX - previous.x
    }
    return { d, length, stops }
}
