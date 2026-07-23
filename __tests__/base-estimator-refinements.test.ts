import { describe, expect, it } from 'vitest'
import { calcFullTotals, makeDefaultEstimateState } from '../lib/estimator'
import {
  buildCostingPrintHtml,
  calculateBreakEvenPricePerM,
  createCostingExportModel,
  extractStyledCostingBody,
} from '../lib/estimator-export'
import {
  compareSavedCostings,
  filterAndSortSavedCostings,
  getCostingVersionMovement,
  getPreviousCostingVersion,
} from '../lib/saved-costings'

const saved = [
  {
    id: 'older', party_name: 'Alpha', quality_label: 'Canvas', quote_price_per_meter: 70,
    landed_cost_per_meter: 50, intended_margin_percent: 18, meters: 1000,
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'newer', party_name: 'Beta', quality_label: 'Georgette', quote_price_per_meter: 45,
    landed_cost_per_meter: 42, intended_margin_percent: 6, meters: 5000,
    created_at: '2026-02-01T00:00:00.000Z', updated_at: '2026-02-03T00:00:00.000Z',
  },
]

describe('Base Saved Costings discovery', () => {
  it('searches labels and sorts deterministically', () => {
    expect(filterAndSortSavedCostings(saved, { query: 'canvas', sort: 'recent', margin: 'all' }).map(item => item.id)).toEqual(['older'])
    expect(filterAndSortSavedCostings(saved, { query: '', sort: 'recent', margin: 'all' }).map(item => item.id)).toEqual(['newer', 'older'])
    expect(filterAndSortSavedCostings(saved, { query: '', sort: 'margin_desc', margin: 'all' }).map(item => item.id)).toEqual(['older', 'newer'])
  })

  it('filters margin bands and compares two immutable snapshots', () => {
    expect(filterAndSortSavedCostings(saved, { query: '', sort: 'recent', margin: 'under_10' }).map(item => item.id)).toEqual(['newer'])
    expect(compareSavedCostings(saved[0], saved[1])).toEqual({
      productionCostDelta: -8,
      sellingPriceDelta: -25,
      marginDelta: -12,
      quantityDelta: 4000,
    })
  })

  it('shows movement only against the previous version in the same costing group', () => {
    const versions = [
      { ...saved[0], id: 'v1', costing_group_id: 'group-a', version_number: 1, landed_cost_per_meter: 50 },
      { ...saved[0], id: 'v2', costing_group_id: 'group-a', version_number: 2, landed_cost_per_meter: 52.25 },
      { ...saved[1], id: 'other', costing_group_id: 'group-b', version_number: 1, landed_cost_per_meter: 10 },
    ]
    const previous = getPreviousCostingVersion(versions[1], versions)
    expect(previous?.id).toBe('v1')
    expect(getCostingVersionMovement(versions[1], previous)).toBe(2.25)
    expect(getPreviousCostingVersion(versions[0], versions)).toBeNull()
  })
})

describe('Base costing exports', () => {
  const state = makeDefaultEstimateState()
  state.warpRows = [{ ...state.warpRows[0], label: 'Warp Main', calcDenier: 75, beamEnds: 3200, yarnRate: 110, gstPct: 5 }]
  state.weftRows = [{ ...state.weftRows[0], label: 'Weft Main', picks: 68, reedSpace: 110, calcDenier: 75, yarnRate: 110, gstPct: 5 }]
  state.tapeLengthM = 1000
  state.perPickCostPaisa = 0.08
  state.overheadOverridePerM = 3
  state.monthlyOutputM = 10000
  state.loomType = 'water_jet'
  state.loomRpm = 700
  state.loomPowerKw = 2.5
  state.profitPct = 12
  state.orderQuantityM = 1000
  const totals = calcFullTotals(state)
  const model = createCostingExportModel({ qualityLabel: 'Test Quality', state, totals })

  it('calculates a commission-aware break-even price', () => {
    expect(calculateBreakEvenPricePerM(100, 5, 5)).toBeCloseTo(110.5263, 4)
  })

  it('keeps internal economics out of customer quotation output', () => {
    const internal = buildCostingPrintHtml(model, {
      mode: 'internal', businessName: 'Acme Weaves', customerName: '', validUntil: '', notes: '', showGstNote: false,
    })
    const customer = buildCostingPrintHtml(model, {
      mode: 'customer', businessName: 'Acme Weaves', customerName: 'Buyer', validUntil: '2026-08-01', notes: '', showGstNote: true,
    })

    expect(internal).toContain('Production cost')
    expect(internal).toContain('Margin')
    expect(customer).toContain('Customer Quotation')
    expect(customer).toContain('Quoted price')
    expect(customer).not.toContain('Production cost')
    expect(customer).not.toContain('Expected profit')
    expect(customer).not.toContain('>Margin<')
  })

  it('preserves print styling in the jsPDF body', () => {
    const html = buildCostingPrintHtml(model, {
      mode: 'internal', businessName: 'Acme Weaves', customerName: '', validUntil: '', notes: '', showGstNote: false,
    })
    const pdfBody = extractStyledCostingBody(html)

    expect(pdfBody).toContain('<style>')
    expect(pdfBody).toContain('.summary{display:grid')
    expect(pdfBody).toContain('class="costing-pdf-root"')
    expect(pdfBody).toContain('class="brandbar"')
    expect(pdfBody).not.toContain('<head>')
  })

  it('renders structured cost and yarn tables with PDF-safe currency text', () => {
    const html = buildCostingPrintHtml(model, {
      mode: 'internal', businessName: 'Acme Weaves', customerName: '', validUntil: '', notes: '', showGstNote: false,
    })

    expect(html).toContain('<th>Cost component</th>')
    expect(html).toContain('<th>Yarn / layer</th>')
    expect(html).toContain('Rs ')
    expect(html).not.toContain('₹')
  })
})
