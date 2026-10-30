import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ requireFounder: vi.fn(), audit: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/admin/founder', () => ({ requireFounder: mocks.requireFounder, adminRecordAudit: mocks.audit }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))

import { contactLists, getMetricAccounts, getMetricsReport, parseMetricsQuery } from '@/lib/admin/growth'
import { factory, trial } from './fixtures/growth'

const principal = { userId: '00000000-0000-4000-8000-000000000091', sessionId: '00000000-0000-4000-8000-000000000092', capabilities: [] }
const emptyInput = (factories: unknown[] = []) => ({ asOf: new Date().toISOString(), goLiveAt: null, trackingSince: null, factories })

beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireFounder.mockResolvedValue(principal)
    mocks.audit.mockResolvedValue(undefined)
    mocks.rpc.mockResolvedValue({ data: emptyInput(), error: null })
})

describe('parseMetricsQuery', () => {
    it.each([
        [{}, { kind: 'fy', fy: '2026–27' }],
        [{ period: 'fy-2025-26' }, { kind: 'fy', fy: '2025–26' }],
        [{ period: '2026-11' }, { kind: 'month', month: '2026-11' }],
        [{ period: '2026-13' }, { kind: 'fy', fy: '2026–27' }],
        [{ period: 'fy-2025-27' }, { kind: 'fy', fy: '2026–27' }],
        [{ period: "'; drop" }, { kind: 'fy', fy: '2026–27' }],
    ])('parseMetricsQuery(%j)', (query, period) => {
        expect(parseMetricsQuery(query, '2026-11-15T00:00:00Z').period).toEqual(period)
    })
    it('unknown list keys become null', () => {
        expect(parseMetricsQuery({ list: 'everyone' }, '2026-11-15T00:00:00Z').list).toBeNull()
        expect(parseMetricsQuery({ list: 'ghost_went_quiet' }, '2026-11-15T00:00:00Z').list).toBe('ghost_went_quiet')
    })
})

describe('getMetricsReport', () => {
    it('audits each read with an ASCII period key', async () => {
        const report = await getMetricsReport({ period: '2026-11' })
        expect(report.period).toEqual({ kind: 'month', month: '2026-11' })
        expect(report.revenue).toBeNull()
        expect(mocks.audit).toHaveBeenCalledWith(principal, 'metrics.read', 'metrics', '2026-11', expect.any(String))
    })
    it('fails closed when the audit fails', async () => {
        mocks.audit.mockRejectedValueOnce(new Error('audit down'))
        await expect(getMetricsReport({})).rejects.toThrow()
    })
    it('a source failure surfaces as 503, and a refused founder session as 403', async () => {
        mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'boom' } })
        await expect(getMetricsReport({})).rejects.toMatchObject({ status: 503 })
        mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'denied' } })
        await expect(getMetricsReport({})).rejects.toMatchObject({ status: 403 })
    })
})

describe('getMetricAccounts', () => {
    it('lists the factories behind a count and audits the list key', async () => {
        const free = factory({ hasFreeGrant: true, name: 'Free Weaving' })
        mocks.rpc.mockResolvedValueOnce({ data: emptyInput([free]), error: null })
        const result = await getMetricAccounts({ list: 'plan_free' })
        expect(result.rows).toEqual([expect.objectContaining({ orgId: free.id, name: 'Free Weaving', plan: 'free' })])
        expect(mocks.audit).toHaveBeenCalledWith(principal, 'metrics.accounts.read', 'metrics', 'plan_free', expect.any(String))
    })
    it('an unknown list is a 400, not a 500', async () => {
        await expect(getMetricAccounts({ list: 'everyone' })).rejects.toMatchObject({ status: 400 })
    })
})

describe('contactLists', () => {
    it('caps each list at 10 rows', () => {
        const now = Date.now()
        const ending = Array.from({ length: 12 }, () => factory({ subscriptions: [trial(new Date(now - 80 * 86_400_000).toISOString(), new Date(now + 5 * 86_400_000).toISOString())] }))
        const lists = contactLists(emptyInput(ending) as never)
        expect(lists.trialsEnding).toHaveLength(10)
        expect(lists.renewalsDue).toEqual([])
        expect(lists.upgradeSignals).toEqual([])
    })
})
