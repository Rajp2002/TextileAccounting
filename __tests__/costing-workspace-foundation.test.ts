import { describe, expect, it } from 'vitest'
import {
  canUseQuotationLifecycle,
  getCostingWorkspaceCapabilities,
  getNewEstimateRecordKind,
  isStandaloneCosting,
  normalizeCostingRecordKind,
  shouldCreateImmutableRevision,
} from '../lib/costing-workspace'
import { parseEstimatorDraft } from '../lib/estimator-drafts'

describe('shared costing workspace foundation', () => {
  it('keeps decision tools shared while production capabilities remain additive', () => {
    const base = getCostingWorkspaceCapabilities(false)
    const suite = getCostingWorkspaceCapabilities(true)

    expect(base).toMatchObject({
      ratesWorkspace: true,
      versionedCostings: true,
      costingComparison: true,
      professionalExports: true,
      partyContext: true,
      quotationLifecycle: false,
      productionConversion: false,
    })
    expect(suite).toMatchObject({
      ratesWorkspace: true,
      versionedCostings: true,
      costingComparison: true,
      professionalExports: true,
      quotationLifecycle: true,
      productionConversion: true,
    })
  })

  it('assigns durable record meaning independently from later plan changes', () => {
    expect(getNewEstimateRecordKind(false)).toBe('costing')
    expect(getNewEstimateRecordKind(true)).toBe('quotation')
    expect(getNewEstimateRecordKind(true, 'costing')).toBe('costing')
    expect(getNewEstimateRecordKind(false, 'quotation')).toBe('costing')
    expect(normalizeCostingRecordKind('costing')).toBe('costing')
    expect(isStandaloneCosting('costing')).toBe(true)
    expect(canUseQuotationLifecycle('costing', true)).toBe(false)
    expect(canUseQuotationLifecycle('quotation', true)).toBe(true)
    expect(canUseQuotationLifecycle('quotation', false)).toBe(false)
  })

  it('makes costings and accepted/converted quotations immutable', () => {
    expect(shouldCreateImmutableRevision('costing', 'draft', false)).toBe(true)
    expect(shouldCreateImmutableRevision('quotation', 'accepted', false)).toBe(true)
    expect(shouldCreateImmutableRevision('quotation', 'draft', true)).toBe(true)
    expect(shouldCreateImmutableRevision('quotation', 'draft', false)).toBe(false)
  })

  it('preserves record context through the browser handoff', () => {
    const parsed = parseEstimatorDraft(JSON.stringify({
      state: { marker: 'saved' },
      partyName: 'Standalone costing',
      qualityLabel: 'Georgette',
      warpInstruction: '',
      weftInstruction: '',
      savedAt: 1_000,
      sourceQuoteId: '00000000-0000-4000-8000-000000000001',
      sourceQuoteUpdatedAt: '2026-07-19T00:00:00.000Z',
      sourceRecordKind: 'costing',
      restoreOnEstimatorEntry: true,
    }), 1_001)

    expect(parsed?.sourceRecordKind).toBe('costing')
    expect(parsed?.sourceQuoteId).toBe('00000000-0000-4000-8000-000000000001')
  })
})
