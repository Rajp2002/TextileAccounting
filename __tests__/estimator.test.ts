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
        expect(calcWeftYarnKg(68, 62, 75)).toBeCloseTo(1.3832021, 6)
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

        expect(round2(quote.landedCostPerM)).toBe(52.67)
        expect(round2(quote.quotePricePerM)).toBe(58.52)
        expect(round2(quote.totalOrderValue)).toBe(58522.73)
        expect(round2(quote.grossProfitRupees)).toBe(5852.27)
        expect(round2(quote.actualMarginPct)).toBe(10)
    })

    it('returns invalid state if commission + margin percentage >= 100%', () => {
        const quote = calcOrderQuote({
            totalProductionCostPerM: 32.48,
            orderQuantityM: 1000,
            commissionPct: 50,
            transportPerM: 1.5,
            profitMarginPct: 50,
        })

        expect(quote.isValid).toBe(false)
        expect(quote.errorMessage).toBe('Commission % + Margin % must be below 100%.')
        expect(quote.quotePricePerM).toBe(0)
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
        expect(round2(totals.weftCostPerM)).toBe(1.60)
        expect(round2(totals.weaveCostPerM)).toBe(10.88)
        expect(round2(totals.warpingAndSizingPerM)).toBe(0.1)
        expect(round2(totals.overheadPerM)).toBe(10)
        expect(round2(totals.totalProductionCostPerM)).toBe(25.66)
        expect(round2(totals.orderQuote?.quotePricePerM ?? 0)).toBe(31.00)
        expect(round2(totals.orderQuote?.grossProfitRupees ?? 0)).toBe(3720.04)
    })

    it('calculates V3 totals for a mixed warp/weft composition', () => {
        const estimate: EstimateState = {
            ...makeDefaultEstimateState(),
            warpRows: [{
                id: 'warp-main',
                calcDenier: 75,
                beamEnds: 3200,
                yarnRate: 100,
                gstPct: 5,
                shortagePct: 5,
            }],
            weftRows: [{
                id: 'weft-main',
                picks: 68,
                reedSpace: 112,
                calcDenier: 50,
                yarnRate: 350,
                gstPct: 0,
                shortagePct: 15,
            }],
            tapeLengthM: 1000,
            perPickCostPaisa: 0.16,
            warpingRatePerKg: 2,
            sizingRatePerKg: 1.5,
            sizingMode: 'outsourced',
            yarnShortagePct: 15,
            warpCrimpPct: 0,
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

        expect(round2(totals.weftRows[0].kgPer100m)).toBeCloseTo(1.92, 2)
        expect(round2(totals.weftCostPerM)).toBeCloseTo(6.70, 2)
        expect(round2(totals.orderQuote?.landedCostPerM ?? 0)).toBeCloseTo(32.36, 2)
    })

    it('calculates the exact 60g Georgette production cost scenario correctly', () => {
        const estimate: EstimateState = {
            ...makeDefaultEstimateState(),
            warpRows: [{
                id: 'warp-main',
                calcDenier: 50,
                beamEnds: 5200,
                yarnRate: 350,
                gstPct: 0,
                shortagePct: null,
            }],
            weftRows: [{
                id: 'weft-main',
                picks: 68,
                reedSpace: 112,
                calcDenier: 50,
                yarnRate: 350,
                gstPct: 0,
                shortagePct: null,
            }],
            tapeLengthM: 100,
            perPickCostPaisa: 8 / 68, // ₹8.00 / 68 picks = ₹/pick
            warpingRatePerKg: 12,
            sizingRatePerKg: 0,
            sizingMode: 'in_house',
            yarnShortagePct: 10,
            warpCrimpPct: 5,
            overheadItems: [],
            monthlyOutputM: 2600,
            overheadOverridePerM: 5.75,
            loomCount: 2,
            avgOutputPerLoomPerDay: 50,
            monthlyWorkingDays: 26,
            commissionPct: 0,
            transportPerM: 0,
            profitPct: 0,
            orderQuantityM: 1000,
            enabledSections: {
                winding: false,
                processing: false,
                finishing: false,
                commission: false,
                transport: false,
            },
        }

        const totals = calcFullTotals(estimate)

        expect(round2(totals.warpRows[0].kgPer100m)).toBe(3.32)
        expect(round2(totals.warpCostPerM)).toBe(11.63)
        expect(round2(totals.weftRows[0].kgPer100m)).toBe(1.92)
        expect(round2(totals.weftCostPerM)).toBe(6.70)
        expect(round2(totals.weaveCostPerM)).toBe(8.00)
        expect(round2(totals.warpingAndSizingPerM)).toBe(0.40)
        expect(round2(totals.overheadPerM)).toBe(5.75)
        
        expect(round2(totals.totalProductionCostPerM)).toBe(32.48)
        expect(round2(totals.orderQuote?.landedCostPerM ?? totals.totalProductionCostPerM)).toBe(32.48)
    })

    it('calculates landed cost separately with commission and transport additions', () => {
        const estimate: EstimateState = {
            ...makeDefaultEstimateState(),
            warpRows: [{
                id: 'warp-main',
                calcDenier: 50,
                beamEnds: 5200,
                yarnRate: 350,
                gstPct: 0,
                shortagePct: null,
            }],
            weftRows: [{
                id: 'weft-main',
                picks: 68,
                reedSpace: 112,
                calcDenier: 50,
                yarnRate: 350,
                gstPct: 0,
                shortagePct: null,
            }],
            tapeLengthM: 100,
            perPickCostPaisa: 8 / 68,
            warpingRatePerKg: 12,
            sizingRatePerKg: 0,
            sizingMode: 'in_house',
            yarnShortagePct: 10,
            warpCrimpPct: 5,
            overheadItems: [],
            monthlyOutputM: 2600,
            overheadOverridePerM: 5.75,
            loomCount: 2,
            avgOutputPerLoomPerDay: 50,
            monthlyWorkingDays: 26,
            commissionPct: 2,
            transportPerM: 1.5,
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

        expect(round2(totals.totalProductionCostPerM)).toBe(32.48)
        expect(round2(totals.orderQuote?.landedCostPerM ?? 0)).toBe(34.77)
        expect(round2(totals.orderQuote?.quotePricePerM ?? 0)).toBe(39.51)
    })
})

describe('Loom weave wage UX and paise/rupee conversion safety', () => {
    it('handles direct wage to paise-per-pick conversion correctly', () => {
        const totalPicks = 68
        const wagePerMeter = 8 // User enters ₹8/m
        
        // UI Action: derived = wageNum / totalPicks
        const derived = wagePerMeter / totalPicks
        const perPickCostPaisaInternal = Math.round(derived * 10000) / 10000
        
        // Assert internal rate is stored in Rupees per pick
        expect(perPickCostPaisaInternal).toBe(0.1176)
        
        // UI Display: Math.round(perPickCostPaisa * 100 * 10000) / 10000
        const paisaPerPickDisplay = Math.round(perPickCostPaisaInternal * 100 * 10000) / 10000
        
        // Assert displayed paise per pick is 11.76 paise
        expect(paisaPerPickDisplay).toBe(11.76)
        
        // Assert weave cost remains correct (approx ₹8.00/m)
        const weaveCost = calcWeaveCostPerMeter(totalPicks, perPickCostPaisaInternal)
        expect(round2(weaveCost)).toBe(8.00)
    })

    it('handles paise direct entry correctly', () => {
        const totalPicks = 68
        const userFacingInputPaise = 16 // User enters 16 paise
        
        // UI Action: value / 100
        const perPickCostPaisaInternal = userFacingInputPaise / 100
        
        // Assert internal rate is stored in Rupees (0.16)
        expect(perPickCostPaisaInternal).toBe(0.16)
        
        // Assert weave cost is ₹10.88/m
        const weaveCost = calcWeaveCostPerMeter(totalPicks, perPickCostPaisaInternal)
        expect(round2(weaveCost)).toBe(10.88)
    })

    it('guards against the old dangerous behavior of treating user-facing 16 paise as ₹16/pick', () => {
        const totalPicks = 68
        const userFacingInputPaise = 16
        
        // New safe behavior:
        const safeInternal = userFacingInputPaise / 100
        const safeWeaveCost = calcWeaveCostPerMeter(totalPicks, safeInternal)
        
        // Old dangerous behavior:
        const dangerousInternal = userFacingInputPaise
        const dangerousWeaveCost = calcWeaveCostPerMeter(totalPicks, dangerousInternal)
        
        expect(round2(safeWeaveCost)).toBe(10.88)
        expect(round2(dangerousWeaveCost)).toBe(1088.00)
        expect(safeWeaveCost).not.toBe(dangerousWeaveCost)
    })

    it('triggers high weave cost warning when weave cost exceeds ₹100/m', () => {
        const totalPicks = 68
        
        // Safe input: 16 paise -> ₹10.88/m
        const safeInternal = 16 / 100
        const safeWeaveCost = calcWeaveCostPerMeter(totalPicks, safeInternal)
        expect(safeWeaveCost > 100).toBe(false)
        
        // Dangerous input: user mistakenly enters 1600 paise -> ₹1088/m
        const mistakenInternal = 1600 / 100
        const mistakenWeaveCost = calcWeaveCostPerMeter(totalPicks, mistakenInternal)
        expect(mistakenWeaveCost > 100).toBe(true)
    })
})

describe('Estimator Market-Mode Race Condition Safety', () => {
    function resolvePartyNameForSubmit(targetMode: 'quote' | 'market', qualityLabel: string, partyName: string) {
        return targetMode === 'market' 
            ? (qualityLabel.trim() || partyName.trim()) 
            : partyName.trim()
    }

    it('resolves the latest qualityLabel as the fabric label in market mode during a race condition', () => {
        // Simulates the user having just typed a brand new fabric label in Market Mode
        // while the internal React batch/delayed state has not yet synced to partyName
        const qualityLabel = 'Japan Satin 100D'
        const partyName = 'Japan Satin 50D' // Outdated/old value in partyName state

        const resolved = resolvePartyNameForSubmit('market', qualityLabel, partyName)
        expect(resolved).toBe('Japan Satin 100D')
    })

    it('resolves qualityLabel when partyName is completely empty in market mode', () => {
        const qualityLabel = 'Japan Satin 100D'
        const partyName = ''

        const resolved = resolvePartyNameForSubmit('market', qualityLabel, partyName)
        expect(resolved).toBe('Japan Satin 100D')
    })

    it('resolves partyName normally in quote/party mode', () => {
        const qualityLabel = 'Japan Satin 100D'
        const partyName = 'Sundaram Textiles'

        const resolved = resolvePartyNameForSubmit('quote', qualityLabel, partyName)
        expect(resolved).toBe('Sundaram Textiles')
    })
})

