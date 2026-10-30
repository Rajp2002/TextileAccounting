import { beforeEach, describe, expect, it, vi } from 'vitest'

// POST /api/analytics/activity: owner-only, strict body, org from the verified
// profile, rate limited, and silent about recorder failures.

const mocks = vi.hoisted(() => ({ getCachedSession: vi.fn(), rpc: vi.fn(), checkRateLimit: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCachedSession: mocks.getCachedSession }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit, getActivityLimiter: () => null }))

import { POST } from '@/app/api/analytics/activity/route'

const owner = { user: { id: '00000000-0000-4000-8000-000000000041' }, profile: { role: 'owner', org_id: '00000000-0000-4000-8000-000000000042' } }
const session = (profile: Record<string, unknown>) => ({ ...owner, profile: { ...owner.profile, ...profile } })
const valid = { minutes: 3, areas: { estimator: 3 }, device: 'phone', installed: false }

async function post(body: unknown, current: unknown) {
    mocks.getCachedSession.mockResolvedValueOnce(current)
    return POST(new Request('https://weavly.example.test/api/analytics/activity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }))
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.rpc.mockResolvedValue({ data: 3, error: null })
    mocks.checkRateLimit.mockResolvedValue({ success: true, reset: 0, remaining: 10 })
})

describe('POST /api/analytics/activity', () => {
    it('401 without a session', async () => {
        expect((await post(valid, null)).status).toBe(401)
    })

    it('403 for a supervisor or an owner without an org', async () => {
        expect((await post(valid, session({ role: 'supervisor' }))).status).toBe(403)
        expect((await post(valid, session({ org_id: null }))).status).toBe(403)
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('400 for unknown areas, zero minutes or extra keys', async () => {
        for (const body of [{ ...valid, areas: { cart: 1 } }, { ...valid, minutes: 0 }, { ...valid, minutes: 11 }, { ...valid, url: '/owner/x' }, { ...valid, device: 'watch' }]) {
            expect((await post(body, owner)).status).toBe(400)
        }
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('413 for bodies over 1 KB', async () => {
        expect((await post({ ...valid, pad: 'x'.repeat(1100) }, owner)).status).toBe(413)
    })

    it('429 when the limiter refuses', async () => {
        mocks.checkRateLimit.mockResolvedValueOnce({ success: false, reset: Date.now() + 1000, remaining: 0 })
        expect((await post(valid, owner)).status).toBe(429)
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('records with the org from the profile, never the body', async () => {
        expect((await post({ ...valid, org_id: 'attacker' }, owner)).status).toBe(400)
        const res = await post(valid, owner)
        expect(res.status).toBe(202)
        expect(mocks.checkRateLimit).toHaveBeenCalledWith(expect.any(Function), `activity:${owner.user.id}`)
        expect(mocks.rpc).toHaveBeenCalledWith('record_account_activity', {
            p_user_id: owner.user.id, p_org_id: owner.profile.org_id, p_minutes: 3,
            p_area_minutes: { estimator: 3 }, p_device: 'phone', p_installed: false,
        })
    })

    it('500 with no detail when the recorder fails', async () => {
        mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
        const res = await post(valid, owner)
        expect(res.status).toBe(500)
        expect(await res.text()).not.toContain('boom')
    })
})
