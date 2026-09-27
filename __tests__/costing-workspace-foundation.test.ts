import { describe, expect, it } from 'vitest'
import {
  isStandaloneCosting,
  normalizeCostingRecordKind,
} from '../lib/costing-workspace'
import { parseEstimatorDraft } from '../lib/estimator-drafts'

describe('shared costing workspace foundation', () => {
  it('reads durable record meaning from the stored record kind', () => {
    // Phase 3H: new estimates are always costings; the plan-dependent record
    // kind and quotation-lifecycle helpers were retired with that workflow.
    expect(normalizeCostingRecordKind('costing')).toBe('costing')
    expect(normalizeCostingRecordKind('quotation')).toBe('quotation')
    expect(normalizeCostingRecordKind(null)).toBe('quotation')
    expect(isStandaloneCosting('costing')).toBe(true)
    expect(isStandaloneCosting('quotation')).toBe(false)
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
