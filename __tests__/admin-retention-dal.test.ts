import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ requireFounder: vi.fn(), audit: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/admin/founder', () => ({ requireFounder: mocks.requireFounder, adminRecordAudit: mocks.audit }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
import { ApiError } from '@/lib/admin/errors'
import { getRetentionReview } from '@/lib/admin/retention'
import { retentionRecordClasses } from '@/lib/admin/retention-contracts'

const id = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002'
const asOf = '2026-10-04T12:00:00.000Z'
function input() {
    return { definitionVersion: 'admin-retention-v1', asOf, automaticPurgeEnabled: false, releaseStatus: 'incomplete',
        classes: retentionRecordClasses.map(recordClass => ({ recordClass, label: recordClass, policyState: 'unconfigured', policy: null, activeHoldCount: 0, sourceLinkageIssues: 0, pendingPolicyCount: 0 })),
        holds: { items: [] as Record<string, unknown>[], totalActive: 0, sourceLinkageIssues: 0 } }
}
beforeEach(() => {
    vi.stubEnv('WEAVLY_ADMIN_FORMAL_ENABLED', 'true')
    vi.clearAllMocks(); mocks.requireFounder.mockResolvedValue({ userId: id, sessionId: other, capabilities: [] })
    mocks.audit.mockResolvedValue(undefined); mocks.rpc.mockResolvedValue({ data: input(), error: null })
})
afterEach(() => vi.unstubAllEnvs())
describe('guarded retention review DAL', () => {
    it('requires founder before any privileged read', async () => {
        mocks.requireFounder.mockRejectedValue(new ApiError('FORBIDDEN', 403, 'Founder access required.'))
        await expect(getRetentionReview()).rejects.toMatchObject({ status: 403 })
        expect(mocks.rpc).not.toHaveBeenCalled()
    })
    it('calls only the bounded read RPC and audits without policy or ticket contents', async () => {
        const value = await getRetentionReview()
        expect(value).toMatchObject({ releaseStatus: 'incomplete', automaticPurgeEnabled: false, holds: { nextCursor: null } })
        expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('admin_retention_review', { p_actor_id: id, p_session_id: other, p_limit: 25, p_cursor_at: null, p_cursor_id: null, p_as_of: null })
        expect(mocks.audit.mock.calls[0].slice(1, 4)).toEqual(['retention.review.read', 'retention', 'policy_review'])
        expect(mocks.audit.mock.calls[0][5]).toEqual({ after: { count: 0 } })
    })
    it('rejects unbounded queries, unknown actor fields and malformed cursors', async () => {
        for (const query of [{ limit: 101 }, { actorId: other }, { cursor: 'not-a-cursor' }, { cursor: 'x'.repeat(701) }]) {
            await expect(getRetentionReview(query)).rejects.toMatchObject({ status: 400 })
        }
        expect(mocks.rpc).not.toHaveBeenCalled()
    })
    it('keeps stable hold pagination with the snapshot in the next cursor', async () => {
        const fixture = input()
        fixture.classes[0].activeHoldCount = 2; fixture.holds.totalActive = 2
        fixture.holds.items = [id, other].map(holdId => ({ id: holdId, recordClass: 'ordinary_support', sourceType: 'support_ticket', sourceId: id, orgId: other,
            reason: 'Synthetic fixture hold', reference: 'fixture:HOLD-1', placedBy: id, placedAt: asOf, sourceLinked: true }))
        mocks.rpc.mockResolvedValue({ data: fixture, error: null })
        const result = await getRetentionReview({ limit: 1 })
        expect(result.holds.items).toHaveLength(1)
        expect(JSON.parse(Buffer.from(result.holds.nextCursor!, 'base64url').toString())).toEqual({ at: asOf, id, asOf })
        await getRetentionReview({ limit: 1, cursor: result.holds.nextCursor })
        expect(mocks.rpc.mock.calls[1][1]).toMatchObject({ p_cursor_at: asOf, p_cursor_id: id, p_as_of: asOf })
    })
    it('returns generic 503 for unavailable, malformed and thrown sources, without leaking errors', async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: { message: 'secret raw database record' } })
        await expect(getRetentionReview()).rejects.toMatchObject({ status: 503, message: 'Retention review is unavailable.' })
        mocks.rpc.mockResolvedValue({ data: { ...input(), automaticPurgeEnabled: true }, error: null })
        await expect(getRetentionReview()).rejects.toMatchObject({ status: 503 })
        mocks.rpc.mockRejectedValue(new Error('private credentials'))
        await expect(getRetentionReview()).rejects.toMatchObject({ status: 503, message: 'Retention review is unavailable.' })
    })
    it('withholds the read if required audit fails', async () => {
        mocks.audit.mockRejectedValue(new ApiError('AUDIT_UNAVAILABLE', 503, 'Audit is unavailable.'))
        await expect(getRetentionReview()).rejects.toMatchObject({ status: 503, code: 'AUDIT_UNAVAILABLE' })
    })
})
