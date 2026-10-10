import Decimal from 'decimal.js'

/**
 * Grey fabric weight from the yarn the costing already calculates.
 *
 * Weight is what is in the cloth: each warp's base weight with its crimp
 * (take-up puts that extra yarn into every metre of cloth), plus each weft's
 * base weight. Waste is yarn lost before weaving, so it is left out.
 */
export interface FabricWeightInput {
    warpRows: ReadonlyArray<{ baseKgPer100mUsed: number; crimpPct: number }>
    weftRows: ReadonlyArray<{ baseKgPer100mUsed: number; effectiveCostingWidthInches: number }>
}

export interface FabricWeight {
    /** Grams per running metre (GLM). */
    gramsPerMetre: number
    /** Grams per square metre over the finished width; null when no width is known. */
    gsm: number | null
}

const INCH_TO_M = new Decimal('0.0254')

const finitePositive = (value: number) => Number.isFinite(value) && value > 0

export function calcFabricWeight({ warpRows, weftRows }: FabricWeightInput): FabricWeight | null {
    let kgPer100m = new Decimal(0)
    for (const row of warpRows) {
        if (!finitePositive(row.baseKgPer100mUsed)) continue
        const crimp = Number.isFinite(row.crimpPct) && row.crimpPct > 0 ? row.crimpPct : 0
        kgPer100m = kgPer100m.plus(new Decimal(row.baseKgPer100mUsed).times(new Decimal(1).plus(new Decimal(crimp).div(100))))
    }
    for (const row of weftRows) {
        if (!finitePositive(row.baseKgPer100mUsed)) continue
        kgPer100m = kgPer100m.plus(row.baseKgPer100mUsed)
    }
    if (kgPer100m.lte(0)) return null

    // kg per 100 m × 1000 g/kg ÷ 100 m = g per metre.
    const gramsPerMetre = kgPer100m.times(10)
    const widthInches = Math.max(0, ...weftRows.map(row => (Number.isFinite(row.effectiveCostingWidthInches) ? row.effectiveCostingWidthInches : 0)))
    const gsm = widthInches > 0 ? gramsPerMetre.div(INCH_TO_M.times(widthInches)) : null

    return {
        gramsPerMetre: gramsPerMetre.toDecimalPlaces(1).toNumber(),
        gsm: gsm ? gsm.toDecimalPlaces(1).toNumber() : null,
    }
}
