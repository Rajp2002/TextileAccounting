/**
 * Example quality, inputs and formatters for the landing page's cost sheet.
 * Kept free of the costing engine so client components can use them without
 * shipping lib/estimator.ts before a visitor interacts (see sample-costing.ts).
 */
export const SAMPLE_QUALITY = {
    name: 'Example polyester grey',
    warp: { denier: 75, ends: 5200, ratePerKg: 118 },
    weft: { denier: 100, widthCm: 140 },
    gstPct: 5,
    wastePct: 2,
    crimpPct: 6,
    overheadPerM: 1.5,
    commissionPct: 2,
    transportPerM: 0.25,
    orderQuantityM: 50_000,
} as const

export type SampleInputs = {
    weftRatePerKg: number
    picksPerInch: number
    paisePerPick: number
    marginPct: number
}

export const SAMPLE_START: SampleInputs = {
    weftRatePerKg: 112,
    picksPerInch: 64,
    paisePerPick: 14,
    marginPct: 8,
}

export type SampleResult = {
    warpYarnPerM: number
    weftYarnPerM: number
    weavingPerM: number
    overheadPerM: number
    productionCostPerM: number
    breakEvenPricePerM: number
    suggestedPricePerM: number
    marginPct: number
    orderProfit: number | null
    quoteIsValid: boolean
}

const rupee = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const rupeeWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const grouped = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export const formatRupees = (value: number) => rupee.format(value)
export const formatRupeesWhole = (value: number) => rupeeWhole.format(Math.round(value))
export const formatCount = (value: number) => grouped.format(value)
