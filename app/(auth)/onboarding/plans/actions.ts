'use server'

import { assertOrgWritable, requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { canEnrollFree, finishFreeProvisioning, getFreeGrant } from '@/lib/free-account'
import { getOrgPlanAccess, hasEstablishedPaidHistory } from '@/lib/subscription'

/** Complete only from verified access; a browser-selected paid tier grants nothing. */
export async function completePlanSelection(plan: 'free' | 'paid'): Promise<{ href?: string; error?: string }> {
    const { user, profile } = await requireRole(['owner'], { allowFreeAccount: true })
    await assertOrgWritable(profile.org_id)
    if (plan !== 'free' && plan !== 'paid') return { error: 'Choose a valid plan.' }

    // Authoritative effective plan access check
    const access = await getOrgPlanAccess(profile.org_id)

    // C2: Active paid access must escape stale onboarding gate
    // Never downgrade active paid to Free, regardless of client 'plan' argument
    if (['lite', 'base', 'premium', 'trial'].includes(access.effectiveTier)) {
        if (user.app_metadata.plan_selection_pending === true) {
            const admin = createAdminClient()
            const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
                app_metadata: { plan_selection_pending: false },
            })
            if (updateError) return { error: 'Your plan is ready, but we could not finish setup. Please try again.' }
            const supabase = await createClient()
            const { error: refreshError } = await supabase.auth.refreshSession()
            if (refreshError) return { error: 'Your plan is saved. Please sign in again to continue.' }
        }
        return { href: '/owner/estimator' }
    }

    // Check paid history: an activated paid subscription never silently falls back to Free on expiry
    const admin = createAdminClient()
    const { data: subData } = await admin.from('org_subscriptions')
        .select('status, plan_tier, current_start, current_end, razorpay_payment_id')
        .eq('org_id', profile.org_id)
    const hadPaidAccess = hasEstablishedPaidHistory(subData ?? [])
    if (hadPaidAccess) {
        if (user.app_metadata.plan_selection_pending === true) {
            await admin.auth.admin.updateUserById(user.id, {
                app_metadata: { plan_selection_pending: false },
            })
            const supabase = await createClient()
            await supabase.auth.refreshSession()
        }
        return { error: 'Please manage or renew your subscription from your workspace.', href: '/owner/billing' }
    }

    // Unverified paid selection
    if (plan === 'paid') {
        return { error: 'Your payment is still being verified. Check its status before paying again.' }
    }

    // C1: Plan is 'free'
    const grant = await getFreeGrant(profile.org_id)
    if (grant) {
        if (grant.state === 'suspended') return { error: 'Free access is not active for this account.' }
        if (grant.state === 'pending') return { error: 'Free access is pending verification.' }
        // grant.state === 'active': Already-active Free account
        // Repeated continuation safely resumes access even when plan_selection_pending is false/absent
        if (user.app_metadata.plan_selection_pending === true) {
            const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
                app_metadata: { plan_selection_pending: false },
            })
            if (updateError) return { error: 'Your plan is ready, but we could not finish setup. Please try again.' }
            const supabase = await createClient()
            const { error: refreshError } = await supabase.auth.refreshSession()
            if (refreshError) return { error: 'Your plan is saved. Please sign in again to continue.' }
        }
        return { href: '/free' }
    }

    // Unassigned account enrolling in Free for the first time
    // Must respect approved server-side enrollment policy per C1
    if (!user.email) return { error: 'An email address is required to enroll in Free.' }
    if (!user.email_confirmed_at) return { error: 'Please verify your email address before activating Free access.' }
    if (user.app_metadata.free_signup !== true) return { error: 'Free enrollment is not available for this account yet.' }
    if (!await canEnrollFree(user.email)) return { error: 'Free enrollment is not available for this account yet.' }

    try {
        const provisioned = await finishFreeProvisioning(user, profile.org_id)
        if (!provisioned) return { error: 'Free setup could not finish. Please try again.' }
    } catch {
        return { error: 'Free setup could not finish. Please try again.' }
    }

    // Authoritative post-provisioning access confirmation
    const confirmedAccess = await getOrgPlanAccess(profile.org_id)
    const confirmedGrant = await getFreeGrant(profile.org_id)
    if (confirmedAccess.effectiveTier !== 'free' || !confirmedGrant || confirmedGrant.state !== 'active') {
        return { error: 'Free access is not active for this account.' }
    }

    if (user.app_metadata.plan_selection_pending === true) {
        const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
            app_metadata: { plan_selection_pending: false },
        })
        if (updateError) return { error: 'Your plan is ready, but we could not finish setup. Please try again.' }
        const supabase = await createClient()
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) return { error: 'Your plan is saved. Please sign in again to continue.' }
    }

    return { href: '/free' }
}
