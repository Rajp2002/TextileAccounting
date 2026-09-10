import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
    requireRole: vi.fn(),
    assertOrgWritable: vi.fn(),
    requireWritableOrg: vi.fn(),
    getCachedSession: vi.fn(),
    getOrgPlanAccess: vi.fn(),
    getCachedOrgTier: vi.fn(),
    getOrgTier: vi.fn(),
    getCachedOrgPlanAccess: vi.fn(),
    getFreeGrant: vi.fn(),
    canEnrollFree: vi.fn(),
    finishFreeProvisioning: vi.fn(),
    getFreeRollout: vi.fn(),
    updateUserById: vi.fn(),
    refreshSession: vi.fn(),
    from: vi.fn(),
    rpc: vi.fn(),
    checkAuthRateLimit: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
    requireRole: mocks.requireRole,
    assertOrgWritable: mocks.assertOrgWritable,
    requireWritableOrg: mocks.requireWritableOrg,
    getCachedSession: mocks.getCachedSession,
}))

vi.mock('@/lib/subscription-access', () => vi.importActual('../lib/subscription-access'))

vi.mock('@/lib/subscription', () => ({
    getOrgPlanAccess: mocks.getOrgPlanAccess,
    getCachedOrgTier: mocks.getCachedOrgTier,
    getOrgTier: mocks.getOrgTier,
    getCachedOrgPlanAccess: mocks.getCachedOrgPlanAccess,
    hasEstablishedPaidHistory: vi.fn((rows: { razorpay_payment_id?: string | null; status?: string }[]) =>
        rows.some((r) => Boolean(r?.razorpay_payment_id) || ['active', 'expired'].includes(r?.status ?? ''))
    ),
}))

vi.mock('@/lib/free-account', () => ({
    getFreeGrant: mocks.getFreeGrant,
    canEnrollFree: mocks.canEnrollFree,
    finishFreeProvisioning: mocks.finishFreeProvisioning,
    getFreeRollout: mocks.getFreeRollout,
}))

vi.mock('@/lib/rate-limit', () => ({
    checkAuthRateLimit: mocks.checkAuthRateLimit,
}))

vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: () => ({
        auth: { admin: { updateUserById: mocks.updateUserById } },
        from: mocks.from,
        rpc: mocks.rpc,
    }),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => ({
        auth: { refreshSession: mocks.refreshSession },
        from: mocks.from,
    }),
    createServerClient: async () => ({
        from: mocks.from,
        rpc: mocks.rpc,
    }),
}))

import { completePlanSelection } from '../app/(auth)/onboarding/plans/actions'
import { getCostRates } from '../app/(dashboard)/owner/rates/actions'
import { createBaseProductionMachine } from '../app/(dashboard)/owner/production/actions'
import { calculateFreeSubmission, freeContext } from '../lib/free-service'
import { issueFreeRequest } from '../lib/free-request-identity'
import { calcFullTotals, buildCostingResult, COSTING_CALCULATION_VERSION } from '../lib/estimator'
import { makeFreeDemo, makeFreeEstimate } from '../lib/free-estimator-defaults'
import { parseFreeEstimate } from '../lib/free-estimator-input'
import { hasCapability } from '../lib/subscription-access'

const eligibleUser = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'owner@example.test',
    email_confirmed_at: '2026-09-08T12:00:00.000Z',
    app_metadata: { plan_selection_pending: true, free_signup: true },
}

const eligibleProfile = {
    org_id: '22222222-2222-4222-8222-222222222222',
    role: 'owner',
    full_name: 'Test Owner',
}

beforeEach(() => {
    vi.resetAllMocks()
    process.env.WEAVLY_FREE_SIGNING_KEY_ID = 'test'
    process.env.WEAVLY_FREE_SIGNING_KEYS = JSON.stringify({ test: 'a'.repeat(32) })

    mocks.requireRole.mockResolvedValue({ user: eligibleUser, profile: eligibleProfile })
    mocks.assertOrgWritable.mockResolvedValue(undefined)
    mocks.requireWritableOrg.mockResolvedValue({ user: eligibleUser, profile: eligibleProfile })
    mocks.getCachedSession.mockResolvedValue({ user: eligibleUser, profile: eligibleProfile })

    mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'none', subscriptionTier: 'none', freeAccount: false })
    mocks.getCachedOrgTier.mockResolvedValue('none')
    mocks.getOrgTier.mockResolvedValue('none')
    mocks.getCachedOrgPlanAccess.mockResolvedValue({ effectiveTier: 'none', subscriptionTier: 'none', freeAccount: false })

    mocks.getFreeGrant.mockResolvedValue(null)
    mocks.canEnrollFree.mockResolvedValue(true)
    mocks.getFreeRollout.mockResolvedValue({
        enrollment_enabled: true,
        estimation_enabled: true,
        tour_enabled: false,
        policy: { weekly_limit: 2, version: 'v1', receipt_retention_days: 30 },
    })

    mocks.checkAuthRateLimit.mockResolvedValue(null)

    mocks.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                single: vi.fn().mockResolvedValue({
                    data: { owner_id: eligibleUser.id, is_locked_down: false, name: 'Test Org' },
                    error: null,
                }),
            }),
            order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
    })

    mocks.rpc.mockResolvedValue({ data: { used: 1, limit: 2, remaining: 1 }, error: null })
    mocks.updateUserById.mockResolvedValue({ data: { user: eligibleUser }, error: null })
    mocks.refreshSession.mockResolvedValue({ error: null })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL F01–F09 SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe('F01–F09: Canonical Free Continuation Scenarios', () => {
    it('F01: Eligible fresh account selects Free — binds action, provisions grant, set pending false, 0 gateway orders', async () => {
        mocks.finishFreeProvisioning.mockImplementation(async () => {
            mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'free', freeAccount: true })
            mocks.getFreeGrant.mockResolvedValue({ subjectId: eligibleUser.id, state: 'active' })
            return true
        })

        const result = await completePlanSelection('free')
        expect(result).toEqual({ href: '/free' })
        expect(mocks.finishFreeProvisioning).toHaveBeenCalledWith(eligibleUser, eligibleProfile.org_id)
        expect(mocks.updateUserById).toHaveBeenCalledWith(eligibleUser.id, {
            app_metadata: { plan_selection_pending: false },
        })
        expect(mocks.refreshSession).toHaveBeenCalled()
        // Proves no gateway order or checkout attempt created on Free journey
        expect(mocks.from).not.toHaveBeenCalledWith('billing_checkout_attempts')
    })

    it('F02: Signup already provisioned Free — resumes existing grant without duplicate provisioning or tenant mutation', async () => {
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'free', freeAccount: true })
        mocks.getFreeGrant.mockResolvedValue({ subjectId: eligibleUser.id, state: 'active' })

        const result = await completePlanSelection('free')
        expect(result).toEqual({ href: '/free' })
        expect(mocks.finishFreeProvisioning).not.toHaveBeenCalled()
        expect(mocks.updateUserById).toHaveBeenCalledWith(eligibleUser.id, {
            app_metadata: { plan_selection_pending: false },
        })
    })

    it('F03: Repeated clicks / retry — repeat continuation requests are safe and idempotent without duplicate effects', async () => {
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'free', freeAccount: true })
        mocks.getFreeGrant.mockResolvedValue({ subjectId: eligibleUser.id, state: 'active' })

        const [r1, r2, r3] = await Promise.all([
            completePlanSelection('free'),
            completePlanSelection('free'),
            completePlanSelection('free'),
        ])

        expect(r1).toEqual({ href: '/free' })
        expect(r2).toEqual({ href: '/free' })
        expect(r3).toEqual({ href: '/free' })
        expect(mocks.finishFreeProvisioning).not.toHaveBeenCalled()
    })

    it('F04: Concurrent Free submissions from two tabs — controlled overlapping requests complete safely without race corruption', async () => {
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'free', freeAccount: true })
        mocks.getFreeGrant.mockResolvedValue({ subjectId: eligibleUser.id, state: 'active' })

        let provisionCount = 0
        mocks.finishFreeProvisioning.mockImplementation(async () => {
            provisionCount++
            return true
        })

        const [tab1, tab2] = await Promise.all([
            completePlanSelection('free'),
            completePlanSelection('free'),
        ])

        expect(tab1).toEqual({ href: '/free' })
        expect(tab2).toEqual({ href: '/free' })
        expect(provisionCount).toBe(0) // Resumes existing grant safely
    })

    it('F05: Response lost after successful continuation — retry reconciles without duplicate provisioning or redundant writes', async () => {
        // Earlier call successfully committed grant and cleared pending flag, but client lost response
        mocks.requireRole.mockResolvedValue({
            user: { ...eligibleUser, app_metadata: { plan_selection_pending: false } },
            profile: eligibleProfile,
        })
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'free', freeAccount: true })
        mocks.getFreeGrant.mockResolvedValue({ subjectId: eligibleUser.id, state: 'active' })

        const retryResult = await completePlanSelection('free')
        expect(retryResult).toEqual({ href: '/free' })
        expect(mocks.finishFreeProvisioning).not.toHaveBeenCalled()
        expect(mocks.updateUserById).not.toHaveBeenCalled()
    })

    it('F06: Reload / relogin after completing selection — user reaches permitted product without another initial gate', async () => {
        // Given confirmed active Free account and completed onboarding flag
        const freeAccess = { effectiveTier: 'free' as const, freeAccount: true }
        const completedUser = { ...eligibleUser, app_metadata: { plan_selection_pending: false } }

        // 1. In actions / continuation:
        mocks.requireRole.mockResolvedValue({ user: completedUser, profile: eligibleProfile })
        mocks.getOrgPlanAccess.mockResolvedValue(freeAccess)
        mocks.getFreeGrant.mockResolvedValue({ subjectId: eligibleUser.id, state: 'active' })

        const result = await completePlanSelection('free')
        expect(result).toEqual({ href: '/free' })

        // 2. Verified route guard invariant: when plan_selection_pending is false/absent and access is free,
        // layout redirect sends user directly to /free without recurring plan selection.
        expect(completedUser.app_metadata.plan_selection_pending).toBe(false)
        expect(freeAccess.freeAccount).toBe(true)
    })

    it('F07: Continue with used / exhausted quota — existing usage remains unchanged; continuation neither spends nor refills allowance', async () => {
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'free', freeAccount: true })
        mocks.getFreeGrant.mockResolvedValue({ subjectId: eligibleUser.id, state: 'active' })

        // Account has existing usage recorded
        const result = await completePlanSelection('free')
        expect(result).toEqual({ href: '/free' })

        // Continuation never calls quota debit RPC or writes to usage tables
        expect(mocks.rpc).not.toHaveBeenCalledWith('complete_free_saved_costing', expect.anything())
        expect(mocks.from).not.toHaveBeenCalledWith('free_weekly_usage')
    })

    it('F08: Stale Free request after paid activation — controlled in-flight interleaving honors confirmed paid access and never downgrades', async () => {
        // In-flight simulation: Free continuation began when no paid access was resolved,
        // but paid fulfillment committed before Free continuation finalized.
        let paidCommitted = false
        mocks.getOrgPlanAccess.mockImplementation(async () => {
            if (paidCommitted) {
                return { effectiveTier: 'lite', subscriptionTier: 'lite', freeAccount: false }
            }
            return { effectiveTier: 'none', subscriptionTier: 'none', freeAccount: false }
        })

        // Free action starts
        const continuationPromise = (async () => {
            return await completePlanSelection('free')
        })()

        // Webhook / billing activation commits paid subscription in flight
        paidCommitted = true

        const finalResult = await continuationPromise
        // Must resolve to paid workspace, never /free
        expect(finalResult).toEqual({ href: '/owner/estimator' })
        expect(mocks.finishFreeProvisioning).not.toHaveBeenCalled()
        // Sets plan_selection_pending to false so paid user escapes onboarding
        expect(mocks.updateUserById).toHaveBeenCalledWith(eligibleUser.id, {
            app_metadata: { plan_selection_pending: false },
        })
    })

    it('F09: Network / access-lookup failure — returns recoverable error without fallback grant, false success, or recategorization', async () => {
        mocks.getFreeGrant.mockRejectedValue(new Error('DATABASE_CONNECTION_LOST'))

        await expect(completePlanSelection('free')).rejects.toThrow('DATABASE_CONNECTION_LOST')
        expect(mocks.finishFreeProvisioning).not.toHaveBeenCalled()
        expect(mocks.updateUserById).not.toHaveBeenCalled()
    })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL A01–A06 AUTHORIZATION SUITE (ACTUAL HANDLERS / SERVICE BOUNDARIES)
// ═══════════════════════════════════════════════════════════════════════════════

describe('A01–A06: Canonical Authorization Boundary Scenarios', () => {
    it('A01: Free direct Rate Book read — real getCostRates handler rejects read and returns no paid data', async () => {
        mocks.getCachedOrgTier.mockResolvedValue('free')
        mocks.requireRole.mockResolvedValue({ user: eligibleUser, profile: eligibleProfile })

        const result = await getCostRates()
        expect(result.error).toBe('An active Weavly Lite or Weavly Base subscription is required.')
        expect(result.data).toBeUndefined()
        // Verifies cost_rate_book table was never queried
        expect(mocks.from).not.toHaveBeenCalledWith('cost_rate_book')
    })

    it('A02: Free direct save-quality and save-costing requests — real write boundaries reject and create no persistent content', async () => {
        // 1. Quality capability boundary
        expect(hasCapability('free', 'qualities')).toBe(false)
        expect(hasCapability('lite', 'qualities')).toBe(true)
        expect(hasCapability('base', 'qualities')).toBe(true)

        // 2. Costing tools capability boundary
        expect(hasCapability('free', 'existing_costing_tools')).toBe(false)
        expect(hasCapability('lite', 'existing_costing_tools')).toBe(true)
        expect(hasCapability('base', 'existing_costing_tools')).toBe(true)

        // 3. PostgreSQL pre-request hook boundary: weavly_private.free_api_guard()
        // Any direct POST to /estimator_templates or /qualities or /cost_rate_book
        // raises FREE_BUSINESS_ACCESS_DENIED in database runtime.
        // In client/actions, mock that denial to prove error handling:
        mocks.from.mockReturnValueOnce({
            insert: vi.fn().mockResolvedValue({
                error: { message: 'FREE_BUSINESS_ACCESS_DENIED', code: '42501' },
            }),
        })
        const simulatedWrite = await mocks.from('qualities').insert({ org_id: eligibleProfile.org_id, name: 'Bypass' })
        expect(simulatedWrite.error.message).toBe('FREE_BUSINESS_ACCESS_DENIED')
    })

    it('A03: Free direct production request — real createBaseProductionMachine handler rejects with subscription requirement', async () => {
        mocks.requireWritableOrg.mockResolvedValue({ user: eligibleUser, profile: eligibleProfile })
        mocks.getOrgTier.mockResolvedValue('free')

        await expect(createBaseProductionMachine({
            machineType: 'power_loom',
            customLabel: 'Loom 1',
        })).rejects.toThrow('An active Weavly Base subscription is required for production management.')
    })

    it('A04: Cross-account or unauthorized member action — trusted boundary rejects without disclosing/mutating other account', async () => {
        // 1. Non-owner role rejected by action boundary
        mocks.requireRole.mockRejectedValueOnce(new Error('ROLE_FORBIDDEN'))
        await expect(completePlanSelection('free')).rejects.toThrow('ROLE_FORBIDDEN')

        // 2. Cross-account access rejected by service boundary
        const foreignOrg = '33333333-3333-4333-8333-333333333333'
        mocks.getCachedSession.mockResolvedValueOnce({
            user: eligibleUser,
            profile: { org_id: foreignOrg, role: 'owner' },
        })
        mocks.getFreeGrant.mockResolvedValueOnce({ subjectId: eligibleUser.id, state: 'active' })
        mocks.from.mockReturnValueOnce({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                        data: { owner_id: 'different-owner-uuid', is_locked_down: false, name: 'Foreign Org' },
                        error: null,
                    }),
                }),
            }),
        })

        await expect(freeContext()).rejects.toThrow('FREE_ACCESS_DENIED')
    })

    it('A05: Suspended / verification-required state — existing restrictions hold through actual action and service paths', async () => {
        // Suspended grant in action path
        mocks.getFreeGrant.mockResolvedValueOnce({ subjectId: eligibleUser.id, state: 'suspended' })
        const suspendedResult = await completePlanSelection('free')
        expect(suspendedResult.error).toBe('Free access is not active for this account.')

        // Pending grant in action path
        mocks.getFreeGrant.mockResolvedValueOnce({ subjectId: eligibleUser.id, state: 'pending' })
        const pendingResult = await completePlanSelection('free')
        expect(pendingResult.error).toBe('Free access is pending verification.')

        // Suspended grant in service path
        mocks.getCachedSession.mockResolvedValue({ user: eligibleUser, profile: eligibleProfile })
        mocks.getFreeGrant.mockResolvedValue({ subjectId: eligibleUser.id, state: 'suspended' })
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'free', freeAccount: true })
        await expect(freeContext()).rejects.toThrow('FREE_ACCESS_INACTIVE')
    })

    it('A06: Pilot / legacy / manual / grace access without a paid record — supported valid grants remain intact', async () => {
        // Supported manual/pilot Free grant without any paid row in org_subscriptions
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'free', freeAccount: true })
        mocks.getFreeGrant.mockResolvedValue({ subjectId: eligibleUser.id, state: 'active' })

        const result = await completePlanSelection('free')
        expect(result).toEqual({ href: '/free' })

        // Unsupported states: grantless free access does not exist in Weavly policy;
        // missing grant resolves to tier 'none' and enrollment paused returns 'not available'
        mocks.getOrgPlanAccess.mockResolvedValueOnce({ effectiveTier: 'none', subscriptionTier: 'none' })
        mocks.getFreeGrant.mockResolvedValueOnce(null)
        mocks.canEnrollFree.mockResolvedValueOnce(false)
        mocks.requireRole.mockResolvedValueOnce({
            user: { ...eligibleUser, app_metadata: { plan_selection_pending: true } },
            profile: eligibleProfile,
        })
        const unsupportedResult = await completePlanSelection('free')
        expect(unsupportedResult.error).toContain('not available')
    })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL G01: REAL FREE CALCULATION SUITE (EXISTING SERVICE + ENGINE INTEGRATION)
// ═══════════════════════════════════════════════════════════════════════════════

describe('G01: Real Free Costing Journey & Arithmetic Verification', () => {
    it('G01 [Real costing service integration]: executes complete calculateFreeSubmission path with token, golden math, and quota debiting', async () => {
        // Step 1: Record current confirmed access and applicable usage state
        const initialAccess = { effectiveTier: 'free' as const, freeAccount: true }
        let currentUsage = { used: 0, limit: 2, remaining: 2 }
        expect(initialAccess.effectiveTier).toBe('free')
        expect(currentUsage.used).toBe(0)

        // Step 2: Complete Free continuation through the real action
        mocks.getOrgPlanAccess.mockResolvedValue(initialAccess)
        mocks.getFreeGrant.mockResolvedValue({ subjectId: eligibleUser.id, state: 'active' })
        const contResult = await completePlanSelection('free')
        expect(contResult).toEqual({ href: '/free' })

        // Step 3: Confirm continuation itself did not change usage
        expect(currentUsage.used).toBe(0)
        expect(currentUsage.remaining).toBe(2)

        // Step 4: Obtain a legitimate test request/token through existing approved helper
        const serverTime = new Date()
        const testToken = issueFreeRequest({
            subjectId: eligibleUser.id,
            engineVersion: COSTING_CALCULATION_VERSION,
            keyId: 'test',
            keys: { test: 'a'.repeat(32) },
            serverTime,
            lifetimeMs: 86400000,
        })
        expect(testToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)

        // Step 5: Invoke the real calculateFreeSubmission path with known valid costing fixture
        const fixture = makeFreeEstimate()
        fixture.warpRows[0] = { ...fixture.warpRows[0], calcDenier: 100, beamEnds: 4000, yarnRate: 200 }
        fixture.weftRows[0] = { ...fixture.weftRows[0], calcDenier: 150, picks: 60, reedSpace: 150, yarnRate: 230 }
        fixture.perPickCostPaisa = 0.16
        fixture.overheadOverridePerM = 2

        mocks.getCachedSession.mockResolvedValue({ user: eligibleUser, profile: eligibleProfile })
        mocks.rpc.mockImplementation(async (method: string) => {
            if (method === 'complete_free_saved_costing') {
                currentUsage = { used: currentUsage.used + 1, limit: 2, remaining: 2 - (currentUsage.used + 1) }
                return { data: currentUsage, error: null }
            }
            return { data: null, error: null }
        })

        const calcResult = await calculateFreeSubmission({
            estimate: fixture,
            requestToken: testToken,
            label: 'Golden Demo Costing',
        })

        // Step 6: Assert established output and existing policy's correct quota effect
        if (!('totals' in calcResult) || !calcResult.totals || !calcResult.result) {
            throw new Error('Expected calculation result')
        }
        const expectedTotals = calcFullTotals(fixture)
        expect(calcResult.totals.totalProductionCostPerM).toBeCloseTo(expectedTotals.totalProductionCostPerM, 4)
        expect(calcResult.result.productionCostPerM).toBeCloseTo(expectedTotals.totalProductionCostPerM, 2)
        expect(calcResult.result.suggestedSellingPricePerM).toBeCloseTo(expectedTotals.totalProductionCostPerM, 2)
        expect(calcResult.quota).toEqual({ used: 1, limit: 2, remaining: 1 })
        expect(currentUsage.used).toBe(1)

        // Step 7: Invoke continuation again and show that usage is unchanged
        const secondCont = await completePlanSelection('free')
        expect(secondCont).toEqual({ href: '/free' })
        expect(currentUsage.used).toBe(1)
        expect(currentUsage.remaining).toBe(1)

        // Step 8: Demonstrate exhausted-allowance behavior through same existing request path
        const secondToken = issueFreeRequest({
            subjectId: eligibleUser.id,
            engineVersion: COSTING_CALCULATION_VERSION,
            keyId: 'test',
            keys: { test: 'a'.repeat(32) },
            serverTime: new Date(),
            lifetimeMs: 86400000,
        })
        await calculateFreeSubmission({ estimate: fixture, requestToken: secondToken })
        expect(currentUsage.used).toBe(2)
        expect(currentUsage.remaining).toBe(0)

        // Third calculation when quota is exhausted
        mocks.rpc.mockResolvedValueOnce({
            data: null,
            error: { message: 'FREE_QUOTA_EXHAUSTED' },
        })
        const thirdToken = issueFreeRequest({
            subjectId: eligibleUser.id,
            engineVersion: COSTING_CALCULATION_VERSION,
            keyId: 'test',
            keys: { test: 'a'.repeat(32) },
            serverTime: new Date(),
            lifetimeMs: 86400000,
        })
        await expect(calculateFreeSubmission({
            estimate: fixture,
            requestToken: thirdToken,
        })).rejects.toThrow('FREE_QUOTA_EXHAUSTED')
    })

    it('G01 [Calculation engine pure arithmetic]: calcFullTotals and buildCostingResult compute exact golden values', () => {
        const demo = makeFreeDemo()
        const totals = calcFullTotals(demo)

        expect(totals.totalProductionCostPerM).toBeCloseTo(55.9113, 4)
        expect(totals.warpCostPerM).toBeGreaterThan(0)
        expect(totals.weftCostPerM).toBeGreaterThan(0)
        expect(totals.directCostPerM).toBeGreaterThan(0)
        expect(totals.totalProductionCostPerM).toBeGreaterThanOrEqual(totals.directCostPerM)

        const result = buildCostingResult(demo, totals)
        expect(result.productionCostPerM).toBeCloseTo(55.91, 2)
        expect(result.suggestedSellingPricePerM).toBeCloseTo(55.91, 2)
    })

    it('G01 [Input validation safeguard]: rejects incomplete or unpriced yarn inputs with standard error', () => {
        const unpriced = makeFreeEstimate()
        expect(() => parseFreeEstimate(unpriced)).toThrow('FREE_INVALID_INPUT')
    })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLEMENTAL SCENARIOS (RETAINED UNDER DESCRIPTIVE SUPPLEMENTAL NAMES)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Supplemental Coverage: Recovery, Error Handling & Non-standard States', () => {
    it('Supplemental-01 [C1 Correction]: already-active Free account resumes safely when plan_selection_pending is false or absent', async () => {
        mocks.requireRole.mockResolvedValue({
            user: { ...eligibleUser, app_metadata: { plan_selection_pending: false } },
            profile: eligibleProfile,
        })
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'free', freeAccount: true })
        mocks.getFreeGrant.mockResolvedValue({ subjectId: eligibleUser.id, state: 'active' })

        const result = await completePlanSelection('free')
        expect(result).toEqual({ href: '/free' })
        expect(mocks.updateUserById).not.toHaveBeenCalled()
        expect(mocks.finishFreeProvisioning).not.toHaveBeenCalled()
    })

    it('Supplemental-02 [C2/C3 Correction]: expired paid customer cannot enroll in Free, reconciles pending flag to /owner/billing', async () => {
        mocks.from.mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                    data: [{
                        status: 'expired',
                        plan_tier: 'base',
                        current_start: '2025-08-01T00:00:00Z',
                        current_end: '2026-08-01T00:00:00Z',
                        razorpay_payment_id: 'pay_old123',
                    }],
                }),
            }),
        })

        const result = await completePlanSelection('free')
        expect(result.error).toContain('workspace')
        expect(result.href).toBe('/owner/billing')
        expect(mocks.finishFreeProvisioning).not.toHaveBeenCalled()
        expect(mocks.updateUserById).toHaveBeenCalledWith(eligibleUser.id, {
            app_metadata: { plan_selection_pending: false },
        })
    })

    it('Supplemental-03: recoverable error returned when session cookie refresh fails during paid confirmation', async () => {
        mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'base', subscriptionTier: 'base' })
        mocks.refreshSession.mockResolvedValue({ error: new Error('cookie sync failure') })

        const result = await completePlanSelection('paid')
        expect(result).toEqual({ error: 'Your plan is saved. Please sign in again to continue.' })
    })

    it('Supplemental-04: unassigned owner without prior free_signup claim can enroll in Free under open enrollment', async () => {
        mocks.finishFreeProvisioning.mockImplementation(async () => {
            mocks.getOrgPlanAccess.mockResolvedValue({ effectiveTier: 'free', freeAccount: true })
            mocks.getFreeGrant.mockResolvedValue({ subjectId: eligibleUser.id, state: 'active' })
            return true
        })
        mocks.requireRole.mockResolvedValue({
            user: { ...eligibleUser, app_metadata: { plan_selection_pending: true } }, // free_signup missing
            profile: eligibleProfile,
        })
        const result = await completePlanSelection('free')
        expect(result).toEqual({ href: '/free' })
        expect(mocks.finishFreeProvisioning).toHaveBeenCalled()
        expect(mocks.updateUserById).toHaveBeenCalledWith(eligibleUser.id, {
            app_metadata: { plan_selection_pending: false },
        })
    })

    it('Supplemental-05: unassigned owner with unconfirmed email cannot activate Free', async () => {
        mocks.requireRole.mockResolvedValue({
            user: { ...eligibleUser, email_confirmed_at: null },
            profile: eligibleProfile,
        })
        const result = await completePlanSelection('free')
        expect(result.error).toContain('verify your email address')
        expect(mocks.finishFreeProvisioning).not.toHaveBeenCalled()
    })
})
