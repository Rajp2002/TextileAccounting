import {
  calcFullTotals,
  buildCostingResult,
  type EstimateState,
} from '../../lib/estimator'
import {
  validateEstimatorSnapshot,
  getEstimatorReadiness,
} from '../../lib/estimator-validation'
import {
  createCostingExportModel,
  buildCostingPrintHtml,
} from '../../lib/estimator-export'
import {
  buildCostingInputFingerprint,
  summarizeCostingInputChanges,
} from '../../lib/costing-save-trust'
import {
  auditHistoricalCosting,
} from '../../lib/costing-reconciliation'
import { performance } from 'perf_hooks'

function createSampleState(): EstimateState {
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

function runBenchmark() {
  const state = createSampleState()
  const iterations = 5000

  // 1. Calculation & Result Pipeline
  const startCalc = performance.now()
  let totals = calcFullTotals(state)
  let result = buildCostingResult(state, totals)
  for (let i = 0; i < iterations; i++) {
    totals = calcFullTotals(state)
    result = buildCostingResult(state, totals)
  }
  const endCalc = performance.now()
  const avgCalcMs = (endCalc - startCalc) / iterations

  // 2. Validation & Readiness State Machine
  const startReadiness = performance.now()
  for (let i = 0; i < iterations; i++) {
    const val = validateEstimatorSnapshot(state, { requireTapeLength: false, requireCapacity: false })
    getEstimatorReadiness({ validation: val, totals, result })
  }
  const endReadiness = performance.now()
  const avgReadinessMs = (endReadiness - startReadiness) / iterations

  // 3. Quick <-> Detailed Mode Switch Simulation
  const startModeSwitch = performance.now()
  for (let i = 0; i < iterations; i++) {
    // Quick -> Detailed
    const detailedState = { ...state }
    calcFullTotals(detailedState)
    // Detailed -> Quick
    const quickState = { ...detailedState }
    calcFullTotals(quickState)
  }
  const endModeSwitch = performance.now()
  const avgModeSwitchMs = (endModeSwitch - startModeSwitch) / iterations

  // 4. Saved-Quality Hydration & Rate Application
  const startHydration = performance.now()
  for (let i = 0; i < iterations; i++) {
    const updated = {
      ...state,
      warpRows: [{ ...state.warpRows[0], yarnRate: 120 + (i % 10) }],
    }
    buildCostingInputFingerprint(updated)
    summarizeCostingInputChanges(state, updated)
  }
  const endHydration = performance.now()
  const avgHydrationMs = (endHydration - startHydration) / iterations

  // 5. Export Model & HTML Preview Generation
  const startExport = performance.now()
  const exportIterations = 500
  for (let i = 0; i < exportIterations; i++) {
    const model = createCostingExportModel({
      qualityLabel: '58" Poly Satin 75x80',
      state,
      totals,
      result,
    })
    buildCostingPrintHtml(model, {
      mode: 'customer',
      businessName: 'Shree Ram Weaves',
      customerName: 'Mehta Textiles',
      validUntil: '2026-09-30',
      notes: 'Net 30',
      showGstNote: true,
    })
  }
  const endExport = performance.now()
  const avgExportMs = (endExport - startExport) / exportIterations

  // 6. Historical Costing Audit Reconciliation
  const startAudit = performance.now()
  for (let i = 0; i < iterations; i++) {
    auditHistoricalCosting({
      id: 'quote-1',
      org_id: 'org-1',
      costing_result_snapshot: result,
      production_cost_per_meter: result.productionCostPerM,
      overhead_per_meter: result.overheadPerM,
      commission_cost_per_meter: result.commissionPerM,
      break_even_price_per_meter: result.breakEvenPricePerM,
      expected_profit_per_meter: result.profitPerM,
      expected_profit_total: result.expectedProfitTotal,
      actual_margin_percent: result.actualMarginPct,
      landed_cost_per_meter: result.landedCostPerM,
      quote_price_per_meter: result.suggestedSellingPricePerM,
      intended_margin_percent: result.targetMarginPct,
      calculation_version: 'estimator_v3_2026_08',
      rounding_policy: 'INR_HALF_UP_2',
    })
  }
  const endAudit = performance.now()
  const avgAuditMs = (endAudit - startAudit) / iterations

  console.log(JSON.stringify({
    calculationAvgMs: avgCalcMs,
    readinessAvgMs: avgReadinessMs,
    modeSwitchAvgMs: avgModeSwitchMs,
    hydrationAvgMs: avgHydrationMs,
    exportGenerationAvgMs: avgExportMs,
    auditReconciliationAvgMs: avgAuditMs,
  }, null, 2))
}

runBenchmark()
