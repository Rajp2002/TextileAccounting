import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const f = vi.hoisted(() => ({ guard: vi.fn(), support: vi.fn(), insert: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireRole: f.guard }))
vi.mock('@/lib/support/data-rights', () => ({ readOwnSupportExport: f.support }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: f.rpc, from: (table: string) => {
    let inserted = false
    const q = {
        select: () => q, eq: () => q, in: () => q,
        insert: (value: unknown) => { inserted = true; f.insert(table, value); return q },
        single: async () => ({ data: { id: 'synthetic-run', status: 'generated' }, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: inserted ? null : [], error: null }).then(resolve),
    }
    return q
} }) }))
import { exportOrganizationData } from '@/app/(dashboard)/owner/settings/data-export'
beforeEach(() => {
    vi.clearAllMocks()
    f.guard.mockResolvedValue({ user: { id: 'owner' }, profile: { org_id: 'org', full_name: 'Synthetic owner' } })
    f.rpc.mockResolvedValue({ data: null, error: null })
    f.support.mockResolvedValue({ asOf: '2026-01-01T00:00:00Z', scope: 'requester_public_support', datasets: {
        support_tickets: [{ id: 'own-ticket', subject: 'Public help' }],
        support_messages: [{ id: 'own-message', ticketId: 'own-ticket', body: 'Public reply' }], support_ticket_events: [],
    } })
})
describe('owner complete export public support integration', () => {
    it('includes only the explicit requester datasets with scope, counts and audited export run', async () => {
        const result = await exportOrganizationData()
        expect(result.datasets.support_messages).toEqual([{ id: 'own-message', ticketId: 'own-ticket', body: 'Public reply' }])
        expect(result.dataset_catalog).toEqual(expect.arrayContaining(['support_tickets', 'support_messages', 'support_ticket_events']))
        expect(result.support_scope.unit).toBe('requester_public_support')
        expect(f.insert).toHaveBeenCalledWith('organization_export_runs', expect.objectContaining({ status: 'generated', dataset_counts: expect.objectContaining({ support_tickets: 1, support_messages: 1 }) }))
        expect(f.rpc).toHaveBeenCalledWith('log_export_event', expect.objectContaining({ p_actor_id: 'owner', p_org_id: 'org' }))
    })
    it('records a failed export and produces no generated download when support schema/history is unavailable', async () => {
        f.support.mockRejectedValue(new Error('private database source details'))
        await expect(exportOrganizationData()).rejects.toThrow('No export was generated')
        expect(f.insert.mock.calls.some(([, value]) => value.status === 'generated')).toBe(false)
        expect(f.insert).toHaveBeenCalledWith('organization_export_runs', expect.objectContaining({ status: 'failed' }))
        expect(JSON.stringify(f.insert.mock.calls)).not.toContain('private database source details')
    })
})
