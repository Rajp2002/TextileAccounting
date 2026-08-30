import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  compareEstimatorDrafts,
  createEstimatorDraft,
  ESTIMATOR_DRAFT_ESTIMATOR_VERSION,
  ESTIMATOR_DRAFT_SCHEMA_VERSION,
  parseEstimatorDraft,
} from '../lib/estimator-drafts'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const input = {
  state: { warpRows: [], weftRows: [], enabledSections: {} },
  partyName: 'QA party',
  qualityLabel: 'QA quality',
  warpInstruction: 'warp',
  weftInstruction: 'weft',
}

describe('P1 estimator draft recovery contract', () => {
  it('writes a versioned payload and preserves its original creation timestamp', () => {
    const first = createEstimatorDraft(input, {
      draftId: 'draft-fixed',
      createdAt: 1_000,
      savedAt: 2_000,
      writerId: 'tab-a',
      writeSequence: 1,
    })
    const second = createEstimatorDraft(input, {
      draftId: first.draftId,
      createdAt: first.createdAt,
      savedAt: 3_000,
      writerId: 'tab-a',
      writeSequence: 2,
    })

    expect(first).toMatchObject({
      schemaVersion: ESTIMATOR_DRAFT_SCHEMA_VERSION,
      estimatorVersion: ESTIMATOR_DRAFT_ESTIMATOR_VERSION,
      draftId: 'draft-fixed',
      createdAt: 1_000,
      savedAt: 2_000,
    })
    expect(second.createdAt).toBe(1_000)
    expect(second.savedAt).toBe(3_000)
  })

  it('rejects malformed, stale, future, and explicitly outdated payloads', () => {
    const valid = createEstimatorDraft(input, { savedAt: 10_000, createdAt: 9_000 })
    const raw = JSON.stringify(valid)

    expect(parseEstimatorDraft(raw, 10_000)?.qualityLabel).toBe('QA quality')
    expect(parseEstimatorDraft(JSON.stringify({ ...valid, state: null }), 10_000)).toBeNull()
    expect(parseEstimatorDraft(JSON.stringify({ ...valid, schemaVersion: 0 }), 10_000)).toBeNull()
    expect(parseEstimatorDraft(JSON.stringify({ ...valid, estimatorVersion: 'estimator_v2' }), 10_000)).toBeNull()
    expect(parseEstimatorDraft(JSON.stringify({ ...valid, savedAt: 1 }), 10_000)).toBeNull()
    expect(parseEstimatorDraft(JSON.stringify({ ...valid, savedAt: 10_000 + 24 * 60 * 60 * 1000 + 1 }), 10_000)).toBeNull()
    expect(parseEstimatorDraft('not-json', 10_000)).toBeNull()
  })

  it('orders same-key two-tab writes deterministically', () => {
    const tabA = createEstimatorDraft(input, {
      draftId: 'draft-shared',
      savedAt: 20_000,
      createdAt: 10_000,
      writerId: 'tab-a',
      writeSequence: 2,
    })
    const tabB = createEstimatorDraft(input, {
      draftId: 'draft-shared',
      savedAt: 20_000,
      createdAt: 10_000,
      writerId: 'tab-b',
      writeSequence: 2,
    })
    const later = createEstimatorDraft(input, {
      draftId: 'draft-shared',
      savedAt: 21_000,
      createdAt: 10_000,
      writerId: 'tab-a',
      writeSequence: 3,
    })

    expect(compareEstimatorDrafts(tabB, tabA)).toBeGreaterThan(0)
    expect(compareEstimatorDrafts(later, tabB)).toBeGreaterThan(0)
  })
})

describe('P1 estimator recovery integration guards', () => {
  it('flushes quick route/page transitions and observes cross-tab replacement', () => {
    const autosave = read('hooks/useAutosave.ts')
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

    expect(autosave).toContain("window.addEventListener('pagehide'")
    expect(autosave).toContain("document.addEventListener('visibilitychange'")
    expect(autosave).toContain('flushRef.current()')
    expect(autosave).toContain("window.addEventListener('storage'")
    expect(autosave).toContain('A newer remote write is surfaced')
    expect(estimator).toContain('aria-label="Restore draft"')
    expect(estimator).toContain('Resume')
    expect(estimator).toContain('Discard draft')
    expect(estimator).not.toContain('aria-label="Start fresh"')
    expect(estimator).toContain('draft.createdAt')
  })

  it('keeps autosave browser-only and leaves saved-costing writes explicit', () => {
    const autosave = read('hooks/useAutosave.ts')
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const quotes = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')

    expect(autosave).not.toContain('saveEstimatorQuoteV3')
    expect(autosave).not.toContain('.from(\'estimator_quotes\')')
    expect(estimator).toContain('saveEstimatorQuoteV3({')
    expect(estimator).toContain('clearDraft()')
    expect(quotes).toContain('createEstimatorDraft<QuoteDraftState>')
  })

  it('keeps diagnostics bounded and logout cleanup scoped to draft keys', () => {
    const drafts = read('lib/estimator-drafts.ts')
    const cleanup = read('lib/client-storage-cleanup.ts')
    const logout = read('components/auth/logout-button.tsx')

    expect(drafts).toContain("ESTIMATOR_DRAFT_DIAGNOSTIC_EVENT = 'weavly:estimator-draft-diagnostic'")
    expect(drafts).toContain("console.info('[estimator-draft]', safeDetail)")
    expect(drafts).not.toContain('console.error(error')
    expect(cleanup).toContain("'weavly-estimator-draft-'")
    expect(cleanup).toContain('isLegacyUserCacheKey')
    expect(logout).toContain('clearUserCacheFromStorage(window.localStorage')
    expect(logout.indexOf('clearUserCacheFromStorage(window.localStorage')).toBeGreaterThan(
      logout.indexOf('detachActiveQueryNamespace()'),
    )
  })
})
