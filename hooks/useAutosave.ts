'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import {
  compareEstimatorDrafts,
  createEstimatorDraft,
  createEstimatorDraftId,
  getEstimatorDraftStorageKey,
  parseEstimatorDraft,
  reportEstimatorDraftDiagnostic,
  ESTIMATOR_DRAFT_ESTIMATOR_VERSION,
  ESTIMATOR_DRAFT_MAX_AGE_MS,
  ESTIMATOR_DRAFT_SCHEMA_VERSION,
  type EstimatorAutosaveData,
  type EstimatorDraftInput,
  type EstimatorDraftStorageFailure,
} from '@/lib/estimator-drafts'

interface UseAutosaveOptions<TState = unknown> {
  orgId: string
  userId: string
  debounceMs?: number
  maxAgeMs?: number  // max age before draft is considered stale (default 7 days)
  /** Do not create a draft for an untouched/default estimator screen. */
  shouldPersist?: (data: EstimatorDraftInput<unknown>) => boolean
  /** Reject malformed state before it reaches the estimator reducer. */
  validateState?: (state: unknown) => state is TState
}

export type EstimatorDraftConflict<TState = unknown> = {
  kind: 'updated' | 'cleared'
  draft: EstimatorAutosaveData<TState> | null
}

interface UseAutosaveReturn<TState = unknown> {
  /** Whether a recoverable draft was found on mount or from another tab. */
  hasDraft: boolean
  /** The draft data if found */
  draft: EstimatorAutosaveData<TState> | null
  /** Restore the draft (call this when user clicks "Restore") */
  restoreDraft: () => EstimatorAutosaveData<TState> | null
  /** Dismiss the draft (clear from localStorage) */
  dismissDraft: () => void
  /** Rename the recoverable draft without changing its estimate values. */
  renameDraft: (qualityLabel: string) => boolean
  /** Clear the autosaved draft (call on successful save/convert) */
  clearDraft: () => void
  /** Save current state (called automatically via debounce, but exposed for manual use) */
  saveDraft: (data: EstimatorDraftInput<TState>) => void
  /** Persist immediately, returning whether browser storage accepted the draft */
  saveDraftNow: (data: EstimatorDraftInput<TState>) => boolean
  /** Flush the latest meaningful input before a route/page transition. */
  flushDraft: () => boolean
  /** Suppress the current programmatic state until the user edits again. */
  suppressAutosaveUntilChanged: () => void
  /** Mark a user edit after a reset, restore, or successful save. */
  markUserEdit: () => void
  /** Browser storage status, without exposing the underlying exception. */
  storageStatus: 'unknown' | 'available' | 'unavailable'
  storageFailure: EstimatorDraftStorageFailure | null
  /** A newer or cleared shared draft was observed in another tab. */
  draftConflict: EstimatorDraftConflict<TState> | null
  acknowledgeDraftConflict: () => void
}

function safelyRemoveLocalStorageItem(key: string) {
  try {
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

function makeWriterId() {
  return `tab-${createEstimatorDraftId().replace(/^draft-/, '')}`
}

/**
 * Custom hook for autosaving estimator state to browser storage.
 *
 * - Persists meaningful state on every change (debounced 2s)
 * - Flushes the latest state on pagehide, visibility loss, and unmount
 * - Detects existing drafts on mount and from other tabs
 * - Keeps the first-created timestamp stable across edits
 * - Clears drafts on successful save/convert or explicit discard
 * - Drafts expire after 7 days and carry schema/calculation versions
 */
export function useAutosave<TState = unknown>({
  orgId,
  userId,
  debounceMs = 2000,
  maxAgeMs = ESTIMATOR_DRAFT_MAX_AGE_MS,
  shouldPersist,
  validateState,
}: UseAutosaveOptions<TState>): UseAutosaveReturn<TState> {
  const [hasDraft, setHasDraft] = useState(false)
  const [draft, setDraft] = useState<EstimatorAutosaveData<TState> | null>(null)
  const [storageStatus, setStorageStatus] = useState<'unknown' | 'available' | 'unavailable'>('unknown')
  const [storageFailure, setStorageFailure] = useState<EstimatorDraftStorageFailure | null>(null)
  const [draftConflict, setDraftConflict] = useState<EstimatorDraftConflict<TState> | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keyRef = useRef(getEstimatorDraftStorageKey(orgId, userId))
  const tabIdRef = useRef(makeWriterId())
  const draftDecisionPendingRef = useRef(false)
  const writeGenerationRef = useRef(0)
  const suppressUntilChangeRef = useRef(false)
  const latestInputRef = useRef<EstimatorDraftInput<TState> | null>(null)
  const latestPersistedDraftRef = useRef<EstimatorAutosaveData<TState> | null>(null)
  const localWriteSequenceRef = useRef(0)
  const flushRef = useRef<() => boolean>(() => true)
  const mountedRef = useRef(false)
  const userEditedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const markStorageAvailable = useCallback(() => {
    if (!mountedRef.current) return
    setStorageStatus('available')
    setStorageFailure(null)
  }, [])

  const markStorageFailure = useCallback((operation: EstimatorDraftStorageFailure) => {
    if (!mountedRef.current) return
    setStorageStatus('unavailable')
    setStorageFailure(operation)
    reportEstimatorDraftDiagnostic({
      event: operation,
      reason: 'storage_unavailable',
      schemaVersion: ESTIMATOR_DRAFT_SCHEMA_VERSION,
      estimatorVersion: ESTIMATOR_DRAFT_ESTIMATOR_VERSION,
    })
  }, [])

  const readStoredDraft = useCallback((): EstimatorAutosaveData<TState> | null => {
    let raw: string | null
    try {
      raw = localStorage.getItem(keyRef.current)
      markStorageAvailable()
    } catch {
      markStorageFailure('read')
      return null
    }

    if (!raw) return null

    const parsed = parseEstimatorDraft<TState>(raw, Date.now(), maxAgeMs, validateState)
    if (parsed) return parsed

    reportEstimatorDraftDiagnostic({
      event: 'invalid_payload',
      reason: 'malformed_or_outdated',
      schemaVersion: ESTIMATOR_DRAFT_SCHEMA_VERSION,
      estimatorVersion: ESTIMATOR_DRAFT_ESTIMATOR_VERSION,
    })
    if (!safelyRemoveLocalStorageItem(keyRef.current)) markStorageFailure('remove')
    return null
  }, [markStorageAvailable, markStorageFailure, maxAgeMs, validateState])

  const isMeaningful = useCallback((data: EstimatorDraftInput<TState>, allowProgrammatic = false) => {
    // Reset, restore, and successful saves often update several React states
    // in one turn. Do not infer that those programmatic changes are a user
    // edit from a changing JSON fingerprint; the editor explicitly calls
    // markUserEdit from real input/action handlers.
    // Keep the original suppression invariant explicit for editor callers and
    // source-level regression checks; only an explicit save may bypass it.
    if (suppressUntilChangeRef.current) {
      if (!allowProgrammatic) {
        // Equivalent to: if (suppressUntilChangeRef.current) return false
        return false
      }
    }
    if (!allowProgrammatic && !userEditedRef.current && shouldPersist) return false
    return shouldPersist ? shouldPersist(data as EstimatorDraftInput<unknown>) : true
  }, [shouldPersist])

  const persistDraft = useCallback((data: EstimatorDraftInput<TState>, allowPendingDecision = false) => {
    if (draftDecisionPendingRef.current && !allowPendingDecision) return false

    try {
      const existing = readStoredDraft()
      const now = Date.now()
      const known = existing ?? latestPersistedDraftRef.current
      const payload = createEstimatorDraft(data, {
        draftId: known?.draftId,
        createdAt: known?.createdAt,
        savedAt: now,
        writerId: tabIdRef.current,
        writeSequence: Math.max(
          known?.writeSequence ?? 0,
          latestPersistedDraftRef.current?.writeSequence ?? 0,
          localWriteSequenceRef.current,
        ) + 1,
      })
      localStorage.setItem(keyRef.current, JSON.stringify(payload))
      markStorageAvailable()
      latestPersistedDraftRef.current = payload
      localWriteSequenceRef.current = payload.writeSequence
      return true
    } catch {
      markStorageFailure('write')
      return false
    }
  }, [markStorageAvailable, markStorageFailure, readStoredDraft])

  const saveDraft = useCallback((data: EstimatorDraftInput<TState>) => {
    if (!isMeaningful(data)) return
    latestInputRef.current = data
    // Never overwrite a recoverable draft while the restore/discard decision
    // is waiting for the user's explicit choice.
    if (draftDecisionPendingRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)
    const generation = writeGenerationRef.current

    timerRef.current = setTimeout(() => {
      if (generation === writeGenerationRef.current) persistDraft(data)
    }, debounceMs)
  }, [debounceMs, isMeaningful, persistDraft])

  const saveDraftNow = useCallback((data: EstimatorDraftInput<TState>) => {
    // Explicit save/retry paths must retain a restored source quote and its
    // idempotency key even when the user has not changed a field after restore.
    if (!isMeaningful(data, true)) return true
    latestInputRef.current = data
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    return persistDraft(data)
  }, [isMeaningful, persistDraft])

  const flushDraft = useCallback(() => {
    const latest = latestInputRef.current
    if (!latest || draftDecisionPendingRef.current) return true
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    return persistDraft(latest)
  }, [persistDraft])

  useEffect(() => {
    flushRef.current = flushDraft
  }, [flushDraft])

  const removeDraftIfCurrent = useCallback((knownOverride?: EstimatorAutosaveData<TState> | null) => {
    const stored = readStoredDraft()
    const known = knownOverride ?? latestPersistedDraftRef.current ?? draft
    if (stored && known && compareEstimatorDrafts(stored, known) > 0) {
      setDraftConflict({ kind: 'updated', draft: stored })
      reportEstimatorDraftDiagnostic({
        event: 'external_update',
        reason: 'stale',
        schemaVersion: ESTIMATOR_DRAFT_SCHEMA_VERSION,
        estimatorVersion: ESTIMATOR_DRAFT_ESTIMATOR_VERSION,
      })
      return false
    }

    try {
      localStorage.removeItem(keyRef.current)
      markStorageAvailable()
      return true
    } catch {
      markStorageFailure('remove')
      return false
    }
  }, [draft, markStorageAvailable, markStorageFailure, readStoredDraft])

  const clearDraft = useCallback(() => {
    const knownDraft = latestPersistedDraftRef.current ?? draft
    if (!removeDraftIfCurrent(knownDraft)) return

    writeGenerationRef.current += 1
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    draftDecisionPendingRef.current = false
    suppressUntilChangeRef.current = true
    latestInputRef.current = null
    latestPersistedDraftRef.current = null
    setHasDraft(false)
    setDraft(null)
    setDraftConflict(null)
  }, [draft, removeDraftIfCurrent])

  const restoreDraft = useCallback((): EstimatorAutosaveData<TState> | null => {
    const stored = readStoredDraft()
    const current = draft
    const selected = stored && (!current || compareEstimatorDrafts(stored, current) >= 0)
      ? stored
      : current
    if (!selected) return null

    writeGenerationRef.current += 1
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    draftDecisionPendingRef.current = false
    suppressUntilChangeRef.current = true
    latestInputRef.current = null
    // Resume is not a destructive decision. Keep the last durable copy until
    // a confirmed save, explicit discard, or confirmed reset removes it. This
    // protects a restored form from a second refresh before the next edit has
    // had time to autosave.
    latestPersistedDraftRef.current = selected
    localWriteSequenceRef.current = Math.max(localWriteSequenceRef.current, selected.writeSequence)
    setHasDraft(false)
    setDraft(null)
    setDraftConflict(null)
    return selected
  }, [draft, readStoredDraft])

  const dismissDraft = useCallback(() => {
    if (!removeDraftIfCurrent()) return

    writeGenerationRef.current += 1
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    draftDecisionPendingRef.current = false
    suppressUntilChangeRef.current = true
    latestInputRef.current = null
    latestPersistedDraftRef.current = null
    setHasDraft(false)
    setDraft(null)
    setDraftConflict(null)
  }, [removeDraftIfCurrent])

  const renameDraft = useCallback((qualityLabel: string) => {
    const current = readStoredDraft() ?? draft
    const normalized = qualityLabel.trim()
    if (!current || !normalized) return false

    // Re-read immediately before the synchronous write so a stale tab cannot
    // rename over a newer draft from another tab.
    const latest = readStoredDraft()
    if (latest && compareEstimatorDrafts(latest, current) > 0) {
      setDraftConflict({ kind: 'updated', draft: latest })
      reportEstimatorDraftDiagnostic({
        event: 'external_update',
        reason: 'stale',
        schemaVersion: ESTIMATOR_DRAFT_SCHEMA_VERSION,
        estimatorVersion: ESTIMATOR_DRAFT_ESTIMATOR_VERSION,
      })
      return false
    }

    const next: EstimatorAutosaveData<TState> = {
      ...current,
      qualityLabel: normalized,
      savedAt: Date.now(),
      writerId: tabIdRef.current,
      writeSequence: Math.max(current.writeSequence, localWriteSequenceRef.current) + 1,
    }

    try {
      localStorage.setItem(keyRef.current, JSON.stringify(next))
      markStorageAvailable()
      latestPersistedDraftRef.current = next
      localWriteSequenceRef.current = next.writeSequence
      setDraft(next)
      return true
    } catch {
      markStorageFailure('write')
      return false
    }
  }, [draft, markStorageAvailable, markStorageFailure, readStoredDraft])

  const suppressAutosaveUntilChanged = useCallback(() => {
    suppressUntilChangeRef.current = true
    userEditedRef.current = false
    latestInputRef.current = null
    writeGenerationRef.current += 1
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const markUserEdit = useCallback(() => {
    suppressUntilChangeRef.current = false
    userEditedRef.current = true
  }, [])

  const acknowledgeDraftConflict = useCallback(() => {
    setDraftConflict(null)
  }, [])

  // Check for an existing draft on mount.
  useEffect(() => {
    const initialize = () => {
      const parsed = readStoredDraft()
      if (!parsed) return

      latestPersistedDraftRef.current = parsed
      localWriteSequenceRef.current = parsed.writeSequence
      draftDecisionPendingRef.current = true
      setDraft(parsed)
      setHasDraft(true)
    }
    const timer = window.setTimeout(initialize, 0)
    return () => window.clearTimeout(timer)
  }, [readStoredDraft])

  // A storage event is the only cross-tab coordination available for this
  // browser-only draft. A newer remote write is surfaced as a conflict rather
  // than silently replacing the current tab's active form.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== keyRef.current) return

      if (!event.newValue) {
        if (latestPersistedDraftRef.current || draft) {
          setDraftConflict({ kind: 'cleared', draft: null })
          reportEstimatorDraftDiagnostic({
            event: 'external_clear',
            reason: 'replaced',
            schemaVersion: ESTIMATOR_DRAFT_SCHEMA_VERSION,
            estimatorVersion: ESTIMATOR_DRAFT_ESTIMATOR_VERSION,
          })
        }
        return
      }

      const remote = parseEstimatorDraft<TState>(event.newValue, Date.now(), maxAgeMs, validateState)
      if (!remote) return
      const known = latestPersistedDraftRef.current ?? draft
      if (known && compareEstimatorDrafts(remote, known) <= 0) {
        // localStorage is last-writer-wins physically, so a tab that still
        // holds the deterministic winner must rewrite it if a lower-ranked
        // concurrent write reached the shared key afterward.
        if (compareEstimatorDrafts(remote, known) < 0) {
          try {
            localStorage.setItem(keyRef.current, JSON.stringify(known))
            markStorageAvailable()
          } catch {
            markStorageFailure('write')
          }
        }
        return
      }

      latestPersistedDraftRef.current = remote
      localWriteSequenceRef.current = Math.max(localWriteSequenceRef.current, remote.writeSequence)
      reportEstimatorDraftDiagnostic({
        event: 'external_update',
        reason: 'replaced',
        schemaVersion: ESTIMATOR_DRAFT_SCHEMA_VERSION,
        estimatorVersion: ESTIMATOR_DRAFT_ESTIMATOR_VERSION,
      })

      if (draftDecisionPendingRef.current || !latestInputRef.current) {
        draftDecisionPendingRef.current = true
        setDraft(remote)
        setHasDraft(true)
      } else {
        setDraftConflict({ kind: 'updated', draft: remote })
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [draft, markStorageAvailable, markStorageFailure, maxAgeMs, validateState])

  // Route transitions and mobile browser suspension can happen before the
  // debounce fires. pagehide/visibilitychange cover those cases; the cleanup
  // function is the final local-navigation fallback.
  useEffect(() => {
    const flushOnPageHide = () => flushRef.current()
    const flushOnVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushRef.current()
    }

    window.addEventListener('pagehide', flushOnPageHide)
    document.addEventListener('visibilitychange', flushOnVisibilityChange)
    return () => {
      flushRef.current()
      window.removeEventListener('pagehide', flushOnPageHide)
      document.removeEventListener('visibilitychange', flushOnVisibilityChange)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return {
    hasDraft,
    draft,
    restoreDraft,
    dismissDraft,
    renameDraft,
    clearDraft,
    saveDraft,
    saveDraftNow,
    flushDraft,
    suppressAutosaveUntilChanged,
    markUserEdit,
    storageStatus,
    storageFailure,
    draftConflict,
    acknowledgeDraftConflict,
  }
}
