import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    parseEstimatorDraft,
    shouldAutoRestoreEstimatorDraft,
    type EstimatorAutosaveData,
} from '../lib/estimator-drafts'

const root = process.cwd()

function makeDraft(
    overrides: Partial<EstimatorAutosaveData<{ marker: string }>> = {}
): EstimatorAutosaveData<{ marker: string }> {
    return {
        state: { marker: 'saved-costing' },
        partyName: '',
        qualityLabel: 'DNO-252',
        warpInstruction: '',
        weftInstruction: '',
        savedAt: 1_800_000,
        ...overrides,
    }
}

describe('EST-RDY-02 saved-costing restore intent', () => {
    it('round-trips the explicit entry marker for edit and duplicate navigation', () => {
        const edit = parseEstimatorDraft(
            JSON.stringify(makeDraft({
                sourceQuoteId: 'quote-a',
                sourceQuoteUpdatedAt: '2026-07-18T11:00:00.000Z',
                restoreOnEstimatorEntry: true,
            })),
            1_800_100
        )
        const duplicate = parseEstimatorDraft(
            JSON.stringify(makeDraft({ restoreOnEstimatorEntry: true })),
            1_800_100
        )

        expect(edit?.restoreOnEstimatorEntry).toBe(true)
        expect(duplicate?.restoreOnEstimatorEntry).toBe(true)
        expect(shouldAutoRestoreEstimatorDraft(edit)).toBe(true)
        expect(shouldAutoRestoreEstimatorDraft(duplicate)).toBe(true)
    })

    it('automatically resumes an autosaved edit session but keeps ordinary drafts opt-in', () => {
        expect(shouldAutoRestoreEstimatorDraft(makeDraft({
            sourceQuoteId: 'quote-a',
        }))).toBe(true)
        expect(shouldAutoRestoreEstimatorDraft(makeDraft())).toBe(false)
        expect(shouldAutoRestoreEstimatorDraft(null)).toBe(false)
    })

    it('does not trust malformed restore markers from browser storage', () => {
        const parsed = parseEstimatorDraft(
            JSON.stringify(makeDraft({
                restoreOnEstimatorEntry: 'yes' as unknown as boolean,
            })),
            1_800_100
        )

        expect(parsed?.restoreOnEstimatorEntry).toBeUndefined()
        expect(shouldAutoRestoreEstimatorDraft(parsed)).toBe(false)
    })

    it('marks every explicit Saved Cost Estimate handoff for immediate restore', () => {
        const quotesClient = readFileSync(
            join(root, 'app/(dashboard)/owner/quotes/QuotesClient.tsx'),
            'utf8'
        )

        expect(quotesClient).toContain('const newDraft: EstimatorAutosaveData<QuoteDraftState>')
        expect(quotesClient).toContain('restoreOnEstimatorEntry: true')
        expect(quotesClient).toContain('sourceQuoteId: isDuplicate ? undefined : quote.id')
        expect(quotesClient).toContain("router.push('/owner/estimator')")
    })

    it('auto-applies explicit handoffs once while retaining the manual recovery button', () => {
        const estimatorClient = readFileSync(
            join(root, 'app/(dashboard)/owner/estimator/EstimatorClient.tsx'),
            'utf8'
        )

        expect(estimatorClient).toContain('const applyEstimatorDraft = useCallback(() => {')
        expect(estimatorClient).toContain('shouldAutoRestoreEstimatorDraft(draft)')
        expect(estimatorClient).toContain('autoRestoredDraftSavedAtRef.current === draft.savedAt')
        expect(estimatorClient).toContain("setSourceQuoteId(restored.sourceQuoteId ?? null)")
        expect(estimatorClient).toContain('onClick={applyEstimatorDraft}')
        expect(estimatorClient).toContain("{draft.sourceQuoteId ? 'Load Specs' : 'Restore'}")
    })
})
