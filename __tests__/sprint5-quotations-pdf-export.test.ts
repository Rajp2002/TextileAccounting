import { describe, expect, it } from 'vitest'
import { calcFullTotals, makeDefaultEstimateState } from '../lib/estimator'
import {
  buildCostingPrintHtml,
  buildQuotationShareMessage,
  createCostingExportModel,
  getCostingExportFilename,
  validateCostingExportInput,
} from '../lib/estimator-export'

function makeModel(quantityM = 5000) {
  const state = makeDefaultEstimateState()
  state.warpRows = [{ ...state.warpRows[0], label: 'Warp Main', calcDenier: 75, beamEnds: 3200, yarnRate: 110 }]
  state.weftRows = [{ ...state.weftRows[0], label: 'Weft Main', picks: 68, reedSpace: 110, calcDenier: 75, yarnRate: 110 }]
  state.tapeLengthM = 1000
  state.perPickCostPaisa = 0.08
  state.overheadOverridePerM = 3
  state.monthlyOutputM = 10000
  state.orderQuantityM = quantityM
  state.profitPct = 10
  state.transportPerM = 2
  state.commissionPct = 2
  const totals = calcFullTotals(state)
  return createCostingExportModel({
    qualityLabel: 'Grey 75D / 68 Picks',
    createdAt: '2026-08-01T10:30:00.000Z',
    state,
    totals,
    suggestedSellingPricePerM: 42.44,
    landedCostPerM: 39.75,
    marginPct: 6.34,
  })
}

describe('Sprint 5 quotation and PDF output contract', () => {
  it('creates a recognizable, repeat-safe quotation filename', () => {
    const model = makeModel()
    const filename = getCostingExportFilename(model, {
      mode: 'customer',
      businessName: 'Patel Weaves',
      customerName: 'Mahavir Traders',
      validUntil: '2026-08-16',
      notes: '',
      showGstNote: true,
      documentReference: 'QT-2026-0042',
    })

    expect(filename).toBe('quotation-qt-2026-0042-mahavir-traders-grey-75d-68-picks-2026-08-01.pdf')
  })

  it('keeps a saved selling price and exposes a loss instead of clamping it to zero', () => {
    const model = createCostingExportModel({
      ...(() => {
        const state = makeDefaultEstimateState()
        const totals = calcFullTotals(state)
        return { qualityLabel: 'Loss Test', state, totals }
      })(),
      suggestedSellingPricePerM: 20,
      landedCostPerM: 25,
      marginPct: -25,
    })

    expect(model.suggestedSellingPricePerM).toBe(20)
    expect(model.landedCostPerM).toBe(25)
    expect(model.expectedProfitPerM).toBe(-5)
    expect(buildCostingPrintHtml(model, {
      mode: 'internal',
      businessName: 'Patel Weaves',
      customerName: '',
      validUntil: '',
      notes: '',
      showGstNote: false,
    })).toContain('Loss / m')
  })

  it('requires customer identity, quantity, and validity before creating a quotation', () => {
    const errors = validateCostingExportInput({ ...makeModel(), quantityM: 0 }, {
      mode: 'customer',
      businessName: 'Patel Weaves',
      customerName: '',
      validUntil: '',
      notes: '',
      showGstNote: true,
    })

    expect(errors).toEqual([
      'Enter the party or customer name before creating a quotation.',
      'Enter an order quantity before creating a Customer Quotation.',
      'Choose a valid quotation validity date.',
    ])
  })

  it('does not turn an unverified legacy snapshot into a customer quotation', () => {
    const legacyModel = { ...makeModel(), reconciliationStatus: 'legacy' }
    const customerErrors = validateCostingExportInput(legacyModel, {
      mode: 'customer',
      businessName: 'Patel Weaves',
      customerName: 'Mahavir Traders',
      validUntil: '2026-08-16',
      notes: '',
      showGstNote: true,
    })
    const internalErrors = validateCostingExportInput(legacyModel, {
      mode: 'internal',
      businessName: 'Patel Weaves',
      customerName: '',
      validUntil: '',
      notes: '',
      showGstNote: true,
    })

    expect(customerErrors).toContain('This saved costing needs owner review before it can be used as a customer quotation. Check the saved numbers or save a new current costing.')
    expect(internalErrors).not.toContain('This saved costing needs owner review before it can be used as a customer quotation. Check the saved numbers or save a new current costing.')
  })

  it('keeps internal economics out of the WhatsApp handoff message', () => {
    const model = makeModel()
    const message = buildQuotationShareMessage(model, {
      mode: 'customer',
      businessName: 'Patel Weaves',
      customerName: 'Mahavir Traders',
      validUntil: '2026-08-16',
      notes: '',
      showGstNote: true,
      documentReference: 'QT-2026-0042',
    })

    expect(message).toContain('Quotation QT-2026-0042')
    expect(message).toContain('Price: Rs 42.44/m')
    expect(message).not.toContain('Production cost')
    expect(message).not.toContain('Margin')
  })
})
