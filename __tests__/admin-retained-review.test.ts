import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const f = vi.hoisted(() => ({ guard: vi.fn(), audit: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/admin/founder', () => ({ requireFounder: f.guard, adminRecordAudit: f.audit }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: f.rpc }) }))
import { getRetainedRecordReview, retainedGroupLabels } from '@/lib/admin/data-rights-review'
import { AdminError } from '@/lib/admin/errors'
const actor = '10000000-0000-4000-8000-000000000001', session = '10000000-0000-4000-8000-000000000002', org = '10000000-0000-4000-8000-000000000003'
const fixture = { foundationReviewRequired: true, reviewRequired: true, countLimit: 1000, groups: Object.keys(retainedGroupLabels).map(key => ({ key, count: 1, more: false })), asOf: '2026-10-04T00:00:00Z', scope: 'retained_record_review', automaticDeletion: false }
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('WEAVLY_ADMIN_FORMAL_ENABLED', 'true'); f.guard.mockResolvedValue({ userId: actor, sessionId: session }); f.audit.mockResolvedValue(undefined); f.rpc.mockResolvedValue({ data: fixture, error: null }) })
afterEach(() => vi.unstubAllEnvs())
describe('counts-only retained record review', () => {
    it('authorizes every read and fails closed when disabled', async () => {
        f.guard.mockRejectedValueOnce(new AdminError('FORBIDDEN', 403, 'Denied'))
        await expect(getRetainedRecordReview(org)).rejects.toMatchObject({ status: 403 })
        vi.stubEnv('WEAVLY_ADMIN_FORMAL_ENABLED', '')
        await expect(getRetainedRecordReview(org)).rejects.toMatchObject({ code: 'FORMAL_DISABLED' }); expect(f.rpc).not.toHaveBeenCalled()
        expect(f.audit).toHaveBeenCalledWith(expect.anything(), 'data_rights.review_preview', 'organization', 'disabled', expect.any(String), expect.objectContaining({ outcome: 'denied', reasonCode: 'formal_disabled' }))
    })
    it('derives actor/session and reads only a bounded review projection', async () => {
        expect(await getRetainedRecordReview(org)).toEqual(fixture)
        expect(f.rpc).toHaveBeenCalledWith('admin_retained_record_review_preview', expect.objectContaining({ p_actor_id: actor, p_session_id: session, p_org_id: org }))
        expect(Object.keys(f.rpc.mock.calls[0][1]).sort()).toEqual(['p_actor_id', 'p_org_id', 'p_request_id', 'p_session_id'])
    })
    it('rejects malformed/missing categories and data that could claim automatic erasure', async () => {
        for (const data of [{ ...fixture, automaticDeletion: true }, { ...fixture, groups: Array(5).fill(fixture.groups[0]) }, { ...fixture, customerBody: 'PRIVATE' }]) {
            f.rpc.mockResolvedValue({ data, error: null }); await expect(getRetainedRecordReview(org)).rejects.toMatchObject({ status: 503 })
        }
        await expect(getRetainedRecordReview('raw-sql')).rejects.toMatchObject({ status: 400 })
    })
})
