import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ guard: vi.fn(), list: vi.fn(), enabled: vi.fn() }))
vi.mock('@/lib/admin/founder', () => ({ requireFounderPage: mocks.guard }))
vi.mock('@/lib/admin/legacy-read', async (load) => ({ ...await load<typeof import('@/lib/admin/legacy-read')>(), legacyReadsEnabled: mocks.enabled, listLegacyRecords: mocks.list }))
import LegacyPage from '@/app/(admin-console)/admin/legacy/page'
import { LegacyRecordDetail } from '@/components/admin/legacy-records'
import { AdminError } from '@/lib/admin/errors'

const report = { kind: 'incidents', items: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', orgId: null, title: 'Synthetic incident', state: 'triaging', recordedAt: '2026-10-04T00:00:00Z', context: 'high · availability' }], filters: { kind: 'incidents', state: 'all', search: '', limit: 25 }, nextCursor: null, asOf: '2026-10-04T00:00:00Z', coverage: 'Bounded retained source', readOnly: true }
beforeEach(() => { vi.resetAllMocks(); mocks.guard.mockResolvedValue({ userId: 'synthetic-founder' }); mocks.enabled.mockReturnValue(false); mocks.list.mockResolvedValue(report) })
afterEach(() => vi.unstubAllEnvs())
const page = (query: Record<string, string | string[]> = {}) => LegacyPage({ searchParams: Promise.resolve(query) })

describe('retained formal fallback gates and usable reads', () => {
    it('default closed gate performs no source query', async () => {
        const html = renderToStaticMarkup(await page())
        expect(mocks.guard).toHaveBeenCalledOnce(); expect(mocks.list).not.toHaveBeenCalled()
        expect(html).toContain('Fallback access is awaiting review')
    })
    it('verifies founder before any read or filters', async () => {
        mocks.enabled.mockReturnValue(true); mocks.guard.mockRejectedValueOnce(new Error('Founder denied'))
        await expect(page()).rejects.toThrow('Founder denied'); expect(mocks.list).not.toHaveBeenCalled()
    })
    it.each(['', 'true'])('operation flag %s never adds mutation, export or messaging controls', async flag => {
        vi.stubEnv('WEAVLY_ADMIN_LEGACY_OPERATIONS_ENABLED', flag); mocks.enabled.mockReturnValue(true)
        const html = renderToStaticMarkup(await page({ kind: 'incidents' }))
        expect(mocks.list).toHaveBeenCalledWith({ kind: 'incidents' })
        expect(html).toContain('Synthetic incident'); expect(html).toContain('Inspect record'); expect(html).toContain('method="get"')
        expect(html).not.toContain('method="post"'); expect(html).not.toContain('Download'); expect(html).not.toContain('Send to customer')
        expect(html).toContain('Recorded documents, deadlines and assessment labels do not establish current legal policy')
    })
    it('source failure does not display an empty/healthy register', async () => {
        mocks.enabled.mockReturnValue(true); mocks.list.mockRejectedValueOnce(new AdminError('LEGACY_SOURCE_UNAVAILABLE', 503, 'Source unavailable; no empty register assumed'))
        const html = renderToStaticMarkup(await page())
        expect(html).toContain('Source unavailable; no empty register assumed'); expect(html).not.toContain('No matching retained records')
    })
    it('passes duplicate query values into validation as invalid rather than choosing one', async () => {
        mocks.enabled.mockReturnValue(true); await page({ kind: ['incidents', 'grievances'] })
        expect(mocks.list).toHaveBeenCalledWith({ kind: '\u0000' })
    })
    it('recorded content renders as inert text and truncation is clear', () => {
        const html = renderToStaticMarkup(<LegacyRecordDetail record={{ ...report.items[0], kind: 'incidents', fields: [], texts: [{ label: 'Summary', value: '<img src=x onerror=alert(1)>', truncated: true }], asOf: report.asOf, readOnly: true }}/>)
        expect(html).toContain('&lt;img'); expect(html).not.toContain('<img'); expect(html).toContain('first 10,000 characters')
    })
})
