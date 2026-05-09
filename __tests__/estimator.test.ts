import { describe, expect, it } from 'vitest'
import {
    calcFullTotals,
    calcOrderQuote,
    calcWarpYarnKg,
    calcWeaveCostPerMeter,
    calcWeftYarnKg,
    makeDefaultEstimateState,
    type EstimateState,
} from '../lib/estimator'

function round2(value: number) {
    return Math.round(value * 100) / 100
}

describe('Estimator formula primitives', () => {
    it('calculates warp and weft yarn kg per 100m using the documented denier formulas', () => {
        expect(calcWarpYarnKg(3200, 75)).toBeCloseTo(2.6666667, 6)
        expect(calcWeftYarnKg(68, 62, 75)).toBeCloseTo(3.5133333, 6)
    })

    it('calculates weave cost as picks times per-pick rupee rate', () => {
        expect(calcWeaveCostPerMeter(68, 0.16)).toBeCloseTo(10.88, 6)
    })

    it('calculates quote values from landed cost, commission, transport, and margin', () => {
        const quote = calcOrderQuote({
            totalProductionCostPerM: 50,
            orderQuantityM: 1000,
            commissionPct: 2,
            transportPerM: 1.5,
            profitMarginPct: 10,
        })

        expect(round2(quote.landedCostPerM)).toBe(52.5)
        expect(round2(quote.quotePricePerM)).toBe(57.75)
        expect(round2(quote.totalOrderValue)).toBe(57750)
        expect(round2(quote.grossProfitRupees)).toBe(5250)
        expect(round2(quote.actualMarginPct)).toBe(9.09)
    })
})

describe('Estimator full totals', () => {
    it('keeps a representative Phase 1 costing stack stable', () => {
        const estimate: EstimateState = {
            ...makeDefaultEstimateState(),
            warpRows: [{
                id: 'warp-main',
                calcDenier: 75,
                beamEnds: 3200,
                yarnRate: 100,
                gstPct: 5,
                shortagePct: null,
            }],
            weftRows: [{
                id: 'weft-main',
                picks: 68,
                reedSpace: 62,
                calcDenier: 75,
                yarnRate: 100,
                gstPct: 5,
                shortagePct: null,
            }],
            tapeLengthM: 1000,
            perPickCostPaisa: 0.16,
            warpingRatePerKg: 2,
            sizingRatePerKg: 1.5,
            sizingMode: 'outsourced',
            yarnShortagePct: 5,
            warpCrimpPct: 5,
            overheadItems: [{
                id: 'rent',
                category: 'rent',
                label: 'Rent',
                monthlyAmount: 26000,
                isPreset: true,
                isLocked: false,
                source: 'manual',
            }],
            monthlyOutputM: 2600,
            loomCount: 2,
            avgOutputPerLoomPerDay: 50,
            monthlyWorkingDays: 26,
            commissionPct: 2,
            transportPerM: 1,
            profitPct: 12,
            orderQuantityM: 1000,
            enabledSections: {
                winding: false,
                processing: false,
                finishing: false,
                commission: true,
                transport: true,
            },
        }

        const totals = calcFullTotals(estimate)

        expect(round2(totals.warpCostPerM)).toBe(3.08)
        expect(round2(totals.weftCostPerM)).toBe(4.06)
        expect(round2(totals.weaveCostPerM)).toBe(10.88)
        expect(round2(totals.warpingAndSizingPerM)).toBe(0.1)
        expect(round2(totals.overheadPerM)).toBe(10)
        expect(round2(totals.totalProductionCostPerM)).toBe(28.12)
        expect(round2(totals.orderQuote?.quotePricePerM ?? 0)).toBe(33.24)
        expect(round2(totals.orderQuote?.grossProfitRupees ?? 0)).toBe(3561.96)
    })
})
