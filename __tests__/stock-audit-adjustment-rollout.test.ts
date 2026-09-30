import { describe, expect, it, vi } from 'vitest'

// Rollout order for PI-06: the page now sends the variance it showed (p_expected_variance). Until migration
// 20260930150000 is applied, the database has no such argument, so the call fails. The owner must be told what to do
// instead of seeing a schema-cache error, and every other database error must still pass through unchanged.
const rpc = vi.hoisted(() => ({ result: { data: null as unknown, error: null as null | { code?: string; message: string } } }))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
vi.mock('@/lib/auth', () => ({ requireRole: async () => ({ user: { id: 'u' }, profile: { org_id: 'o', role: 'owner' } }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: async () => rpc.result }) }))
const { applyAuditAdjustmentAction } = await import('../app/(dashboard)/owner/stock/audit/actions')

const input = {
    auditId: '11111111-1111-4111-8111-111111111111', itemType: 'fabric' as const, itemId: '22222222-2222-4222-8222-222222222222',
    physicalCount: 96, expectedVariance: -4, reason: 'Recount',
}

describe('audit adjustment before the database migration is applied', () => {
    it('explains that the database update is pending when the six-argument function is missing', async () => {
        rpc.result = { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.apply_inventory_audit_adjustment(p_audit_id, p_expected_variance) in the schema cache' } }
        const result = await applyAuditAdjustmentAction(input)
        expect('error' in result && result.error).toContain('20260930150000')
        expect('error' in result && result.error).not.toContain('schema cache')
    })

    it('passes every other database error through unchanged', async () => {
        rpc.result = { data: null, error: { code: '22023', message: 'The adjustment changed since it was shown (was -3, now -4). Review it and try again.' } }
        expect(await applyAuditAdjustmentAction(input)).toEqual({ error: 'The adjustment changed since it was shown (was -3, now -4). Review it and try again.' })
    })

    it('returns the applied variance on success', async () => {
        rpc.result = { data: { success: true, adjusted: true, variance: -4 }, error: null }
        expect(await applyAuditAdjustmentAction(input)).toEqual({ success: true, variance: -4 })
    })
})
