import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { calcFullTotals, makeDefaultEstimateState } from '../lib/estimator'
import { buildCostingPrintHtml, createCostingExportModel } from '../lib/estimator-export'
import { getCostingWorkspaceCapabilities } from '../lib/costing-workspace'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Base P1 pilot remediation', () => {
  it('treats customer context as part of Base costing without enabling production conversion', () => {
    expect(getCostingWorkspaceCapabilities(false)).toMatchObject({
      partyContext: true,
      quotationLifecycle: false,
      productionConversion: false,
    })

    const page = read('app/(dashboard)/owner/estimator/page.tsx')
    const client = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    expect(page).toContain('getEstimatorPartyNames()')
    expect(page).toContain('initialPartyNames={partiesRes.data ?? []}')
    expect(client).toContain('list="estimator-party-options"')
    expect(client).toContain('Select a recent customer or type a new one.')
    expect(client).toContain('defaultCustomerName={partyName}')
  })

  it('requires and persists an explicit Base party and costing quantity', () => {
    const client = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')

    expect(client).toContain("const resolvedPartyName = effectiveTargetMode === 'market'")
    expect(client).toContain("return toast.error(effectiveTargetMode === 'market' ? 'Fabric Label is required'")
    expect(client).toContain('if (!state.orderQuantityM || state.orderQuantityM <= 0)')
    expect(client).toContain('placeholder="5000"')
    expect(actions).toContain('party_name:           params.partyName.trim()')
    expect(actions).toContain('order_quantity_m:     estimate.orderQuantityM')
    expect(actions).toContain('meters:                   estimate.orderQuantityM ?? 0')
    expect(client).toContain('partyName:        partyName.trim() || undefined')
    expect(actions).toContain('partyName: normalizeTemplateName(data.partyName || data.name)')
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
    const insertIndex = actions.indexOf(".from('estimator_templates')\n        .insert({")

    expect(actions).toContain('requireTapeLength: false')
    expect(boundaryIndex).toBeGreaterThan(-1)
    expect(insertIndex).toBeGreaterThan(boundaryIndex)
    expect(actions).toContain('const { data: rolledBack, error: rollbackError }')
    expect(actions).toContain('if (rollbackError || !rolledBack)')
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
    expect(detachedBlock).toContain('setSourceRecordKind(null)')
    expect(detachedBlock).toContain('quoteRequestIdRef.current = null')
  })
})
