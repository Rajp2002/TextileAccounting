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
}: UseAutosaveOptions): UseAutosaveReturn<TState> {
  const [hasDraft, setHasDraft] = useState(false)
  const [draft, setDraft] = useState<EstimatorAutosaveData<TState> | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keyRef = useRef(getEstimatorDraftStorageKey(orgId, userId))

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
      setDraft(parsed)
      setHasDraft(true)
    } catch {
      // Corrupt data — clear it
      localStorage.removeItem(keyRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveDraft = useCallback((data: Omit<EstimatorAutosaveData<TState>, 'savedAt'>) => {
    // Cancel any pending save
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      try {
        const payload: EstimatorAutosaveData<TState> = { ...data, savedAt: Date.now() }
        localStorage.setItem(keyRef.current, JSON.stringify(payload))
      } catch {
        // localStorage full or unavailable — fail silently
      }
    }, debounceMs)
  }, [debounceMs])

  const clearDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    localStorage.removeItem(keyRef.current)
    setHasDraft(false)
    setDraft(null)
  }, [])

  const restoreDraft = useCallback((): EstimatorAutosaveData<TState> | null => {
    const current = draft
    setHasDraft(false)
    // Don't clear from localStorage — keep it until next save or explicit dismiss
    return current
  }, [draft])

  const dismissDraft = useCallback(() => {
    localStorage.removeItem(keyRef.current)
    setHasDraft(false)
    setDraft(null)
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { hasDraft, draft, restoreDraft, dismissDraft, clearDraft, saveDraft }
}
