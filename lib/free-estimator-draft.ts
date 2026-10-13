import type { EstimateState } from './estimator'
import {
  createEstimatorDraft,
  getEstimatorDraftStorageKey,
  parseEstimatorDraft,
  type EstimatorAutosaveData,
} from './estimator-drafts'
import { freeEstimateSchema } from './free-estimator-input'

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** What the owner typed on the Free page before Calculate & save. */
export type FreeDraftPage = {
  state: EstimateState
  qualityLabel: string
  warpInstruction: string
  weftInstruction: string
}

const FREE_DRAFT_WRITER = 'free-estimator'

const isFreeState = (state: unknown): state is EstimateState => freeEstimateSchema.safeParse(state).success

/**
 * Free shares the estimator's per-user draft slot, so inputs typed before an
 * upgrade or a Lite trial are offered again by the paid estimator. A draft
 * that reopens a saved paid costing, or carries anything Free cannot
 * calculate, is not Free's to restore or clear.
 */
function readOwnDraft(storage: DraftStorage, key: string, nowMs: number): EstimatorAutosaveData<EstimateState> | null {
  const draft = parseEstimatorDraft<EstimateState>(storage.getItem(key), nowMs, undefined, isFreeState)
  if (!draft) return null
  if (draft.sourceQuoteId || draft.templateId || draft.pendingSaveRequest || draft.restoreOnEstimatorEntry) return null
  return draft
}

export function readFreeEstimatorDraft(storage: DraftStorage, orgId: string, userId: string, nowMs = Date.now()): FreeDraftPage | null {
  try {
    const draft = readOwnDraft(storage, getEstimatorDraftStorageKey(orgId, userId), nowMs)
    if (!draft) return null
    return {
      state: draft.state,
      qualityLabel: draft.qualityLabel,
      warpInstruction: draft.warpInstruction,
      weftInstruction: draft.weftInstruction,
    }
  } catch {
    return null
  }
}

/** True only when the page is now stored on this device, in a form Free can restore. */
export function writeFreeEstimatorDraft(storage: DraftStorage, orgId: string, userId: string, page: FreeDraftPage, nowMs = Date.now()): boolean {
  if (!isFreeState(page.state)) return false
  try {
    const key = getEstimatorDraftStorageKey(orgId, userId)
    const previous = parseEstimatorDraft<EstimateState>(storage.getItem(key), nowMs)
    const ours = previous?.writerId === FREE_DRAFT_WRITER ? previous : null
    const draft = createEstimatorDraft<EstimateState>({
      // The paid estimator keeps its own setup state when it restores this.
      state: { ...page.state, isConfigured: false },
      partyName: '',
      qualityLabel: page.qualityLabel,
      warpInstruction: page.warpInstruction,
      weftInstruction: page.weftInstruction,
    }, {
      draftId: ours?.draftId,
      createdAt: ours?.createdAt,
      savedAt: nowMs,
      writerId: FREE_DRAFT_WRITER,
      writeSequence: (previous?.writeSequence ?? 0) + 1,
    })
    storage.setItem(key, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

/** Removes the stored Free inputs; a paid draft Free cannot restore is left alone. */
export function clearFreeEstimatorDraft(storage: DraftStorage, orgId: string, userId: string, nowMs = Date.now()) {
  try {
    const key = getEstimatorDraftStorageKey(orgId, userId)
    const raw = storage.getItem(key)
    if (raw === null) return
    // An expired or unreadable draft is cleared too; one Free cannot use is not.
    const parsed = parseEstimatorDraft<EstimateState>(raw, nowMs)
    if (parsed && !readOwnDraft(storage, key, nowMs)) return
    storage.removeItem(key)
  } catch {
    // Storage that cannot be read holds nothing to clear.
  }
}
