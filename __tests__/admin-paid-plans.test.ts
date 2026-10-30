import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveOrgAccessFromRows } from '@/lib/subscription-access'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ requireFounder: vi.fn(), rpc: vi.fn(), readiness: vi.fn(), gaps: vi.fn() }))
vi.mock('@/lib/admin/founder', () => ({ requireFounder: mocks.requireFounder }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/billing-readiness', () => ({ getBillingReadiness: mocks.readiness, getLiveReadinessGaps: mocks.gaps }))

import { extendTrials, getPaidPlansAdmin, goLive } from '@/lib/admin/paid-plans'

const principal = { userId: '00000000-0000-4000-8000-000000000081', sessionId: '00000000-0000-4000-8000-000000000082', capabilities: [] }
const DAY = 86_400_000

beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireFounder.mockResolvedValue(principal)
    // Production today: test keys, which report nothing missing for test checkout.
    mocks.readiness.mockReturnValue({ mode: 'test', missing: [] })
    mocks.gaps.mockReturnValue(['live Razorpay keys', 'valid supplier GSTIN'])
})

describe('goLive', () => {
    it('refuses before the database when live payments are not configured', async () => {
        await expect(goLive()).rejects.toMatchObject({ status: 409, code: 'CHECKLIST_INCOMPLETE' })
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('goes live once the checklist is complete, and maps a second go-live to 409', async () => {
        mocks.readiness.mockReturnValue({ mode: 'live', missing: [] })
        mocks.rpc.mockResolvedValueOnce({ data: { goLiveAt: '2027-03-12T05:00:00Z', movedTrials: 4 }, error: null })
        expect(await goLive()).toEqual({ goLiveAt: '2027-03-12T05:00:00Z', movedTrials: 4 })
        expect(mocks.rpc).toHaveBeenCalledWith('admin_go_live', expect.objectContaining({ p_actor_id: principal.userId, p_session_id: principal.sessionId }))
        mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '55000', message: 'PAID_PLANS_LIVE' } })
        await expect(goLive()).rejects.toMatchObject({ status: 409, code: 'PAID_PLANS_LIVE' })
    })
})

describe('extendTrials', () => {
    it('passes a dry run through and rejects bad input before the database', async () => {
        const newEnd = new Date(Date.now() + 60 * DAY).toISOString()
        mocks.rpc.mockResolvedValueOnce({ data: { total: 3, alreadyEnded: 1, newEnd }, error: null })
        expect(await extendTrials({ newEnd, dryRun: true })).toEqual({ total: 3, alreadyEnded: 1, newEnd })
        expect(mocks.rpc).toHaveBeenCalledWith('admin_extend_trials', expect.objectContaining({ p_new_end: newEnd, p_dry_run: true }))
        await expect(extendTrials({ newEnd: 'soon', dryRun: true })).rejects.toMatchObject({ status: 400 })
        await expect(extendTrials({ newEnd, dryRun: true, orgId: 'x' })).rejects.toMatchObject({ status: 400 })
        expect(mocks.rpc).toHaveBeenCalledTimes(1)
    })

    it('maps a live-plans refusal to 409 and a bad date to 400', async () => {
        const newEnd = new Date(Date.now() + 60 * DAY).toISOString()
        mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '55000', message: 'PAID_PLANS_LIVE' } })
        await expect(extendTrials({ newEnd, dryRun: false })).rejects.toMatchObject({ status: 409 })
        mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'INVALID_TRIAL_END' } })
        await expect(extendTrials({ newEnd, dryRun: false })).rejects.toMatchObject({ status: 400 })
    })
})

describe('getPaidPlansAdmin', () => {
    it('shows the live-only checklist even on test keys, never a false All set', async () => {
        mocks.rpc.mockResolvedValueOnce({ data: { goLiveAt: null, endingIn14Days: 2, endingIn30Days: 5, alreadyEnded: 1 }, error: null })
        expect(await getPaidPlansAdmin()).toEqual({ goLiveAt: null, endingIn14Days: 2, endingIn30Days: 5, alreadyEnded: 1, readiness: { mode: 'test', missing: ['live Razorpay keys', 'valid supplier GSTIN'] } })
    })
})

describe('a moved trial row resolves to Lite again', () => {
    it('effective Lite with the new trial end', () => {
        const moved = {
            status: 'active', plan_tier: 'lite', is_trial: true, current_start: new Date(Date.now() - 40 * DAY).toISOString(),
            current_end: new Date(Date.now() + 60 * DAY).toISOString(), razorpay_payment_id: null, created_at: new Date(Date.now() - 40 * DAY).toISOString(),
        }
        expect(resolveOrgAccessFromRows({ rows: [moved], baseFlag: false, trialFlag: false })).toMatchObject({ effectiveTier: 'lite', trialEndsAt: moved.current_end })
    })
})

describe('payments page', () => {
    it('renders the paid plans panel independently of the payments report', () => {
        const src = readFileSync('app/(admin-console)/admin/payments/page.tsx', 'utf8')
        expect(src).toContain('<PaidPlansCard')
        expect(src).toContain('id="paid-plans"')
        expect(src).toContain('getPaidPlansAdmin()')
        expect(src.indexOf('<PaidPlansPanel')).toBeLessThan(src.indexOf('<PaymentsReport'))
    })
})
