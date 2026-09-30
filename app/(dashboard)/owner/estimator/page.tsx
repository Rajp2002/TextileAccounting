import { getFactoryCostProfile } from './actions'
import EstimatorClient from './EstimatorClient'
import { requireRole } from '@/lib/auth'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { getCachedOwnerOrganization } from '@/lib/owner-organization'

export default async function EstimatorPage() {
    const { user, profile } = await requireRole(['owner'])
    // AccessGate and the owner shell already resolve this request-scoped
    // entitlement. Reuse that promise instead of issuing a second org-tier
    // query before the estimator reads can start.
    const planAccess = await getCachedOrgPlanAccess(profile.org_id)
    const subscriptionTier = planAccess.effectiveTier
    const canUseProductionPipeline = hasCapability(subscriptionTier, 'production')

    const [profileRes, organizationRes] = await Promise.all([
        getFactoryCostProfile({ createIfMissing: false }),
        getCachedOwnerOrganization(user.id, profile.org_id),
    ])

    const wizardDismissed = user.user_metadata?.factory_cost_wizard_dismissed === true
        || user.user_metadata?.factory_cost_configured === true

    return <EstimatorClient
        initialProfile={profileRes.data}
        initialTemplates={undefined}
        initialWorkers={undefined}
        tutorialDismissed={user.user_metadata?.cost_estimate_tutorial_dismissed === true}
        wizardDismissed={wizardDismissed}
        userMetadata={{ tour_preferences: user.user_metadata?.tour_preferences }}
        userId={user.id}
        orgId={profile.org_id}
        canUseProductionPipeline={canUseProductionPipeline}
        staleDefaultRateNames={[]}
        organizationName={organizationRes.data?.name ?? ''}
    />
}
