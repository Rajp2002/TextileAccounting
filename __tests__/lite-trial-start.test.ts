import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
    requireRole: vi.fn(),
    assertOrgWritable: vi.fn(),
    getOrgPlanAccess: vi.fn(),
    hasEstablishedPaidHistory: vi.fn(),
    getFreeGrant: vi.fn(),
    canEnrollFree: vi.fn(),
    finishFreeProvisioning: vi.fn(),
    rpc: vi.fn(),
    from: vi.fn(),
    updateUserById: vi.fn(),
    refreshSession: vi.fn(),
}))

vi.mock('../lib/auth', () => ({ requireRole: mocks.requireRole, assertOrgWritable: mocks.assertOrgWritable }))
vi.mock('../lib/subscription', () => ({
    getOrgPlanAccess: mocks.getOrgPlanAccess,
    hasEstablishedPaidHistory: mocks.hasEstablishedPaidHistory,
}))
vi.mock('../lib/free-account', () => ({
    getFreeGrant: mocks.getFreeGrant,
    canEnrollFree: mocks.canEnrollFree,
    finishFreeProvisioning: mocks.finishFreeProvisioning,
}))
vi.mock('../lib/supabase/admin', () => ({
    createAdminClient: () => ({
        rpc: mocks.rpc,
        from: mocks.from,
        auth: { admin: { updateUserById: mocks.updateUserById } },
    }),
}))
vi.mock('../lib/supabase/server', () => ({
    createClient: async () => ({ auth: { refreshSession: mocks.refreshSession } }),
}))

import { startLiteTrialForOwner } from '../lib/lite-trial.server'
import { completePlanSelection } from '../app/(auth)/onboarding/plans/actions'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const org = '22222222-2222-4222-8222-222222222222'
const user = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'owner@example.test',
    email_confirmed_at: '2026-09-08T00:00:00.000Z',
    app_metadata: { plan_selection_pending: true, free_signup: true },
}
const NOT_AVAILABLE = 'Your free trial is not available for this account.'
const FREE_SETUP = 'Free setup could not finish. Please try again.'

beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireRole.mockResolvedValue({ user, profile: { org_id: org, role: 'owner' } })
    mocks.assertOrgWritable.mockResolvedValue(undefined)
    mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'none', liteTrialEligible: true })
    mocks.hasEstablishedPaidHistory.mockReturnValue(false)
    mocks.getFreeGrant.mockResolvedValue(null)
    mocks.canEnrollFree.mockResolvedValue(true)
    mocks.finishFreeProvisioning.mockResolvedValue(true)
    mocks.rpc.mockResolvedValue({ data: 'trial-row', error: null })
    mocks.from.mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }),
    })
    mocks.updateUserById.mockResolvedValue({ data: { user }, error: null })
    mocks.refreshSession.mockResolvedValue({ error: null })
})

describe('startLiteTrialForOwner', () => {
    it('refuses when liteTrialEligible is false', async () => {
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'free', liteTrialEligible: false })
        expect(await startLiteTrialForOwner(user, org)).toEqual({ ok: false, error: NOT_AVAILABLE })
        expect(mocks.finishFreeProvisioning).not.toHaveBeenCalled()
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('provisions the Free grant before calling start_lite_trial', async () => {
        expect(await startLiteTrialForOwner(user, org)).toEqual({ ok: true })
        expect(mocks.finishFreeProvisioning).toHaveBeenCalledWith(user, org)
        expect(mocks.rpc).toHaveBeenCalledWith('start_lite_trial', { p_org_id: org })
        expect(mocks.finishFreeProvisioning.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0])
    })

    it('maps LITE_TRIAL_INELIGIBLE to the not-available message and LITE_TRIAL_FREE_GRANT_REQUIRED / provisioning failure to Free setup could not finish. Please try again.', async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: { message: 'LITE_TRIAL_INELIGIBLE' } })
        expect(await startLiteTrialForOwner(user, org)).toEqual({ ok: false, error: NOT_AVAILABLE })

        mocks.rpc.mockResolvedValue({ data: null, error: { message: 'LITE_TRIAL_FREE_GRANT_REQUIRED' } })
        expect(await startLiteTrialForOwner(user, org)).toEqual({ ok: false, error: FREE_SETUP })

        mocks.rpc.mockResolvedValue({ data: null, error: { message: 'connection reset' } })
        expect(await startLiteTrialForOwner(user, org)).toEqual({ ok: false, error: FREE_SETUP })

        mocks.finishFreeProvisioning.mockResolvedValue(false)
        expect(await startLiteTrialForOwner(user, org)).toEqual({ ok: false, error: FREE_SETUP })

        mocks.finishFreeProvisioning.mockRejectedValue(new Error('FREE_PROVISIONING_PENDING'))
        expect(await startLiteTrialForOwner(user, org)).toEqual({ ok: false, error: FREE_SETUP })
        expect(mocks.rpc).toHaveBeenCalledTimes(3)
    })

    it('refuses an unverified email before provisioning, because provisioning would confirm it', async () => {
        const unverified = { id: user.id, email: user.email, app_metadata: user.app_metadata }
        expect(await startLiteTrialForOwner(unverified, org)).toEqual({
            ok: false,
            error: 'Please verify your email address before activating Free access.',
        })
        expect(mocks.finishFreeProvisioning).not.toHaveBeenCalled()
        expect(mocks.rpc).not.toHaveBeenCalled()
    })
})

describe('completePlanSelection trial path', () => {
    it("starts the trial, clears the pending gate and returns the estimator for 'trial'", async () => {
        expect(await completePlanSelection('trial')).toEqual({ href: '/owner/estimator' })
        expect(mocks.assertOrgWritable).toHaveBeenCalledWith(org)
        expect(mocks.finishFreeProvisioning).toHaveBeenCalledWith(user, org)
        expect(mocks.rpc).toHaveBeenCalledWith('start_lite_trial', { p_org_id: org })
        expect(mocks.updateUserById).toHaveBeenCalledWith(user.id, { app_metadata: { plan_selection_pending: false } })
        expect(mocks.refreshSession).toHaveBeenCalled()
    })

    it('a second call after success is not an error: an org already on an active trial returns the estimator', async () => {
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'lite', liteTrialEligible: false })
        expect(await completePlanSelection('trial')).toEqual({ href: '/owner/estimator' })
        expect(mocks.finishFreeProvisioning).not.toHaveBeenCalled()
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('sends paid history to billing before any trial is attempted', async () => {
        mocks.from.mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [{ status: 'expired', plan_tier: 'lite', current_end: '2026-08-01T00:00:00Z', razorpay_payment_id: 'pay_1' }] }),
            }),
        })
        mocks.hasEstablishedPaidHistory.mockReturnValue(true)
        expect(await completePlanSelection('trial')).toEqual({
            error: 'Please manage or renew your subscription from your workspace.',
            href: '/owner/billing',
        })
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('keeps the pending gate when the trial is refused', async () => {
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'free', liteTrialEligible: false })
        expect(await completePlanSelection('trial')).toEqual({ error: NOT_AVAILABLE })
        expect(mocks.updateUserById).not.toHaveBeenCalled()
    })

    it('rejects a plan value outside free, paid and trial', async () => {
        expect(await completePlanSelection('base' as never)).toEqual({ error: 'Choose a valid plan.' })
        expect(mocks.rpc).not.toHaveBeenCalled()
    })
})

describe('Lite trial start contracts', () => {
    const actions = () => read('app/(auth)/onboarding/plans/actions.ts')

    it('lite-trial.server is server-only and calls the RPC with the org id only', () => {
        const source = read('lib/lite-trial.server.ts')
        expect(source.startsWith("import 'server-only'")).toBe(true)
        expect(source).toContain(".rpc('start_lite_trial', { p_org_id: orgId })")
        expect(source.indexOf('finishFreeProvisioning(user, orgId)')).toBeLessThan(source.indexOf(".rpc('start_lite_trial'"))
    })

    it("completePlanSelection accepts 'trial' and validates the argument", () => {
        const source = actions()
        expect(source).toContain("completePlanSelection(plan: 'free' | 'paid' | 'trial')")
        expect(source).toContain("if (plan !== 'free' && plan !== 'paid' && plan !== 'trial') return { error: 'Choose a valid plan.' }")
    })

    it("handles 'trial' after the paid-history check and before the unverified-payment error", () => {
        const source = actions()
        const paidHistory = source.indexOf('if (hadPaidAccess) {')
        const trial = source.indexOf("if (plan === 'trial') {")
        const unverifiedPaid = source.indexOf("if (plan === 'paid') {")
        expect(paidHistory).toBeGreaterThan(-1)
        expect(trial).toBeGreaterThan(paidHistory)
        expect(unverifiedPaid).toBeGreaterThan(trial)
        const branch = source.slice(trial, unverifiedPaid)
        expect(branch).toContain('startLiteTrialForOwner(user, profile.org_id)')
        expect(branch).toContain("if (user.app_metadata.plan_selection_pending === true)")
        expect(branch).toContain("return { href: '/owner/estimator' }")
    })

    it('the trial branch refreshes the session with the same error strings as the other branches', () => {
        const source = actions()
        expect(source).toContain("'Your plan is ready, but we could not finish setup. Please try again.'")
        expect(source).toContain("'Your plan is saved. Please sign in again to continue.'")
        expect(source).toContain('await supabase.auth.refreshSession()')
    })

    it('the active-paid early branch is unchanged and still returns the estimator', () => {
        const source = actions()
        expect(source).toContain("if (access.effectiveTier === 'lite' || access.effectiveTier === 'base') {")
    })
})
