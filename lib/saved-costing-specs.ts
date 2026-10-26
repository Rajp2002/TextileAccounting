import { getEffectiveCostingWidthCm, type CostingResultSnapshot, type EstimateState, type EstimatorYarnLayerAudit } from './estimator'

/**
 * The inputs a saved costing was priced from, for the owner's breakdown: the
 * construction, each warp and weft yarn, and the rates behind every cost line.
 * Unlike the customer fabric spec, row names and yarn rates are kept, because
 * only the owner reads this. Nothing is recalculated: values come from the
 * saved state, and the per-layer audit wins where the result recorded the
 * rate, GST, waste or crimp it actually applied.
 */
export type SavedCostingSpecYarn = {
    /** The row's own name, or null so the reader numbers it ("Warp 1"). */
    name: string | null
    /** "75D" or "40s Ne"; null for a row entered as a manual weight. */
    count: string | null
    /** Manual base weight, kg per 100 m, when the row skips the formula. */
    manualKgPer100m: number | null
    /** Ends for a warp row, picks per inch for a weft row. */
    amount: number | null
    ratePerKg: number | null
    gstPct: number | null
    wastePct: number | null
    crimpPct: number | null
}

export type SavedCostingSpecs = {
    widthInches: number | null
    widthCm: number | null
    totalEnds: number | null
    endsPerInch: number | null
    totalPicks: number | null
    quantityM: number | null
    warp: SavedCostingSpecYarn[]
    weft: SavedCostingSpecYarn[]
    weavingRatePerM: number | null
    paisePerPick: number | null
    /** Null when the step is done in-house, so the costing carries no rate for it. */
    warpingRatePerKg: number | null
    sizingRatePerKg: number | null
    windingRatePerKg: number | null
    processingRatePerM: number | null
    finishingRatePerM: number | null
    overheadMode: 'direct' | 'monthly_expenses'
    overheadPerM: number
    overheadMonthlyTotal: number | null
    overheadMonthlyOutputM: number | null
    commissionPct: number | null
    transportPerM: number | null
}

const positive = (value: unknown) => {
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? number : null
}

const finite = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const round = (value: number, digits: number) => Number(value.toFixed(digits))

function yarnCount(row: { linearDensityUnit?: string; cottonCountNe?: number | null; calcDenier?: number; calculationMode?: string }) {
    if (row.calculationMode === 'manual') return null
    if (row.linearDensityUnit === 'cotton_count_ne') {
        const count = positive(row.cottonCountNe)
        return count ? `${round(count, 1)}s Ne` : null
    }
    const denier = positive(row.calcDenier)
    return denier ? `${round(denier, 1)}D` : null
}

function specYarn(
    row: EstimateState['warpRows'][number] | EstimateState['weftRows'][number],
    amount: unknown,
    audit: EstimatorYarnLayerAudit | undefined,
    fallback: { wastePct: unknown; crimpPct: unknown },
): SavedCostingSpecYarn {
    return {
        name: row.label?.trim() || null,
        count: yarnCount(row),
        manualKgPer100m: row.calculationMode === 'manual' ? positive(row.manualKgPer100m) : null,
        amount: positive(amount),
        ratePerKg: finite(audit?.ratePerKg ?? row.yarnRate),
        gstPct: finite(audit?.gstPct ?? row.gstPct),
        wastePct: finite(audit?.wastePct ?? row.shortagePct ?? fallback.wastePct),
        crimpPct: finite(audit?.crimpPct ?? row.crimpPct ?? fallback.crimpPct),
    }
}

export function buildSavedCostingSpecs(state: EstimateState, result: CostingResultSnapshot): SavedCostingSpecs {
    const warpRows = Array.isArray(state.warpRows) ? state.warpRows : []
    const weftRows = Array.isArray(state.weftRows) ? state.weftRows : []
    // The audit lists layers in row order; a length mismatch means the rows
    // changed shape since, so the saved row values are shown instead.
    const warpAudit = result.audit?.warp.layers.length === warpRows.length ? result.audit.warp.layers : []
    const weftAudit = result.audit?.weft.layers.length === weftRows.length ? result.audit.weft.layers : []

    const widthCm = weftRows.map(row => positive(getEffectiveCostingWidthCm(row))).find(Boolean) ?? null
    const widthInches = widthCm ? widthCm / 2.54 : null
    const ends = warpRows.map(row => positive(row.beamEnds)).filter((value): value is number => value !== null)
    const totalEnds = ends.length ? ends.reduce((sum, value) => sum + value, 0) : null
    const picks = weftRows.map(row => positive(row.picks)).filter((value): value is number => value !== null)
    const totalPicks = picks.length ? picks.reduce((sum, value) => sum + value, 0) : null

    const perPick = positive(state.perPickCostPaisa)
    const weavingRatePerM = positive(result.breakdown.weaveCostPerM) ?? (perPick && totalPicks ? perPick * totalPicks : null)
    const warpingOutsourced = (state.warpingMode ?? (state.warpingRatePerKg > 0 ? 'outsourced' : 'in_house')) === 'outsourced'
    const sizingOutsourced = (state.sizingMode ?? 'in_house') === 'outsourced'
    const overhead = result.assumptions?.overhead ?? null
    const overheadMode = overhead?.mode ?? result.overheadMode

    return {
        widthInches: widthInches ? round(widthInches, 1) : null,
        widthCm: widthCm ? round(widthCm, 1) : null,
        totalEnds,
        endsPerInch: totalEnds && widthInches ? round(totalEnds / widthInches, 1) : null,
        totalPicks: totalPicks ? round(totalPicks, 1) : null,
        quantityM: positive(result.quantityM),
        warp: warpRows.map((row, index) => specYarn(row, row.beamEnds, warpAudit[index], { wastePct: state.yarnShortagePct, crimpPct: state.warpCrimpPct })),
        weft: weftRows.map((row, index) => specYarn(row, row.picks, weftAudit[index], { wastePct: state.yarnShortagePct, crimpPct: null })),
        weavingRatePerM: weavingRatePerM ? round(weavingRatePerM, 2) : null,
        paisePerPick: perPick ? round(perPick * 100, 4) : null,
        warpingRatePerKg: warpingOutsourced ? finite(state.warpingRatePerKg) : null,
        sizingRatePerKg: sizingOutsourced ? finite(state.sizingRatePerKg) : null,
        windingRatePerKg: state.enabledSections?.winding ? finite(state.windingRatePerKg) : null,
        processingRatePerM: state.enabledSections?.processing ? finite(state.processingRatePerM) : null,
        finishingRatePerM: state.enabledSections?.finishing ? finite(state.finishingRatePerM) : null,
        overheadMode,
        overheadPerM: result.breakdown.overheadPerM,
        overheadMonthlyTotal: overheadMode === 'monthly_expenses' ? positive(overhead?.monthlyExpenseTotal) : null,
        overheadMonthlyOutputM: overheadMode === 'monthly_expenses' ? positive(overhead?.monthlyOutputM) : null,
        commissionPct: positive(result.commissionPct),
        transportPerM: positive(result.transportPerM),
    }
}
