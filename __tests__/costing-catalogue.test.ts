import { describe, expect, it } from 'vitest'
import { averageMargin, costMix, marginAtSavedPrice, qualityYarns } from '@/lib/costing-catalogue'

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

describe('band margins', () => {
    it('averages margins to one decimal', () => {
        expect(averageMargin([10.7, 13, 15.3, 9.1])).toBe(12)
        expect(averageMargin([])).toBeNull()
    })

    it('takes the cost rise off the margin at the saved selling price', () => {
        // Saved at ₹50/m with a 10% margin; cost rises ₹1.40/m, so the margin falls 2.8 points.
        expect(marginAtSavedPrice(10, 50, 40, 41.4)).toBe(7.2)
        expect(marginAtSavedPrice(10, 50, 40, 39)).toBe(12)
        expect(marginAtSavedPrice(null, 50, 40, 41)).toBeNull()
        expect(marginAtSavedPrice(10, 0, 40, 41)).toBeNull()
    })
})
