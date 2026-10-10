import 'server-only'

import { cache } from 'react'
import { getFreeGrant } from './free-account'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
    applyFreeGrantToAccess,
    resolveEffectiveSubscription,
    resolveOrgAccessFromRows,
    type OrgPlanAccess,
    type SubscriptionTier,
} from './subscription-access'

export {
    hasEstablishedPaidHistory,
    hasPaidBaseHistory,
    resolveEffectiveSubscription,
    resolveOrgPlanAccess,
    type OrgPlanAccess,
    type SubscriptionTier,
} from './subscription-access'

/**
 * Subscription tier hierarchy:
 *   'none'    — no active subscription (blocked)
 *   'lite'    — paid Lite plan (complete costing management)
 *   'base'    — paid Base plan (Lite + owner-only Production Core)
 */
// ─── getOrgTier ───────────────────────────────────────────────────────────────

/**
 * Returns the current access tier for an org.
 * Resolves every current subscription row so a later failed/cancelled payment
 * attempt cannot hide an older paid entitlement that has not expired.
 */
export async function getOrgPlanAccess(orgId: string): Promise<OrgPlanAccess> {
    // Every caller derives orgId from a verified profile or freshly validated
    // sign-in claims. Use the server-only client so a transient RLS auth-context
    // miss cannot turn a paid owner into tier "none" during route selection.
    const admin = createAdminClient()

    const { data, error } = await admin
        .from('organizations')
        .select('base_plan_visible, lite_trial_eligible, org_subscriptions(status, plan_tier, current_start, current_end, razorpay_payment_id, created_at, is_trial)')
        .eq('id', orgId)
        .maybeSingle()

    if (error) throw new Error(`Unable to resolve organization plan access: ${error.code}`)

    const subscriptionRows = data?.org_subscriptions ?? []
    const access = resolveOrgAccessFromRows({
        rows: subscriptionRows,
        baseFlag: data?.base_plan_visible,
        trialFlag: data?.lite_trial_eligible,
    })
    // Paid and trial organizations return here without the Free-grant query.
    if (access.effectiveTier !== 'none') return access
    const grant = await getFreeGrant(orgId)
    return applyFreeGrantToAccess(access, subscriptionRows, Boolean(grant))
}

export async function getOrgTier(orgId: string): Promise<SubscriptionTier> {
    return (await getOrgPlanAccess(orgId)).effectiveTier
}

/**
 * getCachedOrgTier — request-scoped, deduplicated subscription tier lookup.
 *
 * Wraps getOrgTier() with React.cache() so that multiple components within
 * the same server request (e.g., AccessGate in nested layouts) share one
 * org_subscriptions DB query.
 */
export const getCachedOrgPlanAccess = cache(getOrgPlanAccess)
export const getCachedOrgTier = cache(async (orgId: string) => (
    await getCachedOrgPlanAccess(orgId)
).effectiveTier)

// ─── getSubscriptionDetail ────────────────────────────────────────────────────

/** Returns tier + the raw subscription row (for billing page UI) */
export async function getSubscriptionDetail(orgId: string): Promise<{
    tier: SubscriptionTier
    subscription: {
        status: string
        plan_tier: string
        plan_id: string | null
        current_start: string | null
        current_end: string | null
        paid_count: number | null
        total_count: number | null
        razorpay_subscription_id: string | null
        razorpay_order_id: string | null
        billing_model: string | null
        cancel_at_cycle_end: boolean
        created_at: string | null
        is_trial: boolean | null
    } | null
}> {
    const supabase = await createClient()

    const { data } = await supabase
        .from('org_subscriptions')
        .select('status, plan_tier, plan_id, current_start, current_end, paid_count, total_count, razorpay_subscription_id, razorpay_order_id, billing_model, cancel_at_cycle_end, created_at, is_trial')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

    const rows = data ?? []
    const effective = resolveEffectiveSubscription(rows)
    return {
        tier: effective.tier,
        // When nothing is active, retain the newest row so billing can explain
        // the latest payment/cancellation state to the owner.
        subscription: effective.subscription ?? rows[0] ?? null,
    }
}

// ─── Legacy helpers (kept for backwards compat) ───────────────────────────────

/**
 * @deprecated Use getOrgTier() instead.
 */
export async function getSubscriptionStatus(orgId: string): Promise<string> {
    const supabase = await createClient()

    const { data } = await supabase
        .from('org_subscriptions')
        .select('status, current_end')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (!data) return 'none'

    if (data.status === 'active' && data.current_end) {
        const gracePeriodMs = 24 * 60 * 60 * 1000
        const expired = new Date(data.current_end).getTime() + gracePeriodMs < Date.now()
        if (expired) return 'expired'
    }

    return data.status
}

/**
 * @deprecated Use plan capabilities instead.
 */
export function isSubscriptionActive(status: string): boolean {
    return ['active', 'authenticated'].includes(status)
}
