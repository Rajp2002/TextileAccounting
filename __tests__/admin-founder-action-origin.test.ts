import { beforeEach, describe, expect, it, vi } from 'vitest'

// Founder mutations must come from this application, like the support and formal actions.
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ goLive: vi.fn(), extendTrials: vi.fn(), setFactoryCohort: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getVerifiedIdentity: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin/founder', () => ({ requireFounder: vi.fn() }))
vi.mock('@/lib/admin/paid-plans', () => ({ goLive: mocks.goLive, extendTrials: mocks.extendTrials }))
vi.mock('@/lib/admin/cohort', () => ({ setFactoryCohort: mocks.setFactoryCohort }))

import { POST as goLiveRoute } from '@/app/api/admin/paid-plans/go-live/route'
import { POST as extendRoute } from '@/app/api/admin/paid-plans/extend/route'
import { POST as cohortRoute } from '@/app/api/admin/factories/[orgId]/cohort/route'

const ORIGIN = 'https://weavly.example.test'
const orgId = '00000000-0000-4000-8000-0000000000a1'
const post = (path: string, headers: Record<string, string>, body = '{}') => new Request(`${ORIGIN}${path}`, { method: 'POST', headers, body })
const sameOrigin = { Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' }
const crossSite = { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site', 'Content-Type': 'application/json' }
const params = { params: Promise.resolve({ orgId }) }

beforeEach(() => {
    vi.clearAllMocks()
    mocks.goLive.mockResolvedValue({ goLiveAt: '2027-03-12T05:00:00Z', movedTrials: 0 })
    mocks.extendTrials.mockResolvedValue({ total: 0, alreadyEnded: 0, newEnd: '2027-01-01T00:00:00Z' })
    mocks.setFactoryCohort.mockResolvedValue({ orgId, cohort: 'test' })
})

describe('founder action routes', () => {
    it('refuse cross-site requests before doing anything', async () => {
        expect((await goLiveRoute(post('/api/admin/paid-plans/go-live', crossSite))).status).toBe(403)
        expect((await extendRoute(post('/api/admin/paid-plans/extend', crossSite, '{"newEnd":"2027-01-01T00:00:00Z","dryRun":true}'))).status).toBe(403)
        expect((await cohortRoute(post(`/api/admin/factories/${orgId}/cohort`, crossSite, '{"cohort":"test"}'), params)).status).toBe(403)
        expect(mocks.goLive).not.toHaveBeenCalled()
        expect(mocks.extendTrials).not.toHaveBeenCalled()
        expect(mocks.setFactoryCohort).not.toHaveBeenCalled()
    })

    it('require JSON', async () => {
        expect((await goLiveRoute(post('/api/admin/paid-plans/go-live', { ...sameOrigin, 'Content-Type': 'text/plain' }))).status).toBe(400)
        expect(mocks.goLive).not.toHaveBeenCalled()
    })

    it('accept same-origin JSON', async () => {
        expect((await goLiveRoute(post('/api/admin/paid-plans/go-live', sameOrigin))).status).toBe(200)
        expect((await extendRoute(post('/api/admin/paid-plans/extend', sameOrigin, '{"newEnd":"2027-01-01T00:00:00Z","dryRun":true}'))).status).toBe(200)
        expect((await cohortRoute(post(`/api/admin/factories/${orgId}/cohort`, sameOrigin, '{"cohort":"test"}'), params)).status).toBe(200)
        expect(mocks.extendTrials).toHaveBeenCalledWith({ newEnd: '2027-01-01T00:00:00Z', dryRun: true })
        expect(mocks.setFactoryCohort).toHaveBeenCalledWith(orgId, { cohort: 'test' })
    })
})
