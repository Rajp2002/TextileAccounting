import { describe, expect, it } from 'vitest'
import { getTotalWeftPicks, getWeftPickConvention, type WeftRow } from '../lib/estimator'
import {
    applyWeftPickConvention,
    reconcileWeftPickConvention,
    setWeftPickRatio,
    setWeftTotalPicks,
} from '../lib/weft-pick-convention'

function weft(id: string, picks: number, pickRatio?: number | null): WeftRow {
    const row: WeftRow = { id, label: id, calcDenier: 150, picks, reedSpace: 160, effectiveCostingWidthCm: 160, yarnRate: 200, gstPct: 0, shortagePct: null }
    if (pickRatio !== undefined) row.pickRatio = pickRatio
    return row
}

describe('weft pick convention row transforms', () => {
    it('switching to total PPI keeps every system’s physical picks', () => {
        const rows = applyWeftPickConvention([weft('a', 40), weft('b', 20)], 'total_ratio')
        expect(getWeftPickConvention(rows)).toBe('total_ratio')
        expect(rows.map(row => row.picks)).toEqual([40, 20])
        expect(getTotalWeftPicks(rows)).toBe(60)
    })

    it('switching to total PPI with blank picks seeds an even share', () => {
        const rows = applyWeftPickConvention([weft('a', 0), weft('b', 0)], 'total_ratio')
        expect(rows.map(row => row.pickRatio)).toEqual([1, 1])
        expect(setWeftTotalPicks(rows, 64).map(row => row.picks)).toEqual([32, 32])
    })

    it('switching to PPI per weft clears the ratios and keeps the picks', () => {
        const rows = applyWeftPickConvention([weft('a', 32, 1), weft('b', 32, 1)], 'per_system')
        expect(getWeftPickConvention(rows)).toBe('per_system')
        expect(rows.map(row => row.picks)).toEqual([32, 32])
    })

    it('a 2:1 share of 64 PPI sums back to 64', () => {
        const rows = setWeftPickRatio(setWeftTotalPicks([weft('a', 0, 1), weft('b', 0, 1)], 64), 'a', 2)
        expect(rows[0].picks + rows[1].picks).toBe(64)
        expect(rows[0].picks).toBeCloseTo(128 / 3, 10)
    })

    it('clearing the total leaves the ratios and zero picks', () => {
        const rows = setWeftTotalPicks([weft('a', 32, 1), weft('b', 32, 1)], null)
        expect(rows.map(row => row.picks)).toEqual([0, 0])
        expect(rows.map(row => row.pickRatio)).toEqual([1, 1])
    })

    it('an invalid ratio keeps the last valid picks for validation to report', () => {
        const rows = setWeftPickRatio([weft('a', 32, 1), weft('b', 32, 1)], 'a', null)
        expect(rows[0].pickRatio).toBe(0)
        expect(rows.map(row => row.picks)).toEqual([32, 32])
    })

    it('adding a weft to a shared total re-shares the same total', () => {
        const previous = [weft('a', 32, 1), weft('b', 32, 1)]
        const next = reconcileWeftPickConvention(previous, [...previous, weft('c', 0)])
        expect(getWeftPickConvention(next)).toBe('total_ratio')
        expect(getTotalWeftPicks(next)).toBe(64)
    })

    it('adding a weft to per-weft PPI keeps per-weft PPI', () => {
        const previous = [weft('a', 64, null), weft('b', 64, null)]
        const next = reconcileWeftPickConvention(previous, [...previous, weft('c', 30)])
        expect(getWeftPickConvention(next)).toBe('per_system')
        expect(getTotalWeftPicks(next)).toBe(158)
    })

    it('shrinking a shared total to one weft gives it the whole total', () => {
        const previous = [weft('a', 32, 1), weft('b', 32, 1)]
        const next = reconcileWeftPickConvention(previous, [previous[0]])
        expect(next).toHaveLength(1)
        expect(next[0].picks).toBe(64)
    })

    it('a legacy single weft growing to two asks for a convention', () => {
        const next = reconcileWeftPickConvention([weft('a', 64)], [weft('a', 64), weft('b', 0)])
        expect(getWeftPickConvention(next)).toBeNull()
    })
})
