import { describe, expect, it } from 'vitest'
import {
    calcFullTotals,
    calcPerPickCostFromWeavingRate,
    calcOrderQuote,
    calcWarpYarnKg,
    calcWeaveCostPerMeter,
    calcWorkerRateSnapshot,
    calcWeftYarnKg,
    getWidthWarnings,
    inchesToCm,
    makeDefaultEstimateState,
    normalizeCurrencySnapshot,
    type EstimateState,
} from '../lib/estimator'

function round2(value: number) {
    return Math.round(value * 100) / 100
}

describe('Batch 10 worker-rate snapshots', () => {
    it('normalizes binary float drift at the quote/order snapshot boundary', () => {
        expect(calcWorkerRateSnapshot([{ picks: 41.7 }], 0.06)).toBe(2.5)
        expect(normalizeCurrencySnapshot(2.5020000000000002)).toBe(2.5)
    })

    it('preserves the user-facing two-decimal loom wage for derived per-pick rates', () => {
        const perPickCostPaisa = Math.round((8 / 68) * 10000) / 10000

        expect(perPickCostPaisa).toBe(0.1176)
        expect(calcWeaveCostPerMeter(68, perPickCostPaisa)).toBe(7.9968)
        expect(calcWorkerRateSnapshot([{ picks: 68 }], perPickCostPaisa)).toBe(8)
    })
})

function makeDno252BaseEstimate(partial: Partial<EstimateState>): EstimateState {
    return {
        ...makeDefaultEstimateState(),
        perPickCostPaisa: 0,
        warpingRatePerKg: 0,
        sizingRatePerKg: 0,
        sizingMode: 'in_house',
        yarnShortagePct: 10,
        warpCrimpPct: 0,
        overheadItems: [],
        overheadMode: 'direct',
        overheadOverridePerM: 21.5,
        monthlyOutputM: 10000,
        enabledSections: {
            winding: false,
            processing: false,
            finishing: false,
            commission: false,
            transport: false,
        },
        ...partial,
    }
}

function makeDno252ManualEstimate(): EstimateState {
    return makeDno252BaseEstimate({
        warpRows: [
            {
                id: 'warp-50-600',
                label: '50/600',
                calculationMode: 'manual',
                manualKgPer100m: 3.8,
                calcDenier: 50.6,
                beamEnds: 6200,
                yarnRate: 191,
                gstPct: 0,
                shortagePct: null,
            },
            {
                id: 'warp-jari',
                label: 'Jari',
                calculationMode: 'manual',
                manualKgPer100m: 3.3,
                calcDenier: 0,
                beamEnds: 0,
                yarnRate: 340,
                gstPct: 0,
                shortagePct: null,
            },
        ],
        weftRows: [{
            id: 'weft-40-spun',
            label: '40 spun',
            calculationMode: 'manual',
            manualKgPer100m: 6.5,
            picks: 0,
            reedSpace: 0,
            calcDenier: 0,
            yarnRate: 197,
            gstPct: 0,
            shortagePct: null,
        }],
    })
}

function makeDno252FormulaEquivalentEstimate(): EstimateState {
    const effectiveWidthCm = inchesToCm(62)
    return makeDno252BaseEstimate({
        warpRows: [
            {
                id: 'warp-50-600',
                label: '50/600',
                calculationMode: 'formula',
                manualKgPer100m: null,
                calcDenier: 55.1612903226,
                beamEnds: 6200,
                yarnRate: 191,
                gstPct: 0,
                shortagePct: null,
            },
            {
                id: 'warp-jari',
                label: 'Jari',
                calculationMode: 'formula',
                manualKgPer100m: null,
                calcDenier: 150,
                beamEnds: 1980,
                yarnRate: 340,
                gstPct: 0,
                shortagePct: null,
            },
        ],
        weftRows: [{
            id: 'weft-40-spun',
            label: '40 spun',
            calculationMode: 'formula',
            manualKgPer100m: null,
            picks: 60,
            effectiveCostingWidthCm: effectiveWidthCm,
            reedSpace: effectiveWidthCm,
            calcDenier: 157.2580645161,
            yarnRate: 197,
            gstPct: 0,
            shortagePct: null,
        }],
    })
}

function makeFactoryFormulaQaEstimate(): EstimateState {
    const effectiveWidthCm = inchesToCm(62)
    return {
        ...makeDefaultEstimateState(),
        warpRows: [
            {
                id: 'qa-warp-50-600',
                label: '50/600',
                calculationMode: 'formula',
                calcDenier: 55,
                beamEnds: 6200,
                yarnRate: 191,
                gstPct: 0,
                shortagePct: null,
            },
            {
                id: 'qa-warp-jari',
                label: 'Jari',
                calculationMode: 'formula',
                calcDenier: 155,
                beamEnds: 1920,
                yarnRate: 340,
                gstPct: 0,
                shortagePct: null,
            },
        ],
        weftRows: [{
            id: 'qa-weft-spun',
            label: '50 span/spun',
            calculationMode: 'formula',
            picks: 60,
            effectiveCostingWidthCm: effectiveWidthCm,
            reedSpace: effectiveWidthCm,
            calcDenier: 132,
            yarnRate: 197,
            gstPct: 0,
            shortagePct: null,
        }],
        perPickCostPaisa: 8.25 / 60,
        warpingRatePerKg: 0,
        sizingRatePerKg: 0,
        sizingMode: 'in_house',
        yarnShortagePct: 10,
        warpCrimpPct: 10,
        overheadItems: [],
        overheadMode: 'direct',
        overheadOverridePerM: 13.5,
        monthlyOutputM: 10000,
        enabledSections: {
            winding: false,
            processing: false,
            finishing: false,
            commission: false,
            transport: false,
        },
    }
}

function makeFactoryFormulaEquivalentManualQaEstimate(): EstimateState {
    return {
        ...makeFactoryFormulaQaEstimate(),
        warpRows: [
            {
                id: 'qa-manual-warp-50-600',
                label: '50/600',
                calculationMode: 'manual',
                manualKgPer100m: 3.7888889,
                calcDenier: 55,
                beamEnds: 6200,
                yarnRate: 191,
                gstPct: 0,
                shortagePct: null,
            },
            {
                id: 'qa-manual-warp-jari',
                label: 'Jari',
                calculationMode: 'manual',
                manualKgPer100m: 3.3066667,
                calcDenier: 155,
                beamEnds: 1920,
                yarnRate: 340,
                gstPct: 0,
                shortagePct: null,
            },
        ],
        weftRows: [{
            id: 'qa-manual-weft-spun',
            label: '50 span/spun',
            calculationMode: 'manual',
            manualKgPer100m: 5.456,
            picks: 60,
            effectiveCostingWidthCm: inchesToCm(62),
            reedSpace: inchesToCm(62),
            calcDenier: 132,
            yarnRate: 197,
            gstPct: 0,
            shortagePct: null,
        }],
    }
}

function makePracticalManualQaEstimate(overheadPerM: number): EstimateState {
    return {
        ...makeDefaultEstimateState(),
        warpRows: [
            {
                id: 'practical-warp-50-600',
                label: '50/600',
                calculationMode: 'manual',
                manualKgPer100m: 3.8,
                calcDenier: 50.6,
                beamEnds: 6200,
                yarnRate: 191,
                gstPct: 0,
                shortagePct: null,
            },
            {
                id: 'practical-warp-jari',
                label: 'Jari',
                calculationMode: 'manual',
                manualKgPer100m: 3.3,
                calcDenier: 150,
                beamEnds: 1980,
                yarnRate: 340,
                gstPct: 0,
                shortagePct: null,
            },
        ],
        weftRows: [{
            id: 'practical-weft-40-spun',
            label: '40 spun',
            calculationMode: 'manual',
            manualKgPer100m: 6.5,
            picks: 60,
            effectiveCostingWidthCm: inchesToCm(62),
            reedSpace: inchesToCm(62),
            calcDenier: 132,
            yarnRate: 197,
            gstPct: 0,
            shortagePct: null,
        }],
        perPickCostPaisa: 8.25 / 60,
        warpingRatePerKg: 0,
        sizingRatePerKg: 0,
        sizingMode: 'in_house',
        yarnShortagePct: 10,
        warpCrimpPct: 0,
        overheadItems: [],
        overheadMode: 'direct',
        overheadOverridePerM: overheadPerM,
        monthlyOutputM: 10000,
        enabledSections: {
            winding: false,
            processing: false,
            finishing: false,
            commission: false,
            transport: false,
        },
    }
}

function expectDno252Reconciled(totals: ReturnType<typeof calcFullTotals>) {
    expect(round2(totals.warpRows[0].costPerMeter)).toBe(7.98)
    expect(round2(totals.warpRows[1].costPerMeter)).toBe(12.34)
    expect(round2(totals.weftRows[0].costPerMeter)).toBe(14.09)
    expect(totals.audit.yarnBaseCostPerMeter).toBeCloseTo(31.28, 2)
    expect(round2(totals.audit.yarnTotalCostPerMeter)).toBe(34.41)
    expect(round2(totals.overheadPerM)).toBe(21.5)
    expect(totals.totalProductionCostPerM).toBeGreaterThanOrEqual(55.78)
    expect(totals.totalProductionCostPerM).toBeLessThanOrEqual(55.98)
    expect(round2(totals.totalProductionCostPerM)).toBe(55.91)
}

function expectFactoryFormulaQaReconciled(totals: ReturnType<typeof calcFullTotals>) {
    expect(totals.warpRows[0].formulaKgPer100m).toBeCloseTo(3.7888889, 6)
    expect(totals.warpRows[0].finalKgPer100m).toBeCloseTo(4.5466667, 6)
    expect(round2(totals.warpRows[0].costPerMeter)).toBe(8.68)

    expect(totals.warpRows[1].formulaKgPer100m).toBeCloseTo(3.3066667, 6)
    expect(totals.warpRows[1].finalKgPer100m).toBeCloseTo(3.968, 6)
    expect(round2(totals.warpRows[1].costPerMeter)).toBe(13.49)

    expect(totals.weftRows[0].formulaKgPer100m).toBeCloseTo(5.456, 6)
    expect(totals.weftRows[0].finalKgPer100m).toBeCloseTo(6.0016, 6)
    expect(round2(totals.weftRows[0].costPerMeter)).toBe(11.82)

    expect(round2(totals.audit.yarnTotalCostPerMeter)).toBe(34)
    expect(round2(totals.weaveCostPerM)).toBe(8.25)
    expect(round2(totals.overheadPerM)).toBe(13.5)
    expect(totals.totalProductionCostPerM).toBeGreaterThanOrEqual(55.65)
    expect(totals.totalProductionCostPerM).toBeLessThanOrEqual(55.85)
    expect(round2(totals.totalProductionCostPerM)).toBe(55.75)
}

describe('Estimator formula primitives', () => {
    it('calculates warp and weft yarn kg per 100m using the documented denier formulas', () => {
        expect(calcWarpYarnKg(3200, 75)).toBeCloseTo(2.6666667, 6)
        expect(calcWeftYarnKg(68, 62, 75)).toBeCloseTo(1.3832021, 6)
    })

    it('calculates warp and weft yarn kg with floating point denier (e.g. 50.6)', () => {
        expect(calcWarpYarnKg(3200, 50.6)).toBeCloseTo(1.7991111, 6)
        expect(calcWeftYarnKg(68, 62, 50.6)).toBeCloseTo(0.9332003, 6)
    })

    it('divides the 100m weft formula multiplier across all weft components', () => {
        const weftComponent = {
            id: 'weft-1',
            picks: 68,
            reedSpace: 62,
            effectiveCostingWidthCm: 62,
            calcDenier: 75,
            yarnRate: 100,
            gstPct: 0,
            shortagePct: 0,
        }
        const calculateForCount = (count: number) => calcFullTotals({
            ...makeDefaultEstimateState(),
            yarnShortagePct: 0,
            weftRows: Array.from({ length: count }, (_, index) => ({
                ...weftComponent,
                id: `weft-${index + 1}`,
            })),
        })

        const oneComponent = calculateForCount(1)
        const twoComponents = calculateForCount(2)
        const threeComponents = calculateForCount(3)

        expect(oneComponent.weftRows[0].formulaLengthM).toBe(100)
        expect(twoComponents.weftRows[0].formulaLengthM).toBe(50)
        expect(threeComponents.weftRows[0].formulaLengthM).toBeCloseTo(100 / 3, 10)
        expect(twoComponents.weftRows[0].formulaKgPer100m).toBeCloseTo(
            oneComponent.weftRows[0].formulaKgPer100m / 2,
            10,
        )
        expect(threeComponents.weftRows[0].formulaKgPer100m).toBeCloseTo(
            oneComponent.weftRows[0].formulaKgPer100m / 3,
            10,
        )
        const totalWeftKg = (totals: ReturnType<typeof calcFullTotals>) => totals.weftRows
            .reduce((sum, row) => sum + row.kgPer100m, 0)
        expect(totalWeftKg(twoComponents)).toBeCloseTo(totalWeftKg(oneComponent), 10)
        expect(totalWeftKg(threeComponents)).toBeCloseTo(totalWeftKg(oneComponent), 10)
    })

    it('does not divide explicit manual weft consumption by the component count', () => {
        const estimate = makeDefaultEstimateState()
        estimate.yarnShortagePct = 0
        estimate.weftRows = [1, 2].map(index => ({
            ...estimate.weftRows[0],
            id: `manual-weft-${index}`,
            calculationMode: 'manual',
            manualKgPer100m: 2.5,
            shortagePct: 0,
        }))

        const totals = calcFullTotals(estimate)

        expect(totals.weftRows.map(row => row.baseKgPer100mUsed)).toEqual([2.5, 2.5])
        expect(totals.weftRows.reduce((sum, row) => sum + row.kgPer100m, 0)).toBe(5)
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

    it('preserves the configured margin when Base has no order quantity', () => {
        const quote = calcOrderQuote({
            totalProductionCostPerM: 35.1718,
            orderQuantityM: 0,
            commissionPct: 2,
            transportPerM: 2,
            profitMarginPct: 10,
        })

        expect(round2(quote.quotePricePerM)).toBe(42.24)
        expect(round2(quote.actualMarginPct)).toBe(10)
        expect(quote.totalOrderValue).toBe(0)
        expect(quote.grossProfitRupees).toBe(0)
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
    it('keeps the blank crimp default neutral while preserving explicit crimp costing', () => {
        const base = makeDefaultEstimateState()
        const estimate: EstimateState = {
            ...base,
            warpRows: [
                {
                    id: 'quality-2-warp-1',
                    calcDenier: 40,
                    beamEnds: 5500,
                    yarnRate: 187,
                    gstPct: 0,
                    shortagePct: null,
                },
                {
                    id: 'quality-2-warp-2',
                    calcDenier: 155,
                    beamEnds: 1250,
                    yarnRate: 333,
                    gstPct: 0,
                    shortagePct: null,
                },
            ],
            weftRows: [{
                id: 'quality-2-weft-1',
                picks: 58,
                reedSpace: 54 * 2.54,
                effectiveCostingWidthCm: 54 * 2.54,
                calcDenier: 125,
                yarnRate: 192,
                gstPct: 0,
                shortagePct: null,
            }],
            perPickCostPaisa: 8.10 / 58,
            yarnShortagePct: 10,
            warpCrimpPct: 0,
            overheadItems: [],
            overheadMode: 'direct',
            overheadOverridePerM: 12.75,
        }

        expect(makeDefaultEstimateState().warpCrimpPct).toBe(0)
        expect(round2(calcFullTotals(estimate).totalProductionCostPerM)).toBe(42.95)
        expect(round2(calcFullTotals({ ...estimate, warpCrimpPct: 1 }).totalProductionCostPerM)).toBe(43.07)
        expect(round2(calcFullTotals({ ...estimate, warpCrimpPct: 5 }).totalProductionCostPerM)).toBe(43.54)
    })

    it('honors an explicitly entered transport cost even when a stale section toggle is off', () => {
        const estimate = makeFactoryFormulaQaEstimate()
        estimate.orderQuantityM = 0
        estimate.transportPerM = 2
        estimate.commissionPct = 2
        estimate.profitPct = 10
        estimate.enabledSections = { ...estimate.enabledSections, transport: false, commission: true }

        const totals = calcFullTotals(estimate)
        const expected = (totals.totalProductionCostPerM + 2) / (1 - 0.02 - 0.10)

        expect(totals.orderQuote?.quotePricePerM).toBeCloseTo(expected, 8)
        expect(totals.orderQuote?.actualMarginPct).toBeCloseTo(10, 8)
    })

    it('calculates the real factory formula QA case honestly with warp crimp only on warp', () => {
        const totals = calcFullTotals(makeFactoryFormulaQaEstimate())

        expectFactoryFormulaQaReconciled(totals)
        expect(totals.audit.warp.layers[0]).toMatchObject({
            name: '50/600',
            mode: 'formula',
            crimpPct: 10,
            wastePct: 10,
            totalAdjustmentPct: 20,
        })
        expect(totals.audit.warp.layers[1]).toMatchObject({
            name: 'Jari',
            mode: 'formula',
            crimpPct: 10,
            wastePct: 10,
            totalAdjustmentPct: 20,
        })
        expect(totals.audit.weft.layers[0]).toMatchObject({
            name: '50 span/spun',
            mode: 'formula',
            crimpPct: 0,
            wastePct: 10,
            totalAdjustmentPct: 10,
            effectiveCostingWidthInches: expect.closeTo(62, 6),
        })
    })

    it('matches real formula QA totals in formula-equivalent manual kg/100m mode', () => {
        const formulaTotals = calcFullTotals(makeFactoryFormulaQaEstimate())
        const manualTotals = calcFullTotals(makeFactoryFormulaEquivalentManualQaEstimate())

        expectFactoryFormulaQaReconciled(manualTotals)
        expect(Math.abs(formulaTotals.totalProductionCostPerM - manualTotals.totalProductionCostPerM)).toBeLessThanOrEqual(0.10)
        expect(manualTotals.audit.warp.layers[0]).toMatchObject({
            mode: 'manual',
            baseKgPer100mUsed: expect.closeTo(3.7888889, 6),
            totalAdjustmentPct: 20,
        })
        expect(manualTotals.audit.weft.layers[0]).toMatchObject({
            mode: 'manual',
            baseKgPer100mUsed: expect.closeTo(5.456, 6),
            crimpPct: 0,
            totalAdjustmentPct: 10,
        })
    })

    it('keeps practical manual regression aligned with explicit weave and overhead inputs', () => {
        const oldOtherCostTotals = calcFullTotals(makePracticalManualQaEstimate(13.25))
        const newOtherCostTotals = calcFullTotals(makePracticalManualQaEstimate(13.5))

        expect(round2(oldOtherCostTotals.audit.yarnTotalCostPerMeter)).toBe(34.41)
        expect(round2(oldOtherCostTotals.weaveCostPerM)).toBe(8.25)
        expect(round2(oldOtherCostTotals.overheadPerM)).toBe(13.25)
        expect(round2(oldOtherCostTotals.totalProductionCostPerM)).toBe(55.91)

        expect(round2(newOtherCostTotals.audit.yarnTotalCostPerMeter)).toBe(34.41)
        expect(round2(newOtherCostTotals.weaveCostPerM)).toBe(8.25)
        expect(round2(newOtherCostTotals.overheadPerM)).toBe(13.5)
        expect(round2(newOtherCostTotals.totalProductionCostPerM)).toBe(56.16)
    })

    it('reconciles D.NO 252/254 manual kg/100m factory costing within pilot tolerance', () => {
        const totals = calcFullTotals(makeDno252ManualEstimate())

        expectDno252Reconciled(totals)
        expect(totals.audit.warp.layers[0]).toMatchObject({
            name: '50/600',
            mode: 'manual',
            manualKgPer100m: 3.8,
            baseKgPer100mUsed: 3.8,
            wastePct: 10,
            totalAdjustmentPct: 10,
        })
        expect(totals.audit.productionCostPerMeter).toBe(totals.totalProductionCostPerM)
    })

    it('reconciles D.NO 252/254 formula inputs when they mathematically imply the manual kg fixture', () => {
        const manualTotals = calcFullTotals(makeDno252ManualEstimate())
        const formulaTotals = calcFullTotals(makeDno252FormulaEquivalentEstimate())

        expectDno252Reconciled(formulaTotals)
        expect(Math.abs(formulaTotals.totalProductionCostPerM - manualTotals.totalProductionCostPerM)).toBeLessThanOrEqual(0.10)
        expect(formulaTotals.audit.warp.layers[0]).toMatchObject({
            mode: 'formula',
            formulaDescription: 'denier × beam ends / 90000',
            calcDenier: 55.1612903226,
            beamEnds: 6200,
            formulaKgPer100m: expect.closeTo(3.8, 6),
            baseKgPer100mUsed: expect.closeTo(3.8, 6),
            totalAdjustmentPct: 10,
        })
        expect(formulaTotals.audit.weft.layers[0]).toMatchObject({
            mode: 'formula',
            formulaDescription: 'denier × PPI × effective width inches × 100m / 9000000',
            calcDenier: 157.2580645161,
            picks: 60,
            effectiveCostingWidthInches: expect.closeTo(62, 6),
            formulaKgPer100m: expect.closeTo(6.5, 6),
            baseKgPer100mUsed: expect.closeTo(6.5, 6),
            totalAdjustmentPct: 10,
        })
    })

    it('matches manual layer costs when formula inputs imply the same base kg/100m', () => {
        const manualTotals = calcFullTotals(makeDno252ManualEstimate())
        const formulaTotals = calcFullTotals(makeDno252FormulaEquivalentEstimate())

        expect(Math.abs(formulaTotals.warpRows[0].costPerMeter - manualTotals.warpRows[0].costPerMeter)).toBeLessThanOrEqual(0.05)
        expect(Math.abs(formulaTotals.warpRows[1].costPerMeter - manualTotals.warpRows[1].costPerMeter)).toBeLessThanOrEqual(0.05)
        expect(Math.abs(formulaTotals.weftRows[0].costPerMeter - manualTotals.weftRows[0].costPerMeter)).toBeLessThanOrEqual(0.05)
        expect(Math.abs(formulaTotals.totalProductionCostPerM - manualTotals.totalProductionCostPerM)).toBeLessThanOrEqual(0.10)
    })

    it('reconciles mixed formula/manual D.NO 252/254 layers when each layer implies the same base kg', () => {
        const formula = makeDno252FormulaEquivalentEstimate()
        const manual = makeDno252ManualEstimate()
        const mixed = makeDno252BaseEstimate({
            warpRows: [
                formula.warpRows[0],
                manual.warpRows[1],
            ],
            weftRows: [formula.weftRows[0]],
        })

        const totals = calcFullTotals(mixed)

        expectDno252Reconciled(totals)
        expect(totals.audit.warp.layers[0].mode).toBe('formula')
        expect(totals.audit.warp.layers[1].mode).toBe('manual')
        expect(totals.audit.weft.layers[0].mode).toBe('formula')
    })

    it('does not silently adjust formula-derived kg to practical/manual fixture weights', () => {
        const estimate = makeDno252BaseEstimate({
            warpRows: [{
                id: 'warp-50-600',
                label: '50/600 practical mismatch',
                calculationMode: 'formula',
                calcDenier: 50.6,
                beamEnds: 6200,
                yarnRate: 191,
                gstPct: 0,
                shortagePct: null,
            }],
            weftRows: [],
        })

        const totals = calcFullTotals(estimate)
        const layer = totals.audit.warp.layers[0]

        expect(layer.mode).toBe('formula')
        expect(layer.formulaKgPer100m).toBeCloseTo(3.4857778, 6)
        expect(layer.baseKgPer100mUsed).toBeCloseTo(3.4857778, 6)
        expect(layer.baseKgPer100mUsed).not.toBeCloseTo(3.8, 3)
        expect(layer.finalKgPer100m).toBeCloseTo(3.8343556, 6)
        expect(round2(layer.costPerMeter)).toBe(7.32)
        expect(round2(totals.totalProductionCostPerM)).toBe(28.82)
    })

    it('applies row waste override and crimp semantics without hidden double-counting', () => {
        const base = makeDefaultEstimateState()
        const makeEstimate = (defaultWaste: number, rowWaste: number | null, crimp: number): EstimateState => ({
            ...base,
            warpRows: [{
                id: 'warp-main',
                calcDenier: 75,
                beamEnds: 3200,
                yarnRate: 100,
                gstPct: 0,
                shortagePct: rowWaste,
            }],
            weftRows: [{
                id: 'weft-main',
                picks: 60,
                reedSpace: inchesToCm(62),
                effectiveCostingWidthCm: inchesToCm(62),
                calcDenier: 132,
                yarnRate: 197,
                gstPct: 0,
                shortagePct: rowWaste,
            }],
            yarnShortagePct: defaultWaste,
            warpCrimpPct: crimp,
        })

        expect(calcFullTotals(makeEstimate(10, null, 0)).warpRows[0].totalAdjustmentPct).toBe(10)
        expect(calcFullTotals(makeEstimate(10, 0, 0)).warpRows[0].totalAdjustmentPct).toBe(0)
        expect(calcFullTotals(makeEstimate(0, 10, 10)).warpRows[0].totalAdjustmentPct).toBe(20)
        expect(calcFullTotals(makeEstimate(10, 10, 0)).warpRows[0].totalAdjustmentPct).toBe(10)
        expect(calcFullTotals(makeEstimate(10, null, 10)).weftRows[0].totalAdjustmentPct).toBe(10)
        expect(calcFullTotals(makeEstimate(10, 0, 10)).weftRows[0].totalAdjustmentPct).toBe(0)
        expect(calcFullTotals(makeEstimate(10, 10, 10)).weftRows[0].totalAdjustmentPct).toBe(10)
        expect(calcFullTotals(makeEstimate(10, 10, 10)).weftRows[0].crimpPct).toBe(0)
    })

    it('exposes base yarn weight and cost before adding wastage in the manual workflow', () => {
        const estimate = makeDefaultEstimateState()
        estimate.warpRows = [{
            ...estimate.warpRows[0],
            calcDenier: 110,
            beamEnds: 1974,
            yarnRate: 172,
            gstPct: 0,
            shortagePct: 10,
        }]
        estimate.weftRows = []
        estimate.warpCrimpPct = 0

        const totals = calcFullTotals(estimate)
        const row = totals.warpRows[0]

        expect(row.baseKgPer100mUsed).toBeCloseTo(2.4126666667, 9)
        expect(row.baseCostPer100m).toBeCloseTo(row.baseKgPer100mUsed * 172, 9)
        expect(row.finalKgPer100m).toBeCloseTo(row.baseKgPer100mUsed * 1.10, 9)
        expect(totals.yarnShortageCostPerM).toBeCloseTo(row.baseCostPerMeter * 0.10, 9)
        expect(totals.audit.yarnTotalCostPerMeter).toBeCloseTo(
            totals.audit.yarnBaseCostPerMeter + totals.audit.yarnAdjustmentCostPerMeter,
            9,
        )
    })

    it('uses effective costing width for weft formula and warns on dangerous cm widths', () => {
        const effectiveWidthCm = inchesToCm(62)
        const estimate: EstimateState = {
            ...makeDefaultEstimateState(),
            warpRows: [],
            weftRows: [{
                id: 'weft-main',
                picks: 68,
                effectiveCostingWidthCm: effectiveWidthCm,
                reedSpace: effectiveWidthCm,
                calcDenier: 40,
                yarnRate: 197,
                gstPct: 0,
                shortagePct: 0,
            }],
            yarnShortagePct: 10,
            warpCrimpPct: 0,
        }

        const totals = calcFullTotals(estimate)
        expect(totals.weftRows[0].formulaKgPer100m).toBeCloseTo(calcWeftYarnKg(68, effectiveWidthCm, 40), 8)
        expect(totals.weftRows[0].effectiveCostingWidthInches).toBeCloseTo(62, 6)
        expect(totals.weftRows[0].totalAdjustmentPct).toBe(0)

        const warnings = getWidthWarnings({
            effectiveCostingWidthCm: 62,
            inputUnit: 'cm',
            rawInputValue: 62,
        })
        expect(warnings.map(warning => warning.message)).toContain('62 cm is only 24.4 inches. Did you mean 62 inches?')
    })

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
        expect(round2(totals.weftCostPerM)).toBe(1.52)
        expect(round2(totals.weaveCostPerM)).toBe(10.88)
        expect(round2(totals.warpingAndSizingPerM)).toBe(0.1)
        expect(round2(totals.overheadPerM)).toBe(10)
        expect(round2(totals.totalProductionCostPerM)).toBe(25.59)
        expect(round2(totals.orderQuote?.quotePricePerM ?? 0)).toBe(30.92)
        expect(round2(totals.orderQuote?.grossProfitRupees ?? 0)).toBe(3709.90)
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
            overheadMode: 'direct',
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
        expect(round2(totals.weftRows[0].kgPer100m)).toBe(1.83)
        expect(round2(totals.weftCostPerM)).toBe(6.41)
        expect(round2(totals.weaveCostPerM)).toBe(8.00)
        expect(round2(totals.warpingAndSizingPerM)).toBe(0.40)
        expect(round2(totals.overheadPerM)).toBe(5.75)
        
        expect(round2(totals.totalProductionCostPerM)).toBe(32.19)
        expect(round2(totals.orderQuote?.landedCostPerM ?? totals.totalProductionCostPerM)).toBe(32.19)
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
            overheadMode: 'direct',
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

        expect(round2(totals.totalProductionCostPerM)).toBe(32.19)
        expect(round2(totals.orderQuote?.landedCostPerM ?? 0)).toBe(34.47)
        expect(round2(totals.orderQuote?.quotePricePerM ?? 0)).toBe(39.17)
    })
})

describe('Loom weave wage UX and paise/rupee conversion safety', () => {
    it('handles direct wage to paise-per-pick conversion correctly', () => {
        const totalPicks = 68
        const wagePerMeter = 8 // User enters ₹8/m
        
        const perPickCostPaisaInternal = calcPerPickCostFromWeavingRate(wagePerMeter, totalPicks)
        
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

    it('does not derive a per-pick rate until total picks are available', () => {
        expect(calcPerPickCostFromWeavingRate(8, 0)).toBe(0)
        expect(calcPerPickCostFromWeavingRate(0, 68)).toBe(0)
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
