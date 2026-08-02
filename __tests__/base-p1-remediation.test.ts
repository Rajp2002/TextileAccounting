import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { calcFullTotals, makeDefaultEstimateState } from '../lib/estimator'
import { buildCostingPrintHtml, createCostingExportModel } from '../lib/estimator-export'
import { getCostingWorkspaceCapabilities } from '../lib/costing-workspace'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Base P1 pilot remediation', () => {
  it('keeps Base costing quality-first without enabling production conversion', () => {
    expect(getCostingWorkspaceCapabilities(false)).toMatchObject({
      partyContext: false,
      quotationLifecycle: false,
      productionConversion: false,
    })

    const page = read('app/(dashboard)/owner/estimator/page.tsx')
    const client = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    expect(page).toContain('getEstimatorPartyNames()')
    expect(page).toContain('initialPartyNames={partiesRes.data ?? []}')
    expect(client).toContain('const showPartyField = canUseProduction && !isStandaloneCostingSession')
    expect(client).toContain('defaultCustomerName={showPartyField ? partyName : \'\'}')
    expect(client).toContain('Quick Costing')
  })

  it('allows Base costings without party or quantity while keeping quotation requirements', () => {
    const client = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')

    expect(client).toContain("const resolvedPartyName = effectiveTargetMode === 'market'")
    expect(client).toContain("if (!saveAsStandaloneCosting && !resolvedPartyName)")
    expect(client).toContain("if (!saveAsStandaloneCosting && (!state.orderQuantityM || state.orderQuantityM <= 0))")
    expect(client).toContain('placeholder="5000"')
    expect(actions).toContain('party_name:           params.partyName?.trim() || null')
    expect(actions).toContain("if (newRecordKind === 'quotation' && !params.partyName?.trim())")
    expect(actions).toContain('order_quantity_m:     authoritative.result.quantityM')
    expect(actions).toContain('meters:                   authoritative.result.quantityM ?? 0')
    expect(actions).toContain("party_name: normalizeTemplateName(data.partyName || '') || null")
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
  })

  it('validates the complete initial quality snapshot before inserting the template', () => {
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')
    const boundaryIndex = actions.indexOf('const snapshotBoundaryError')
    const atomicSaveIndex = actions.indexOf("create_saved_quality_with_initial_costing_v1")

    expect(actions).toContain('requireTapeLength: false')
    expect(boundaryIndex).toBeGreaterThan(-1)
    expect(atomicSaveIndex).toBeGreaterThan(boundaryIndex)
    expect(actions).toContain('p_template_payload: templatePayload')
    expect(actions).toContain('p_quote_payload: quotePayload')
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
