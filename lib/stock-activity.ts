import { businessDate } from '@/lib/challan-payment-terms'

/**
 * Recent stock activity for the Fabric and Yarn stock pages: the movements of the last three weeks, read once on
 * the server so that week totals, daily pace and trend lines never depend on which history page the client holds.
 * Every function here is pure; dates are India calendar days (IST has no daylight saving).
 */

/** Days of movements the server returns for trends. */
export const ACTIVITY_DAYS = 21
/** Days that count as "this week" for totals and pace. */
export const WEEK_DAYS = 7
/** Upper bound on rows read for the window; a busier factory loses only the oldest trend points. */
export const ACTIVITY_ROW_LIMIT = 2000

const DAY_MS = 86_400_000

export type ActivityRow = { id: string; itemId: string; kind: string; delta: number; balanceAfter: number; createdAt: string }
export type TrendPoint = { t: number; v: number }

/** Start of the India calendar day `daysBack` days before today, as an ISO timestamp. */
export function indiaDayStart(daysBack: number, now: Date = new Date()): string {
    const today = businessDate(now)
    return new Date(Date.parse(`${today}T00:00:00+05:30`) - daysBack * DAY_MS).toISOString()
}

/** The first moment of the activity window: today and the 20 days before it. */
export const activitySince = (now: Date = new Date()) => indiaDayStart(ACTIVITY_DAYS - 1, now)
/** The first moment of this week: today and the 6 days before it. */
export const weekSince = (now: Date = new Date()) => indiaDayStart(WEEK_DAYS - 1, now)

/** India calendar date (YYYY-MM-DD) of a timestamp. */
export const indiaDate = (iso: string) => businessDate(new Date(iso))

/** Adds each row's delta to the bucket its kind belongs to; rows before `since` and unbucketed kinds are skipped. */
export function totalsSince<B extends string>(rows: readonly ActivityRow[], since: string, bucket: (kind: string) => B | null): Partial<Record<B, number>> {
    const sinceMs = Date.parse(since)
    const totals: Partial<Record<B, number>> = {}
    for (const row of rows) {
        if (Date.parse(row.createdAt) < sinceMs) continue
        const key = bucket(row.kind)
        if (key) totals[key] = round((totals[key] ?? 0) + row.delta)
    }
    return totals
}

/**
 * One item's balance over the window, oldest first: the balance before its first movement, a point after each
 * movement, and the current balance now. An item with no movements in the window stays flat at its balance.
 */
export function balanceTrail(rows: readonly ActivityRow[], itemId: string, current: number, since: string, now: Date = new Date()): TrendPoint[] {
    const start = Date.parse(since), end = now.getTime()
    const own = rows.filter(row => row.itemId === itemId).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id))
    if (own.length === 0) return [{ t: start, v: current }, { t: end, v: current }]
    const first = own[0]
    return [
        { t: start, v: round(first.balanceAfter - first.delta) },
        ...own.map(row => ({ t: Date.parse(row.createdAt), v: row.balanceAfter })),
        { t: end, v: current },
    ]
}

/** A stepped trend line and its filled area for an SVG `viewBox="0 0 width height"`, scaled from zero to the peak. */
export function trailPath(points: readonly TrendPoint[], width: number, height: number) {
    if (points.length === 0) return { line: '', area: '' }
    const t0 = points[0].t, span = Math.max(points.at(-1)!.t - t0, 1)
    const peak = Math.max(...points.map(point => point.v), 0)
    const top = 4, usable = height - top - 2
    const x = (t: number) => fixed(((t - t0) / span) * width)
    const y = (v: number) => fixed(height - 2 - (peak > 0 ? (Math.max(v, 0) / peak) * usable : 0))
    let line = `M0 ${y(points[0].v)}`
    for (const point of points.slice(1)) line += ` H${x(point.t)} V${y(point.v)}`
    line += ` H${width}`
    return { line, area: `${line} V${height} H0 Z` }
}

/** Rows grouped by India calendar day, newest day first; rows keep their order inside a day. */
export function groupByIndiaDay<T extends { created_at: string }>(rows: readonly T[]): { date: string; rows: T[] }[] {
    const days: { date: string; rows: T[] }[] = []
    for (const row of rows) {
        const date = indiaDate(row.created_at)
        const day = days.at(-1)
        if (day?.date === date) day.rows.push(row)
        else days.push({ date, rows: [row] })
    }
    return days
}

/** How long a balance lasts at a daily use, as the unit and count the page shows. Null when nothing is being used. */
export function lastsFor(balance: number, perDay: number): { unit: 'underDay' | 'days' | 'weeks' | 'months'; count: number } | null {
    if (!(perDay > 0)) return null
    const days = Math.max(balance, 0) / perDay
    if (days < 1) return { unit: 'underDay', count: 0 }
    if (days < 14) return { unit: 'days', count: Math.floor(days) }
    if (days < 112) return { unit: 'weeks', count: Math.round(days / 7) }
    return { unit: 'months', count: Math.round(days / 30) }
}

const round = (value: number) => Math.round(value * 1e9) / 1e9
const fixed = (value: number) => Math.round(value * 10) / 10
