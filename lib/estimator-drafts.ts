'use client'

export const ESTIMATOR_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000

export interface EstimatorAutosaveData<TState = unknown> {
  state: TState
  partyName: string
  qualityLabel: string
  warpInstruction: string
  weftInstruction: string
  savedAt: number
  sourceQuoteId?: string
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
