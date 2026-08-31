import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createDocumentGenerationGuard } from '../lib/document-generation'
import { getEstimatorFieldTarget } from '../lib/estimator-field-target'
import { findCostingSaveReceipt } from '../lib/costing-save-receipt'
import { createEstimatorDraft, parseEstimatorDraft } from '../lib/estimator-drafts'
import { makeDefaultEstimateState } from '../lib/estimator'
import { translateStrictBasePlanText } from '../lib/i18n/runtime'

describe('new recovery copy localization', () => {
  it.each(['hi', 'gu'] as const)('translates the new task states in %s', language => {
    for (const text of ['Save not yet confirmed', 'Check save status', 'Retry original save', 'Saved to factory', 'Undo quality change', 'Switch quality with unfinished changes?', 'Document details changed. Download a fresh PDF before sharing.']) {
      expect(translateStrictBasePlanText(text, language)).not.toBe(text)
    }
  })
})

describe('uncertain-save recovery', () => {
  it('looks up only the original request in the authenticated factory', async () => {
    const receipt = { id: 'saved-id', version_number: 4 }
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: receipt, error: null }) }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    const from = vi.fn().mockReturnValue(query)
    expect(await findCostingSaveReceipt({ from } as unknown as SupabaseClient, 'factory-a', 'request-a')).toEqual({ data: receipt, error: null })
    expect(from).toHaveBeenCalledWith('estimator_quotes')
    expect(query.eq.mock.calls).toEqual([['org_id', 'factory-a'], ['client_request_id', 'request-a']])
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect((await findCostingSaveReceipt({ from } as unknown as SupabaseClient, 'factory-b', 'request-a')).data).toBeNull()
  })

  it('preserves the original submitted payload across reload, including concurrency tokens', () => {
    const state = makeDefaultEstimateState()
    const clientRequestId = '123e4567-e89b-42d3-a456-426614174000'
    const pendingSaveRequest = { clientRequestId, qualityLabel: 'Satin', estimate: state, totalProductionCostPerM: 20, quotePricePerM: 25, recordKind: 'costing' as const, updateSavedQuality: true, expectedTemplateUpdatedAt: '2026-08-31T00:00:00Z' }
    const draft = createEstimatorDraft({ state, partyName: '', qualityLabel: 'Satin', warpInstruction: '', weftInstruction: '', clientRequestId, pendingSaveRequest }, { savedAt: 1000, createdAt: 1000 })
    expect(parseEstimatorDraft(JSON.stringify(draft), 1000)?.pendingSaveRequest).toEqual(pendingSaveRequest)
    const mismatched = { ...draft, pendingSaveRequest: { ...pendingSaveRequest, clientRequestId: 'another-request' } }
    expect(parseEstimatorDraft(JSON.stringify(mismatched), 1000)?.pendingSaveRequest).toBeUndefined()
  })
})

describe('document generation freshness', () => {
  it('accepts only work for the current preview', () => {
    const guard = createDocumentGenerationGuard()
    guard.update('customer A')
    const original = guard.begin('customer A')
    expect(original()).toBe(true)
    guard.update('customer B')
    expect(original()).toBe(false)
    expect(guard.begin('customer B')()).toBe(true)
  })
  it('rejects a late generation after close/reopen or edit/revert', () => {
    const guard = createDocumentGenerationGuard()
    guard.update('terms A')
    const original = guard.begin('terms A')
    guard.update(null)
    guard.update('terms A')
    expect(original()).toBe(false)
    const reopened = guard.begin('terms A')
    guard.update('terms B')
    guard.update('terms A')
    expect(reopened()).toBe(false)
  })
})

describe('language-independent validation targets', () => {
  it.each(['warpRows.1.yarnRate', 'warpRows[1].yarnRate'])(
    'preserves the exact row in %s', field => {
      expect(getEstimatorFieldTarget(field)).toEqual({ row: 'warpRows.1', field: 'yarnRate' })
    },
  )
  it('handles multi-digit rows and density aliases', () => {
    expect(getEstimatorFieldTarget('weftRows.12.effectiveDenier')).toEqual({ row: 'weftRows.12', field: 'calcDenier' })
    expect(getEstimatorFieldTarget('warpRows.2')).toEqual({ row: 'warpRows.2', field: null })
    expect(getEstimatorFieldTarget('weftRows.0.cottonCountNe')).toEqual({ row: 'weftRows.0', field: 'calcDenier' })
  })
  it('handles top-level fields without guessing a yarn row', () => {
    expect(getEstimatorFieldTarget('quality_label')).toEqual({ row: null, field: 'qualityLabel' })
    expect(getEstimatorFieldTarget('monthlyOutputM')).toEqual({ row: null, field: 'monthlyOutputM' })
  })
})
