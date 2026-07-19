import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseEstimatorDraft } from '../lib/estimator-drafts'
import {
    ESTIMATOR_OFFLINE_SAVE_TITLE,
    getEstimatorSubmitFailureCopy,
    isLikelyEstimatorNetworkFailure,
} from '../lib/estimator-submit-recovery'
import { createClientRequestUuid } from '../lib/client-request-id'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

function sourceBlock(source: string, startNeedle: string, endNeedle: string) {
    const start = source.indexOf(startNeedle)
    expect(start).toBeGreaterThanOrEqual(0)
    const end = source.indexOf(endNeedle, start + startNeedle.length)
    expect(end).toBeGreaterThan(start)
    return source.slice(start, end)
}

describe('EST-RDY-08 Estimator offline failure and retry safety', () => {
    it('creates a valid request UUID when randomUUID is unavailable on LAN HTTP', () => {
        const bytes = Uint8Array.from({ length: 16 }, (_, index) => index)
        const requestId = createClientRequestUuid({
            getRandomValues(target) {
                target.set(bytes)
                return target
            },
        })

        expect(requestId).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
        expect(requestId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        )
    })

    it('falls back when an exposed randomUUID method rejects an insecure origin', () => {
        const requestId = createClientRequestUuid({
            randomUUID() {
                throw new TypeError('randomUUID is unavailable in this context')
            },
            getRandomValues(target) {
                target.fill(255)
                return target
            },
        })

        expect(requestId).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
    })

    it('maps offline and transport failures to truthful recovery guidance', () => {
        expect(isLikelyEstimatorNetworkFailure(new TypeError('Failed to fetch'))).toBe(true)
        expect(isLikelyEstimatorNetworkFailure(new Error('Load failed'))).toBe(true)
        expect(isLikelyEstimatorNetworkFailure(new Error('Validation failed'))).toBe(false)

        expect(getEstimatorSubmitFailureCopy(new Error('anything'), false, true)).toEqual({
            title: ESTIMATOR_OFFLINE_SAVE_TITLE,
            description: 'Your current inputs are saved on this device. Reconnect, then use Save Costing or Update Costing again.',
            retryable: true,
        })
        expect(getEstimatorSubmitFailureCopy(new Error('Validation failed'), true, true)).toEqual({
            title: 'Validation failed',
            retryable: false,
        })
    })

    it('round-trips only valid persisted request identities', () => {
        const baseDraft = {
            state: { marker: 'offline-retry' },
            partyName: 'Offline Costing',
            qualityLabel: 'OFF-001',
            warpInstruction: '',
            weftInstruction: '',
            savedAt: 1_800_000,
        }
        const validId = '123e4567-e89b-42d3-a456-426614174000'

        expect(parseEstimatorDraft(
            JSON.stringify({ ...baseDraft, clientRequestId: validId }),
            1_800_100
        )?.clientRequestId).toBe(validId)
        expect(parseEstimatorDraft(
            JSON.stringify({ ...baseDraft, clientRequestId: 'not-a-uuid' }),
            1_800_100
        )?.clientRequestId).toBeUndefined()
    })

    it('flushes the draft and request identity before the server action', () => {
        const client = readProjectFile('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
        const handler = sourceBlock(
            client,
            'const handleSaveQuote = async',
            '    const handleStartPartyOrder = async'
        )

        expect(client).toContain('const isOnline = useOnlineStatus()')
        expect(client).toContain('quoteRequestIdRef.current = restored.clientRequestId ?? null')
        expect(handler).toContain("typeof navigator === 'undefined' || navigator.onLine")
        expect(handler).toContain('const draftSaved = saveDraftNow(buildCurrentDraft())')
        expect(handler).toContain('const draftSavedBeforeSubmit = saveDraftNow(buildCurrentDraft(clientRequestId))')
        expect(handler).toContain('clientRequestId:          clientRequestId!')
        expect(handler).toContain('quoteRequestIdRef.current ?? createClientRequestUuid()')
        expect(handler.indexOf('saveDraftNow(buildCurrentDraft(clientRequestId))'))
            .toBeLessThan(handler.indexOf('saveEstimatorQuoteV3({'))
        expect(handler).toContain('duration: failure.retryable ? Infinity : undefined')
        expect(handler).toContain("router.push('/owner/quotes')")
    })

    it('retains database idempotency and stale-update guards behind the retry', () => {
        const action = readProjectFile('app/(dashboard)/owner/estimator/actions.ts')
        const migration = readProjectFile(
            'supabase/migrations/20260710110907_enforce_standalone_estimator_boundary.sql'
        )

        expect(action).toContain(".eq('client_request_id', params.clientRequestId)")
        expect(action).toContain('idempotentReplay: true')
        expect(action).toContain(".eq('updated_at', params.expectedSourceUpdatedAt!)")
        expect(migration).toContain('estimator_quotes_org_client_request_unique')
        expect(migration).toContain('ON public.estimator_quotes (org_id, client_request_id)')
    })
})

describe('EST-RDY-07 installed Base PWA launch contract', () => {
    it('launches at the Base product home while preserving explicit update activation', () => {
        const manifest = readProjectFile('app/manifest.ts')
        const nextConfig = readProjectFile('next.config.ts')
        const updateNotice = readProjectFile('components/pwa-update-notice.tsx')

        expect(manifest).toContain("start_url: '/owner/estimator'")
        expect(manifest).toContain("display: 'standalone'")
        expect(nextConfig).toContain('skipWaiting: false')
        expect(nextConfig).toContain('clientsClaim: false')
        expect(updateNotice).toContain("waitingWorker.postMessage({ type: 'SKIP_WAITING' })")
        expect(updateNotice).toContain('controllerchange')
        expect(updateNotice).toContain('const hadControllerAtMount = Boolean(navigator.serviceWorker.controller)')
        expect(updateNotice).toContain('if (!registration.waiting && !allowAlreadyActivatedWorker) return')
        expect(updateNotice).toContain('if (!hadControllerAtMount) return')
        expect(updateNotice).toContain('id: UPDATE_TOAST_ID')
    })

    it('never caches authenticated document, RSC, Next data, or API responses', () => {
        const nextConfig = readProjectFile('next.config.ts')
        const runtimeCaching = sourceBlock(
            nextConfig,
            '    runtimeCaching: [',
            '    ],\n  },'
        )

        expect(nextConfig).toContain('dynamicStartUrl: false')
        expect(nextConfig).toContain('extendDefaultRuntimeCaching: true')
        expect(nextConfig).toContain("document: '/_offline'")
        expect(runtimeCaching.match(/handler: 'NetworkOnly'/g)).toHaveLength(5)
        expect(runtimeCaching).toContain("cacheName: 'next-data'")
        expect(runtimeCaching).toContain("cacheName: 'apis'")
        expect(runtimeCaching).toContain("cacheName: 'pages-rsc-prefetch'")
        expect(runtimeCaching).toContain("cacheName: 'pages-rsc'")
        expect(runtimeCaching).toContain("cacheName: 'pages'")
        expect(runtimeCaching).toContain("request.mode === 'navigate'")
        expect(runtimeCaching).not.toContain('NetworkFirst')
        expect(runtimeCaching).not.toContain('CacheFirst')
        expect(runtimeCaching).not.toContain('StaleWhileRevalidate')
    })
})
