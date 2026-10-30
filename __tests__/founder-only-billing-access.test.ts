import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(), getSession: vi.fn(), from: vi.fn(), createAdmin: vi.fn(),
    getRazorpay: vi.fn(), reconcile: vi.fn(), requireRole: vi.fn(),
    receiptPdf: vi.fn(), invoicePdf: vi.fn(), invoiceSupported: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
    auth: { getUser: mocks.getUser, getSession: mocks.getSession }, from: mocks.from,
}) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdmin }))
vi.mock('@/lib/razorpay', () => ({ getRazorpay: mocks.getRazorpay }))
vi.mock('@/lib/billing-reconciliation', () => ({ reconcileBillingOrder: mocks.reconcile }))
vi.mock('@/lib/auth', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/generate-payment-receipt', () => ({ generatePaymentReceiptPdf: mocks.receiptPdf }))
vi.mock('@/lib/generate-gst-invoice', () => ({ generateGstInvoicePdf: mocks.invoicePdf }))
vi.mock('@/lib/billing-document-policy', () => ({ isGstInvoiceSupported: mocks.invoiceSupported }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
// create-order now imports lib/subscription (Base gate); stub it so the server-only chain never loads.
vi.mock('@/lib/subscription', () => ({ getOrgPlanAccess: vi.fn() }))
// Paid plans are open in these tests; the pre-go-live gate is covered in paid-plans.test.ts.
vi.mock('@/lib/paid-plans.server', () => ({ getPaidPlansState: async () => ({ live: true, goLiveAt: '2027-01-01T00:00:00Z', checkoutOpen: true }) }))

import { POST as createOrder } from '@/app/api/billing/create-order/route'
import { POST as verifyPayment } from '@/app/api/billing/verify-payment/route'
import { POST as checkoutState } from '@/app/api/billing/checkout-state/route'
import { POST as paymentStatus } from '@/app/api/billing/status/route'
import { GET as receipt } from '@/app/api/billing/receipt/[paymentId]/route'
import { GET as invoice } from '@/app/api/billing/invoice/[invoiceId]/route'
import { POST as legacyCreate } from '@/app/api/subscriptions/create/route'
import { POST as autoRenew } from '@/app/api/subscriptions/auto-renew/route'
import { POST as redeemReferral } from '@/app/api/billing/redeem-referral-year/route'
import { GET as retiredCheckoutScript } from '@/app/api/billing/checkout-script/route'

const founderEmail = 'synthetic-founder@example.test'
const userId = '00000000-0000-4000-8000-000000000011'
const orgId = '00000000-0000-4000-8000-000000000012'
const request = () => new NextRequest('https://weavly.example.test/api/billing/status', {
    method: 'POST', body: JSON.stringify({ orderId: 'order_synthetic', paymentId: 'pay_synthetic' }),
    headers: { 'Content-Type': 'application/json', Origin: 'https://weavly.example.test' },
})
const owner = { id: userId, email: founderEmail, user_metadata: { role: 'owner', org_id: orgId } }
const handlers = [
    ['create order', () => createOrder(request())],
    ['verify payment', () => verifyPayment(request())],
    ['checkout state', () => checkoutState(request())],
    ['payment status reconciliation', () => paymentStatus(request())],
    ['payment receipt', () => receipt(request(), { params: Promise.resolve({ paymentId: 'synthetic-payment' }) })],
    ['GST invoice', () => invoice(request(), { params: Promise.resolve({ invoiceId: 'synthetic-invoice' }) })],
    ['legacy subscription creation', () => legacyCreate()],
    ['legacy auto-renew cancellation', () => autoRenew()],
] as const

beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('WEAVLY_FOUNDER_TEST_EMAIL', founderEmail)
    mocks.getUser.mockResolvedValue({ data: { user: owner }, error: null })
    // A stale client session/JWT could still call this identity an ordinary
    // owner. Every handler must use the fresh provider user instead.
    mocks.getSession.mockResolvedValue({ data: { session: { user: { ...owner, email: 'ordinary-owner@example.test' } } } })
    mocks.from.mockImplementation(() => { throw new Error('Tenant data must not be read for founder identity') })
    mocks.createAdmin.mockImplementation(() => { throw new Error('Service client must not be created for founder identity') })
    mocks.getRazorpay.mockImplementation(() => { throw new Error('Provider client must not be created for founder identity') })
    mocks.invoiceSupported.mockReturnValue(true)
    mocks.requireRole.mockResolvedValue({ user: owner, profile: { role: 'owner', org_id: orgId } })
})
afterEach(() => { vi.unstubAllEnvs() })

describe('Founder-only identity cannot reach customer billing handlers', () => {
    it.each(handlers)('%s denies the current founder email before any tenant/provider/service access', async (_name, invoke) => {
        const response = await invoke()
        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ error: 'Forbidden' })
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        expect(mocks.getUser).toHaveBeenCalledOnce()
        expect(mocks.getSession).not.toHaveBeenCalled()
        expect(mocks.from).not.toHaveBeenCalled()
        expect(mocks.createAdmin).not.toHaveBeenCalled()
        expect(mocks.getRazorpay).not.toHaveBeenCalled()
        expect(mocks.reconcile).not.toHaveBeenCalled()
        expect(mocks.receiptPdf).not.toHaveBeenCalled()
        expect(mocks.invoicePdf).not.toHaveBeenCalled()
    })

    it.each(handlers)('%s keeps unauthenticated requests denied', async (_name, invoke) => {
        mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
        expect((await invoke()).status).toBe(401)
        expect(mocks.from).not.toHaveBeenCalled()
        expect(mocks.createAdmin).not.toHaveBeenCalled()
        expect(mocks.getRazorpay).not.toHaveBeenCalled()
    })

    it('invoice denial precedes the unsupported-document gate and cannot generate or load a document', async () => {
        mocks.invoiceSupported.mockReturnValue(false)
        const response = await invoice(request(), { params: Promise.resolve({ invoiceId: 'synthetic-invoice' }) })
        expect(response.status).toBe(403)
        expect(mocks.invoiceSupported).not.toHaveBeenCalled()
        expect(mocks.invoicePdf).not.toHaveBeenCalled()
        expect(mocks.from).not.toHaveBeenCalled()
    })

    it('normalizes only case and surrounding whitespace for the current reserved email', async () => {
        mocks.getUser.mockResolvedValue({ data: { user: { ...owner, email: ` ${founderEmail.toUpperCase()} ` } }, error: null })
        expect((await createOrder(request())).status).toBe(403)
        expect(mocks.from).not.toHaveBeenCalled()
        expect(mocks.getRazorpay).not.toHaveBeenCalled()
    })

    it('referral-credit redemption has its own denial before the service mutation', async () => {
        const response = await redeemReferral()
        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ error: 'Forbidden' })
        expect(mocks.createAdmin).not.toHaveBeenCalled()
    })

    it('current ordinary owner email retains existing tenant-scoped reconciliation even if cached email is stale founder email', async () => {
        mocks.getUser.mockResolvedValue({ data: { user: { ...owner, email: 'ordinary-owner@example.test' } }, error: null })
        mocks.getSession.mockResolvedValue({ data: { session: { user: owner } } })
        const profileQuery = { select: vi.fn(), eq: vi.fn(), single: vi.fn() }
        profileQuery.select.mockReturnValue(profileQuery)
        profileQuery.eq.mockReturnValue(profileQuery)
        profileQuery.single.mockResolvedValue({ data: { org_id: orgId, role: 'owner' }, error: null })
        mocks.from.mockReturnValue(profileQuery)
        mocks.reconcile.mockResolvedValue({ state: 'activated', orderId: 'order_synthetic' })
        const response = await paymentStatus(request())
        expect(response.status).toBe(200)
        expect(mocks.from).toHaveBeenCalledWith('profiles')
        expect(mocks.reconcile).toHaveBeenCalledWith({ orgId, orderId: 'order_synthetic', hintedPaymentId: 'pay_synthetic', source: 'owner_status' })
        expect(mocks.getSession).not.toHaveBeenCalled()
    })

    it('ordinary owner still gets the retired subscription contract without provider work', async () => {
        mocks.getUser.mockResolvedValue({ data: { user: { ...owner, email: 'ordinary-owner@example.test' } }, error: null })
        expect((await legacyCreate()).status).toBe(410)
        expect(mocks.from).not.toHaveBeenCalled()
        expect(mocks.getRazorpay).not.toHaveBeenCalled()
    })

    it('ordinary owner still gets the unsupported invoice contract without document queries', async () => {
        mocks.getUser.mockResolvedValue({ data: { user: { ...owner, email: 'ordinary-owner@example.test' } }, error: null })
        mocks.invoiceSupported.mockReturnValue(false)
        expect((await invoice(request(), { params: Promise.resolve({ invoiceId: 'synthetic-invoice' }) })).status).toBe(404)
        expect(mocks.from).not.toHaveBeenCalled()
        expect(mocks.invoicePdf).not.toHaveBeenCalled()
    })

    it('the public retired checkout-script tombstone returns no user/provider data', async () => {
        const response = await retiredCheckoutScript()
        expect(response.status).toBe(410)
        expect(mocks.getUser).not.toHaveBeenCalled()
        expect(mocks.getRazorpay).not.toHaveBeenCalled()
    })
})
