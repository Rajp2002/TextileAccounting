import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    ESTIMATOR_DRAFT_MAX_AGE_MS,
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

        expect(estimatorActions).toContain('calcFullTotals, calcWorkerRateSnapshot, normalizeCurrencySnapshot')
        expect(estimatorActions).toContain('const workerRatePerM = calcWorkerRateSnapshot(estimate.weftRows, estimate.perPickCostPaisa ?? 0)')
        expect(estimatorActions.match(/const workerRatePerM = calcWorkerRateSnapshot\(/g)?.length).toBeGreaterThanOrEqual(3)
        expect(functionBody(estimatorActions, 'startPartyOrderFromEstimator')).not.toContain('input.workerRatePerM')
        expect(functionBody(estimatorActions, 'createMarketRunFromEstimator')).not.toContain('params.workerRatePerM')
        // Package 2C: both live costing saves pass the snapshot to the shared
        // payload builder; the retired market-run path still writes it inline.
        expect(readProjectFile('lib/estimator-quote-payload.ts')).toContain('worker_rate_per_m: input.workerRatePerM')
        expect(functionBody(estimatorActions, 'saveEstimatorQuoteV3')).toContain('        workerRatePerM,\n')
        expect(functionBody(estimatorActions, 'saveAsFabricTemplate')).toContain('        workerRatePerM,\n')
        expect(functionBody(estimatorActions, 'createMarketRunFromEstimator')).toContain('worker_rate_per_m:        workerRatePerM')
        expect(estimatorClient).not.toContain('calcWorkerRateSnapshot(state.weftRows, state.perPickCostPaisa ?? 0)')
    })

    it('persists delivered landed cost rather than dropping commission and transport', () => {
        const estimatorActions = readProjectFile('app/(dashboard)/owner/estimator/actions.ts')
        const saveQuote = functionBody(estimatorActions, 'saveEstimatorQuoteV3')
        const startOrder = functionBody(estimatorActions, 'startPartyOrderFromEstimator')

        expect(estimatorActions).toContain('landedCostPerM: result.landedCostPerM')
        expect(estimatorActions).toContain('const result = buildCostingResult(estimate, totals)')
        expect(saveQuote).toContain('        result: authoritative.result,\n')
        expect(readProjectFile('lib/estimator-quote-payload.ts')).toContain('landed_cost_per_meter: result.landedCostPerM')
        expect(startOrder).toContain('p_landed_cost_per_meter: authoritative.landedCostPerM')
        expect(startOrder).not.toContain('p_landed_cost_per_meter: authoritative.productionCostPerM')
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
            sourceQuoteUpdatedAt: '2026-07-10T11:00:00.000Z',
        })

        const parsed = parseEstimatorDraft(raw, nowMs)

        expect(getEstimatorDraftStorageKey('org-1', 'user-1')).toBe('weavly-estimator-draft-org-1-user-1')
        expect(parsed?.partyName).toBe('Mahavir Traders')
        expect(parsed?.sourceQuoteUpdatedAt).toBe('2026-07-10T11:00:00.000Z')
        expect(shouldWarnBeforeQuoteRestore(parsed, 'quote-b')).toBe(true)
        expect(shouldWarnBeforeQuoteRestore(parsed, 'quote-a')).toBe(false)
        expect(parseEstimatorDraft(raw, nowMs + ESTIMATOR_DRAFT_MAX_AGE_MS + 1)).toBeNull()
        expect(parseEstimatorDraft('not-json', nowMs)).toBeNull()
    })

    it('quote history prompts before overwriting a different estimator draft', () => {
        const quotesClient = readProjectFile('app/(dashboard)/owner/quotes/QuotesClient.tsx')

        expect(quotesClient).toContain('parseEstimatorDraft<QuoteDraftState>(localStorage.getItem(draftKey))')
        expect(quotesClient).toContain('shouldWarnBeforeQuoteRestore(existingDraft, restoreIdentity)')
        expect(quotesClient).toContain('Replace estimator draft?')
        expect(quotesClient).toContain('Keep draft')
        expect(quotesClient).toContain('Overwrite draft')
    })
})

describe('Estimator persistence safety', () => {
    it('makes quote saves idempotent and protects stale draft updates', () => {
        const estimatorActions = readProjectFile('app/(dashboard)/owner/estimator/actions.ts')
        const saveQuote = functionBody(estimatorActions, 'saveEstimatorQuoteV3')
        const estimatorClient = readProjectFile('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

        expect(saveQuote).toContain(".eq('client_request_id', params.clientRequestId)")
        expect(saveQuote).toContain('clientRequestId: params.clientRequestId,')
        expect(readProjectFile('lib/estimator-quote-payload.ts')).toContain('client_request_id: input.clientRequestId')
        expect(saveQuote).toContain(".eq('updated_at', params.expectedSourceUpdatedAt!)")
        expect(saveQuote).toContain('idempotentReplay: true')
        expect(estimatorClient).toContain('createClientRequestUuid()')
        expect(estimatorClient).toContain('expectedSourceUpdatedAt: sourceQuoteUpdatedAt ?? undefined')
    })

    it('validates template recipes and uses optimistic concurrency on template writes', () => {
        const estimatorActions = readProjectFile('app/(dashboard)/owner/estimator/actions.ts')

        expect(estimatorActions).toContain('function validateTemplateRecipe(data: TemplateRecipeInput)')
        expect(functionBody(estimatorActions, 'saveAsFabricTemplate')).toContain('validateTemplateRecipe(data)')
        expect(functionBody(estimatorActions, 'updateFabricTemplate')).toContain(".eq('updated_at', data.expectedUpdatedAt)")
        expect(functionBody(estimatorActions, 'updateTemplateRates')).toContain(".eq('updated_at', data.expectedUpdatedAt)")
        expect(estimatorActions).toContain('getEffectiveYarnDenier(firstWarp)')
    })

    it('offers immutable accepted-quote re-estimation plus explicit duplicate and archive-first record management', () => {
        const quotesClient = readProjectFile('app/(dashboard)/owner/quotes/QuotesClient.tsx')
        const estimatorActions = readProjectFile('app/(dashboard)/owner/estimator/actions.ts')

        expect(quotesClient).toContain("onClick={() => handleRestore(quote, 'edit')}")
        expect(quotesClient).toContain("onClick={() => handleRestore(quote, 'duplicate')}")
        expect(quotesClient).toContain('sourceQuoteId: isDuplicate ? undefined : quote.id')
        expect(quotesClient).toContain("onClick={() => requestArchiveState(quote)}")
        expect(quotesClient).toContain('This archives only this costing snapshot.')
        expect(quotesClient).not.toContain('Delete this Costing?')
        expect(functionBody(estimatorActions, 'deleteEstimatorQuote')).toContain(".in('status', ['draft', 'rejected'])")
    })

    it('contains browser-storage failures in autosave and quote restore flows', () => {
        const autosave = readProjectFile('hooks/useAutosave.ts')
        const quotesClient = readProjectFile('app/(dashboard)/owner/quotes/QuotesClient.tsx')

        expect(autosave).toContain('function safelyRemoveLocalStorageItem(key: string)')
        expect(autosave).toContain('safelyRemoveLocalStorageItem(keyRef.current)')
        expect(quotesClient).toContain("toast.error(tx('Browser storage is unavailable. The quote could not be opened in the estimator.'))")
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
