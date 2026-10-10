import { getCachedSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getOrgPlanAccess } from '@/lib/subscription'
import { getFreeGrant } from '@/lib/free-account'
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

export default async function FreeBillingPage() {
    const session = await getCachedSession()
    if (!session) redirect('/login')

    const supabase = await createClient()
    const [access, grant, paymentsResult, organizationResult] = await Promise.all([
        getOrgPlanAccess(session.profile.org_id),
        getFreeGrant(session.profile.org_id),
        supabase
            .from('subscription_payments')
            .select('id, status, created_at, razorpay_payment_id, amount_paise, method, subscription_id, razorpay_order_id, captured_at')
            .eq('org_id', session.profile.org_id)
            .order('created_at', { ascending: false })
            .limit(10),
        supabase.from('organizations').select('name').eq('id', session.profile.org_id).maybeSingle(),
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
            billingHistory={billingHistory}
        />
    )
}
