import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserClaims } from '@/lib/auth'
import { getOrgTier } from '@/lib/subscription'
import { founderOnlyIdentity } from '@/lib/admin/founder-email'

/** Redirect owners to their selected plan's current workspace. */
export default async function OnboardingPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')
    if (founderOnlyIdentity(user.email, getUserClaims(user).user_role)) redirect('/admin/login')
    if (user.app_metadata?.plan_selection_pending === true) redirect('/plans?from=onboarding')

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

    if (role === 'supervisor') redirect('/feature-archived')

    if (role === 'owner' && orgId) {
        const tier = await getOrgTier(orgId)
        if (tier === 'free' || user.app_metadata.free_signup === true && tier === 'none') redirect('/free')
        if (tier === 'none') redirect('/owner/billing')
        if (tier === 'lite' || tier === 'base') redirect('/owner/estimator')
    }

    redirect('/plans?from=onboarding')
}
