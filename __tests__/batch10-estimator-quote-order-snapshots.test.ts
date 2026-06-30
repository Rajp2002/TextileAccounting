import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    getEstimatorDraftStorageKey,
    parseEstimatorDraft,
    shouldWarnBeforeQuoteRestore,
} from '../lib/estimator-drafts'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

function functionBody(source: string, name: string) {
    const start = source.indexOf(`export async function ${name}`)
    expect(start).toBeGreaterThanOrEqual(0)

    const next = source.indexOf('\nexport async function ', start + 1)
    return source.slice(start, next === -1 ? source.length : next)
}

describe('Batch 10 estimator quote/order snapshots', () => {
    it('stores normalized worker-rate snapshots on quote, order, and market-run write paths', () => {
        const estimatorActions = readProjectFile('app/(dashboard)/owner/estimator/actions.ts')
        const estimatorClient = readProjectFile('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

        expect(estimatorActions).toContain("import { calcWorkerRateSnapshot, normalizeCurrencySnapshot")
        expect(estimatorActions).toContain('const workerRatePerM = calcWorkerRateSnapshot(estimate.weftRows, estimate.perPickCostPaisa ?? 0)')
        expect(estimatorActions).toContain('const workerRatePerM = normalizeCurrencySnapshot(')
        expect(estimatorActions).toContain('worker_rate_per_m:        workerRatePerM')
        expect(estimatorActions).toContain('worker_rate_per_m: workerRatePerM')
        expect(estimatorActions).toContain('worker_rate_per_m:   workerRatePerM')
        expect(estimatorClient).toContain('calcWorkerRateSnapshot(state.weftRows, state.perPickCostPaisa ?? 0)')
    })
})

describe('Batch 10 quote restore draft collision', () => {
    it('uses the same estimator draft key and detects another local draft before restore', () => {
        const nowMs = 1_800_000
        const raw = JSON.stringify({
            state: { warpRows: [] },
            partyName: 'Mahavir Traders',
            qualityLabel: 'DNO-252',
            warpInstruction: '',
            weftInstruction: '',
            savedAt: nowMs - 1_000,
            sourceQuoteId: 'quote-a',
        })

        const parsed = parseEstimatorDraft(raw, nowMs)

        expect(getEstimatorDraftStorageKey('org-1', 'user-1')).toBe('weavly-estimator-draft-org-1-user-1')
        expect(parsed?.partyName).toBe('Mahavir Traders')
        expect(shouldWarnBeforeQuoteRestore(parsed, 'quote-b')).toBe(true)
        expect(shouldWarnBeforeQuoteRestore(parsed, 'quote-a')).toBe(false)
        expect(parseEstimatorDraft(raw, nowMs + 25 * 60 * 60 * 1000)).toBeNull()
        expect(parseEstimatorDraft('not-json', nowMs)).toBeNull()
    })

    it('quote history prompts before overwriting a different estimator draft', () => {
        const quotesClient = readProjectFile('app/(dashboard)/owner/quotes/QuotesClient.tsx')

        expect(quotesClient).toContain('parseEstimatorDraft<QuoteDraftState>(localStorage.getItem(draftKey))')
        expect(quotesClient).toContain('shouldWarnBeforeQuoteRestore(existingDraft, quote.id)')
        expect(quotesClient).toContain('Replace estimator draft?')
        expect(quotesClient).toContain('Keep draft')
        expect(quotesClient).toContain('Overwrite draft')
    })
})

describe('Batch 10 quote lifecycle transitions', () => {
    it('rejects direct draft-to-accepted and exposes only valid quote history actions', () => {
        const estimatorActions = readProjectFile('app/(dashboard)/owner/estimator/actions.ts')
        const updateQuoteStatus = functionBody(estimatorActions, 'updateQuoteStatus')
        const quotesClient = readProjectFile('app/(dashboard)/owner/quotes/QuotesClient.tsx')

        expect(updateQuoteStatus).toContain("draft: ['sent']")
        expect(updateQuoteStatus).toContain("sent: ['accepted', 'rejected']")
        expect(updateQuoteStatus).not.toContain("current.status === 'draft' && status === 'accepted'")
        expect(updateQuoteStatus).not.toContain("current.status = 'sent'")
        expect(quotesClient).toContain("quote.status === 'draft' && !linkedOrder")
        expect(quotesClient).toContain("handleStatusChange(quote.id, 'sent')")
        expect(quotesClient).toContain("quote.status === 'sent' && !linkedOrder")
        expect(quotesClient).toContain("handleStatusChange(quote.id, 'rejected')")
    })
})
