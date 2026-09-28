import {
    buildCostingResult,
    calcFullTotals,
    DEFAULT_FACTORY_SECTIONS,
    type EstimateState,
} from '@/lib/estimator'
import { SAMPLE_QUALITY, type SampleInputs, type SampleResult } from './sample-format'

/**
 * Runs the landing page's example through the same engine the Weavly
 * estimator and Cost Sheet use (calcFullTotals + buildCostingResult). The
 * server renders the starting numbers; the browser loads this module only when
 * a visitor first changes a rate.
 */
function sampleState(inputs: SampleInputs): EstimateState {
    const q = SAMPLE_QUALITY
    return {
        warpRows: [{
            id: 'sample-warp', label: 'Warp', calculationMode: 'formula', manualKgPer100m: null,
            linearDensityUnit: 'denier', cottonCountNe: null, calcDenier: q.warp.denier,
            beamEnds: q.warp.ends, yarnRate: q.warp.ratePerKg, gstPct: q.gstPct, shortagePct: null,
        }],
        weftRows: [{
            id: 'sample-weft', label: 'Weft', calculationMode: 'formula', manualKgPer100m: null,
            linearDensityUnit: 'denier', cottonCountNe: null, calcDenier: q.weft.denier,
            picks: inputs.picksPerInch, reedSpace: q.weft.widthCm, effectiveCostingWidthCm: q.weft.widthCm,
            yarnRate: inputs.weftRatePerKg, gstPct: q.gstPct, shortagePct: null,
        }],
        tapeLengthM: 0,
        perPickCostPaisa: inputs.paisePerPick / 100,
        warpingRatePerKg: 0,
        sizingRatePerKg: 0,
        windingRatePerKg: 0,
        processingRatePerM: 0,
        finishingRatePerM: 0,
        yarnShortagePct: q.wastePct,
        warpCrimpPct: q.crimpPct,
        overheadItems: [],
        monthlyOutputM: 0,
        overheadOverridePerM: q.overheadPerM,
        overheadMode: 'direct',
        loomCount: 0,
        avgOutputPerLoomPerDay: 50,
        monthlyWorkingDays: 26,
        loomType: null,
        loomRpm: null,
        loomPowerKw: null,
        loomRpmIsCustomised: false,
        loomPowerKwIsCustomised: false,
        hoursPerShift: 12,
        warpingMode: 'in_house',
        sizingMode: 'in_house',
        overheadPct: 0,
        commissionPct: q.commissionPct,
        transportPerM: q.transportPerM,
        profitPct: inputs.marginPct,
        orderQuantityM: q.orderQuantityM,
        enabledSections: { ...DEFAULT_FACTORY_SECTIONS, commission: true, transport: true },
        isConfigured: true,
    }
}

export function costSample(inputs: SampleInputs): SampleResult {
    const state = sampleState(inputs)
    const totals = calcFullTotals(state)
    const result = buildCostingResult(state, totals)
    return {
        warpYarnPerM: totals.warpCostPerM,
        weftYarnPerM: totals.weftCostPerM,
        weavingPerM: totals.weaveCostPerM,
        overheadPerM: result.overheadPerM,
        productionCostPerM: result.productionCostPerM,
        breakEvenPricePerM: result.breakEvenPricePerM,
        suggestedPricePerM: result.suggestedSellingPricePerM,
        marginPct: result.actualMarginPct,
        orderProfit: result.expectedProfitTotal,
        quoteIsValid: result.quoteIsValid,
    }
}
