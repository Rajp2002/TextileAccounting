import { describe, expect, it } from 'vitest'
import {
    buildRateTrend,
    buildStepPath,
    buildTimeTicks,
    buildYAxis,
    timeFraction,
    type RateTrendRow,
} from '../lib/rate-trend'

const day = (date: string) => Date.parse(`${date}T00:00:00Z`)

let nextId = 0
function row(overrides: Partial<RateTrendRow> & Pick<RateTrendRow, 'value' | 'effective_date'>): RateTrendRow {
    nextId += 1
    return {
        id: `row-${nextId}`,
        previous_value: null,
        event_type: 'recorded',
        created_at: `${overrides.effective_date}T06:00:00Z`,
        source: null,
        ...overrides,
    }
}

describe('buildRateTrend', () => {
    it('returns null when there is nothing to plot', () => {
        expect(buildRateTrend([], '2026-10-07')).toBeNull()
        expect(buildRateTrend([row({ value: 280, effective_date: '2026-07-01', event_type: 'archived' })], '2026-10-07')).toBeNull()
    })

    it('orders points oldest first even though the history action returns newest first', () => {
        const trend = buildRateTrend([
            row({ id: 'c', value: 290, effective_date: '2026-09-10', event_type: 'changed' }),
            row({ id: 'b', value: 285, effective_date: '2026-08-01', event_type: 'changed' }),
            row({ id: 'a', value: 280, effective_date: '2026-07-01', event_type: 'recorded' }),
        ], '2026-10-07')!
        expect(trend.points.map(point => point.id)).toEqual(['a', 'b', 'c'])
    })

    it('orders same-day entries by when they were recorded', () => {
        const trend = buildRateTrend([
            row({ id: 'late', value: 300, effective_date: '2026-08-01', event_type: 'changed', created_at: '2026-08-01T15:00:00Z' }),
            row({ id: 'early', value: 290, effective_date: '2026-08-01', event_type: 'changed', created_at: '2026-08-01T05:00:00Z' }),
        ], '2026-10-07')!
        expect(trend.points.map(point => point.id)).toEqual(['early', 'late'])
    })

    it('plots recorded, changed and reviewed events but not archive or restore', () => {
        const trend = buildRateTrend([
            row({ id: 'r', value: 280, effective_date: '2026-07-01', event_type: 'recorded' }),
            row({ id: 'x', value: 280, effective_date: '2026-07-10', event_type: 'archived' }),
            row({ id: 'y', value: 280, effective_date: '2026-07-12', event_type: 'restored' }),
            row({ id: 'v', value: 280, effective_date: '2026-08-01', event_type: 'reviewed' }),
            row({ id: 'c', value: 285, effective_date: '2026-09-01', event_type: 'changed' }),
        ], '2026-10-07')!
        expect(trend.points.map(point => [point.id, point.kind])).toEqual([['r', 'recorded'], ['v', 'reviewed'], ['c', 'changed']])
    })

    it('fits the time axis to the history: first entry to today', () => {
        const threeMonths = buildRateTrend([
            row({ value: 280, effective_date: '2026-07-01' }),
            row({ value: 285, effective_date: '2026-08-15', event_type: 'changed' }),
        ], '2026-10-01')!
        expect(threeMonths.startTime).toBe(day('2026-07-01'))
        expect(threeMonths.endTime).toBe(day('2026-10-01'))
        expect(threeMonths.spanDays).toBe(92)

        const oneYear = buildRateTrend([
            row({ value: 250, effective_date: '2025-10-01' }),
            row({ value: 285, effective_date: '2026-03-01', event_type: 'changed' }),
        ], '2026-10-01')!
        expect(oneYear.startTime).toBe(day('2025-10-01'))
        expect(oneYear.endTime).toBe(day('2026-10-01'))
        expect(oneYear.spanDays).toBe(365)
    })

    it('extends past today when the latest entry is future-dated', () => {
        const trend = buildRateTrend([
            row({ value: 280, effective_date: '2026-09-01' }),
            row({ value: 290, effective_date: '2026-10-20', event_type: 'changed' }),
        ], '2026-10-07')!
        expect(trend.endTime).toBe(day('2026-10-20'))
    })

    it('has no span when the only entry was made today', () => {
        const trend = buildRateTrend([row({ value: 280, effective_date: '2026-10-07' })], '2026-10-07')!
        expect(trend.spanDays).toBe(0)
        expect(timeFraction(trend, trend.startTime)).toBe(0.5)
    })

    it('measures each change against the previous point on the chart', () => {
        const trend = buildRateTrend([
            row({ value: 280, effective_date: '2026-07-01' }),
            row({ value: 285, effective_date: '2026-08-01', event_type: 'changed', previous_value: 999 }),
            row({ value: 270, effective_date: '2026-09-01', event_type: 'changed' }),
        ], '2026-10-07')!
        expect(trend.points[0].delta).toBeNull()
        expect(trend.points[1].delta).toBe(5)
        expect(trend.points[1].deltaPercent).toBeCloseTo(1.7857, 3)
        expect(trend.points[2].delta).toBe(-15)
    })

    it('summarises the change since the first entry and counts price changes only', () => {
        const trend = buildRateTrend([
            row({ value: 280, effective_date: '2026-07-01' }),
            row({ value: 280, effective_date: '2026-07-20', event_type: 'reviewed' }),
            row({ value: 308, effective_date: '2026-09-01', event_type: 'changed' }),
        ], '2026-10-07')!
        expect(trend.stats).toEqual({ first: 280, latest: 308, change: 28, changePercent: 10, priceChanges: 1 })
    })

    it('reads numeric strings from the database as numbers', () => {
        const trend = buildRateTrend([row({ value: '285.5000' as unknown as number, effective_date: '2026-07-01' })], '2026-10-07')!
        expect(trend.points[0].value).toBe(285.5)
    })
})

describe('buildYAxis', () => {
    it('pads the value range with nice, evenly spaced ticks that bracket it', () => {
        expect(buildYAxis([280, 290]).ticks).toEqual([275, 280, 285, 290, 295])
    })

    it('does not collapse a flat series', () => {
        const axis = buildYAxis([285, 285])
        expect(axis.ticks.length).toBeGreaterThanOrEqual(3)
        expect(axis.ticks[0]).toBeLessThan(285)
        expect(axis.ticks[axis.ticks.length - 1]).toBeGreaterThan(285)
    })

    it('never goes below zero for a rate that has never been negative', () => {
        expect(buildYAxis([1, 2]).ticks[0]).toBeGreaterThanOrEqual(0)
    })

    it('exposes min and max matching the outer ticks', () => {
        const axis = buildYAxis([280, 308])
        expect(axis.min).toBe(axis.ticks[0])
        expect(axis.max).toBe(axis.ticks[axis.ticks.length - 1])
    })
})

describe('buildTimeTicks', () => {
    it('uses month starts for a three month history', () => {
        const ticks = buildTimeTicks(day('2026-07-01'), day('2026-10-01'))
        expect(ticks.map(tick => tick.time)).toEqual([day('2026-07-01'), day('2026-08-01'), day('2026-09-01'), day('2026-10-01')])
        expect(ticks.every(tick => tick.granularity === 'month')).toBe(true)
    })

    it('thins to quarters for a one year history', () => {
        const ticks = buildTimeTicks(day('2025-10-01'), day('2026-10-01'))
        expect(ticks.length).toBeLessThanOrEqual(5)
        expect(ticks.length).toBeGreaterThanOrEqual(2)
        expect(ticks.map(tick => tick.time)).toEqual([day('2025-10-01'), day('2026-01-01'), day('2026-04-01'), day('2026-07-01'), day('2026-10-01')])
    })

    it('uses days when the history is only a few days long', () => {
        const ticks = buildTimeTicks(day('2026-09-28'), day('2026-10-01'))
        expect(ticks.map(tick => tick.time)).toEqual([day('2026-09-28'), day('2026-09-29'), day('2026-09-30'), day('2026-10-01')])
        expect(ticks.every(tick => tick.granularity === 'day')).toBe(true)
    })

    it('keeps every tick inside the range', () => {
        const start = day('2026-02-17')
        const end = day('2026-10-03')
        for (const tick of buildTimeTicks(start, end)) {
            expect(tick.time).toBeGreaterThanOrEqual(start)
            expect(tick.time).toBeLessThanOrEqual(end)
        }
    })

    it('returns a single tick when there is no span', () => {
        expect(buildTimeTicks(day('2026-10-07'), day('2026-10-07')).map(tick => tick.time)).toEqual([day('2026-10-07')])
    })
})

describe('buildStepPath', () => {
    it('holds each value until the next change, then runs flat to the end', () => {
        const path = buildStepPath([{ x: 0, y: 100 }, { x: 50, y: 40 }, { x: 80, y: 70 }], 120)
        expect(path.d).toBe('M0,100 H50 V40 H80 V70 H120')
        expect(path.length).toBe(210)
    })

    it('reports how far along the path each point sits so markers can appear as the line reaches them', () => {
        const path = buildStepPath([{ x: 0, y: 100 }, { x: 50, y: 40 }, { x: 80, y: 70 }], 120)
        expect(path.stops).toEqual([0, 110, 170])
    })

    it('draws a single entry as a flat run, or just its point when there is nowhere to run', () => {
        expect(buildStepPath([{ x: 10, y: 5 }], 100)).toEqual({ d: 'M10,5 H100', length: 90, stops: [0] })
        expect(buildStepPath([{ x: 10, y: 5 }], 10)).toEqual({ d: 'M10,5', length: 0, stops: [0] })
    })
})
