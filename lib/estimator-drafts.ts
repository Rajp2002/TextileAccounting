'use client'

import type { CostingRecordKind } from '@/lib/costing-workspace'

export const ESTIMATOR_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000
const ESTIMATOR_CLIENT_REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface EstimatorAutosaveData<TState = unknown> {
  state: TState
  partyName: string
  qualityLabel: string
  warpInstruction: string
  weftInstruction: string
  savedAt: number
  sourceQuoteId?: string
  sourceQuoteUpdatedAt?: string
  sourceQuoteVersionNumber?: number
  sourceQuoteCreatedAt?: string
  sourceRecordKind?: CostingRecordKind
  templateId?: string
  /**
   * Stable identity for a quote save/update attempt. Keeping it with the
   * local draft makes a retry idempotent even if the server committed but its
   * response was lost before the browser received it.
   */
  clientRequestId?: string
  /**
   * Marks a draft written by an explicit Saved Cost Estimate action.
   * Generic background autosaves stay opt-in so they still require the
   * existing recovery confirmation on the Estimator screen.
   */
  restoreOnEstimatorEntry?: boolean
}

export function getEstimatorDraftStorageKey(orgId: string, userId: string): string {
  return `weavly-estimator-draft-${orgId}-${userId}`
}

export function parseEstimatorDraft<TState = unknown>(
  raw: string | null,
  nowMs = Date.now(),
  maxAgeMs = ESTIMATOR_DRAFT_MAX_AGE_MS
): EstimatorAutosaveData<TState> | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<EstimatorAutosaveData<TState>>
    if (!parsed || typeof parsed !== 'object') return null
    if (!Number.isFinite(parsed.savedAt)) return null
    if (nowMs - Number(parsed.savedAt) > maxAgeMs) return null
    if (!('state' in parsed)) return null

    return {
      state: parsed.state as TState,
      partyName: typeof parsed.partyName === 'string' ? parsed.partyName : '',
      qualityLabel: typeof parsed.qualityLabel === 'string' ? parsed.qualityLabel : '',
      warpInstruction: typeof parsed.warpInstruction === 'string' ? parsed.warpInstruction : '',
      weftInstruction: typeof parsed.weftInstruction === 'string' ? parsed.weftInstruction : '',
      savedAt: Number(parsed.savedAt),
      sourceQuoteId: typeof parsed.sourceQuoteId === 'string' ? parsed.sourceQuoteId : undefined,
      sourceQuoteUpdatedAt: typeof parsed.sourceQuoteUpdatedAt === 'string' ? parsed.sourceQuoteUpdatedAt : undefined,
      sourceQuoteVersionNumber: Number.isFinite(parsed.sourceQuoteVersionNumber)
        ? Number(parsed.sourceQuoteVersionNumber)
        : undefined,
      sourceQuoteCreatedAt: typeof parsed.sourceQuoteCreatedAt === 'string' ? parsed.sourceQuoteCreatedAt : undefined,
      sourceRecordKind: parsed.sourceRecordKind === 'costing' || parsed.sourceRecordKind === 'quotation' || parsed.sourceRecordKind === 'market_run'
        ? parsed.sourceRecordKind
        : undefined,
      templateId: typeof parsed.templateId === 'string' ? parsed.templateId : undefined,
      clientRequestId:
        typeof parsed.clientRequestId === 'string' &&
        ESTIMATOR_CLIENT_REQUEST_ID_PATTERN.test(parsed.clientRequestId)
          ? parsed.clientRequestId
          : undefined,
      restoreOnEstimatorEntry: parsed.restoreOnEstimatorEntry === true ? true : undefined,
    }
  } catch {
    return null
  }
}

export function shouldWarnBeforeQuoteRestore<TState>(
  existingDraft: EstimatorAutosaveData<TState> | null,
  sourceQuoteId: string
): boolean {
  return Boolean(existingDraft && existingDraft.sourceQuoteId !== sourceQuoteId)
}

export function shouldAutoRestoreEstimatorDraft<TState>(
  draft: EstimatorAutosaveData<TState> | null
): boolean {
  return Boolean(draft && (draft.restoreOnEstimatorEntry || draft.sourceQuoteId))
}
