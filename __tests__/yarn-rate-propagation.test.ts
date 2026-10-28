import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { makeDefaultEstimateState, type EstimateState, type WarpRow, type WeftRow } from '../lib/estimator'
import {
    applyRateBookYarns,
    applyYarnRate,
    chunkIds,
    findAffectedLayers,
    isCostingEligible,
    latestCostingPerLineage,
    priceEstimate,
    summarizeOutcomes,
    tickedAfterReload,
    type CostingLineageKey,
} from '../lib/yarn-rate-propagation'
import { buildPropagationRequestId, buildRateBookUpdateRequestId } from '../lib/yarn-rate-propagation-request.server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function warp(id: string, label: string, yarnRate: number): WarpRow {
    return { id, label, calcDenier: 75, beamEnds: 3200, yarnRate, gstPct: 5, shortagePct: 0 }
}

function weft(id: string, label: string, yarnRate: number): WeftRow {
    return { id, label, picks: 60, reedSpace: 150, calcDenier: 75, yarnRate, gstPct: 5, shortagePct: 0 }
}

function estimateWith(warpRows: WarpRow[], weftRows: WeftRow[]): EstimateState {
    return { ...makeDefaultEstimateState(), warpRows, weftRows }
}

/** An estimate that passes the same validation a costing save runs. */
function pricedEstimate(): EstimateState {
    const base = makeDefaultEstimateState()
    return {
        ...base,
        warpRows: [{ ...base.warpRows[0], ...warp('w1', '75D Poly', 100) }],
        weftRows: [{ ...base.weftRows[0], ...weft('f1', '75D Poly', 100), effectiveCostingWidthCm: 150 }],
        perPickCostPaisa: 16,
        warpingRatePerKg: 5,
        sizingRatePerKg: 8,
        windingRatePerKg: 2,
        loomCount: 10,
        avgOutputPerLoomPerDay: 100,
        monthlyWorkingDays: 26,
        monthlyOutputM: 26000,
    }
}

function lineage(id: string, group: string | null, version: number | null, createdAt: string, extra: Partial<CostingLineageKey> = {}): CostingLineageKey {
    return { id, costing_group_id: group, version_number: version, created_at: createdAt, is_archived: false, template_id: null, ...extra }
}

describe('applyYarnRate', () => {
    it('changes only matching rows of the edited category', () => {
        const estimate = estimateWith([warp('w1', '75D Poly', 100)], [weft('f1', '75D Poly', 100)])
        const result = applyYarnRate(estimate, 'yarn_warp', '75d  POLY', 120)
        expect(result.warpRows[0].yarnRate).toBe(120)
        expect(result.weftRows[0].yarnRate).toBe(100)
        expect({ ...result, warpRows: estimate.warpRows }).toEqual({ ...estimate, warpRows: estimate.warpRows })
        expect({ ...result.warpRows[0], yarnRate: 100 }).toEqual(estimate.warpRows[0])
    })

    it('leaves the input untouched and changes nothing when no row matches', () => {
        const estimate = estimateWith([warp('w1', '75D Poly', 100)], [weft('f1', '120D Viscose', 90)])
        const snapshot = JSON.parse(JSON.stringify(estimate))
        const result = applyYarnRate(estimate, 'yarn_weft', '75D Poly', 150)
        expect(result.warpRows).toEqual(estimate.warpRows)
        expect(result.weftRows).toEqual(estimate.weftRows)
        expect(estimate).toEqual(snapshot)
    })
})

describe('findAffectedLayers', () => {
    it('skips a row that already has the new rate', () => {
        const estimate = estimateWith([warp('w1', '75D Poly', 120)], [weft('f1', '75D Poly', 90)])
        expect(findAffectedLayers(estimate, 'yarn_warp', '75D Poly', 120)).toEqual([])
    })

    it('returns the differing matching row of the edited category only', () => {
        const estimate = estimateWith([warp('w1', '75D Poly', 100), warp('w2', 'Other', 100)], [weft('f1', '75D Poly', 100)])
        expect(findAffectedLayers(estimate, 'yarn_warp', ' 75d poly ', 120)).toEqual([{ layer: 'warp', index: 0 }])
        expect(findAffectedLayers(estimate, 'yarn_weft', '75D Poly', 120)).toEqual([{ layer: 'weft', index: 0 }])
    })
})

describe('latestCostingPerLineage', () => {
    it('keeps the highest version per costing_group_id', () => {
        const rows = [
            lineage('a1', 'g1', 1, '2026-10-01T00:00:00Z'),
            lineage('a2', 'g1', 2, '2026-10-02T00:00:00Z'),
            lineage('b1', 'g2', 1, '2026-10-01T00:00:00Z'),
        ]
        expect(latestCostingPerLineage(rows).map(row => row.id).sort()).toEqual(['a2', 'b1'])
    })

    it('breaks a version tie by created_at, then id', () => {
        const rows = [
            lineage('a', 'g1', 2, '2026-10-02T00:00:00Z'),
            lineage('b', 'g1', 2, '2026-10-03T00:00:00Z'),
            lineage('c', 'g2', 1, '2026-10-01T00:00:00Z'),
            lineage('d', 'g2', 1, '2026-10-01T00:00:00Z'),
        ]
        expect(latestCostingPerLineage(rows).map(row => row.id).sort()).toEqual(['b', 'd'])
    })

    it('treats a null costing_group_id as its own lineage', () => {
        const rows = [lineage('x', null, null, '2026-10-01T00:00:00Z'), lineage('y', null, null, '2026-10-02T00:00:00Z')]
        expect(latestCostingPerLineage(rows).map(row => row.id).sort()).toEqual(['x', 'y'])
    })
})

describe('isCostingEligible', () => {
    const active = new Set(['t-active'])
    it('is false for an archived costing', () => {
        expect(isCostingEligible({ is_archived: true, template_id: null }, active)).toBe(false)
    })
    it('is false when the quality is not in the active set', () => {
        expect(isCostingEligible({ is_archived: false, template_id: 't-gone' }, active)).toBe(false)
    })
    it('is true for an active quality and for a costing with no quality', () => {
        expect(isCostingEligible({ is_archived: false, template_id: 't-active' }, active)).toBe(true)
        expect(isCostingEligible({ is_archived: false, template_id: null }, active)).toBe(true)
    })
})

describe('buildPropagationRequestId', () => {
    const source = '11111111-1111-4111-8111-111111111111'
    const rate = '22222222-2222-4222-8222-222222222222'
    it('is a UUID and stable for equal inputs', () => {
        const id = buildPropagationRequestId(source, rate, 120)
        expect(id).toMatch(UUID_PATTERN)
        expect(buildPropagationRequestId(source, rate, 120)).toBe(id)
    })
    it('differs when the source, rate id or value differs', () => {
        const id = buildPropagationRequestId(source, rate, 120)
        expect(buildPropagationRequestId('33333333-3333-4333-8333-333333333333', rate, 120)).not.toBe(id)
        expect(buildPropagationRequestId(source, '44444444-4444-4444-8444-444444444444', 120)).not.toBe(id)
        expect(buildPropagationRequestId(source, rate, 121)).not.toBe(id)
    })
})

describe('priceEstimate', () => {
    it('returns null for an invalid snapshot', () => {
        expect(priceEstimate(estimateWith([], []))).toBeNull()
    })

    it('prices a valid estimate, and a higher yarn rate costs more', () => {
        const estimate = pricedEstimate()
        const before = priceEstimate(estimate)
        const after = priceEstimate(applyYarnRate(estimate, 'yarn_warp', '75D Poly', 120))
        expect(before?.productionCostPerM).toBeGreaterThan(0)
        expect(after?.productionCostPerM).toBeGreaterThan(before!.productionCostPerM)
    })

    it('cannot price a zero yarn rate, so a costing at rate 0 is skipped instead of failing', () => {
        const estimate = pricedEstimate()
        expect(() => priceEstimate(applyYarnRate(estimate, 'yarn_warp', '75D Poly', 0))).not.toThrow()
        expect(priceEstimate(applyYarnRate(estimate, 'yarn_warp', '75D Poly', 0))).toBeNull()
    })
})

describe('chunkIds and summarizeOutcomes', () => {
    it('splits 23 ids into 10, 10 and 3', () => {
        const ids = Array.from({ length: 23 }, (_, index) => `id-${index}`)
        expect(chunkIds(ids).map(chunk => chunk.length)).toEqual([10, 10, 3])
    })

    it('counts each outcome status', () => {
        expect(summarizeOutcomes([
            { id: '1', status: 'created' },
            { id: '2', status: 'created' },
            { id: '3', status: 'unchanged' },
            { id: '4', status: 'stale' },
            { id: '5', status: 'failed', message: 'x' },
        ])).toEqual({ created: 2, unchanged: 1, stale: 1, failed: 1 })
    })
})

describe('tickedAfterReload', () => {
    it('keeps the costings the owner unticked unticked after a reload', () => {
        expect([...tickedAfterReload(['a', 'b', 'c'], new Set(['b']))]).toEqual(['a', 'c'])
    })

    it('ticks a costing that was not in the previous review', () => {
        expect([...tickedAfterReload(['a', 'new'], new Set(['gone']))]).toEqual(['a', 'new'])
    })
})

describe('applyRateBookYarns', () => {
    const yarns = [
        { name: '75D Poly', category: 'yarn_warp' as const, current_value: 120 },
        { name: ' 75d  poly ', category: 'yarn_warp' as const, current_value: 999 },
        { name: '75D Poly', category: 'yarn_weft' as const, current_value: 110 },
        { name: 'Viscose 30s', category: 'yarn_weft' as const, current_value: 300 },
    ]

    it('moves every row the Rate Book prices to today\'s rate, matched by name within its category', () => {
        const estimate = estimateWith([warp('w1', '75D Poly', 100), warp('w2', 'Unknown', 80)], [weft('f1', '75d poly', 100), weft('f2', 'Viscose 30s', 300)])
        const { estimate: next, changes } = applyRateBookYarns(estimate, yarns)
        expect(next.warpRows.map(row => row.yarnRate)).toEqual([120, 80])
        expect(next.weftRows.map(row => row.yarnRate)).toEqual([110, 300])
        expect(changes).toEqual([
            { layer: 'warp', index: 0, name: '75D Poly', from: 100, to: 120 },
            { layer: 'weft', index: 0, name: '75d poly', from: 100, to: 110 },
        ])
        expect(estimate.warpRows[0].yarnRate).toBe(100)
    })

    it('returns the same estimate and no changes when everything already matches', () => {
        const estimate = estimateWith([warp('w1', '75D Poly', 120)], [weft('f1', 'Viscose 30s', 300)])
        const result = applyRateBookYarns(estimate, yarns)
        expect(result.changes).toEqual([])
        expect(result.estimate).toBe(estimate)
    })
})

describe('buildRateBookUpdateRequestId', () => {
    it('is UUID-shaped and stable for the same source and new rates, different otherwise', () => {
        const changes = [{ layer: 'warp', index: 0, to: 120 }]
        const id = buildRateBookUpdateRequestId('quote-1', changes)
        expect(id).toMatch(UUID_PATTERN)
        expect(buildRateBookUpdateRequestId('quote-1', changes)).toBe(id)
        expect(buildRateBookUpdateRequestId('quote-1', [{ layer: 'warp', index: 0, to: 121 }])).not.toBe(id)
        expect(buildRateBookUpdateRequestId('quote-2', changes)).not.toBe(id)
    })
})
