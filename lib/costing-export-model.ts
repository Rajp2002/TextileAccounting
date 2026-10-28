import {
  buildCostingResult,
  calculateBreakEvenPricePerM,
  normalizeCurrencySnapshot,
  type CostingResultSnapshot,
  type EstimateState,
  type EstimatorV3Totals,
} from './estimator'

/*
 * The numbers a costing document is built from. Pages build this model while
 * the owner works; the print/PDF renderer in estimator-export.ts (with its
 * embedded logo and every language's labels) loads only with the export
 * dialog, so it is kept out of this module.
 */

export type CostingExportModel = {
  qualityLabel: string
  createdAt: string
  quantityM: number
  productionCostPerM: number
  suggestedSellingPricePerM: number
  breakEvenPricePerM: number
  landedCostPerM: number
  marginPct: number
  expectedProfit: number | null
  expectedProfitPerM: number
  result: CostingResultSnapshot
  reconciliationStatus: string
  state: EstimateState
  totals: EstimatorV3Totals
}

function finiteNumber(value: unknown) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

export function createCostingExportModel(input: {
  qualityLabel: string
  createdAt?: string
  state: EstimateState
  totals: EstimatorV3Totals
  result?: CostingResultSnapshot
  reconciliationStatus?: string
  suggestedSellingPricePerM?: number
  landedCostPerM?: number
  marginPct?: number
}): CostingExportModel {
  const calculatedResult = input.result ?? buildCostingResult(input.state, input.totals)
  const hasExplicitLegacyOverrides = input.result == null && (
    input.suggestedSellingPricePerM !== undefined
    || input.landedCostPerM !== undefined
    || input.marginPct !== undefined
  )
  const result = hasExplicitLegacyOverrides
    ? (() => {
        const suggestedSellingPricePerM = normalizeCurrencySnapshot(
          finiteNumber(input.suggestedSellingPricePerM) ?? calculatedResult.suggestedSellingPricePerM,
        )
        const landedCostPerM = normalizeCurrencySnapshot(
          finiteNumber(input.landedCostPerM) ?? calculatedResult.landedCostPerM,
        )
        const profitPerM = normalizeCurrencySnapshot(suggestedSellingPricePerM - landedCostPerM)
        const commissionPerM = normalizeCurrencySnapshot(
          landedCostPerM - calculatedResult.productionCostPerM - calculatedResult.transportPerM,
        )
        const commissionPct = suggestedSellingPricePerM > 0
          ? normalizeCurrencySnapshot(commissionPerM / suggestedSellingPricePerM * 100)
          : calculatedResult.commissionPct
        const quantityM = calculatedResult.quantityM
        const totalOrderValue = quantityM == null ? null : normalizeCurrencySnapshot(suggestedSellingPricePerM * quantityM)
        const totalLandedCost = quantityM == null ? null : normalizeCurrencySnapshot(landedCostPerM * quantityM)
        return {
          ...calculatedResult,
          suggestedSellingPricePerM,
          commissionPct,
          commissionPerM,
          landedCostPerM,
          breakEvenPricePerM: normalizeCurrencySnapshot(calculateBreakEvenPricePerM(
            calculatedResult.productionCostPerM,
            calculatedResult.transportPerM,
            commissionPct,
          )),
          profitPerM,
          totalOrderValue,
          totalLandedCost,
          expectedProfitTotal: totalOrderValue == null || totalLandedCost == null
            ? null
            : normalizeCurrencySnapshot(totalOrderValue - totalLandedCost),
          targetMarginPct: finiteNumber(input.marginPct) ?? calculatedResult.targetMarginPct,
          actualMarginPct: finiteNumber(input.marginPct) ?? calculatedResult.actualMarginPct,
        }
      })()
    : calculatedResult
  const quantityM = result.quantityM == null ? 0 : result.quantityM
  return {
    qualityLabel: input.qualityLabel.trim() || 'Untitled Costing',
    createdAt: input.createdAt ?? new Date().toISOString(),
    quantityM,
    productionCostPerM: result.productionCostPerM,
    suggestedSellingPricePerM: result.suggestedSellingPricePerM,
    breakEvenPricePerM: result.breakEvenPricePerM,
    landedCostPerM: result.landedCostPerM,
    marginPct: result.actualMarginPct,
    expectedProfit: result.expectedProfitTotal,
    expectedProfitPerM: result.profitPerM,
    result,
    reconciliationStatus: input.reconciliationStatus ?? 'verified',
    state: input.state,
    totals: input.totals,
  }
}

/**
 * A short reference people can read out over the phone, for records that only
 * have a UUID (Free costings). The full id stays out of the document and the
 * filename: `ec4e031d-69a8-…` becomes `WV-EC4E031D`.
 */
export function shortDocumentReference(id: string | null | undefined, prefix = 'WV') {
  const compact = (id ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()
  return compact ? `${prefix}-${compact}` : ''
}
