import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    requireRole: vi.fn(), assertOrgWritable: vi.fn(), getOrgPlanAccess: vi.fn(),
    getFreeGrant: vi.fn(), canEnrollFree: vi.fn(), finishFreeProvisioning: vi.fn(),
    updateUserById: vi.fn(), refreshSession: vi.fn(), from: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ requireRole: mocks.requireRole, assertOrgWritable: mocks.assertOrgWritable }))
vi.mock('@/lib/subscription', () => ({
    getOrgPlanAccess: mocks.getOrgPlanAccess,
    hasEstablishedPaidHistory: vi.fn((rows: { razorpay_payment_id?: string | null; status?: string }[]) =>
        rows.some((r) => Boolean(r?.razorpay_payment_id) || ['active', 'expired'].includes(r?.status ?? ''))
    ),
}))
vi.mock('@/lib/free-account', () => ({ getFreeGrant: mocks.getFreeGrant, canEnrollFree: mocks.canEnrollFree, finishFreeProvisioning: mocks.finishFreeProvisioning }))
// The trial path is covered in lite-trial-start.test.ts; this file only needs the action module to load.
vi.mock('@/lib/lite-trial.server', () => ({ startLiteTrialForOwner: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: () => ({
        auth: { admin: { updateUserById: mocks.updateUserById } },
        from: mocks.from,
    }),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { refreshSession: mocks.refreshSession } }) }))
import { completePlanSelection } from '../app/(auth)/onboarding/plans/actions'

const user = {
    id: 'owner',
    email: 'owner@example.test',
    email_confirmed_at: '2026-09-08T00:00:00.000Z',
    app_metadata: { plan_selection_pending: true, free_signup: true },
}

beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireRole.mockResolvedValue({ user, profile: { org_id: 'org', role: 'owner' } })
    mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'none' })
    mocks.getFreeGrant.mockResolvedValue(null)
    mocks.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [] }),
        }),
    })
    mocks.updateUserById.mockResolvedValue({ data: { user }, error: null })
    mocks.refreshSession.mockResolvedValue({ error: null })
})

describe('initial plan selection', () => {
    it('rejects an unverified paid selection without marking onboarding complete', async () => {
        expect((await completePlanSelection('paid')).error).toContain('verified')
        expect(mocks.updateUserById).not.toHaveBeenCalled()
    })
    it.each(['lite', 'base'])('opens the estimator only after verified %s activation', async tier => {
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: tier })
        expect(await completePlanSelection('paid')).toEqual({ href: '/owner/estimator' })
        expect(mocks.assertOrgWritable).toHaveBeenCalledWith('org')
        expect(mocks.updateUserById).toHaveBeenCalledWith('owner', { app_metadata: { plan_selection_pending: false } })
        expect(mocks.refreshSession).toHaveBeenCalled()
    })
    it('escapes stale onboarding gate when active paid customer calls completePlanSelection free', async () => {
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'lite' })
        expect(await completePlanSelection('free')).toEqual({ href: '/owner/estimator' })
        expect(mocks.updateUserById).toHaveBeenCalledWith('owner', { app_metadata: { plan_selection_pending: false } })
        expect(mocks.finishFreeProvisioning).not.toHaveBeenCalled()
    })
    it('keeps the Free fallback after an unpaid or cancelled checkout', async () => {
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'free', freeAccount: true })
        mocks.getFreeGrant.mockResolvedValue({ subjectId: 'owner', state: 'active' })
        expect(await completePlanSelection('free')).toEqual({ href: '/free' })
        expect(mocks.finishFreeProvisioning).not.toHaveBeenCalled()
    })
    it('safely resumes already-active Free account when plan_selection_pending is false or absent', async () => {
        mocks.requireRole.mockResolvedValue({
            user: { ...user, app_metadata: { plan_selection_pending: false } },
            profile: { org_id: 'org', role: 'owner' },
        })
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'free', freeAccount: true })
        mocks.getFreeGrant.mockResolvedValue({ subjectId: 'owner', state: 'active' })
        expect(await completePlanSelection('free')).toEqual({ href: '/free' })
        expect(mocks.updateUserById).not.toHaveBeenCalled()
    })
    it('provisions and completes onboarding for eligible unassigned owner', async () => {
        mocks.canEnrollFree.mockResolvedValue(true)
        mocks.finishFreeProvisioning.mockImplementation(async () => {
            mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'free' })
            mocks.getFreeGrant.mockResolvedValue({ subjectId: 'owner', state: 'active' })
            return true
        })
        expect(await completePlanSelection('free')).toEqual({ href: '/free' })
        expect(mocks.updateUserById).toHaveBeenCalledWith('owner', { app_metadata: { plan_selection_pending: false } })
        expect(mocks.refreshSession).toHaveBeenCalled()
    })
    it('preserves the Free enrollment gate', async () => {
        mocks.canEnrollFree.mockResolvedValue(false)
        expect((await completePlanSelection('free')).error).toContain('not available')
        expect(mocks.updateUserById).not.toHaveBeenCalled()
    })
    it('retains the pending step when provisioning fails', async () => {
        mocks.canEnrollFree.mockResolvedValue(true)
        mocks.finishFreeProvisioning.mockRejectedValue(new Error('temporary outage'))
        expect((await completePlanSelection('free')).error).toContain('try again')
        expect(mocks.updateUserById).not.toHaveBeenCalledWith('owner', { app_metadata: { plan_selection_pending: false } })
    })
    it('does not allow a suspended Free grant to complete onboarding', async () => {
        mocks.getFreeGrant.mockResolvedValue({ state: 'suspended' })
        expect((await completePlanSelection('free')).error).toContain('not active')
        expect(mocks.updateUserById).not.toHaveBeenCalled()
    })
    it('cannot turn an existing expired customer into a new Free enrollment', async () => {
        mocks.from.mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                    data: [{ status: 'expired', plan_tier: 'base', current_end: '2026-08-01T00:00:00Z', razorpay_payment_id: 'pay_123' }],
                }),
            }),
        })
        expect((await completePlanSelection('free')).error).toContain('workspace')
        expect(mocks.finishFreeProvisioning).not.toHaveBeenCalled()
    })
    it('returns a recoverable error when refreshed session cookies fail', async () => {
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'base' })
        mocks.refreshSession.mockResolvedValue({ error: new Error('offline') })
        expect(await completePlanSelection('paid')).toEqual({ error: 'Your plan is saved. Please sign in again to continue.' })
    })
})
