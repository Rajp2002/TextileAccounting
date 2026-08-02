'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import {
  getEstimatorDraftStorageKey,
  parseEstimatorDraft,
  ESTIMATOR_DRAFT_MAX_AGE_MS,
  type EstimatorAutosaveData,
} from '@/lib/estimator-drafts'

interface UseAutosaveOptions {
  orgId: string
  userId: string
  debounceMs?: number
  maxAgeMs?: number  // max age before draft is considered stale (default 24h)
  /** Do not create a draft for an untouched/default estimator screen. */
  shouldPersist?: (data: Omit<EstimatorAutosaveData<unknown>, 'savedAt'>) => boolean
}

interface UseAutosaveReturn<TState = unknown> {
  /** Whether a recoverable draft was found on mount */
  hasDraft: boolean
  /** The draft data if found */
  draft: EstimatorAutosaveData<TState> | null
  /** Restore the draft (call this when user clicks "Restore") */
  restoreDraft: () => EstimatorAutosaveData<TState> | null
  /** Dismiss the draft (clear from localStorage) */
  dismissDraft: () => void
  /** Clear the autosaved draft (call on successful save/convert) */
  clearDraft: () => void
  /** Save current state (called automatically via debounce, but exposed for manual use) */
  saveDraft: (data: Omit<EstimatorAutosaveData<TState>, 'savedAt'>) => void
  /** Persist immediately, returning whether browser storage accepted the draft */
  saveDraftNow: (data: Omit<EstimatorAutosaveData<TState>, 'savedAt'>) => boolean
  /** Suppress the current programmatic state until the user edits again. */
  suppressAutosaveUntilChanged: () => void
  /** Mark a user edit after a reset, restore, or successful save. */
  markUserEdit: () => void
}

function safelyRemoveLocalStorageItem(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Storage can be blocked (private mode, policy, quota implementation).
  }
}

/**
 * Custom hook for autosaving estimator state to localStorage.
 * 
 * - Persists state on every change (debounced 2s)
 * - Detects existing draft on mount
 * - Shows "Restore draft?" banner via hasDraft flag
 * - Clears draft on successful save/convert
 * - Draft expires after 24 hours
 */
export function useAutosave<TState = unknown>({
  orgId,
  userId,
  debounceMs = 2000,
  maxAgeMs = ESTIMATOR_DRAFT_MAX_AGE_MS,
  shouldPersist,
}: UseAutosaveOptions): UseAutosaveReturn<TState> {
  const [hasDraft, setHasDraft] = useState(false)
  const [draft, setDraft] = useState<EstimatorAutosaveData<TState> | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keyRef = useRef(getEstimatorDraftStorageKey(orgId, userId))
  const draftDecisionPendingRef = useRef(false)
  const writeGenerationRef = useRef(0)
  const suppressUntilChangeRef = useRef(false)

  const isMeaningful = useCallback((data: Omit<EstimatorAutosaveData<TState>, 'savedAt'>) => {
    // Reset, restore, and successful saves often update several React states
    // in one turn. Do not infer that those programmatic changes are a user
    // edit from a changing JSON fingerprint; the editor explicitly calls
    // markUserEdit from real input/action handlers.
    if (suppressUntilChangeRef.current) return false
    return shouldPersist ? shouldPersist(data as Omit<EstimatorAutosaveData<unknown>, 'savedAt'>) : true
  }, [shouldPersist])

  const persistDraft = useCallback((data: Omit<EstimatorAutosaveData<TState>, 'savedAt'>) => {
    if (draftDecisionPendingRef.current) return false

    try {
      const payload: EstimatorAutosaveData<TState> = { ...data, savedAt: Date.now() }
      localStorage.setItem(keyRef.current, JSON.stringify(payload))
      return true
    } catch {
      return false
    }
  }, [])

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(keyRef.current)
      if (!raw) return

      const parsed = parseEstimatorDraft<TState>(raw, Date.now(), maxAgeMs)
      if (!parsed) {
        // Draft is too old — silently discard
        localStorage.removeItem(keyRef.current)
        return
      }

      // Valid draft found — surface it
      draftDecisionPendingRef.current = true
      setDraft(parsed)
      setHasDraft(true)
    } catch {
      // Corrupt data — clear it
      safelyRemoveLocalStorageItem(keyRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveDraft = useCallback((data: Omit<EstimatorAutosaveData<TState>, 'savedAt'>) => {
    if (!isMeaningful(data)) return
    // Cancel any pending save
    if (timerRef.current) clearTimeout(timerRef.current)
    const generation = writeGenerationRef.current

    timerRef.current = setTimeout(() => {
      // Never overwrite a recoverable draft with the blank initial screen while
      // the restore/dismiss banner is waiting for the user's decision.
      if (generation === writeGenerationRef.current) persistDraft(data)
    }, debounceMs)
  }, [debounceMs, isMeaningful, persistDraft])

  const saveDraftNow = useCallback((data: Omit<EstimatorAutosaveData<TState>, 'savedAt'>) => {
    if (!isMeaningful(data)) return true
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    return persistDraft(data)
  }, [isMeaningful, persistDraft])

  const clearDraft = useCallback(() => {
    writeGenerationRef.current += 1
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    draftDecisionPendingRef.current = false
    suppressUntilChangeRef.current = true
    safelyRemoveLocalStorageItem(keyRef.current)
    setHasDraft(false)
    setDraft(null)
  }, [])

  const restoreDraft = useCallback((): EstimatorAutosaveData<TState> | null => {
    const current = draft
    writeGenerationRef.current += 1
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    draftDecisionPendingRef.current = false
    suppressUntilChangeRef.current = true
    setHasDraft(false)
    // Remove the recovery item immediately. A meaningful restored edit can be
    // written again; an invalid/blank restored item cannot resurrect the banner.
    safelyRemoveLocalStorageItem(keyRef.current)
    return current
  }, [draft])

  const dismissDraft = useCallback(() => {
    writeGenerationRef.current += 1
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    draftDecisionPendingRef.current = false
    suppressUntilChangeRef.current = true
    safelyRemoveLocalStorageItem(keyRef.current)
    setHasDraft(false)
    setDraft(null)
  }, [])

  const suppressAutosaveUntilChanged = useCallback(() => {
    suppressUntilChangeRef.current = true
    writeGenerationRef.current += 1
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const markUserEdit = useCallback(() => {
    suppressUntilChangeRef.current = false
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { hasDraft, draft, restoreDraft, dismissDraft, clearDraft, saveDraft, saveDraftNow, suppressAutosaveUntilChanged, markUserEdit }
}
