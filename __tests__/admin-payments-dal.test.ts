import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ requireFounder: vi.fn(), audit: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/admin/founder', () => ({ requireFounder: mocks.requireFounder, adminRecordAudit: mocks.audit }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
import { ApiError } from '@/lib/admin/errors'
import { getPaymentsReport } from '@/lib/admin/payments'

const from = '2026-09-01T00:00:00.000Z', to = '2026-10-01T00:00:00.000Z'
function input() {
    return { summary: { knownGrossMinor: '1299800', knownRefundMinor: '100000', captureCount: 2, refundCount: 1, unverifiedMinor: '0', unverifiedCount: 0, excludedCount: 0, taxExclusiveKnownMinor: '0', taxExcludedMinor: '1399800' },
        coverage: [{ provider: 'razorpay', providerAccountId: 'synthetic', mode: 'live', currency: 'INR', periodStart: from, periodEnd: to, captureState: 'complete', refundState: 'complete', checkedAt: to, conflictsCount: 0 }],
        accounts: [{ provider: 'razorpay', providerAccountId: 'synthetic' }], ledger: [], exceptions: [], asOf: to,
        diagnostics: { unmappedPayments: 0, unmappedRefunds: 0, sourceConflicts: 0, unmappedPaymentAmountMinor: '0', unmappedRefundAmountMinor: '0' } }
}
beforeEach(() => { vi.clearAllMocks(); mocks.requireFounder.mockResolvedValue({ userId: 'founder', sessionId: 'session', capabilities: [] }); mocks.audit.mockResolvedValue(undefined); mocks.rpc.mockResolvedValue({ data: input(), error: null }) })
describe('AD07 guarded read-only DAL', () => {
    it('authorizes before touching privileged records and returns denied identity errors', async () => {
        mocks.requireFounder.mockRejectedValue(new ApiError('FORBIDDEN', 403, 'Founder access required.'))
        await expect(getPaymentsReport()).rejects.toMatchObject({ status: 403 })
        expect(mocks.rpc).not.toHaveBeenCalled()
    })
    it('uses only the read RPC and exact bigint net when both coverage feeds are complete', async () => {
        const result = await getPaymentsReport({ from, to })
        expect(result.summary).toMatchObject({ netMinor: '1199800', grossState: 'complete', refundState: 'complete' })
        expect(mocks.rpc).toHaveBeenCalledOnce()
        expect(mocks.rpc.mock.calls[0][0]).toBe('admin_billing_report_input')
        expect(mocks.audit).toHaveBeenCalledOnce()
        expect(result.readiness).not.toHaveProperty('missing')
    })
    it('independently invalidates complete net on source conflicts despite complete coverage', async () => {
        const value = input(); value.diagnostics.sourceConflicts = 1
        mocks.rpc.mockResolvedValue({ data: value, error: null })
        expect((await getPaymentsReport({ from, to })).summary.netMinor).toBeNull()
    })
    it('keeps unknown refund feeds and empty coverage incomplete', async () => {
        const value = input(); value.coverage = []
        mocks.rpc.mockResolvedValue({ data: value, error: null })
        expect((await getPaymentsReport({ from, to })).summary).toMatchObject({ knownRefundMinor: '100000', refundState: 'partial', netMinor: null })
    })
    it('withholds net when overlapping independent coverage contradicts an older complete row', async () => {
        const value = input(); value.coverage.push({ ...value.coverage[0], captureState: 'partial', refundState: 'partial', checkedAt: '2026-10-02T00:00:00Z', conflictsCount: 1 })
        mocks.rpc.mockResolvedValue({ data: value, error: null })
        expect((await getPaymentsReport({ from, to })).summary).toMatchObject({ grossState: 'partial', refundState: 'partial', netMinor: null })
    })
    it('denies unbounded or unsupported filters before the read and sanitizes backend failure', async () => {
        await expect(getPaymentsReport({ from, to, limit: 1000 })).rejects.toMatchObject({ status: 400 })
        expect(mocks.rpc).not.toHaveBeenCalled()
        mocks.rpc.mockResolvedValue({ data: null, error: { message: 'secret-ticket-body-and-credential' } })
        await expect(getPaymentsReport({ from, to })).rejects.toMatchObject({ status: 503, message: 'Payment evidence is unavailable. Customer billing has not changed.' })
    })
    it('cannot return a privileged read when required audit is unavailable', async () => {
        mocks.audit.mockRejectedValue(new ApiError('AUDIT_UNAVAILABLE', 503, 'Could not audit.'))
        await expect(getPaymentsReport({ from, to })).rejects.toMatchObject({ code: 'AUDIT_UNAVAILABLE' })
    })
})
