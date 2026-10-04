import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const f = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn(), limiter: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireRole: f.guard }))
vi.mock('@/lib/admin/founder', () => ({ requireLegacyFounder: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: f.rpc }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(() => { throw new Error('No direct customer table write allowed') }) }))
vi.mock('@/lib/rate-limit', () => ({ checkAuthRateLimit: f.limiter }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { requestUnlock } from '@/lib/actions/compliance'
const org = '10000000-0000-4000-8000-000000000001'
beforeEach(() => { vi.resetAllMocks(); f.guard.mockResolvedValue({ user: { id: 'verified-owner' }, profile: { org_id: org } }); f.rpc.mockResolvedValue({ error: null }); f.limiter.mockResolvedValue(null) })
describe('existing locked owner request intake', () => {
    it('allows identity-valid Free/expired owner intake and derives actor/org for the narrow RPC', async () => {
        await requestUnlock(org, '  Review my locked workspace  ')
        expect(f.guard).toHaveBeenCalledWith(['owner'], { allowFreeAccount: true })
        expect(f.rpc).toHaveBeenCalledWith('admin_owner_unlock_request', { p_actor_id: 'verified-owner', p_org_id: org, p_reason: 'Review my locked workspace' })
    })
    it('rejects foreign org/oversized text, throttling and unavailable source without raw errors', async () => {
        await expect(requestUnlock('foreign-org', 'Reason')).rejects.toThrow('Unauthorized')
        await expect(requestUnlock(org, 'a'.repeat(1001))).rejects.toThrow('3 to 1,000')
        expect(f.rpc).not.toHaveBeenCalled()
        f.limiter.mockResolvedValue('throttled'); await expect(requestUnlock(org, 'Reason')).rejects.toThrow('Please wait')
        f.limiter.mockResolvedValue(null); f.rpc.mockResolvedValue({ error: { message: 'private database fields' } })
        await expect(requestUnlock(org, 'Reason')).rejects.toThrow('could not be recorded')
    })
})
