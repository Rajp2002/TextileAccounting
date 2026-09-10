import { redirect } from 'next/navigation'
import { requireRole, assertOrgWritable } from '@/lib/auth'
import { canEnrollFree, getFreeGrant } from '@/lib/free-account'
import { getOrgPlanAccess } from '@/lib/subscription'
import { getBillingReadiness } from '@/lib/billing-readiness'
import { PlanSelection } from '@/components/onboarding/PlanSelection'
import { createClient } from '@/lib/supabase/server'
import { BillingAttemptStatus } from '@/components/billing/BillingAttemptStatus'
import type { BillingAttemptRow } from '@/lib/billing-attempts'

export const metadata = { title: 'Choose your plan · Weavly', robots: { index: false, follow: false } }

export default async function PlanSelectionPage() {
    const { user, profile } = await requireRole(['owner'], { allowFreeAccount: true })
    await assertOrgWritable(profile.org_id)
    const access = await getOrgPlanAccess(profile.org_id)
    const paid = ['lite', 'base', 'premium', 'trial'].includes(access.effectiveTier)
    if (user.app_metadata.plan_selection_pending !== true) {
        redirect(paid ? '/owner/estimator' : access.freeAccount ? '/free' : '/owner/billing')
    }
    const grant = await getFreeGrant(profile.org_id)
    const freeAvailable = grant
        ? grant.state === 'active'
        : Boolean(user.email && user.email_confirmed_at && user.app_metadata.free_signup === true && await canEnrollFree(user.email))
    const supabase = await createClient()
    const { data: attempt, error } = await supabase.from('billing_checkout_attempts')
        .select('id, org_id, client_request_id, plan_tier, purchase_type, status, provider_order_id, provider_payment_id')
        .eq('org_id', profile.org_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error) throw new Error('Unable to check existing payment attempts. Please reload.')
    return <PlanSelection freeAvailable={freeAvailable} paid={paid} billingReady={getBillingReadiness().canCreateOrder}
        paymentRecovery={attempt && !paid ? <BillingAttemptStatus attempt={attempt as BillingAttemptRow} /> : undefined} />
}
