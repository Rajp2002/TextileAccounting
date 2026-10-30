import { requireRole, assertOrgWritable } from '@/lib/auth'
import { canEnrollFree, getFreeGrant } from '@/lib/free-account'
import { getOrgPlanAccess } from '@/lib/subscription'
import { getBillingReadiness } from '@/lib/billing-readiness'
import { createClient } from '@/lib/supabase/server'
import { BillingAttemptStatus } from '@/components/billing/BillingAttemptStatus'
import type { BillingAttemptRow } from '@/lib/billing-attempts'
import { PlanChooserClient } from '@/components/plans/PlanChooserClient'
import { ActivityTracker } from '@/components/analytics/ActivityTracker'
import { PaidPlansProvider } from '@/components/billing/PaidPlansProvider'
import { getPaidPlansState } from '@/lib/paid-plans.server'
import type { UpgradePlan } from '@/lib/upgrade-wall'

export const metadata = {
  title: 'Choose your plan · Weavly',
  description: 'Select the right Weavly plan for your textile manufacturing workspace.',
  robots: { index: false, follow: false },
}

interface PlansPageProps {
  searchParams?: Promise<{ from?: string | string[] }>
}

export default async function PlansPage(props: PlansPageProps) {
  const { user, profile } = await requireRole(['owner'], { allowFreeAccount: true })
  await assertOrgWritable(profile.org_id)

  const searchParams = props.searchParams ? await props.searchParams : undefined
  const from = typeof searchParams?.from === 'string'
    ? searchParams.from
    : Array.isArray(searchParams?.from)
      ? searchParams.from[0]
      : undefined

  const access = await getOrgPlanAccess(profile.org_id)
  const paid = access.effectiveTier === 'lite' || access.effectiveTier === 'base'
  const isOnboarding = user.app_metadata.plan_selection_pending === true || from === 'onboarding'

  let currentPlan: UpgradePlan | 'unassigned' = 'unassigned'
  if (access.effectiveTier === 'lite') currentPlan = 'lite'
  else if (access.effectiveTier === 'base') currentPlan = 'base'
  else if (access.effectiveTier === 'free' || access.freeAccount) currentPlan = 'free'

  const grant = await getFreeGrant(profile.org_id)
  const freeAvailable = grant
    ? grant.state === 'active'
    : Boolean(user.email && !paid && (await canEnrollFree(user.email)))

  const supabase = await createClient()
  const { data: attempt } = await supabase
    .from('billing_checkout_attempts')
    .select('id, org_id, client_request_id, plan_tier, purchase_type, status, provider_order_id, provider_payment_id')
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const billingReadiness = getBillingReadiness()
  const paidPlans = await getPaidPlansState(profile.org_id)

  return (
    <PaidPlansProvider checkoutOpen={paidPlans.checkoutOpen}>
    <ActivityTracker />
    <PlanChooserClient
      currentPlan={currentPlan}
      isOnboarding={isOnboarding}
      freeAvailable={freeAvailable}
      billingReady={billingReadiness.canCreateOrder}
      paid={paid}
      baseVisible={access.baseVisible === true}
      liteTrialEligible={access.liteTrialEligible === true}
      paymentRecovery={
        attempt && !paid ? (
          <BillingAttemptStatus attempt={attempt as BillingAttemptRow} />
        ) : undefined
      }
    />
    </PaidPlansProvider>
  )
}
