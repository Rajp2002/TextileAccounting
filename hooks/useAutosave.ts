'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

interface AutosaveData {
  state: any
  partyName: string
  qualityLabel: string
  warpInstruction: string
  weftInstruction: string
  savedAt: number  // timestamp
}

interface UseAutosaveOptions {
  orgId: string
  userId: string
  debounceMs?: number
  maxAgeMs?: number  // max age before draft is considered stale (default 24h)
}

interface UseAutosaveReturn {
  /** Whether a recoverable draft was found on mount */
  hasDraft: boolean
  /** The draft data if found */
  draft: AutosaveData | null
  /** Restore the draft (call this when user clicks "Restore") */
  restoreDraft: () => AutosaveData | null
  /** Dismiss the draft (clear from localStorage) */
  dismissDraft: () => void
  /** Clear the autosaved draft (call on successful save/convert) */
  clearDraft: () => void
  /** Save current state (called automatically via debounce, but exposed for manual use) */
  saveDraft: (data: Omit<AutosaveData, 'savedAt'>) => void
}

function getStorageKey(orgId: string, userId: string): string {
  return `weavly-estimator-draft-${orgId}-${userId}`
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
export function useAutosave({
  orgId,
  userId,
  debounceMs = 2000,
  maxAgeMs = 24 * 60 * 60 * 1000,  // 24 hours
}: UseAutosaveOptions): UseAutosaveReturn {
  const [hasDraft, setHasDraft] = useState(false)
  const [draft, setDraft] = useState<AutosaveData | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keyRef = useRef(getStorageKey(orgId, userId))

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(keyRef.current)
      if (!raw) return

      const parsed: AutosaveData = JSON.parse(raw)
      const age = Date.now() - parsed.savedAt

      if (age > maxAgeMs) {
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

  const saveDraft = useCallback((data: Omit<AutosaveData, 'savedAt'>) => {
    // Cancel any pending save
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      try {
        const payload: AutosaveData = { ...data, savedAt: Date.now() }
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

  const restoreDraft = useCallback((): AutosaveData | null => {
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
