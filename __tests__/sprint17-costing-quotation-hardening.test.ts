import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildCostingResult,
  calcFullTotals,
  makeDefaultEstimateState,
  type EstimateState,
} from '../lib/estimator'
import { parseEstimatorDraft } from '../lib/estimator-drafts'
import { buildCostingPrintHtml, createCostingExportModel } from '../lib/estimator-export'
import { buildCostingInputFingerprint, summarizeCostingInputChanges } from '../lib/costing-save-trust'
import { compareSavedCostingSnapshots } from '../lib/saved-costings'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

function scenario(overrides: Partial<EstimateState> = {}) {
  const base = makeDefaultEstimateState()
  return {
    ...base,
    overheadMode: 'direct',
    overheadOverridePerM: 3,
    yarnShortagePct: 4,
    warpCrimpPct: 6,
    commissionPct: 2,
    transportPerM: 0.5,
    profitPct: 12,
    orderQuantityM: 1_000,
    ...overrides,
    warpRows: [{
      ...base.warpRows[0],
      label: 'Main warp',
      calcDenier: 75,
      beamEnds: 3_200,
      yarnRate: 110,
      gstPct: 5,
      shortagePct: null,
      ...overrides.warpRows?.[0],
    }],
    weftRows: [{
      ...base.weftRows[0],
      label: 'Main weft',
      calcDenier: 75,
      picks: 68,
      reedSpace: 110,
      effectiveCostingWidthCm: 110,
      yarnRate: 112,
      gstPct: 5,
      shortagePct: null,
      ...overrides.weftRows?.[0],
    }],
    enabledSections: {
      ...base.enabledSections,
      commission: true,
      transport: true,
      ...(overrides.enabledSections ?? {}),
    },
  } satisfies EstimateState
}

function savedSnapshot(id: string, state: EstimateState) {
  const result = buildCostingResult(state, calcFullTotals(state))
  return {
    id,
    party_name: 'Rajesh Textiles',
    quality_label: 'D.NO:246N',
    quote_price_per_meter: result.suggestedSellingPricePerM,
    landed_cost_per_meter: result.landedCostPerM,
    intended_margin_percent: result.targetMarginPct,
    meters: result.quantityM ?? 0,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    costing_group_id: 'group-246n',
    version_number: id === 'left' ? 1 : 2,
    costing_result_snapshot: result,
    yarn_shortage_pct: state.yarnShortagePct,
    warp_crimp_pct: state.warpCrimpPct,
  }
}

describe('Sprint 17 costing and quotation hardening', () => {
  it('keeps the normal calculation explainable and independently reproducible', () => {
    const state = scenario()
    const totals = calcFullTotals(state)
    const result = buildCostingResult(state, totals)
    const warp = totals.warpRows[0]
    const weft = totals.weftRows[0]

    expect(warp.finalKgPer100m).toBeCloseTo(warp.baseKgPer100mUsed * 1.1, 10)
    expect(weft.finalKgPer100m).toBeCloseTo(weft.baseKgPer100mUsed * 1.04, 10)
    expect(result.suggestedSellingPricePerM).toBeCloseTo(
      (result.productionCostPerM + result.transportPerM)
        / (1 - result.commissionPct / 100 - result.targetMarginPct / 100),
      2,
    )
    expect(totals.audit.warp.layers[0].wastePctSource).toBe('default')
    expect(totals.audit.warp.layers[0].defaultWastePct).toBe(4)
  })

  it('uses New minus Old for a rate-change comparison, including width and commercial inputs', () => {
    const oldState = scenario()
    const newState = scenario({
      warpRows: [{ ...oldState.warpRows[0], yarnRate: 135 }],
      weftRows: [{ ...oldState.weftRows[0], effectiveCostingWidthCm: 116, reedSpace: 116, shortagePct: 0 }],
      commissionPct: 3.5,
      transportPerM: 0.9,
      profitPct: 14,
    })
    const comparison = compareSavedCostingSnapshots(savedSnapshot('left', oldState), savedSnapshot('right', newState))
    const oldResult = buildCostingResult(oldState, calcFullTotals(oldState))
    const newResult = buildCostingResult(newState, calcFullTotals(newState))

    expect(comparison.yarn.warp.ratePerKg.delta).toBe(25)
    expect(comparison.yarn.weft.wastePct.delta).toBe(-4)
    expect(comparison.yarn.weft.widthInches.delta).toBeCloseTo(6 / 2.54, 2)
    expect(comparison.commercial.commissionPct.delta).toBe(1.5)
    expect(comparison.commercial.transportPerM.delta).toBe(0.4)
    expect(comparison.margin.targetPct.delta).toBe(2)
    expect(comparison.price.sellingPricePerM.delta).toBeCloseTo(
      newResult.suggestedSellingPricePerM - oldResult.suggestedSellingPricePerM,
      2,
    )
  })

  it('keeps an explicit zero waste override visible in the formula audit', () => {
    const state = scenario({
      yarnShortagePct: 7,
      warpCrimpPct: 3,
      commissionPct: 9.5,
      transportPerM: 0,
      warpRows: [{ ...scenario().warpRows[0], shortagePct: 0 }],
      weftRows: [{ ...scenario().weftRows[0], shortagePct: 0 }],
    })
    const totals = calcFullTotals(state)

    expect(totals.warpRows[0].wastePct).toBe(0)
    expect(totals.weftRows[0].wastePct).toBe(0)
    expect(totals.warpRows[0].defaultWastePct).toBe(7)
    expect(totals.warpRows[0].wastePctSource).toBe('row_override')
    expect(totals.weftRows[0].wastePctSource).toBe('row_override')
    expect(totals.audit.warp.layers[0].totalAdjustmentPct).toBe(3)
    expect(totals.audit.weft.layers[0].totalAdjustmentPct).toBe(0)
  })

  it('does not create a duplicate-looking version for an ordinary repeat save', () => {
    const first = scenario()
    const reopened = structuredClone(first)
    reopened.warpRows[0].id = 'new-row-id'
    reopened.weftRows[0].id = 'new-weft-row-id'

    expect(buildCostingInputFingerprint(first)).toBe(buildCostingInputFingerprint(reopened))
    expect(summarizeCostingInputChanges(first, reopened)).toEqual([])
    expect(summarizeCostingInputChanges(first, { ...reopened, commissionPct: 3 })).toEqual(['commission'])
  })

  it('round-trips quotation status and source economics through a reopen draft', () => {
    const state = scenario()
    const draft = parseEstimatorDraft<EstimateState>(JSON.stringify({
      state,
      partyName: 'Rajesh Textiles',
      qualityLabel: 'D.NO:246N',
      warpInstruction: '',
      weftInstruction: '',
      savedAt: Date.now(),
      sourceQuoteId: 'quote-1',
      sourceQuoteStatus: 'sent',
      sourceState: state,
      sourceRecordKind: 'quotation',
    }))

    expect(draft?.sourceQuoteStatus).toBe('sent')
    expect(draft?.sourceState?.warpRows[0].yarnRate).toBe(110)
    expect(draft?.sourceRecordKind).toBe('quotation')
  })

  it('retires the quotation ledger and keeps archive/restore boundaries explicit', () => {
    const quotes = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')
    const migration = read('supabase/migrations/20260808121411_sprint17_quotation_ledger_hardening.sql')
    const hardeningMigration = read('supabase/migrations/20260808121531_harden_quotation_sent_stamp_search_path.sql')
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

    // Phase 3H: the quotation ledger and its status controls were retired.
    expect(quotes).not.toContain('Quotation ledger')
    expect(quotes).not.toContain('Mark Sent')
    expect(quotes).toContain('Restore snapshot')
    expect(quotes).toContain('New minus Old')
    expect(actions).not.toContain('Next allowed action:')
    expect(migration).toContain('sent_at')
    expect(migration).toContain('stamp_estimator_quote_sent_at')
    expect(hardeningMigration).toContain('SET search_path = pg_catalog, public')
    expect(estimator).toContain('Save quality/recipe:')
    expect(estimator).toContain('Save costing snapshot:')
    expect(estimator).toContain('Create new version:')
  })

  it('keeps internal economics out of the customer quotation in both UI and print output', () => {
    const state = scenario()
    const totals = calcFullTotals(state)
    const model = createCostingExportModel({
      qualityLabel: 'D.NO:246N',
      state,
      totals,
      result: buildCostingResult(state, totals),
    })
    const customer = buildCostingPrintHtml(model, {
      mode: 'customer',
      businessName: 'Rajesh Textiles',
      customerName: 'Mahavir Traders',
      validUntil: '2026-08-31',
      notes: '',
      showGstNote: true,
    })
    const internal = buildCostingPrintHtml(model, {
      mode: 'internal',
      businessName: 'Rajesh Textiles',
      customerName: 'Mahavir Traders',
      validUntil: '',
      notes: 'Internal review',
      showGstNote: false,
    })

    expect(customer).toContain('Customer Quotation')
    expect(customer).not.toContain('Commercial assumptions')
    expect(customer).not.toContain('Broker commission')
    expect(internal).toContain('Internal Cost Sheet')
    expect(internal).toContain('Commercial assumptions')
    expect(read('components/estimator/CostingExportDialog.tsx')).toContain('Internal Cost Estimate')
  })
})
