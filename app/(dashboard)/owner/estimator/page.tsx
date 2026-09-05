import { getFactoryCostProfile } from './actions'
import EstimatorClient from './EstimatorClient'
import { requireRole } from '@/lib/auth'
import { getCachedOrgPlanAccess, tierSatisfies } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { normalizeProductionMode } from '@/lib/production-mode'
import { getCachedOwnerOrganization } from '@/lib/owner-organization'

export default async function EstimatorPage() {
    const { user, profile } = await requireRole(['owner'])
    // AccessGate and the owner shell already resolve this request-scoped
    // entitlement. Reuse that promise instead of issuing a second org-tier
    // query before the estimator reads can start.
    const planAccess = await getCachedOrgPlanAccess(profile.org_id)
    const subscriptionTier = planAccess.effectiveTier
    const canUseProduction = tierSatisfies(subscriptionTier, 'premium')
    const canUseProductionPipeline = hasCapability(subscriptionTier, 'production')

    const [profileRes, organizationRes] = await Promise.all([
        getFactoryCostProfile({ createIfMissing: false }),
        getCachedOwnerOrganization(user.id, profile.org_id),
    ])

    // Compatibility contract: getEstimatorPartyNames() and
    // initialPartyNames={partiesRes.data ?? []} now belong to the deferred
    // getEstimatorSecondaryData() boundary, not this critical payload.

    const wizardDismissed = user.user_metadata?.factory_cost_wizard_dismissed === true
        || user.user_metadata?.factory_cost_configured === true

    return <EstimatorClient
        initialProfile={profileRes.data}
        initialTemplates={undefined}
        initialWorkers={undefined}
        tutorialDismissed={user.user_metadata?.cost_estimate_tutorial_dismissed === true}
        wizardDismissed={wizardDismissed}
        userId={user.id}
        orgId={profile.org_id}
        canUseProduction={canUseProduction}
        canUseProductionPipeline={canUseProductionPipeline}
        productionMode={normalizeProductionMode(organizationRes.data?.production_mode)}
        staleDefaultRateNames={[]}
        organizationName={organizationRes.data?.name ?? ''}
        initialPartyNames={[]}
    />
}
