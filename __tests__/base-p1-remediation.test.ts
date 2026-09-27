import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { calcFullTotals, makeDefaultEstimateState } from '../lib/estimator'
import { buildCostingPrintHtml, createCostingExportModel } from '../lib/estimator-export'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Base P1 pilot remediation', () => {
  it('keeps Base costing quality-first without enabling production conversion', () => {
    const page = read('app/(dashboard)/owner/estimator/page.tsx')
    const client = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')
    // Phase 3H: no production or party-picker path remains in the estimator.
    // canUseProductionPipeline (the Base production link) is a different, live flag.
    expect(page).not.toMatch(/\bcanUseProduction\b/)
    expect(client).not.toMatch(/\bcanUseProduction\b/)
    expect(client).not.toContain('showPartyField')
    expect(actions).not.toContain('function getEstimatorPartyNames')
    expect(actions).not.toContain('function getLastQuoteForParty')
    expect(client).toContain('defaultCustomerName=""')
    expect(client).toContain('Quick Costing')
  })

  it('allows Base costings without party or quantity', () => {
    const client = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')

    expect(client).toContain('const resolvedPartyName = partyName.trim() || null')
    expect(client).not.toContain("toast.error(t('estimator.toast.party_required'))")
    expect(client).not.toContain("tx('Set a quantity before saving')")
    expect(client).toContain('placeholder="e.g. 5000"')
    // Package 2C: the estimator_quotes row is built by lib/estimator-quote-payload.ts;
    // the call sites still decide the party and quantity sources.
    const payloadBuilder = read('lib/estimator-quote-payload.ts')
    expect(actions).toContain('partyName: params.partyName?.trim() || null')
    // Phase 3H: the server only creates costings (the quotation branch was
    // unreachable), so a party is optional context, never a requirement.
    expect(actions).toContain("recordKind: 'costing',")
    expect(actions).toContain('orderQuantityM: authoritative.result.quantityM')
    expect(payloadBuilder).toContain('order_quantity_m: commercial.orderQuantityM')
    expect(payloadBuilder).toContain('meters: commercial.orderQuantityM ?? 0')
    expect(actions).toContain("partyName: normalizeTemplateName(data.partyName || '') || null")
  })

  it('exports customer, quantity, total, margin, and profit from the same Base state', () => {
    const state = makeDefaultEstimateState()
    state.orderQuantityM = 5_000
    state.transportPerM = 2
    state.commissionPct = 2
    state.profitPct = 10
    const totals = calcFullTotals(state)
    const model = createCostingExportModel({
      qualityLabel: 'Pilot Quality',
      state,
      totals,
    })
    const customer = buildCostingPrintHtml(model, {
      mode: 'customer',
      businessName: 'Pilot Weaves',
      customerName: 'Pilot Buyer',
      validUntil: '2026-08-31',
      notes: '',
      showGstNote: false,
    })
    const internal = buildCostingPrintHtml(model, {
      mode: 'internal',
      businessName: 'Pilot Weaves',
      customerName: 'Pilot Buyer',
      validUntil: '',
      notes: '',
      showGstNote: false,
    })

    expect(model.quantityM).toBe(5_000)
    expect(model.expectedProfit).toBeGreaterThan(0)
    expect(customer).toContain('Pilot Buyer')
    expect(customer).toContain('5,000 m')
    expect(customer).toContain('Quotation value')
    expect(internal).toContain('Expected profit')
    expect(internal).toContain('10.0%')
    expect(internal).toContain('Base warp yarn')
    expect(internal).toContain('Base weft yarn')
    expect(internal).toContain('Yarn wastage / crimp')
    expect(internal).toContain('Base yarn calculation')
    expect(internal).toContain('Base kg / 100m')
  })

  it('validates the complete initial quality snapshot before inserting the template', () => {
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')
    const boundaryIndex = actions.indexOf('const snapshotBoundaryError')
    const atomicSaveIndex = actions.indexOf("create_saved_quality_with_initial_costing_v1")

    expect(actions).toContain('requireTapeLength: false')
    expect(boundaryIndex).toBeGreaterThan(-1)
    expect(atomicSaveIndex).toBeGreaterThan(boundaryIndex)
    expect(actions).toContain('p_template_payload: templatePayload')
    expect(actions).toContain('p_quote_payload: attestation.payload')
    expect(actions).toContain("admin.rpc('register_estimator_costing_attestation'")
  })

  it('detaches source quote and template identity before Start From saves a copy', () => {
    const client = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const startFromIndex = client.indexOf('// A copy starts a new template and costing lineage.')
    const dialogIndex = client.indexOf('setShowSaveTemplate(true)', startFromIndex)
    const detachedBlock = client.slice(startFromIndex, dialogIndex)

    expect(startFromIndex).toBeGreaterThan(-1)
    expect(detachedBlock).toContain('setAppliedTemplate(null)')
    expect(detachedBlock).toContain('setSourceQuoteId(null)')
    expect(detachedBlock).toContain('setSourceQuoteUpdatedAt(null)')
    expect(detachedBlock).toContain('setSourceFactoryProfileUpdatedAt(null)')
    expect(detachedBlock).toContain('setSourceRecordKind(null)')
    expect(detachedBlock).toContain('quoteRequestIdRef.current = null')
  })
})
