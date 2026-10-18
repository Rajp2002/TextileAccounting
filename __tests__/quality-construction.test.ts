import { describe, expect, it } from 'vitest'
import type { WarpRow, WeftRow } from '@/lib/estimator'
import {
    constructionSignature,
    describeConstructionChanges,
    sameConstruction,
    templateConstructionRows,
} from '@/lib/quality-construction'

// A different fabric is always a different quality. Only the fabric decides
// that: prices, GST, wastage, crimp, loom and overhead never do.

let seq = 0
const warp = (overrides: Partial<WarpRow> = {}): WarpRow => ({
    id: `w${seq++}`,
    label: '75D Poly',
    calcDenier: 75,
    beamEnds: 4800,
    yarnRate: 120,
    gstPct: 5,
    shortagePct: null,
    ...overrides,
})
const weft = (overrides: Partial<WeftRow> = {}): WeftRow => ({
    id: `f${seq++}`,
    label: '75D Poly',
    picks: 60,
    reedSpace: 120,
    calcDenier: 75,
    yarnRate: 110,
    gstPct: 5,
    shortagePct: null,
    ...overrides,
})

describe('sameConstruction', () => {
    it('ignores rates, GST, wastage and crimp', () => {
        const a = { warpRows: [warp({})], weftRows: [weft({})] }
        const b = {
            warpRows: [warp({ yarnRate: 135, gstPct: 12, shortagePct: 3, crimpPct: 8 })],
            weftRows: [weft({ yarnRate: 99, crimpPct: 2 })],
        }
        expect(sameConstruction(a, b)).toBe(true)
        expect(constructionSignature(a)).toBe(constructionSignature(b))
    })

    it.each([
        ['beam ends', { warpRows: [warp({ beamEnds: 5200 })] }],
        ['warp denier', { warpRows: [warp({ calcDenier: 80 })] }],
        ['count unit', { warpRows: [warp({ linearDensityUnit: 'cotton_count_ne', cottonCountNe: 40 })] }],
        ['picks', { weftRows: [weft({ picks: 64 })] }],
        ['pick ratio', { weftRows: [weft({ pickRatio: 2 })] }],
        ['width', { weftRows: [weft({ effectiveCostingWidthCm: 125 })] }],
        ['manual kg', { warpRows: [warp({ calculationMode: 'manual', manualKgPer100m: 4.2 })] }],
        ['extra weft layer', { weftRows: [weft({}), weft({ label: 'Zari' })] }],
        ['extra warp layer', { warpRows: [warp({}), warp({ label: 'Selvedge' })] }],
    ])('treats a %s change as a different fabric', (_, patch) => {
        const base = { warpRows: [warp({})], weftRows: [weft({ pickRatio: null })] }
        expect(sameConstruction(base, { ...base, ...patch })).toBe(false)
        expect(constructionSignature(base)).not.toBe(constructionSignature({ ...base, ...patch }))
    })

    it('ignores manual kg while the layer is in formula mode', () => {
        const a = { warpRows: [warp({ manualKgPer100m: 3 })], weftRows: [weft({})] }
        const b = { warpRows: [warp({ manualKgPer100m: 9 })], weftRows: [weft({})] }
        expect(sameConstruction(a, b)).toBe(true)
    })

    it('uses the costing width, else the reed space', () => {
        const a = { warpRows: [warp({})], weftRows: [weft({ reedSpace: 120, effectiveCostingWidthCm: null })] }
        const b = { warpRows: [warp({})], weftRows: [weft({ reedSpace: 120, effectiveCostingWidthCm: 120 })] }
        expect(sameConstruction(a, b)).toBe(true)
    })

    it('normalises yarn names and numeric formatting', () => {
        const a = { warpRows: [warp({ label: '75D Poly' })], weftRows: [weft({})] }
        const b = {
            warpRows: [warp({ label: ' 75d  poly', beamEnds: '4800' as unknown as number })],
            weftRows: [weft({ picks: '60.0' as unknown as number })],
        }
        expect(sameConstruction(a, b)).toBe(true)
        expect(constructionSignature(a)).toBe(constructionSignature(b))
    })

    it('treats naming a previously blank yarn as the same fabric', () => {
        for (const blank of ['', undefined, '   ']) {
            const baseline = { warpRows: [warp({ label: blank })], weftRows: [weft({ label: blank })] }
            const current = { warpRows: [warp({ label: 'Viscose' })], weftRows: [weft({ label: 'Viscose' })] }
            expect(sameConstruction(baseline, current)).toBe(true)
            expect(describeConstructionChanges(baseline, current)).toEqual([])
        }
    })

    it('treats renaming a named yarn as a different fabric', () => {
        const base = { warpRows: [warp({ label: 'Poly' })], weftRows: [weft({})] }
        const changed = { warpRows: [warp({ label: 'Viscose' })], weftRows: [weft({})] }
        expect(sameConstruction(base, changed)).toBe(false)
    })

    it('treats clearing a named yarn as a different fabric', () => {
        const base = { warpRows: [warp({ label: 'Poly' })], weftRows: [weft({})] }
        const changed = { warpRows: [warp({ label: '' })], weftRows: [weft({})] }
        expect(sameConstruction(base, changed)).toBe(false)
    })
})

describe('a quality saved before the pick convention existed', () => {
    it('is the same fabric once the owner picks a convention that fills the ratio from the same picks', () => {
        const baseline = { warpRows: [warp({})], weftRows: [weft({ picks: 32 }), weft({ picks: 32, label: 'Zari' })] }
        const current = { warpRows: [warp({})], weftRows: [weft({ picks: 32, pickRatio: 32 }), weft({ picks: 32, pickRatio: 32, label: 'Zari' })] }
        expect(sameConstruction(baseline, current)).toBe(true)
        expect(describeConstructionChanges(baseline, current)).toEqual([])
    })

    it('still treats changed picks as a different fabric', () => {
        const baseline = { warpRows: [warp({})], weftRows: [weft({ picks: 32 })] }
        const current = { warpRows: [warp({})], weftRows: [weft({ picks: 30, pickRatio: 30 })] }
        expect(sameConstruction(baseline, current)).toBe(false)
    })

    it('still treats a changed recorded ratio as a different fabric', () => {
        const baseline = { warpRows: [warp({})], weftRows: [weft({ pickRatio: 1 })] }
        expect(sameConstruction(baseline, { warpRows: [warp({})], weftRows: [weft({ pickRatio: 2 })] })).toBe(false)
        expect(sameConstruction({ warpRows: [warp({})], weftRows: [weft({ pickRatio: null })] }, { warpRows: [warp({})], weftRows: [weft({ pickRatio: 2 })] })).toBe(false)
    })
})

describe('describeConstructionChanges', () => {
    it('describes changes in warp-then-weft, layer order', () => {
        expect(describeConstructionChanges(
            { warpRows: [warp({})], weftRows: [weft({})] },
            { warpRows: [warp({ beamEnds: 5200 })], weftRows: [weft({}), weft({ label: 'Zari' })] },
        )).toEqual([
            { kind: 'beamEnds', side: 'warp', layer: 1, from: '4800', to: '5200' },
            { kind: 'weftLayers', side: 'weft', layer: null, from: '1', to: '2' },
        ])
    })

    it('names the yarn on both sides of a yarn change', () => {
        expect(describeConstructionChanges(
            { warpRows: [warp({ label: '75D poly' })], weftRows: [weft({})] },
            { warpRows: [warp({ label: '75D viscose' })], weftRows: [weft({})] },
        )).toEqual([{ kind: 'yarnName', side: 'warp', layer: 1, from: '75D poly', to: '75D viscose' }])
    })

    it('reports picks, ratio, width and denier changes on a weft layer', () => {
        const changes = describeConstructionChanges(
            { warpRows: [warp({})], weftRows: [weft({ pickRatio: null })] },
            { warpRows: [warp({})], weftRows: [weft({ picks: 64, pickRatio: 2, effectiveCostingWidthCm: 125, calcDenier: 80 })] },
        )
        expect(changes.map(c => c.kind)).toEqual(['picks', 'pickRatio', 'width', 'yarnCount'])
        expect(changes.every(c => c.side === 'weft' && c.layer === 1)).toBe(true)
    })

    it('reports a layer-count change and does not diff the extra layers', () => {
        const changes = describeConstructionChanges(
            { warpRows: [warp({})], weftRows: [weft({})] },
            { warpRows: [warp({})], weftRows: [weft({}), weft({ picks: 99 })] },
        )
        expect(changes).toEqual([{ kind: 'weftLayers', side: 'weft', layer: null, from: '1', to: '2' }])
    })

    it('is empty when the fabric is the same', () => {
        const rows = { warpRows: [warp({})], weftRows: [weft({})] }
        expect(describeConstructionChanges(rows, { warpRows: [warp({ yarnRate: 1 })], weftRows: [weft({})] })).toEqual([])
    })
})

describe('templateConstructionRows', () => {
    it('uses the stored rows when the quality has them', () => {
        const rows = templateConstructionRows({ warp_rows: [warp({ beamEnds: 5000 })], weft_rows: [weft({ picks: 70 })] })
        expect(rows.warpRows[0].beamEnds).toBe(5000)
        expect(rows.weftRows[0].picks).toBe(70)
    })

    it('builds the legacy one-row construction from template columns', () => {
        const rows = templateConstructionRows({ beam_ends: 4000, ppi: 70 })
        expect(rows.warpRows).toHaveLength(1)
        expect(rows.warpRows[0].beamEnds).toBe(4000)
        expect(rows.weftRows).toHaveLength(1)
        expect(rows.weftRows[0].picks).toBe(70)
    })

    it('applies the estimator defaults for missing legacy columns', () => {
        const rows = templateConstructionRows({})
        expect(rows.warpRows[0]).toMatchObject({ calcDenier: 75, beamEnds: 3200 })
        expect(rows.weftRows[0]).toMatchObject({ calcDenier: 75, picks: 68, reedSpace: 110 })
    })

    it('treats a legacy quality as the same fabric as the rows the estimator builds for it', () => {
        const baseline = templateConstructionRows({ beam_ends: 4000, ppi: 70, reed_space: 120, weft_denier: 60, yarn_denier: 80 })
        const built = {
            warpRows: [warp({ label: undefined, calcDenier: 80, beamEnds: 4000 })],
            weftRows: [weft({ label: undefined, calcDenier: 60, picks: 70, reedSpace: 120 })],
        }
        expect(sameConstruction(baseline, built)).toBe(true)
    })
})
