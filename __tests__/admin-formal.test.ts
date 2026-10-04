import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const f = vi.hoisted(() => ({ guard: vi.fn(), audit: vi.fn(), rpc: vi.fn(), limit: vi.fn() }))
vi.mock('@/lib/admin/founder', () => ({ requireFounder: f.guard, adminRecordAudit: f.audit }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: f.rpc }) }))
vi.mock('@/lib/rate-limit', () => ({ checkAuthRateLimit: f.limit }))
import { listFormalCases, getFormalCase, mutateFormalCase } from '@/lib/admin/formal'
import { AdminError } from '@/lib/admin/errors'
import { GET, POST } from '@/app/api/admin/formal/route'
import { POST as detailPost } from '@/app/api/admin/formal/[kind]/[id]/route'
const actor = '10000000-0000-4000-8000-000000000001', sid = '10000000-0000-4000-8000-000000000002', id = '10000000-0000-4000-8000-000000000003', requestId = '10000000-0000-4000-8000-000000000004'
const intake = { kind: 'privacy', title: 'Synthetic request', body: 'Synthetic privacy context.', orgId: null, requesterUserId: null, contactEmail: null, receivedAt: '2026-10-01T00:00:00Z', nextAction: 'Review requested scope', followUpDueAt: '2026-10-06T00:00:00Z', sourceReference: 'fixture-email-reference', category: 'access', source: 'manual_email', clientRequestId: requestId }
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('WEAVLY_ADMIN_FORMAL_ENABLED', 'true'); f.guard.mockResolvedValue({ userId: actor, sessionId: sid }); f.audit.mockResolvedValue(undefined); f.limit.mockResolvedValue(null); f.rpc.mockResolvedValue({ data: { items: [], asOf: '2026-10-04T00:00:00Z' }, error: null }) })
afterEach(() => vi.unstubAllEnvs())
describe('formal DAL and endpoint isolation', () => {
    it.each(['list', 'detail', 'create'])('%s authorizes independently before privileged queries', async operation => {
        f.guard.mockRejectedValue(new AdminError('FORBIDDEN', 403, 'Founder denied.'))
        const load = operation === 'list' ? () => listFormalCases() : operation === 'detail' ? () => getFormalCase('privacy', id) : () => mutateFormalCase('create', null, null, intake)
        await expect(load()).rejects.toMatchObject({ status: 403 }); expect(f.rpc).not.toHaveBeenCalled()
    })
    it('the disabled gate fails closed for reads and writes and records safe denial', async () => {
        vi.stubEnv('WEAVLY_ADMIN_FORMAL_ENABLED', '')
        await expect(listFormalCases()).rejects.toMatchObject({ code: 'FORMAL_DISABLED' })
        await expect(mutateFormalCase('create', null, null, intake)).rejects.toMatchObject({ code: 'FORMAL_DISABLED' })
        expect(f.rpc).not.toHaveBeenCalled(); expect(JSON.stringify(f.audit.mock.calls)).not.toContain(intake.body)
    })
    it.each([{ limit: 101 }, { actorId: actor }, { kind: 'payroll' }, { search: 'x'.repeat(161) }, { cursor: 'bad' }])('rejects unbounded and unallowlisted inputs %j', async query => { await expect(listFormalCases(query)).rejects.toMatchObject({ status: 400 }); expect(f.rpc).not.toHaveBeenCalled() })
    it('derives actor/session and sends no transport/request identity fields to economic services', async () => {
        f.rpc.mockResolvedValue({ data: { id, kind: 'privacy', version: 1, requestId }, error: null })
        expect(await mutateFormalCase('create', null, null, intake)).toEqual({ id, kind: 'privacy', version: 1, requestId })
        expect(f.rpc).toHaveBeenCalledWith('admin_formal_mutate', expect.objectContaining({ p_actor_id: actor, p_session_id: sid, p_request_id: requestId, p_id: null, p_kind: 'privacy' }))
        const args = f.rpc.mock.calls[0][1]; expect(args.p_payload).not.toHaveProperty('clientRequestId'); expect(args.p_payload).not.toHaveProperty('kind')
        await expect(mutateFormalCase('create', null, null, { ...intake, actorId: actor })).rejects.toMatchObject({ status: 400 })
    })
    it('maps malformed committed responses and raw source errors to unavailable, with no raw data leakage', async () => {
        f.rpc.mockResolvedValue({ data: { id, unexpected: 'secret source' }, error: null })
        await expect(mutateFormalCase('create', null, null, intake)).rejects.toMatchObject({ status: 503 })
        f.rpc.mockResolvedValue({ data: null, error: { code: '08006', message: 'Private source body' } })
        const response = await GET(new Request('http://localhost/api/admin/formal'))
        expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('Private source body')
        expect(JSON.stringify(f.audit.mock.calls)).not.toContain(intake.body)
    })
    it('returns JSON authorization status and private/no-store independently of page guards', async () => {
        f.guard.mockRejectedValue(new AdminError('UNAUTHENTICATED', 401, 'Sign in again.'))
        const response = await GET(new Request('http://localhost/api/admin/formal'))
        expect(response.status).toBe(401); expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(response.headers.get('vary')).toBe('Cookie')
    })
    it('rejects CSRF, non-JSON and duplicate ambiguous queries before any mutation', async () => {
        const response = await POST(new Request('http://localhost/api/admin/formal', { method: 'POST', headers: { Origin: 'https://foreign.test', 'Content-Type': 'application/json' }, body: JSON.stringify(intake) }))
        expect(response.status).toBe(403); expect(f.rpc).not.toHaveBeenCalled()
        expect((await GET(new Request('http://localhost/api/admin/formal?kind=privacy&kind=security'))).status).toBe(400)
        const detail = await detailPost(new Request(`http://localhost/api/admin/formal/privacy/${id}`, { method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'delete', expectedVersion: 1 }) }), { params: Promise.resolve({ kind: 'privacy', id }) })
        expect(detail.status).toBe(400)
    })
    it('throttling never issues a transaction; ambiguous date/reference and requester bindings remain validated', async () => {
        f.limit.mockResolvedValue('Throttled')
        await expect(mutateFormalCase('create', null, null, intake)).rejects.toMatchObject({ status: 429 }); expect(f.rpc).not.toHaveBeenCalled()
        f.limit.mockResolvedValue(null)
        for (const change of [{ sourceReference: 'javascript:alert(1)' }, { requesterUserId: actor }, { receivedAt: 'tomorrow' }]) await expect(mutateFormalCase('create', null, null, { ...intake, ...change })).rejects.toMatchObject({ status: 400 })
    })
})
