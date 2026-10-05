import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserClaims } from '@/lib/auth'
import { getOrgTier } from '@/lib/subscription'
import { getBaseOnboardingInitialState } from './actions'
import { founderOnlyIdentity } from '@/lib/admin/founder-email'
import { BaseOnboardingWizard } from '@/components/onboarding/base/BaseOnboardingWizard'

export const dynamic = 'force-dynamic'

export default async function BaseOnboardingPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) redirect('/login')
    if (founderOnlyIdentity(user.email, getUserClaims(user).user_role)) redirect('/admin/login')

    const userClaims = getUserClaims(user)
    let role = userClaims.user_role
    let orgId = userClaims.org_id

    if (!role || !orgId) {
        const admin = createAdminClient()
        const { data: profile } = await admin
            .from('profiles')
            .select('role, org_id')
            .eq('id', user.id)
            .maybeSingle()
        role = profile?.role ?? undefined
        orgId = profile?.org_id ?? undefined
    }

    if (role === 'supervisor') {
        redirect('/feature-archived')
    }

    if (!orgId || role !== 'owner') {
        redirect('/login')
    }

    const tier = await getOrgTier(orgId)
    if (tier === 'free' || (user.app_metadata?.free_signup === true && tier === 'none')) redirect('/free')
    if (tier === 'none') redirect('/owner/billing')
    if (tier === 'lite') redirect('/owner/estimator')

    const state = await getBaseOnboardingInitialState()
    if (!state.ok || !state.draft || !state.readiness) {
        redirect('/owner/estimator')
    }

    return (
        <BaseOnboardingWizard
            orgId={orgId}
            initialDraft={state.draft}
            initialReadiness={state.readiness}
            hasSavedCostings={state.hasSavedCostings}
            isAlreadyCompleted={state.isCompleted}
        />
    )
}
