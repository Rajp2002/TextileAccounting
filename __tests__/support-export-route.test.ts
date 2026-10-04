import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ owner: vi.fn(), export: vi.fn() }))
vi.mock('@/lib/support/server', async () => {
    const { adminErrorResponse } = await import('@/lib/admin/errors')
    return { requireSupportOwner: mocks.owner, supportError: adminErrorResponse }
})
vi.mock('@/lib/support/data-rights', () => ({ readOwnSupportExport: mocks.export }))
import { GET } from '@/app/api/support/export/route'
import { AdminError } from '@/lib/admin/errors'
beforeEach(() => { vi.resetAllMocks(); mocks.owner.mockResolvedValue({ userId: 'synthetic-requester', orgId: 'synthetic-org' }); mocks.export.mockResolvedValue({ datasets: { support_tickets: [] }, scope: 'requester_public_support', asOf: '2026-10-04T00:00:00Z' }) })
describe('requester support download', () => {
    it('returns a private downloadable snapshot only after the independent owner gate', async () => {
        const response = await GET()
        expect(response.status).toBe(200)
        expect(response.headers.get('cache-control')).toContain('no-store')
        expect(response.headers.get('content-disposition')).toContain('attachment')
        expect(await response.json()).toMatchObject({ schemaVersion: 'requester-support-v1', scope: 'requester_public_support' })
        expect(mocks.export.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.owner.mock.invocationCallOrder[0])
    })
    it.each([401, 403, 503])('denies %s without reading ticket data', async status => {
        mocks.owner.mockRejectedValue(new AdminError('DENIED', status, 'Access unavailable.'))
        expect((await GET()).status).toBe(status)
        expect(mocks.export).not.toHaveBeenCalled()
    })
    it('sanitizes an incomplete export and never returns a partial download', async () => {
        mocks.export.mockRejectedValue(new Error('raw private source error'))
        const response = await GET()
        expect(response.status).toBe(503)
        expect(await response.text()).not.toContain('raw private')
        expect(response.headers.get('content-disposition')).toBeNull()
    })
})
