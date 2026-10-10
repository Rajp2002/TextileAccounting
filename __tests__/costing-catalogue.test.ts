import { describe, expect, it } from 'vitest'
import { averageMargin, averageYarnShare, costMix, marginRanking, qualityYarns } from '@/lib/costing-catalogue'

const breakdown = {
    warpCostPerM: 13.4,
    weftCostPerM: 12.15,
    weaveCostPerM: 4.8,
    warpingAndSizingPerM: 1.62,
    windingPerM: 0.2,
    processingPerM: 0.4,
    finishingPerM: 0.3,
    directCostPerM: 32.87,
    overheadPerM: 1.5,
    productionCostPerM: 34.37,
}

describe('costMix', () => {
    it('folds a saved breakdown into yarn, weaving, sizing and processing, and factory', () => {
        const mix = costMix(breakdown)!
        expect(mix.parts.map(part => part.key)).toEqual(['yarn', 'weaving', 'processing', 'factory'])
        expect(mix.parts[0].value).toBeCloseTo(25.55)
        expect(mix.parts[2].value).toBeCloseTo(2.52)
        expect(mix.total).toBeCloseTo(breakdown.productionCostPerM)
    })

    it('reads numeric strings and returns null for costings saved without a breakdown', () => {
        expect(costMix({ ...breakdown, warpCostPerM: '13.40' })?.parts[0].value).toBeCloseTo(25.55)
        expect(costMix(null)).toBeNull()
        expect(costMix({ weaveCostPerM: 4 })).toBeNull()
        expect(costMix({ warpCostPerM: 0, weftCostPerM: 0, weaveCostPerM: 0 })).toBeNull()
    })

    it('averages the yarn share across the costings that have a breakdown', () => {
        expect(averageYarnShare([costMix(breakdown), null, costMix({ warpCostPerM: 6, weftCostPerM: 6, weaveCostPerM: 4, overheadPerM: 0 })])).toBe(75)
        expect(averageYarnShare([null])).toBeNull()
    })
})

describe('qualityYarns', () => {
    it('lists each named warp and weft yarn once, in recipe order', () => {
        expect(qualityYarns({
            warp_rows: [{ label: 'Demo Polyester Warp 75D' }, { label: ' demo  polyester warp 75D ' }, { label: 'test' }, { label: '' }, {}],
            weft_rows: [{ label: 'Weft yarn 1' }],
        })).toEqual({ warp: ['Demo Polyester Warp 75D', 'test'], weft: ['Weft yarn 1'] })
    })

    it('copes with a quality that has no recipe rows', () => {
        expect(qualityYarns(null)).toEqual({ warp: [], weft: [] })
        expect(qualityYarns({ warp_rows: 'not rows' })).toEqual({ warp: [], weft: [] })
    })
})

describe('marginRanking', () => {
    const entries = [
        { key: 'a', name: 'Test', margin: 10.7 },
        { key: 'b', name: 'D2.456', margin: 13 },
        { key: 'c', name: 'Demo - Signature Polyester', margin: 15.3 },
        { key: 'd', name: 'D.345', margin: 9.1 },
    ]

    it('shows every quality, highest margin first, while they fit', () => {
        expect(marginRanking(entries)).toEqual({ entries: [entries[2], entries[1], entries[0], entries[3]], lowestOnly: false })
    })

    it('keeps only the lowest margins, lowest first, beyond the limit', () => {
        expect(marginRanking(entries, 2)).toEqual({ entries: [entries[3], entries[0]], lowestOnly: true })
    })

    it('averages margins to one decimal', () => {
        expect(averageMargin(entries.map(entry => entry.margin))).toBe(12)
        expect(averageMargin([])).toBeNull()
    })
})
