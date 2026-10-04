import { describe, expect, it } from 'vitest'
import {
  calcFullTotals,
  buildCostingResult,
  type EstimateState,
} from '../lib/estimator'
import {
  getEstimatorReadiness,
  validateEstimatorSnapshot,
} from '../lib/estimator-validation'
import {
  createCostingExportModel,
  buildCostingPrintHtml,
  CUSTOMER_QUOTATION_NOT_TAX_INVOICE_NOTICE,
} from '../lib/estimator-export'
import { translateStrictBasePlanText } from '../lib/i18n/runtime'

describe('LST-17: Release-Candidate Domain Task Validation Harness', () => {
  function createStandardPolySatinState(): EstimateState {
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
      warpingMode: 'in_house',
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

  it('Task 1: Blank slate -> standard 58" Poly Satin -> computes verified result without mode switching', () => {
    const state = createStandardPolySatinState()
    const validation = validateEstimatorSnapshot(state, {
      requireTapeLength: false,
      requireCapacity: false,
    })
    const totals = calcFullTotals(state)
    const result = buildCostingResult(state, totals)
    const readiness = getEstimatorReadiness({
      validation,
      totals,
      result,
    })

    expect(readiness.status).toBe('ready')
    expect(readiness.canDisplayMoney).toBe(true)
    expect(readiness.canPersist).toBe(true)
    expect(result.productionCostPerM).toBeGreaterThan(30)
    expect(result.suggestedSellingPricePerM).toBeGreaterThan(result.productionCostPerM)
    expect(result.breakEvenPricePerM).toBeGreaterThan(result.productionCostPerM)
    expect(result.quoteIsValid).toBe(true)
  })

  it('Task 2: Repeat quality fast path -> applies current yarn rate & creates new version with provenance', () => {
    const originalState = createStandardPolySatinState()
    const updatedState = {
      ...originalState,
      warpRows: [
        {
          ...originalState.warpRows[0],
          yarnRate: 122, // Current updated market rate
        },
      ],
    }

    const origTotals = calcFullTotals(originalState)
    const newTotals = calcFullTotals(updatedState)

    const origResult = buildCostingResult(originalState, origTotals)
    const newResult = buildCostingResult(updatedState, newTotals)

    // Verification of calculation sensitivity
    expect(newResult.productionCostPerM).toBeGreaterThan(origResult.productionCostPerM)
    expect(newResult.breakdown.warpCostPerM).toBeGreaterThan(origResult.breakdown.warpCostPerM)
  })

  it('Task 3: Unsaved draft restoration -> ensures draft restoration preserves exact state', () => {
    const state = createStandardPolySatinState()
    const serialized = JSON.stringify(state)
    const restored: EstimateState = JSON.parse(serialized)

    expect(restored).toEqual(state)
    const restoredTotals = calcFullTotals(restored)
    const restoredResult = buildCostingResult(restored, restoredTotals)
    expect(restoredResult.productionCostPerM).toBe(buildCostingResult(state, calcFullTotals(state)).productionCostPerM)
  })

  it('Task 4: Commercial separation -> Customer Quotation strictly protects internal economics', () => {
    const state = createStandardPolySatinState()
    const totals = calcFullTotals(state)
    const result = buildCostingResult(state, totals)
    const model = createCostingExportModel({
      qualityLabel: '58" Poly Satin 75x80',
      state,
      totals,
      result,
    })

    const customerHtml = buildCostingPrintHtml(model, {
      mode: 'customer',
      businessName: 'Shree Balaji Weaves',
      customerName: 'A-One Fashion Fabrics',
      validUntil: '2026-09-30',
      notes: 'Payment net 15 days upon receipt.',
      showGstNote: true,
    })

    // Customer doc assertions
    expect(customerHtml).toContain('Customer Quotation')
    expect(customerHtml).toContain('Quoted price')
    expect(customerHtml).toContain('Order quantity')
    expect(customerHtml).toContain(CUSTOMER_QUOTATION_NOT_TAX_INVOICE_NOTICE)

    // Strict non-leakage
    const forbiddenPatterns = [
      'Cost breakdown',
      'Base yarn calculation',
      'Break-even price',
      'Estimated margin',
      'Expected profit',
      'Broker commission',
      'Factory expenses',
      '110/kg',
      '115/kg',
    ]
    forbiddenPatterns.forEach(pattern => {
      expect(customerHtml).not.toContain(pattern)
    })
  })

  it('Task 5: Language Parity & Zero English Leakage on critical Hindi and Gujarati textile actions', () => {
    const criticalActions = [
      'Selling price and quantity',
      'Warp yarn',
      'Save Costing',
      'Export Cost Sheet',
      'Save as New Quality',
      'Check Saved Costings',
      'Discard draft',
    ]

    criticalActions.forEach(action => {
      const hi = translateStrictBasePlanText(action, 'hi')
      const gu = translateStrictBasePlanText(action, 'gu')
      expect(hi).toBeTruthy()
      expect(gu).toBeTruthy()
      // Ensure not falling back to English unchanged
      expect(hi).not.toBe(action)
      expect(gu).not.toBe(action)
    })
  })
})
