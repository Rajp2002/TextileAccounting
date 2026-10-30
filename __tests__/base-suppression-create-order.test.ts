import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Behavioural check of the Base gate in POST /api/billing/create-order. The real
// handler runs; every service it reaches is a stub, so no tenant, provider or
// database call happens unless the gate lets the request through.

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(), from: vi.fn(), rpc: vi.fn(), createAdmin: vi.fn(), getRazorpay: vi.fn(),
    getOrgPlanAccess: vi.fn(), getBillingReadiness: vi.fn(), captureException: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdmin }))
vi.mock('@/lib/razorpay', () => ({ getRazorpay: mocks.getRazorpay }))
vi.mock('@/lib/subscription', () => ({ getOrgPlanAccess: mocks.getOrgPlanAccess }))
vi.mock('@/lib/billing-readiness', () => ({ getBillingReadiness: mocks.getBillingReadiness }))
// Paid plans are open in these tests; the pre-go-live gate is covered in paid-plans.test.ts.
vi.mock('@/lib/paid-plans.server', () => ({ getPaidPlansState: async () => ({ live: true, goLiveAt: '2027-01-01T00:00:00Z', checkoutOpen: true }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException }))

import { POST as createOrder } from '@/app/api/billing/create-order/route'

const userId = '00000000-0000-4000-8000-000000000031'
const orgId = '00000000-0000-4000-8000-000000000032'
const BASE_CLOSED = 'Weavly Base is not available for new accounts yet.'

const request = (body: Record<string, unknown>) => new NextRequest('https://weavly.example.test/api/billing/create-order', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Origin: 'https://weavly.example.test' },
})

/** A profiles query chain that resolves the signed-in owner's profile. */
function profileChain() {
    const chain: Record<string, unknown> = {}
    chain.select = () => chain
    chain.eq = () => chain
    chain.single = () => Promise.resolve({ data: { org_id: orgId, role: 'owner', full_name: 'Synthetic Owner' }, error: null })
    return chain
}

beforeEach(() => {
    vi.resetAllMocks()
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId, email: 'synthetic-owner@example.test' } } })
    mocks.from.mockImplementation((table: string) => {
        if (table !== 'profiles') throw new Error(`Unexpected tenant read of ${table} before the gate`)
        return profileChain()
    })
    mocks.createAdmin.mockImplementation(() => ({ rpc: mocks.rpc }))
    // Readiness refuses after the gates. Any request that passes the Base gate stops here with a 503.
    mocks.getBillingReadiness.mockReturnValue({
        canCreateOrder: false, mode: 'blocked', code: 'gateway_not_configured', publicMessage: 'Billing is not configured.', missing: [],
    })
})

describe('create-order refuses Base for an organization that cannot view Base', () => {
    it.each([
        ['missing', {}],
        ['false', { baseVisible: false }],
    ])('returns 403 before any pricing, claim or provider call when baseVisible is %s', async (_label, access) => {
        mocks.getOrgPlanAccess.mockResolvedValue(access)
        const response = await createOrder(request({ planTier: 'base' }))

        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ error: BASE_CLOSED })
        expect(mocks.getOrgPlanAccess).toHaveBeenCalledWith(orgId)
        expect(mocks.createAdmin).not.toHaveBeenCalled()
        expect(mocks.rpc).not.toHaveBeenCalled()
        expect(mocks.getRazorpay).not.toHaveBeenCalled()
    })
})

describe('create-order lets an organization that can view Base past the Base gate', () => {
    it('continues past the gate for baseVisible true and stops at the readiness refusal', async () => {
        mocks.getOrgPlanAccess.mockResolvedValue({ baseVisible: true })
        const response = await createOrder(request({ planTier: 'base' }))

        expect(response.status).toBe(503)
        expect(await response.json()).toMatchObject({ code: 'gateway_not_configured' })
        expect(mocks.getOrgPlanAccess).toHaveBeenCalledWith(orgId)
        expect(mocks.rpc).not.toHaveBeenCalled()
        expect(mocks.getRazorpay).not.toHaveBeenCalled()
    })
})

describe('create-order does not read Base access for Lite', () => {
    it.each([
        ['an explicit Lite tier', { planTier: 'lite' }],
        ['a missing tier, which defaults to Lite', {}],
    ])('never calls getOrgPlanAccess for %s', async (_label, body) => {
        const response = await createOrder(request(body))

        expect(mocks.getOrgPlanAccess).not.toHaveBeenCalled()
        expect(response.status).toBe(503)
        expect(mocks.getBillingReadiness).toHaveBeenCalledOnce()
    })
})
