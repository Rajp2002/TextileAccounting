import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { computeCheckoutOpen } from '@/lib/paid-plans'

// Release 2 (spec 2026-10-30 section C2): no real checkout before go-live.

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(), from: vi.fn(), rpc: vi.fn(), createAdmin: vi.fn(), getRazorpay: vi.fn(),
    getOrgPlanAccess: vi.fn(), getBillingReadiness: vi.fn(), captureException: vi.fn(), paidPlans: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdmin }))
vi.mock('@/lib/razorpay', () => ({ getRazorpay: mocks.getRazorpay }))
vi.mock('@/lib/subscription', () => ({ getOrgPlanAccess: mocks.getOrgPlanAccess }))
vi.mock('@/lib/billing-readiness', () => ({ getBillingReadiness: mocks.getBillingReadiness }))
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException }))
vi.mock('@/lib/paid-plans.server', () => ({ getPaidPlansState: mocks.paidPlans }))

import { POST as createOrder } from '@/app/api/billing/create-order/route'

const userId = '00000000-0000-4000-8000-000000000061'
const orgId = '00000000-0000-4000-8000-000000000062'
const request = (body: Record<string, unknown>) => new NextRequest('https://weavly.example.test/api/billing/create-order', {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Origin: 'https://weavly.example.test' },
})
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
    mocks.getOrgPlanAccess.mockResolvedValue({ baseVisible: false })
    mocks.getBillingReadiness.mockReturnValue({ canCreateOrder: true, mode: 'test', code: 'test_ready', publicMessage: 'Test checkout.', missing: [] })
})

describe('computeCheckoutOpen', () => {
    it.each([
        [null, false, 'test', false], [null, true, 'test', true], [null, true, 'blocked', false], [null, false, 'live', false],
        ['2027-01-01T00:00:00Z', false, 'live', true], ['2027-01-01T00:00:00Z', false, 'test', false], ['2027-01-01T00:00:00Z', true, 'test', true],
    ] as const)('computeCheckoutOpen(%s, %s, %s) is %s', (goLive, test, mode, open) => {
        expect(computeCheckoutOpen(goLive, test, mode)).toBe(open)
    })
})

describe('create-order before go-live', () => {
    it('refuses a real account with PAID_PLANS_NOT_OPEN before any claim or provider call', async () => {
        mocks.paidPlans.mockResolvedValueOnce({ live: false, goLiveAt: null, checkoutOpen: false })
        const res = await createOrder(request({ planTier: 'lite', clientRequestId: randomUUID() }))
        expect(res.status).toBe(409)
        expect(await res.json()).toMatchObject({ code: 'PAID_PLANS_NOT_OPEN' })
        expect(mocks.paidPlans).toHaveBeenCalledWith(orgId)
        expect(mocks.rpc).not.toHaveBeenCalled()
        expect(mocks.getRazorpay).not.toHaveBeenCalled()
    })
})

describe('paid-plans state reaches every pay button', () => {
    it.each(['app/(dashboard)/owner/layout.tsx', 'app/free/layout.tsx', 'app/(plan-selection)/plans/page.tsx'])('%s provides paid-plans state', file => {
        expect(readFileSync(file, 'utf8')).toContain('<PaidPlansProvider')
    })
})
