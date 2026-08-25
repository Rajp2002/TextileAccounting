import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOnboardingStatus } from '@/app/(auth)/actions/auth'
import { getUserClaims } from '@/lib/auth'
import OnboardingChecklist from './checklist'
import { getOrgTier } from '@/lib/subscription'

/**
 * /onboarding — Full Suite owner setup checklist (server component)
 *
 * This page is a BLOCKING GATE for Full Suite owners. Base owners go directly
 * to the estimator and owners without an active plan go to Billing.
 *
 * Not dismissible. No skip button. An org with no data is broken downstream.
 */
export default async function OnboardingPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const userClaims = getUserClaims(user)

    // Determine role: prefer JWT claim, fall back to DB (handles JWT race condition
    // where custom_access_token_hook fires before the profile row is visible).
    let role = userClaims.user_role
    let orgId = userClaims.org_id

    if (!role || !orgId) {
        // JWT is stale (race condition on new signup) — fetch role from DB directly
        const admin = createAdminClient()
        const { data: profile } = await admin
            .from('profiles')
            .select('role, org_id')
            .eq('id', user.id)
            .maybeSingle()
        role = profile?.role ?? undefined
        orgId = profile?.org_id ?? undefined
    }

    // Supervisors don't go through onboarding — send them to their home screen
    if (role === 'supervisor') {
        redirect('/supervisor/production')
    }

    // Factory setup only belongs to the Full Suite. Keep both non-Full-Suite
    // states out of this page, including direct/stale links to /onboarding.
    if (role === 'owner' && orgId) {
        const tier = await getOrgTier(orgId)
        if (tier === 'none') redirect('/owner/billing')
        if (tier === 'base') redirect('/owner/estimator')
    }

    if (role === 'owner' && userClaims.onboarding_complete === true) {
        redirect('/owner/today')
    }

    // If role is still unknown (very rare edge case), show the checklist safely
    // rather than bouncing the user to an unknown route and causing a blank page.
    // getOnboardingStatus() will redirect to /login if there's truly no session.

    // Fetch real-time status (SSR — accurate on page load)
    const status = await getOnboardingStatus()

    // NOTE: we intentionally do NOT redirect here when isComplete=true.
    // The middleware handles that guard via JWT claims (onboarding_complete flag).
    // If we redirect here, Next.js router.refresh() after server actions re-triggers
    // this redirect before the JWT has been refreshed — causing a blank page.

    return <OnboardingChecklist initialStatus={status} />
}
