import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ guard: vi.fn(), audit: vi.fn(), client: vi.fn(), tables: [] as string[], results: [] as Array<{ data: unknown; error: unknown }>, requests: [] as Array<Record<string, ReturnType<typeof vi.fn>>> }))
vi.mock('@/lib/admin/founder', () => ({ requireFounder: mocks.guard, adminRecordAudit: mocks.audit }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.client }))
import { getLegacyRecord, listLegacyDpaBindings, listLegacyRecords } from '@/lib/admin/legacy-read'
import { AdminError } from '@/lib/admin/errors'
import { GET as listGET } from '@/app/api/admin/legacy/route'
import { GET as detailGET } from '@/app/api/admin/legacy/[kind]/[id]/route'
import { GET as bindingsGET } from '@/app/api/admin/legacy/dpas/[id]/bindings/route'

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ID2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', ORG = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const createdAt = '2026-10-04T00:00:00.000Z'
const incident = { id: ID, org_id: ORG, title: 'Synthetic availability investigation', status: 'triaging', created_at: createdAt, severity: 'high', incident_type: 'availability', cert_in_assessment: 'pending', aware_at: createdAt, cert_in_assessment_due_at: '2026-10-04T06:00:00Z', summary: 'Synthetic read-only record' }

beforeEach(() => {
    vi.resetAllMocks(); mocks.results.length = 0; mocks.requests.length = 0; mocks.tables.length = 0
    vi.stubEnv('WEAVLY_ADMIN_LEGACY_READS_ENABLED', 'true')
    mocks.guard.mockResolvedValue({ userId: ID, sessionId: ID2, capabilities: [] }); mocks.audit.mockResolvedValue(undefined)
    mocks.client.mockImplementation(() => ({ from: (table: string) => {
        mocks.tables.push(table)
        const request: Record<string, ReturnType<typeof vi.fn>> = {}
        for (const method of ['select', 'order', 'limit', 'eq', 'is', 'lt', 'or', 'ilike']) request[method] = vi.fn(() => request)
        const result = () => mocks.results.shift() ?? { data: [], error: null }
        request.maybeSingle = vi.fn(() => Promise.resolve(result()))
        request.then = vi.fn((resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject))
        mocks.requests.push(request); return request
    } }))
})
afterEach(() => vi.unstubAllEnvs())

describe('bounded founder-only legacy reads', () => {
    it.each(['list', 'detail', 'bindings'])('%s requires founder before privileged access', async operation => {
        mocks.guard.mockRejectedValueOnce(new AdminError('FORBIDDEN', 403, 'Founder denied'))
        const load = operation === 'list' ? () => listLegacyRecords() : operation === 'detail' ? () => getLegacyRecord('incidents', ID) : () => listLegacyDpaBindings(ID)
        await expect(load()).rejects.toMatchObject({ code: 'FORBIDDEN' }); expect(mocks.client).not.toHaveBeenCalled()
    })
    it.each(['list', 'detail', 'bindings'])('%s is separately gated and audits denied access', async operation => {
        vi.stubEnv('WEAVLY_ADMIN_LEGACY_READS_ENABLED', '')
        const load = operation === 'list' ? () => listLegacyRecords() : operation === 'detail' ? () => getLegacyRecord('incidents', ID) : () => listLegacyDpaBindings(ID)
        await expect(load()).rejects.toMatchObject({ code: 'LEGACY_READS_DISABLED', status: 403 }); expect(mocks.client).not.toHaveBeenCalled()
        expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), 'legacy.read.attempt', 'legacy_register', 'gated', expect.any(String), { outcome: 'denied', reasonCode: 'legacy_reads_disabled' })
    })
    it.each([{ limit: 0 }, { limit: 101 }, { sort: 'rawSql' }, { kind: 'profiles' }, { kind: 'incidents', state: 'resolved' }, { search: 'x'.repeat(161) }])('rejects invalid allowlisted query %j', async query => {
        await expect(listLegacyRecords(query)).rejects.toMatchObject({ status: 400 }); expect(mocks.client).not.toHaveBeenCalled()
        expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), 'legacy.register.read', 'legacy_register', 'bounded_list', expect.any(String), expect.objectContaining({ outcome: 'failure' }))
    })
    it('selects safe columns and literal search without exposing full incident records', async () => {
        mocks.results.push({ data: [{ ...incident, reported_by_email: 'omit@example.test', created_by: ID2, unexpected: 'sensitive' }], error: null })
        const report = await listLegacyRecords({ kind: 'incidents', search: '100%_\\', state: 'triaging', limit: 100 })
        const request = mocks.requests[0]
        expect(mocks.tables[0]).toBe('security_incidents'); expect(request.select).toHaveBeenCalledWith(expect.not.stringContaining('*'))
        expect(request.select.mock.calls[0][0]).not.toMatch(/reported_by_email|summary|created_by/)
        expect(request.ilike).toHaveBeenCalledWith('title', '%100\\%\\_\\\\%'); expect(request.eq).toHaveBeenCalledWith('status', 'triaging'); expect(request.limit).toHaveBeenCalledWith(101)
        expect(report.items[0]).toEqual({ id: ID, orgId: ORG, title: incident.title, state: 'triaging', recordedAt: createdAt, context: 'high · availability · Assessment: pending' })
        expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(incident.title)
    })
    it('honest empty matching page is distinct from failed source', async () => {
        const report = await listLegacyRecords(); expect(report.items).toEqual([]); expect(report.nextCursor).toBeNull()
        mocks.results.push({ data: null, error: { message: 'Raw SQL credentials or private body' } })
        await expect(listLegacyRecords()).rejects.toMatchObject({ code: 'LEGACY_SOURCE_UNAVAILABLE', status: 503, message: expect.not.stringContaining('Raw SQL') })
        expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain('Raw SQL')
    })
    it('stable cursor retains tied timestamp and UUID, validates filters, and includes undated tail', async () => {
        mocks.results.push({ data: [incident, { ...incident, id: ID2 }], error: null })
        const first = await listLegacyRecords({ kind: 'incidents', limit: 1 })
        expect(first.items).toHaveLength(1); expect(first.nextCursor).not.toBeNull()
        await listLegacyRecords({ kind: 'incidents', limit: 1, cursor: first.nextCursor })
        expect(mocks.requests[1].or).toHaveBeenCalledWith(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${ID}),created_at.is.null`)
        expect(mocks.requests[1].order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false, nullsFirst: false }); expect(mocks.requests[1].order).toHaveBeenNthCalledWith(2, 'id', { ascending: false })
        await expect(listLegacyRecords({ kind: 'grievances', cursor: first.nextCursor })).rejects.toMatchObject({ code: 'INVALID_CURSOR' })
        await expect(listLegacyRecords({ kind: 'incidents', search: 'changed', cursor: first.nextCursor })).rejects.toMatchObject({ code: 'INVALID_CURSOR' })
    })
    it('undated cursor stays in undated rows with UUID tie-break', async () => {
        mocks.results.push({ data: [{ ...incident, created_at: null }, { ...incident, id: ID2, created_at: null }], error: null })
        const first = await listLegacyRecords({ kind: 'incidents', limit: 1 })
        await listLegacyRecords({ kind: 'incidents', limit: 1, cursor: first.nextCursor })
        expect(mocks.requests[1].is).toHaveBeenCalledWith('created_at', null); expect(mocks.requests[1].lt).toHaveBeenCalledWith('id', ID)
    })
    it('invalid source identity or date fails closed rather than reporting partial validity', async () => {
        mocks.results.push({ data: [{ ...incident, org_id: 'not-uuid' }], error: null })
        await expect(listLegacyRecords({ kind: 'incidents' })).rejects.toMatchObject({ code: 'LEGACY_SOURCE_UNAVAILABLE' })
        expect(mocks.audit.mock.calls.map(call => call[5]?.outcome)).toEqual(['failure'])
    })
    it('bounded grievance detail omits worker and resolution proof but records authorized contact', async () => {
        mocks.results.push({ data: { ...incident, subject: 'Privacy inquiry', description: 'x'.repeat(10001), requester_email: 'synthetic@example.test', worker_id: 123, resolution_proof_url: 'https://private.test/proof', response_summary: '<script>text</script>' }, error: null })
        const record = await getLegacyRecord('grievances', ID)
        expect(record.texts[0].value).toHaveLength(10000); expect(record.texts[0].truncated).toBe(true)
        expect(record.fields.find(field => field.label === 'Requester contact')?.value).toBe('synthetic@example.test')
        expect(mocks.requests[0].select.mock.calls[0][0]).not.toMatch(/worker_id|proof_url/)
        expect(JSON.stringify(record)).not.toContain('https://private.test'); expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain('synthetic@example.test')
    })
    it('notice detail omits audio URL and has no invented update timestamp', async () => {
        mocks.results.push({ data: { id: ID, created_at: createdAt, version_string: 'v-test', is_active: true, body_text: 'Recorded notice', english_transcript: 'Recorded transcript', content_hash: 'synthetic-hash', content_audio_url: 'https://private.test/audio' }, error: null })
        const record = await getLegacyRecord('notices', ID)
        expect(mocks.requests[0].select.mock.calls[0][0]).not.toContain('audio'); expect(record.fields.find(field => field.label === 'Last updated')?.value).toBeNull()
        expect(JSON.stringify(record)).not.toContain('audio')
    })
    it('DPA bindings are bounded to one verified UUID and omit signer/proof data', async () => {
        mocks.results.push({ data: [{ id: ID2, org_id: ORG, status: 'signed', signed_at: createdAt, created_at: createdAt, signed_by: ID, proof_url: 'private' }], error: null })
        const bindings = await listLegacyDpaBindings(ID)
        expect(mocks.requests[0].eq).toHaveBeenCalledWith('dpa_id', ID); expect(mocks.requests[0].limit).toHaveBeenCalledWith(26)
        expect(mocks.requests[0].select).toHaveBeenCalledWith('id,org_id,status,signed_at,created_at'); expect(JSON.stringify(bindings)).not.toMatch(/signed_by|proof_url/)
    })
    it('audit failure prevents returning a read DTO', async () => {
        mocks.results.push({ data: [incident], error: null }); mocks.audit.mockRejectedValueOnce(new AdminError('AUDIT_UNAVAILABLE', 503, 'Audit unavailable'))
        await expect(listLegacyRecords({ kind: 'incidents' })).rejects.toMatchObject({ code: 'AUDIT_UNAVAILABLE' }); expect(mocks.audit).toHaveBeenCalledOnce()
    })
    it('missing record returns 404 and audits unsuccessful read only', async () => {
        mocks.results.push({ data: null, error: null })
        await expect(getLegacyRecord('incidents', ID)).rejects.toMatchObject({ status: 404 })
        expect(mocks.audit.mock.calls.map(call => call[5]?.outcome)).toEqual(['failure'])
    })
})

describe('read-only legacy HTTP contracts', () => {
    it.each(['list', 'detail', 'bindings'])('%s protects direct API calls and emits private no-store JSON error', async path => {
        mocks.guard.mockRejectedValueOnce(new AdminError('UNAUTHENTICATED', 401, 'Sign in required'))
        const request = new Request('http://localhost/api/admin/legacy')
        const response = path === 'list' ? await listGET(request) : path === 'detail' ? await detailGET(request, { params: Promise.resolve({ kind: 'incidents', id: ID }) }) : await bindingsGET(request, { params: Promise.resolve({ id: ID }) })
        expect(response.status).toBe(401); expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(response.headers.get('vary')).toBe('Cookie')
        expect(await response.json()).toEqual({ code: 'UNAUTHENTICATED', message: 'Sign in required', requestId: expect.any(String) }); expect(mocks.client).not.toHaveBeenCalled()
    })
    it('duplicate query arguments reject instead of silently selecting a register', async () => {
        const response = await listGET(new Request('http://localhost/api/admin/legacy?kind=incidents&kind=grievances'))
        expect(response.status).toBe(400); expect(mocks.client).not.toHaveBeenCalled()
    })
    it('bounded success is private/no-store and failures never expose raw source errors', async () => {
        const success = await listGET(new Request('http://localhost/api/admin/legacy'))
        expect(success.status).toBe(200); expect(success.headers.get('cache-control')).toBe('private, no-store')
        mocks.results.push({ data: null, error: { message: 'Secret raw error' } })
        const response = await listGET(new Request('http://localhost/api/admin/legacy'))
        expect(response.status).toBe(503); expect(await response.text()).not.toContain('Secret raw error')
    })
})
