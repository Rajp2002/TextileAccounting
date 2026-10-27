import Decimal from 'decimal.js'
import { denierToCottonCountNe, type CostingResultSnapshot, type EstimateState, type EstimatorYarnLayerAudit } from './estimator'

/**
 * A saved costing's per-metre cost laid out the way a Surat costing sheet is
 * worked: weigh each warp and weft layer from its count, price the weight at
 * the yarn's rate, add the layers, add wastage and crimp, then weaving,
 * warping and sizing, any processing, and factory expenses.
 *
 * Every figure is the saved one; nothing is recalculated at today's rates. A
 * step carries its formula inputs only when they reproduce the saved figure,
 * so the sheet never explains a number with inputs it was not priced from.
 * Otherwise the step shows the saved figure alone.
 */

export type FormulaYarnWeight =
    | {
        mode: 'formula'
        denier: number
        /** Set for a row entered as an English cotton count; the formula then starts from 5315 ÷ Ne. */
        countNe: number | null
        /** Warp: the layer's ends. */
        ends: number | null
        /** Weft: the layer's picks per inch and the costing width in inches. */
        picks: number | null
        widthInches: number | null
        /** Metres of a 100 m run the weft is weighed over: 100, or less under the double-weft ratio rule. */
        lengthM: number
        kgPer100m: number
    }
    /** A weight typed by hand instead of the count formula. */
    | { mode: 'manual'; kgPer100m: number }
    /** The saved weight, when the saved inputs no longer reproduce it. */
    | { mode: 'saved'; kgPer100m: number }

export type FormulaYarnLayer = {
    system: 'warp' | 'weft'
    /** 1-based place within its system, for "Warp 1". */
    position: number
    /** The row's own name, or null when it was left blank. */
    name: string | null
    weight: FormulaYarnWeight
    ratePerKg: number
    gstPct: number
    /** True when weight × rate reproduces the saved base cost, so the cost line can show it. */
    costFromRate: boolean
    baseCostPerM: number
    wastePct: number
    crimpPct: number
    /** What wastage and crimp add to this layer, per metre. */
    allowancePerM: number
}

export type SavedCostingFormula = {
    /** One entry per warp and weft layer; empty when the version was saved without per-layer detail. */
    layers: FormulaYarnLayer[]
    /** Saved warp and weft yarn including allowances, for versions without per-layer detail. */
    warpPerM: number
    weftPerM: number
    /** Sum of the layers before wastage; null without per-layer detail. */
    yarnBasePerM: number | null
    allowancePerM: number | null
    /** Set when every layer carries the same waste and crimp, so one percentage applies to the yarn total. */
    sharedAllowance: { wastePct: number; crimpPct: number } | null
    weaving: { perM: number; picks: number | null; paisePerPick: number | null }
    warpingSizing: {
        perM: number
        /** Both steps done in-house: they carry no rate and sit in factory expenses. */
        inHouse: boolean
        warpKgPer100m: number | null
        warpingRatePerKg: number | null
        sizingRatePerKg: number | null
    }
    winding: { perM: number; kgPer100m: number | null; ratePerKg: number | null } | null
    processingPerM: number | null
    finishingPerM: number | null
    overhead: { perM: number; monthlyTotal: number | null; monthlyOutputM: number | null }
    productionCostPerM: number
}

const COTTON_COUNT_FORMULA = '(5315'
// The estimator names new rows "Warp 1", and the audit falls back to "Warp layer 1"; neither is a name of its own.
const DEFAULT_LAYER_NAME = /^(warp|weft)( layer)? \d+$/i

const ownName = (value: string | undefined) => {
    const name = value?.trim()
    return name && !DEFAULT_LAYER_NAME.test(name) ? name : null
}

const finite = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

// Saved ₹/m figures are rounded to the paisa (the audit is not), so a figure
// worked from the inputs agrees with a saved one within half a paisa.
const TOLERANCE = 1e-9
const sameMoney = (left: number, right: number) => Math.abs(left - right) <= 0.005 + TOLERANCE
/** Two weights agree to half a gram per 100 m. */
const sameWeight = (left: number, right: number) => Math.abs(left - right) <= 0.0005 + TOLERANCE

function layerWeight(system: 'warp' | 'weft', layer: EstimatorYarnLayerAudit, row: { linearDensityUnit?: string; cottonCountNe?: number | null } | undefined): FormulaYarnWeight {
    if (layer.mode === 'manual') return { mode: 'manual', kgPer100m: layer.baseKgPer100mUsed }
    const isWarp = system === 'warp'
    const formulaKg = isWarp
        ? new Decimal(layer.calcDenier).times(layer.beamEnds ?? 0).times(100).div(9_000_000).toNumber()
        : new Decimal(layer.calcDenier).times(layer.picks ?? 0).times(layer.effectiveCostingWidthInches ?? 0).times(layer.formulaLengthM).div(9_000_000).toNumber()
    if (!sameWeight(formulaKg, layer.baseKgPer100mUsed)) return { mode: 'saved', kgPer100m: layer.baseKgPer100mUsed }
    const isCottonCount = row ? row.linearDensityUnit === 'cotton_count_ne' : layer.formulaDescription.startsWith(COTTON_COUNT_FORMULA)
    const countNe = isCottonCount ? finite(row?.cottonCountNe) ?? denierToCottonCountNe(layer.calcDenier) : null
    return {
        mode: 'formula',
        denier: layer.calcDenier,
        countNe,
        ends: isWarp ? layer.beamEnds : null,
        picks: isWarp ? null : layer.picks,
        widthInches: isWarp ? null : layer.effectiveCostingWidthInches,
        lengthM: layer.formulaLengthM,
        kgPer100m: layer.baseKgPer100mUsed,
    }
}

function formulaLayers(
    system: 'warp' | 'weft',
    layers: EstimatorYarnLayerAudit[],
    rows: ReadonlyArray<{ label?: string; linearDensityUnit?: string; cottonCountNe?: number | null }> | null,
): FormulaYarnLayer[] {
    // The audit lists layers in row order; a length mismatch means the rows
    // changed shape since, so the audit is read on its own.
    const matched = rows && rows.length === layers.length ? rows : null
    return layers.map((layer, index) => {
        const row = matched?.[index]
        const rateCost = new Decimal(layer.baseKgPer100mUsed).times(layer.ratePerKg).times(new Decimal(1).plus(new Decimal(layer.gstPct).div(100))).div(100).toNumber()
        return {
            system,
            position: index + 1,
            name: ownName(matched ? row?.label : layer.name),
            weight: layerWeight(system, layer, row),
            ratePerKg: layer.ratePerKg,
            gstPct: layer.gstPct,
            costFromRate: sameMoney(rateCost, layer.baseCostPerMeter),
            baseCostPerM: layer.baseCostPerMeter,
            wastePct: layer.wastePct,
            crimpPct: layer.crimpPct,
            allowancePerM: new Decimal(layer.costPerMeter).minus(layer.baseCostPerMeter).toNumber(),
        }
    })
}

/**
 * Builds the worksheet for one saved version. `state` is the version's saved
 * inputs rebuilt as an estimate, or null when it has none; the per-layer
 * working then comes from the result's audit alone, and the rates that live
 * only in the inputs (pick rate, warping, sizing, winding) are left out.
 */
export function buildSavedCostingFormula(result: CostingResultSnapshot, state: EstimateState | null): SavedCostingFormula {
    const { breakdown, audit } = result
    const warpRows = state && Array.isArray(state.warpRows) ? state.warpRows : null
    const weftRows = state && Array.isArray(state.weftRows) ? state.weftRows : null
    const layers = audit
        ? [...formulaLayers('warp', audit.warp.layers, warpRows), ...formulaLayers('weft', audit.weft.layers, weftRows)]
        : []
    const hasLayers = layers.length > 0

    const first = layers[0]
    const sharedAllowance = first && layers.every(layer => layer.wastePct === first.wastePct && layer.crimpPct === first.crimpPct)
        ? { wastePct: first.wastePct, crimpPct: first.crimpPct }
        : null

    // Weaving: the fabric's total picks at the loom's rate per pick.
    const picks = audit?.weft.layers.length
        ? audit.weft.layers.reduce((sum, layer) => sum.plus(layer.picks ?? 0), new Decimal(0)).toNumber()
        : weftRows?.reduce((sum, row) => sum.plus(Number(row.picks) || 0), new Decimal(0)).toNumber() ?? null
    const perPick = finite(state?.perPickCostPaisa)
    const weavingFromRate = picks != null && picks > 0 && perPick != null && perPick > 0
        && sameMoney(new Decimal(picks).times(perPick).toNumber(), breakdown.weaveCostPerM)

    // Warping and sizing are charged on the warp weight after its allowances.
    const warpKg = audit?.warp.layers.length
        ? audit.warp.layers.reduce((sum, layer) => sum.plus(layer.finalKgPer100m), new Decimal(0)).toNumber()
        : null
    const warpingOutsourced = state ? (state.warpingMode ?? (state.warpingRatePerKg > 0 ? 'outsourced' : 'in_house')) === 'outsourced' : false
    const sizingOutsourced = state ? (state.sizingMode ?? 'in_house') === 'outsourced' : false
    const warpingRate = warpingOutsourced ? finite(state?.warpingRatePerKg) ?? 0 : 0
    const sizingRate = sizingOutsourced ? finite(state?.sizingRatePerKg) ?? 0 : 0
    const warpingFromRate = state != null && warpKg != null && (warpingOutsourced || sizingOutsourced)
        && sameMoney(new Decimal(warpKg).times(new Decimal(warpingRate).plus(sizingRate)).div(100).toNumber(), breakdown.warpingAndSizingPerM)

    // Winding is charged on all the yarn, warp and weft.
    const allKg = audit ? [...audit.warp.layers, ...audit.weft.layers].reduce((sum, layer) => sum.plus(layer.finalKgPer100m), new Decimal(0)).toNumber() : null
    const windingRate = finite(state?.windingRatePerKg)
    const windingFromRate = allKg != null && windingRate != null && windingRate > 0
        && sameMoney(new Decimal(allKg).times(windingRate).div(100).toNumber(), breakdown.windingPerM)

    const overhead = result.assumptions?.overhead ?? null
    const monthlyTotal = finite(overhead?.monthlyExpenseTotal)
    const monthlyOutput = finite(overhead?.monthlyOutputM)
    const overheadFromMonthly = (overhead?.mode ?? result.overheadMode) === 'monthly_expenses'
        && monthlyTotal != null && monthlyOutput != null && monthlyOutput > 0
        && sameMoney(new Decimal(monthlyTotal).div(monthlyOutput).toNumber(), breakdown.overheadPerM)

    return {
        layers,
        warpPerM: breakdown.warpCostPerM,
        weftPerM: breakdown.weftCostPerM,
        yarnBasePerM: hasLayers ? audit?.yarnBaseCostPerMeter ?? null : null,
        allowancePerM: hasLayers ? audit?.yarnAdjustmentCostPerMeter ?? null : null,
        sharedAllowance,
        weaving: {
            perM: breakdown.weaveCostPerM,
            picks: weavingFromRate ? picks : null,
            paisePerPick: weavingFromRate && perPick != null ? new Decimal(perPick).times(100).toNumber() : null,
        },
        warpingSizing: {
            perM: breakdown.warpingAndSizingPerM,
            inHouse: state != null && !warpingOutsourced && !sizingOutsourced && breakdown.warpingAndSizingPerM === 0,
            warpKgPer100m: warpingFromRate ? warpKg : null,
            warpingRatePerKg: warpingFromRate && warpingOutsourced ? warpingRate : null,
            sizingRatePerKg: warpingFromRate && sizingOutsourced ? sizingRate : null,
        },
        winding: breakdown.windingPerM > 0
            ? { perM: breakdown.windingPerM, kgPer100m: windingFromRate ? allKg : null, ratePerKg: windingFromRate ? windingRate : null }
            : null,
        processingPerM: breakdown.processingPerM > 0 ? breakdown.processingPerM : null,
        finishingPerM: breakdown.finishingPerM > 0 ? breakdown.finishingPerM : null,
        overhead: {
            perM: breakdown.overheadPerM,
            monthlyTotal: overheadFromMonthly ? monthlyTotal : null,
            monthlyOutputM: overheadFromMonthly ? monthlyOutput : null,
        },
        productionCostPerM: result.productionCostPerM,
    }
}

/**
 * The selling price as the margin control sets it: (cost + transport) ÷
 * (1 − commission − margin). Null when those saved figures do not give the
 * saved price, as for a price that was typed in.
 */
export function sellingPriceFormula(result: Pick<CostingResultSnapshot, 'productionCostPerM' | 'transportPerM' | 'commissionPct' | 'targetMarginPct' | 'suggestedSellingPricePerM'>) {
    const share = new Decimal(1).minus(new Decimal(result.commissionPct || 0).div(100)).minus(new Decimal(result.targetMarginPct || 0).div(100))
    if (share.lte(0)) return null
    const price = new Decimal(result.productionCostPerM).plus(result.transportPerM || 0).div(share).toNumber()
    // The saved price was worked from the unrounded cost, so the rounding of the cost grows by the division.
    if (Math.abs(price - result.suggestedSellingPricePerM) > 0.005 / share.toNumber() + 0.005 + TOLERANCE) return null
    return {
        costPerM: result.productionCostPerM,
        transportPerM: result.transportPerM > 0 ? result.transportPerM : null,
        commissionPct: result.commissionPct > 0 ? result.commissionPct : null,
        marginPct: result.targetMarginPct,
    }
}
