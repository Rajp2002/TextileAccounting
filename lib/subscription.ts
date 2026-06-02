import { createClient } from '@/lib/supabase/server'

/**
 * Subscription tier hierarchy:
 *   'none'    — no active subscription (blocked)
 *   'trial'   — 7-day free trial (full premium access)
 *   'base'    — paid Base plan (Estimator only)
 *   'premium' — paid Premium plan (full access)
 */
export type SubscriptionTier = 'none' | 'trial' | 'base' | 'premium'

// ─── Tier helpers ─────────────────────────────────────────────────────────────

/** Returns true if `actual` meets or exceeds `required` access. */
export function tierSatisfies(actual: SubscriptionTier, required: 'base' | 'premium'): boolean {
    if (actual === 'none') return false
    if (actual === 'trial' || actual === 'premium') return true  // full access
    if (actual === 'base') return required === 'base'            // base only satisfies 'base'
    return false
}

// ─── getOrgTier ───────────────────────────────────────────────────────────────

/**
 * Returns the current access tier for an org.
 * Always reads the most recently created subscription row.
 */
export async function getOrgTier(orgId: string): Promise<SubscriptionTier> {
    const supabase = await createClient()

    const { data } = await supabase
        .from('org_subscriptions')
        .select('status, plan_tier, current_end')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (!data) return 'none'

    // Must be in an active state
    const isActive = ['active', 'authenticated'].includes(data.status)
    if (!isActive) return 'none'

    // Check expiry
    if (data.current_end) {
        const endMs = new Date(data.current_end).getTime()
        const now = Date.now()

        if (data.plan_tier === 'trial') {
            // No grace period for trial — strict expiry
            if (endMs < now) return 'none'
        } else {
            // 24-hour grace period for paid plans (webhook delay buffer)
            const gracePeriodMs = 24 * 60 * 60 * 1000
            if (endMs + gracePeriodMs < now) return 'none'
        }
    }

    return (data.plan_tier as SubscriptionTier) ?? 'premium'
}

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
        cancel_at_cycle_end: boolean
    } | null
}> {
    const supabase = await createClient()

    const { data } = await supabase
        .from('org_subscriptions')
        .select('status, plan_tier, plan_id, current_start, current_end, paid_count, total_count, razorpay_subscription_id, cancel_at_cycle_end')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (!data) return { tier: 'none', subscription: null }

    const isActive = ['active', 'authenticated'].includes(data.status)
    if (!isActive) return { tier: 'none', subscription: data }

    // Check expiry
    let tier: SubscriptionTier = 'none'
    if (data.current_end) {
        const endMs = new Date(data.current_end).getTime()
        const now = Date.now()
        const gracePeriodMs = data.plan_tier === 'trial' ? 0 : 24 * 60 * 60 * 1000
        if (endMs + gracePeriodMs >= now) {
            tier = (data.plan_tier as SubscriptionTier) ?? 'premium'
        }
    } else {
        tier = (data.plan_tier as SubscriptionTier) ?? 'premium'
    }

    return { tier, subscription: data }
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
 * @deprecated Use tierSatisfies() instead.
 */
export function isSubscriptionActive(status: string): boolean {
    return ['active', 'authenticated'].includes(status)
}
