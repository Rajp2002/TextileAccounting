import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Release 2 (spec 2026-10-30 section C2): before go-live the pay button becomes
// "Notify me when paid plans open", and each tap is recorded per factory.

const mocks = vi.hoisted(() => ({ getCachedSession: vi.fn(), rpc: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/app/(auth)/onboarding/plans/actions', () => ({ completePlanSelection: async () => ({}) }))
vi.mock('@/lib/auth', () => ({ getCachedSession: mocks.getCachedSession }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))

import { SubscribeButton } from '@/components/billing/SubscribeButton'
import { PlanCard } from '@/components/plans/PlanCard'
import { PaidPlansProvider } from '@/components/billing/PaidPlansProvider'
import { POST } from '@/app/api/billing/notify-me/route'
import { ACCOUNT_PHRASES } from '@/lib/i18n/lite-phrases/account'

const owner = { user: { id: '00000000-0000-4000-8000-000000000071' }, profile: { role: 'owner', org_id: '00000000-0000-4000-8000-000000000072' } }
async function post(body: unknown, session: unknown = owner) {
    mocks.getCachedSession.mockResolvedValueOnce(session)
    return POST(new Request('https://weavly.example.test/api/billing/notify-me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.rpc.mockResolvedValue({ data: 1, error: null })
})

describe('SubscribeButton before go-live', () => {
    it('renders Notify me, not checkout, without an open provider', () => {
        const html = renderToStaticMarkup(<SubscribeButton planTier="lite"/>)
        expect(html).toContain('Notify me when paid plans open')
        expect(html).not.toContain('base_plan.billing.checkout')
        expect(html).toMatch(/min-h-11|h-11/)
    })

    it('renders checkout inside an open provider', () => {
        const html = renderToStaticMarkup(<PaidPlansProvider checkoutOpen><SubscribeButton planTier="lite"/></PaidPlansProvider>)
        expect(html).not.toContain('Notify me')
        expect(html).toContain('base_plan.billing.checkout')
    })
})

describe('POST /api/billing/notify-me', () => {
    it('records interest with the profile org and the caller', async () => {
        const res = await post({ source: 'plan_card' })
        expect(res.status).toBe(202)
        expect(await res.json()).toEqual({ taps: 1 })
        expect(mocks.rpc).toHaveBeenCalledWith('record_paid_plan_interest', { p_org_id: owner.profile.org_id, p_user_id: owner.user.id, p_source: 'plan_card' })
    })

    it('validates the source and the caller', async () => {
        expect((await post({ source: 'email' })).status).toBe(400)
        expect((await post({ source: 'billing', orgId: 'x' })).status).toBe(400)
        expect((await post({ source: 'billing' }, null)).status).toBe(401)
        expect((await post({ source: 'billing' }, { ...owner, profile: { ...owner.profile, role: 'supervisor' } })).status).toBe(403)
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('500 without detail when recording fails', async () => {
        mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
        const res = await post({ source: 'billing' })
        expect(res.status).toBe(500)
        expect(await res.text()).not.toContain('boom')
    })
})

describe('notify-me copy', () => {
    it('all three strings have Hindi and Gujarati rows', () => {
        for (const en of ['Notify me when paid plans open', "Thanks. We'll tell you when paid plans open.", 'Could not save your request. Try again.']) {
            const row = ACCOUNT_PHRASES.find(phrase => phrase[0] === en)
            expect(row, en).toBeDefined()
            expect(row!.slice(1).every(text => typeof text === 'string' && text.length > 0)).toBe(true)
        }
    })
})


describe('Plan selection trial entry respects checkout availability', () => {
    const props = { planTier: 'lite' as const, currentPlan: 'unassigned' as const, isOnboarding: true, freeAvailable: true, billingReady: true, busy: false, liteTrialEligible: true, onSelectFree() {}, onOpenPreview() {} }

    it('keeps trial activation and the notify action visible before paid plans open', () => {
        const html = renderToStaticMarkup(<PlanCard {...props} />)
        expect(html).toContain('Start 3-month free trial')
        expect(html).toContain('Notify me when paid plans open')
        expect(html).not.toContain('Or pay now:')
        expect(html).not.toContain('Payment document:')
    })

    it('opens the paid details entry only when checkout is open', () => {
        const html = renderToStaticMarkup(<PaidPlansProvider checkoutOpen><PlanCard {...props} /></PaidPlansProvider>)
        expect(html).toContain('Start 3-month free trial')
        expect(html).toContain('Or pay now:')
        expect(html).not.toContain('Notify me when paid plans open')
    })
})
