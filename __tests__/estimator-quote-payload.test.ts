import { describe, expect, it } from 'vitest'
import { buildCostingResult, calcFullTotals } from '@/lib/estimator'
import { buildEstimatorQuotePayload, type EstimatorQuotePayloadInput, toLegacyEstimatorQuotePayload } from '@/lib/estimator-quote-payload'
import { f1State } from './fixtures/costing-characterization'

// Package 2C: the estimator_quotes row for both live costing saves
// (saveEstimatorQuoteV3, saveAsFabricTemplate) comes from one builder.

function input(overrides: Partial<EstimatorQuotePayloadInput> = {}): EstimatorQuotePayloadInput {
    const estimate = overrides.estimate ?? f1State({ profitPct: 12 })
    return {
        orgId: 'org-1',
        recordKind: 'costing',
        partyName: 'Shah Textiles',
        qualityLabel: 'Poplin 60',
        templateId: null,
        warpInstruction: null,
        weftInstruction: null,
        estimate,
        result: buildCostingResult(estimate, calcFullTotals(estimate)),
        commercial: { commissionPct: 3, transportPerM: 0.5, orderQuantityM: 5000, profitPct: 12 },
        status: 'draft',
        clientRequestId: 'request-1',
        workerRatePerM: 9.6,
        costingInputFingerprint: 'fingerprint',
        factoryProfileUpdatedAt: null,
        reconciledAt: '2026-09-26T00:00:00.000Z',
        ...overrides,
    }
}

describe('estimator quote payload builder', () => {
    it('INVARIANT: result columns come from the result and recipe columns from the estimate', () => {
        const source = input()
        const payload = buildEstimatorQuotePayload(source)
        expect(payload).toMatchObject({
            production_cost_per_meter: source.result.productionCostPerM,
            quote_price_per_meter: source.result.suggestedSellingPricePerM,
            landed_cost_per_meter: source.result.landedCostPerM,
            intended_margin_percent: source.result.targetMarginPct,
            calculation_version: source.result.calculationVersion,
            reconciliation_status: 'verified',
            warp_rows: source.estimate.warpRows,
            weft_rows: source.estimate.weftRows,
            per_pick_cost_paise: source.estimate.perPickCostPaisa,
            worker_rate_per_m: 9.6,
        })
        expect(payload.costing_result_snapshot).toBe(source.result)
    })

    it('INVARIANT: commercial columns are exactly what the caller supplies; meters follows the quantity', () => {
        const payload = buildEstimatorQuotePayload(input({ commercial: { commissionPct: 1.25, transportPerM: 2, orderQuantityM: 750, profitPct: 14 } }))
        expect(payload).toMatchObject({ commission_pct: 1.25, transport_per_m: 2, order_quantity_m: 750, profit_margin_pct: 14, meters: 750 })
        const noQuantity = buildEstimatorQuotePayload(input({ commercial: { commissionPct: 3, transportPerM: 0.5, orderQuantityM: null, profitPct: 12 } }))
        expect(noQuantity).toMatchObject({ order_quantity_m: null, meters: 0 })
    })

    // LT01B (CS-2) deliberately replaced "override only in direct mode": the
    // engine applies a non-null override in monthly mode too, so the applied
    // value is stored with an explicit mode. The legacy payload keeps the old rule.
    it('INVARIANT: the applied overhead override is stored with its mode; the legacy percentage is always 0', () => {
        const monthly = buildEstimatorQuotePayload(input({ estimate: f1State({ overheadMode: 'monthly_expenses', overheadOverridePerM: 4 }) }))
        const direct = buildEstimatorQuotePayload(input({ estimate: f1State({ overheadMode: 'direct', overheadOverridePerM: 4 }) }))
        expect(monthly).toMatchObject({ overhead_override_per_m: 4, overhead_mode: 'monthly_expenses', overhead_pct: 0 })
        expect(direct).toMatchObject({ overhead_override_per_m: 4, overhead_mode: 'direct', overhead_pct: 0 })
        expect(toLegacyEstimatorQuotePayload(monthly)).toMatchObject({ overhead_override_per_m: null, overhead_pct: 0 })
        expect(toLegacyEstimatorQuotePayload(direct)).toMatchObject({ overhead_override_per_m: 4 })
        expect(toLegacyEstimatorQuotePayload(monthly)).not.toHaveProperty('overhead_mode')
        expect(toLegacyEstimatorQuotePayload(monthly)).not.toHaveProperty('warping_mode')
    })

    it('INVARIANT: record-kind columns are added without replacing the costing columns', () => {
        const payload = buildEstimatorQuotePayload(input({ recordKind: 'quotation', extra: { quotation_valid_until: '2026-10-31', customer_terms: 'Net 30' } }))
        expect(payload).toMatchObject({ record_kind: 'quotation', quotation_valid_until: '2026-10-31', customer_terms: 'Net 30', worker_rate_per_m: 9.6 })
    })

    it('CHARACTERIZATION: legacy flat columns fall back to 68 picks, 75 denier and a zero rate without rows', () => {
        const estimate = { ...f1State(), warpRows: [], weftRows: [] }
        const payload = buildEstimatorQuotePayload(input({ estimate, result: buildCostingResult(f1State(), calcFullTotals(f1State())) }))
        expect(payload).toMatchObject({ ppi: 68, yarn_denier: 75, yarn_rate_per_kg: 0 })
    })
})
