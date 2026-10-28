import { getCachedSession, getSessionHint } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getOrgPlanAccess } from '@/lib/subscription'
import { getFreeGrant } from '@/lib/free-account'
import { getFreeOrganization } from '@/lib/free-service'
import { startEarly } from '@/lib/start-early'
import { createClient } from '@/lib/supabase/server'
import type { BillingHistoryEntry, BillingHistoryStatus } from '@/components/billing/PaymentHistoryDialog'
import FreeBillingClient from './FreeBillingClient'

export const metadata = {
    title: 'Subscription & Billing · Weavly Free',
    robots: { index: false, follow: false },
}

function normalizeStatus(status: string): BillingHistoryStatus {
    if (status === 'captured') return 'captured'
    if (status === 'failed') return 'failed'
    if (status === 'refunded') return 'refunded'
    return 'incomplete'
}

function readPayments(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string) {
    return Promise.resolve(supabase
        .from('subscription_payments')
        .select('id, status, created_at, razorpay_payment_id, amount_paise, method, subscription_id, razorpay_order_id, captured_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(10))
}

export default async function FreeBillingPage() {
    // Payments start with Proxy's session hint while the identity is verified
    // (RLS still applies); they are used only for the verified user and org.
    const [hint, supabase] = await Promise.all([getSessionHint(), createClient()])
    const earlyPayments = hint?.orgId ? { userId: hint.userId, orgId: hint.orgId, read: startEarly(readPayments(supabase, hint.orgId)) } : null
    const session = await getCachedSession()
    if (!session) redirect('/login')

    const orgId = session.profile.org_id
    const paymentsRead = earlyPayments && earlyPayments.userId === session.user.id && earlyPayments.orgId === orgId
        ? earlyPayments.read : readPayments(supabase, orgId)
    // The organization name comes from the Free layout's organization read.
    const [access, grant, paymentsResult, organizationResult] = await Promise.all([
        getOrgPlanAccess(orgId),
        getFreeGrant(orgId),
        paymentsRead,
        getFreeOrganization(orgId),
    ])

    const billingHistory: BillingHistoryEntry[] = (paymentsResult.data ?? []).map((p) => ({
        id: `payment-${p.id}`,
        kind: 'payment' as const,
        date: p.captured_at || p.created_at,
        planTier: null,
        purchaseType: null,
        amountPaise: p.amount_paise,
        method: p.method ?? null,
        paymentId: p.razorpay_payment_id ?? null,
        orderId: p.razorpay_order_id ?? null,
        receiptPaymentId: p.status === 'captured' ? p.id : null,
        status: normalizeStatus(p.status),
    }))

    return (
        <FreeBillingClient
            organizationName={organizationResult.data?.name ?? ''}
            initialTier={access.effectiveTier}
            grantState={grant?.state}
            baseVisible={access.baseVisible === true}
            liteTrialEligible={access.liteTrialEligible === true}
            billingHistory={billingHistory}
        />
    )
}
