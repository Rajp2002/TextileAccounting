import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ requireFounder: vi.fn(), audit: vi.fn(), factory: vi.fn(), support: vi.fn(), payments: vi.fn(), system: vi.fn(), paidPlans: vi.fn(), growth: vi.fn(), contacts: vi.fn() }))
vi.mock('@/lib/admin/paid-plans', () => ({ getPaidPlansAdmin: mocks.paidPlans }))
vi.mock('@/lib/admin/growth', () => ({ loadGrowthInput: mocks.growth, contactLists: mocks.contacts }))
vi.mock('@/lib/admin/founder', () => ({ requireFounder: mocks.requireFounder, adminRecordAudit: mocks.audit }))
vi.mock('@/lib/admin/factories', () => ({ getFactorySummary: mocks.factory }))
vi.mock('@/lib/admin/support', () => ({ getSupportSummary: mocks.support }))
vi.mock('@/lib/admin/payments', () => ({ getPaymentsReport: mocks.payments }))
vi.mock('@/lib/admin/system', () => ({ getAdminSystem: mocks.system }))
import { ApiError } from '@/lib/admin/errors'
import { getAdminOverview } from '@/lib/admin/overview'
beforeEach(() => {
    vi.clearAllMocks(); mocks.requireFounder.mockResolvedValue({ userId: 'founder', sessionId: 'session' }); mocks.audit.mockResolvedValue(undefined)
    mocks.factory.mockResolvedValue({ asOf: '2026-10-04T00:00:00Z', totalProductionFactories: 0 })
    mocks.support.mockResolvedValue({ asOf: '2026-10-04T00:00:00Z', unanswered: 1, needsReply: 1, overdueFollowUps: 0, attention: [{ id: 'support:1', ticketId: '1', subject: 'Synthetic help', priority: 'normal', observedAt: '2026-10-01T00:00:00Z', status: 'in_progress', followUpDueAt: null, nextUpdateDueAt: null, sortRank: 3, nextAction: 'Reply in-app', reason: 'Customer is waiting.' }] })
    mocks.payments.mockResolvedValue({ asOf: '2026-10-04T00:00:00Z', exceptions: [] })
    mocks.system.mockResolvedValue({ asOf: '2026-10-04T00:00:00Z', signals: [] })
    mocks.paidPlans.mockResolvedValue({ goLiveAt: null, endingIn14Days: 0, endingIn30Days: 0, alreadyEnded: 0, readiness: { mode: 'test', missing: [] } })
    mocks.growth.mockResolvedValue({ asOf: '2026-10-04T00:00:00Z', goLiveAt: null, trackingSince: null, factories: [] })
    mocks.contacts.mockReturnValue({ trialsEnding: [], renewalsDue: [], upgradeSignals: [] })
})
describe('Release 3 Customers to contact on Today', () => {
    it('loads the contact lists from the growth input', async () => {
        mocks.contacts.mockReturnValue({ trialsEnding: [{ orgId: 'o1' }], renewalsDue: [], upgradeSignals: [] })
        const result = await getAdminOverview()
        expect(result.contacts).toMatchObject({ state: 'available', value: { trialsEnding: [{ orgId: 'o1' }] } })
        expect(mocks.growth).toHaveBeenCalledWith({ userId: 'founder', sessionId: 'session' }, expect.any(String))
    })
    it('a contacts source failure leaves the rest of Today intact', async () => {
        mocks.growth.mockRejectedValue(new Error('private backend failure'))
        const result = await getAdminOverview()
        expect(result.contacts).toMatchObject({ state: 'unavailable', value: null })
        expect(result.support.value?.needsReply).toBe(1)
        expect(JSON.stringify(result)).not.toContain('private backend failure')
    })
})
describe('Release 2 paid plans warning on Today', () => {
    it('warns while paid plans are not live and unpaid trials end within 14 days', async () => {
        mocks.paidPlans.mockResolvedValue({ goLiveAt: null, endingIn14Days: 3, endingIn30Days: 4, alreadyEnded: 0, readiness: { mode: 'test', missing: [] } })
        const item = (await getAdminOverview()).attention.find(entry => entry.id === 'paid_plans:trials_ending')
        expect(item).toMatchObject({ group: 'payments', severity: 'high', href: '/admin/payments#paid-plans', reason: "3 unpaid trials end in the next 14 days. Paid plans aren't live yet." })
    })
    it('does not warn after go-live or when no trial is ending', async () => {
        mocks.paidPlans.mockResolvedValue({ goLiveAt: '2027-03-12T05:00:00Z', endingIn14Days: 3, endingIn30Days: 4, alreadyEnded: 0, readiness: { mode: 'live', missing: [] } })
        expect((await getAdminOverview()).attention.some(entry => entry.id === 'paid_plans:trials_ending')).toBe(false)
        mocks.paidPlans.mockResolvedValue({ goLiveAt: null, endingIn14Days: 0, endingIn30Days: 2, alreadyEnded: 1, readiness: { mode: 'test', missing: [] } })
        expect((await getAdminOverview()).attention.some(entry => entry.id === 'paid_plans:trials_ending')).toBe(false)
    })
    it('a paid plans source failure leaves the rest of Today intact', async () => {
        mocks.paidPlans.mockRejectedValue(new Error('private backend failure'))
        const result = await getAdminOverview()
        expect(result.paidPlans).toMatchObject({ state: 'unavailable', value: null })
        expect(result.support.value?.needsReply).toBe(1)
    })
})
describe('AD08 partial-source operating queue', () => {
    it('keeps support actionable when optional factory/payment sources fail', async () => {
        mocks.factory.mockRejectedValue(new ApiError('SOURCE_UNAVAILABLE', 503, 'Unavailable.')); mocks.payments.mockRejectedValue(new Error('private backend failure'))
        const result = await getAdminOverview()
        expect(result.factories).toMatchObject({ state: 'unavailable', value: null })
        expect(result.payments).toMatchObject({ state: 'unavailable', value: null })
        expect(result.support.value?.needsReply).toBe(1)
        expect(result.attention[0]).toMatchObject({ id: 'support:1', href: '/admin/support/1', owner: 'Founder' })
        expect(JSON.stringify(result)).not.toContain('private backend failure')
    })
    it('never degrades revoked/denied founder authorization into an available summary', async () => {
        mocks.payments.mockRejectedValue(new ApiError('FORBIDDEN', 403, 'Denied.'))
        await expect(getAdminOverview()).rejects.toMatchObject({ status: 403 })
        expect(mocks.audit).not.toHaveBeenCalled()
    })
    it('ranks high-impact incidents before money/access and ordinary support, deduplicating stable IDs', async () => {
        const incident = { id: 'incident:1', observedAt: '2026-10-01T00:00:00Z', severity: 'critical', reason: 'Incident', href: '/admin/legacy' }
        mocks.system.mockResolvedValue({ asOf: '2026-10-04T00:00:00Z', signals: [{ key: 'security_incidents', items: [incident, incident] }] })
        mocks.payments.mockResolvedValue({ asOf: '2026-10-04T00:00:00Z', exceptions: [{ id: 'capture:1', reference: 'Synthetic payment', severity: 'high', observedAt: '2026-10-01T00:00:00Z', reason: 'Access needs review', href: '/admin/payments' }] })
        const result = await getAdminOverview()
        expect(result.attention.map(item => item.id)).toEqual(['incident:1', 'capture:1', 'support:1'])
        expect(result.attention.every(item => item.ageSeconds >= 0)).toBe(true)
    })
    it('separates internal waiting-customer follow-ups from public update promises and preserves queue rank', async () => {
        const reminder = { id: 'support:followup', ticketId: 'followup', subject: 'Synthetic customer question', priority: 'normal', status: 'waiting_on_customer',
            observedAt: '2026-10-02T00:00:00Z', followUpDueAt: '2026-10-02T00:00:00Z', nextUpdateDueAt: null, sortRank: 2, nextAction: 'Check the requested setup details.', reason: 'Internal customer follow-up due' }
        const promise = { ...reminder, id: 'support:promise', ticketId: 'promise', observedAt: '2026-10-03T00:00:00Z', followUpDueAt: null, nextUpdateDueAt: '2026-10-03T00:00:00Z', sortRank: 1, reason: 'Promised customer update overdue' }
        const ordinary = { ...reminder, id: 'support:older', ticketId: 'older', observedAt: '2026-09-01T00:00:00Z', status: 'in_progress', followUpDueAt: null, sortRank: 3, reason: 'Customer needs our reply' }
        mocks.support.mockResolvedValue({ asOf: '2026-10-04T00:00:00Z', overdueFollowUps: 1, overduePromises: 1, attention: [ordinary, reminder, promise] })
        const result = await getAdminOverview()
        expect(result.attention.map(item => item.id)).toEqual(['support:promise', 'support:followup', 'support:older'])
        expect(result.attention[1]).toMatchObject({ reason: 'Internal customer follow-up due', dueLabel: 'Internal customer follow-up due', dueAt: reminder.followUpDueAt })
        expect(result.attention[0]).toMatchObject({ dueLabel: 'Promised customer update due', dueAt: promise.nextUpdateDueAt })
        expect(result.support.value?.overdueFollowUps).toBe(1)
        expect(result.support.value?.overduePromises).toBe(1)
    })
})
