import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const f = vi.hoisted(() => ({ guard: vi.fn(), preflight: vi.fn(), provider: vi.fn(), deleteRpc: vi.fn(), signOut: vi.fn(), from: vi.fn(), billing: { data: [] as Array<{ id: string }>, error: null as { code: string } | null }, order: [] as string[] }))
vi.mock('@/lib/auth', () => ({ requireRole: f.guard }))
vi.mock('@/lib/support/data-rights', () => ({ checkOwnAccountDeletion: f.preflight, ACCOUNT_DELETION_REVIEW_MESSAGE: 'Review required. No database rows were deleted.', ACCOUNT_DELETION_UNAVAILABLE_MESSAGE: 'Readiness unavailable. No provider changes were requested.' }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: async () => ({ success: true }), getDestructiveLimiter: vi.fn(), getRateLimitRetrySeconds: () => 1 }))
vi.mock('@/lib/razorpay', () => ({ getRazorpay: f.provider }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: f.from }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: f.deleteRpc, auth: { signOut: f.signOut } }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { deleteAccountPermanently } from '@/app/(dashboard)/owner/settings/account-deletion'
const input = { organizationName: 'Synthetic factory', confirmationPhrase: 'DELETE MY ACCOUNT' as const }
beforeEach(() => {
    vi.clearAllMocks(); f.order.length = 0; f.billing = { data: [], error: null }
    f.guard.mockResolvedValue({ user: { id: 'owner' }, profile: { org_id: 'org' } })
    f.preflight.mockImplementation(async () => { f.order.push('preflight'); return { allowed: true, reason: 'ready' } })
    f.from.mockImplementation((table: string) => {
        const query = { select: () => query, eq: () => query, not: () => query, limit: () => { f.order.push('subscriptionQuery'); return Promise.resolve(f.billing) }, maybeSingle: async () => ({ data: { id: 'org', name: 'Synthetic factory', owner_id: 'owner' }, error: null }) }
        if (!['organizations', 'org_subscriptions'].includes(table)) throw new Error('Unexpected query')
        return query
    })
    f.provider.mockImplementation(() => { throw new Error('Deletion must never initialize a financial provider') })
    f.deleteRpc.mockImplementation(async () => { f.order.push('delete'); return { error: null } })
})
describe('deletion readiness without financial side effects', () => {
    it('blocked retained records cause no provider call, subscription query or deletion', async () => {
        f.preflight.mockResolvedValue({ allowed: false, reason: 'review_required' })
        expect(await deleteAccountPermanently(input)).toEqual({ error: 'Review required. No database rows were deleted.' })
        expect(f.from).toHaveBeenCalledTimes(1); expect(f.provider).not.toHaveBeenCalled(); expect(f.deleteRpc).not.toHaveBeenCalled()
    })
    it('unavailable preflight is fail-closed and does not expose database internals', async () => {
        f.preflight.mockRejectedValue(new Error('private database exception'))
        expect(await deleteAccountPermanently(input)).toEqual({ error: 'Readiness unavailable. No provider changes were requested.' })
        expect(f.provider).not.toHaveBeenCalled(); expect(f.deleteRpc).not.toHaveBeenCalled()
    })
    it('validates confirmation before readiness and deletes an evidence-free account without a provider call', async () => {
        expect(await deleteAccountPermanently({ ...input, organizationName: 'Wrong' })).toHaveProperty('error')
        expect(f.preflight).not.toHaveBeenCalled()
        expect(await deleteAccountPermanently(input)).toEqual({ success: true })
        expect(f.order).toEqual(['preflight', 'subscriptionQuery', 'delete'])
        expect(f.provider).not.toHaveBeenCalled()
    })
    it('any legacy recurring reference requires review without a cancellation or deletion attempt', async () => {
        f.billing.data = [{ id: 'legacy-reference' }]
        expect(await deleteAccountPermanently(input)).toEqual({ error: 'Review required. No database rows were deleted.' })
        expect(f.provider).not.toHaveBeenCalled(); expect(f.deleteRpc).not.toHaveBeenCalled()
    })
    it('a failed billing reference lookup prevents deletion and does not expose provider configuration', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        f.billing.error = { code: 'PGRST202' }
        expect(await deleteAccountPermanently(input)).toEqual({ error: 'Account billing could not be verified. Nothing was deleted.' })
        expect(f.provider).not.toHaveBeenCalled(); expect(f.deleteRpc).not.toHaveBeenCalled()
        vi.restoreAllMocks()
    })
    it('a race caught by authoritative DB recheck reports review and never claims deletion', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        f.deleteRpc.mockResolvedValue({ error: { code: '55000', message: 'ACCOUNT_DELETION_REVIEW_REQUIRED' } })
        expect(await deleteAccountPermanently(input)).toEqual({ error: 'Review required. No database rows were deleted.' })
        expect(f.signOut).not.toHaveBeenCalled()
        vi.restoreAllMocks()
    })
    it('does not mislabel other unavailable deletion conditions as a retention decision', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        f.deleteRpc.mockResolvedValue({ error: { code: '55000', message: 'STORAGE_OBJECTS_EXIST' } })
        expect(await deleteAccountPermanently(input)).toEqual({ error: 'Your account could not be deleted. Nothing was removed; please try again.' })
        expect(f.signOut).not.toHaveBeenCalled()
        vi.restoreAllMocks()
    })
})
