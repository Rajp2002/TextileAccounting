import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const fixture = vi.hoisted(() => ({ guard: vi.fn(), audit: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/admin/founder', () => ({ requireFounder: fixture.guard, adminRecordAudit: fixture.audit }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: fixture.rpc }) }))
import { getFactorySummary, listFactories } from '@/lib/admin/factories'

beforeEach(() => {
    vi.clearAllMocks()
    fixture.guard.mockResolvedValue({ userId: 'founder', sessionId: 'session', capabilities: [] })
    fixture.audit.mockResolvedValue(undefined)
    fixture.rpc.mockImplementation((_name, args) => Promise.resolve({ data: { asOf: args.p_as_of, rows: [] }, error: null }))
})
describe('AD03/04 guarded reporting loaders', () => {
    it('denies before any privileged query and audit on wrong identity', async () => {
        fixture.guard.mockRejectedValue(new Error('Denied'))
        await expect(getFactorySummary()).rejects.toThrow('Denied')
        await expect(listFactories()).rejects.toThrow('Denied')
        expect(fixture.rpc).not.toHaveBeenCalled()
    })
    it('population-source failure is unavailable, never a successful zero', async () => {
        fixture.rpc.mockResolvedValue({ data: null, error: { code: 'connection' } })
        await expect(getFactorySummary()).rejects.toMatchObject({ code: 'FACTORY_SOURCE_UNAVAILABLE', status: 503 })
        expect(fixture.audit).not.toHaveBeenCalled()
    })
    it('known zero requires healthy population and required audited access', async () => {
        expect(await getFactorySummary()).toMatchObject({ totalProductionFactories: 0 })
        expect(fixture.guard).toHaveBeenCalledOnce()
        expect(fixture.audit).toHaveBeenCalledWith(expect.anything(), 'factories.summary.read', 'factory_population', 'snapshot', expect.any(String))
        fixture.audit.mockRejectedValue(new Error('Audit unavailable'))
        await expect(listFactories()).rejects.toThrow('Audit unavailable')
    })
    it('validates bounded allowlisted inputs before RPC and never logs raw search', async () => {
        await expect(listFactories({ limit: 101 })).rejects.toMatchObject({ status: 400 })
        expect(fixture.rpc).not.toHaveBeenCalled()
        await listFactories({ search: 'synthetic@example.test' })
        expect(fixture.rpc).toHaveBeenCalledWith('admin_factory_snapshot', expect.objectContaining({ p_search: 'synthetic@example.test' }))
        expect(JSON.stringify(fixture.audit.mock.calls)).not.toContain('synthetic@example.test')
    })
    it('reports search-population classification counts from the same guarded RPC before access filtering', async () => {
        const row = { id: '00000000-0000-4000-8000-000000000001', name: 'Synthetic search result', created_at: new Date().toISOString(), cohort: 'unclassified', is_locked_down: false, owner_revoked: false, verified_email: null, subscriptions: [], has_free_grant: false, free_subject_id: null, estimator_at: null, production_at: null, last_outcome_at: null, open_tickets: 0 }
        fixture.rpc.mockImplementation((_name, args) => Promise.resolve({ data: { asOf: args.p_as_of, rows: [row] }, error: null }))
        const result = await listFactories({ search: 'Synthetic', cohort: 'production', plan: 'free' })
        expect(result.totalMatching).toBe(0)
        expect(result.classificationCounts).toEqual({ production: 0, unclassified: 1, test: 0, demo: 0, internal: 0 })
        expect(result.classificationScope).toBe('search_population_before_access_filters')
        expect(fixture.rpc).toHaveBeenCalledOnce()
    })
})
