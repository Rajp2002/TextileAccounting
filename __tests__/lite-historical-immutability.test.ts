import { describe, expect, it } from 'vitest'
import {
  calcFullTotals,
  buildCostingResult,
  COSTING_CALCULATION_VERSION,
  COSTING_ROUNDING_POLICY,
  type EstimateState,
} from '../lib/estimator'
import {
  buildCostingInputFingerprint,
  summarizeCostingInputChanges,
} from '../lib/costing-save-trust'
import {
  auditHistoricalCosting,
} from '../lib/costing-reconciliation'

function createVersionAState(): EstimateState {
  return {
    warpRows: [
      {
        id: 'warp-1',
        label: '75D Roto Semi Dull',
        calculationMode: 'formula',
        calcDenier: 75,
        cottonCountNe: 0,
        beamEnds: 4800,
        shortagePct: 3,
        yarnRate: 110,
        gstPct: 12,
        manualKgPer100m: 0,
      },
    ],
    weftRows: [
      {
        id: 'weft-1',
        label: '80D Bright',
        calculationMode: 'formula',
        calcDenier: 80,
        cottonCountNe: 0,
        picks: 64,
        effectiveCostingWidthCm: 147.32,
        reedSpace: 58,
        shortagePct: 4,
        yarnRate: 115,
        gstPct: 12,
        manualKgPer100m: 0,
      },
    ],
    tapeLengthM: 100,
    perPickCostPaisa: 0.28,
    warpingRatePerKg: 2.5,
    sizingRatePerKg: 4.0,
    windingRatePerKg: 1.2,
    processingRatePerM: 3.5,
    finishingRatePerM: 1.8,
    yarnShortagePct: 3,
    warpCrimpPct: 5,
    overheadItems: [
      { id: '1', label: 'Power', monthlyAmount: 45000, category: 'electricity', isPreset: false, isLocked: false, source: 'manual' },
      { id: '2', label: 'Rent', monthlyAmount: 30000, category: 'rent', isPreset: false, isLocked: false, source: 'manual' },
    ],
    monthlyOutputM: 50000,
    overheadOverridePerM: 2.5,
    overheadMode: 'direct',
    overheadPct: 0,
    isConfigured: true,
    loomRpmIsCustomised: false,
    loomPowerKwIsCustomised: false,
    loomCount: 12,
    avgOutputPerLoomPerDay: 150,
    monthlyWorkingDays: 26,
    loomType: 'water_jet',
    loomRpm: 650,
    loomPowerKw: 3.7,
    hoursPerShift: 12,
    sizingMode: 'in_house',
    commissionPct: 1.5,
    transportPerM: 0.8,
    profitPct: 8.0,
    orderQuantityM: 10000,
    enabledSections: {
      winding: true,
      processing: true,
      finishing: true,
      commission: true,
      transport: true,
    },
    outputSuggestion: undefined,
  }
}

describe('LST-06 & P0 Invariant: Historical Costing Immutability', () => {
  it('strictly proves that changes to Rate Book and Factory Profile do not mutate historical versions', () => {
    // 1. Save costing version A
    const versionAState = createVersionAState()
    const versionATotals = calcFullTotals(versionAState)
    const versionAResult = buildCostingResult(versionAState, versionATotals)
    const versionAFingerprint = buildCostingInputFingerprint(versionAState)

    const historicalRecordA = {
      id: 'quote-uuid-1',
      org_id: 'org-weavly-alpha',
      version_number: 1,
      quality_label: '58" Poly Satin 75x80',
      estimate: JSON.parse(JSON.stringify(versionAState)), // immutable snapshot
      calculation_version: COSTING_CALCULATION_VERSION,
      rounding_policy: COSTING_ROUNDING_POLICY,
      production_cost_per_meter: versionAResult.productionCostPerM,
      overhead_per_meter: versionAResult.overheadPerM,
      commission_cost_per_meter: versionAResult.commissionPerM,
      break_even_price_per_meter: versionAResult.breakEvenPricePerM,
      expected_profit_per_meter: versionAResult.profitPerM,
      expected_profit_total: versionAResult.expectedProfitTotal,
      actual_margin_percent: versionAResult.actualMarginPct,
      landed_cost_per_meter: versionAResult.landedCostPerM,
      quote_price_per_meter: versionAResult.suggestedSellingPricePerM,
      intended_margin_percent: versionAResult.targetMarginPct,
      costing_result_snapshot: versionAResult,
      fingerprint: versionAFingerprint,
      created_at: '2026-08-01T10:00:00.000Z',
      updated_at: '2026-08-01T10:00:00.000Z',
    }

    // 2. Change Rate Book yarn rates in the factory
    const activeRateBook = {
      '75D Roto Semi Dull': 135, // Rate changed from 110 -> 135
      '80D Bright': 140,         // Rate changed from 115 -> 140
    }

    // 3. Change Factory Profile defaults
    const activeFactoryDefaults = {
      overheadOverridePerM: 4.5, // Changed from 2.5 -> 4.5
      perPickCostPaisa: 0.35,    // Changed from 0.28 -> 0.35
    }

    // 4. Reopen Version A
    const reopenedStateA: EstimateState = JSON.parse(JSON.stringify(historicalRecordA.estimate))
    const reopenedTotalsA = calcFullTotals(reopenedStateA)
    const reopenedResultA = buildCostingResult(reopenedStateA, reopenedTotalsA)
    const reopenedFingerprintA = buildCostingInputFingerprint(reopenedStateA)

    // 5. Verify EVERY historical persisted costing value remains unchanged
    expect(reopenedStateA.warpRows[0].yarnRate).toBe(110)
    expect(reopenedStateA.weftRows[0].yarnRate).toBe(115)
    expect(reopenedStateA.overheadOverridePerM).toBe(2.5)
    expect(reopenedStateA.perPickCostPaisa).toBe(0.28)
    expect(reopenedResultA.productionCostPerM).toBe(historicalRecordA.production_cost_per_meter)
    expect(reopenedResultA.suggestedSellingPricePerM).toBe(historicalRecordA.quote_price_per_meter)
    expect(reopenedFingerprintA).toBe(historicalRecordA.fingerprint)

    // Verify reconciliation audit confirms perfect match
    const auditReportA = auditHistoricalCosting(historicalRecordA)
    expect(auditReportA.status).toBe('verified')

    // 6. Deliberately apply new current rates for version B
    const versionBState: EstimateState = {
      ...reopenedStateA,
      warpRows: [
        {
          ...reopenedStateA.warpRows[0],
          yarnRate: activeRateBook['75D Roto Semi Dull'],
        },
      ],
      weftRows: [
        {
          ...reopenedStateA.weftRows[0],
          yarnRate: activeRateBook['80D Bright'],
        },
      ],
    }

    // 7. Save as version B
    const versionBTotals = calcFullTotals(versionBState)
    const versionBResult = buildCostingResult(versionBState, versionBTotals)
    const versionBFingerprint = buildCostingInputFingerprint(versionBState)

    const historicalRecordB = {
      id: 'quote-uuid-2',
      org_id: 'org-weavly-alpha',
      source_quote_id: historicalRecordA.id,
      version_number: historicalRecordA.version_number + 1,
      quality_label: historicalRecordA.quality_label,
      estimate: JSON.parse(JSON.stringify(versionBState)),
      calculation_version: COSTING_CALCULATION_VERSION,
      rounding_policy: COSTING_ROUNDING_POLICY,
      production_cost_per_meter: versionBResult.productionCostPerM,
      overhead_per_meter: versionBResult.overheadPerM,
      commission_cost_per_meter: versionBResult.commissionPerM,
      break_even_price_per_meter: versionBResult.breakEvenPricePerM,
      expected_profit_per_meter: versionBResult.profitPerM,
      expected_profit_total: versionBResult.expectedProfitTotal,
      actual_margin_percent: versionBResult.actualMarginPct,
      landed_cost_per_meter: versionBResult.landedCostPerM,
      quote_price_per_meter: versionBResult.suggestedSellingPricePerM,
      intended_margin_percent: versionBResult.targetMarginPct,
      costing_result_snapshot: versionBResult,
      fingerprint: versionBFingerprint,
      created_at: '2026-08-31T12:00:00.000Z',
      updated_at: '2026-08-31T12:00:00.000Z',
    }

    // 8. Verify version A remains completely unchanged
    expect(historicalRecordA.version_number).toBe(1)
    expect(historicalRecordA.estimate.warpRows[0].yarnRate).toBe(110)
    expect(historicalRecordA.production_cost_per_meter).toBe(versionAResult.productionCostPerM)
    expect(historicalRecordA.fingerprint).toBe(versionAFingerprint)

    // 9. Verify version B has distinct provenance, higher costs, and distinct version identity
    expect(historicalRecordB.version_number).toBe(2)
    expect(historicalRecordB.source_quote_id).toBe(historicalRecordA.id)
    expect(historicalRecordB.estimate.warpRows[0].yarnRate).toBe(135)
    expect(historicalRecordB.production_cost_per_meter).toBeGreaterThan(historicalRecordA.production_cost_per_meter)
    expect(historicalRecordB.fingerprint).not.toBe(historicalRecordA.fingerprint)

    const auditReportB = auditHistoricalCosting(historicalRecordB)
    expect(auditReportB.status).toBe('verified')

    const changesSummary = summarizeCostingInputChanges(versionAState, versionBState)
    expect(changesSummary).toContain('rate')
  })
})
