import { describe, expect, it } from 'vitest'
import {
  calcFullTotals,
  buildCostingResult,
  type EstimateState,
} from '../lib/estimator'
import {
  createCostingExportModel,
  buildCostingPrintHtml,
  CUSTOMER_QUOTATION_NOT_TAX_INVOICE_NOTICE,
} from '../lib/estimator-export'

function createCostingState(): EstimateState {
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
    commissionPct: 2.0,
    transportPerM: 1.0,
    profitPct: 10.0,
    orderQuantityM: 5000,
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

describe('LST-15 & LST-16: Document Privacy & GST Quotation Separation', () => {
  it('strictly excludes internal costing economics from Customer Quotation output', () => {
    const state = createCostingState()
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
      businessName: 'Shree Ram Weaving Mills',
      customerName: 'Mehta Textiles',
      validUntil: '2026-09-30',
      notes: 'Net 30 payment terms.',
      showGstNote: true,
    })

    // Assert customer quotation includes safe commercial items
    expect(customerHtml).toContain('Customer Quotation')
    expect(customerHtml).toContain('Quoted price')
    expect(customerHtml).toContain('Order quantity')
    expect(customerHtml).toContain('Net 30 payment terms.')
    expect(customerHtml).toContain(CUSTOMER_QUOTATION_NOT_TAX_INVOICE_NOTICE)

    // Strictly assert NO internal economics or formulas leak into Customer Quotation
    expect(customerHtml).not.toContain('Cost breakdown')
    expect(customerHtml).not.toContain('Base yarn calculation')
    expect(customerHtml).not.toContain('Break-even price')
    expect(customerHtml).not.toContain('Target margin')
    expect(customerHtml).not.toContain('Actual margin')
    expect(customerHtml).not.toContain('Expected profit')
    expect(customerHtml).not.toContain('Broker commission')
    expect(customerHtml).not.toContain('Factory expenses')
    expect(customerHtml).not.toContain('110/kg') // Raw yarn rate 1
    expect(customerHtml).not.toContain('115/kg') // Raw yarn rate 2
  })

  it('includes complete cost breakdowns and confidential notices in Internal Cost Sheet', () => {
    const state = createCostingState()
    const totals = calcFullTotals(state)
    const result = buildCostingResult(state, totals)

    const model = createCostingExportModel({
      qualityLabel: '58" Poly Satin 75x80',
      state,
      totals,
      result,
    })

    const internalHtml = buildCostingPrintHtml(model, {
      mode: 'internal',
      businessName: 'Shree Ram Weaving Mills',
      customerName: '',
      validUntil: '',
      notes: 'Internal factory notes.',
      showGstNote: false,
    })

    // Assert internal sheet includes full details
    expect(internalHtml).toContain('Internal Cost Sheet')
    expect(internalHtml).toContain('Production cost')
    expect(internalHtml).toContain('Suggested selling price')
    expect(internalHtml).toContain('Break-even price')
    expect(internalHtml).toContain('Actual margin')
    expect(internalHtml).toContain('Expected profit')
    expect(internalHtml).toContain('Cost breakdown')
    expect(internalHtml).toContain('Base yarn calculation')
    expect(internalHtml).toContain('Commercial assumptions')
    expect(internalHtml).toContain('Broker commission')
  })
})
