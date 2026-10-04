import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const f = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireRole: f.guard }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: f.rpc }) }))
import { checkOwnAccountDeletion, readOwnSupportExport } from '@/lib/support/data-rights'

const userId = '00000000-0000-4000-8000-000000000001', orgId = '00000000-0000-4000-8000-000000000002'
const ticket = { id: userId, subject: 'Synthetic public help', category: 'other', priority: 'normal', status: 'new', source: 'in_app', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', nextUpdateDueAt: null, resolvedAt: null, resolutionCode: null, resolutionSummary: null }
beforeEach(() => { vi.clearAllMocks(); f.guard.mockResolvedValue({ user: { id: userId }, profile: { org_id: orgId } }) })
describe('requester data-rights loaders', () => {
    it('independently verifies owner identity before any privileged read and allows unpaid access', async () => {
        f.guard.mockRejectedValue(new Error('Denied'))
        await expect(readOwnSupportExport()).rejects.toThrow('Denied')
        await expect(checkOwnAccountDeletion()).rejects.toThrow('Denied')
        expect(f.rpc).not.toHaveBeenCalled()
        expect(f.guard).toHaveBeenCalledWith(['owner'], { allowFreeAccount: true })
    })
    it('exports every page with the same snapshot and server-derived requester/org', async () => {
        const next = { rank: 0, createdAt: ticket.createdAt, id: userId }
        f.rpc.mockResolvedValueOnce({ data: { items: [{ kind: 'ticket', value: ticket }], nextCursor: next }, error: null })
            .mockResolvedValueOnce({ data: { items: [{ kind: 'message', value: { id: orgId, ticketId: userId, authorKind: 'customer', messageKind: 'initial_intake', body: 'Public text', createdAt: ticket.createdAt, messageSeq: '9007199254740993' } }], nextCursor: null }, error: null })
        const result = await readOwnSupportExport()
        expect(result.datasets.support_tickets).toEqual([ticket])
        expect(result.datasets.support_messages[0].messageSeq).toBe('9007199254740993')
        expect(f.rpc.mock.calls[1][1]).toEqual({ p_actor_id: userId, p_org_id: orgId, p_as_of: f.rpc.mock.calls[0][1].p_as_of, p_limit: 100, p_cursor: next })
    })
    it('never returns a partial export when schema/source fails after a successful page', async () => {
        f.rpc.mockResolvedValueOnce({ data: { items: [{ kind: 'ticket', value: ticket }], nextCursor: { rank: 0, createdAt: ticket.createdAt, id: userId } }, error: null })
            .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'private database details' } })
        await expect(readOwnSupportExport()).rejects.toThrow('No export was generated')
    })
    it('rejects private fields or a repeating cursor instead of hiding incomplete data', async () => {
        f.rpc.mockResolvedValueOnce({ data: { items: [{ kind: 'ticket', value: { ...ticket, internalNotes: ['secret'] } }], nextCursor: null }, error: null })
        await expect(readOwnSupportExport()).rejects.toThrow('unavailable or incomplete')
        f.rpc.mockResolvedValue({ data: { items: [{ kind: 'ticket', value: ticket }], nextCursor: { rank: 0, createdAt: ticket.createdAt, id: userId } }, error: null })
        await expect(readOwnSupportExport()).rejects.toThrow('unavailable or incomplete')
    })
    it('preflight requires consistent safe output; source errors never mean ready', async () => {
        f.rpc.mockResolvedValueOnce({ data: { allowed: false, reason: 'review_required' }, error: null })
        expect(await checkOwnAccountDeletion()).toEqual({ allowed: false, reason: 'review_required' })
        f.rpc.mockResolvedValueOnce({ data: { allowed: true, reason: 'review_required' }, error: null })
        await expect(checkOwnAccountDeletion()).rejects.toThrow('no subscription cancellation was requested')
        f.rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } })
        await expect(checkOwnAccountDeletion()).rejects.toThrow('could not be verified')
    })
})
