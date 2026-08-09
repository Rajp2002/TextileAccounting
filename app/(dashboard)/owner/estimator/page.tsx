import { getEstimatorPartyNames, getFactoryCostProfile, getEstimatorTemplates, getFixedWorkersForOverhead } from './actions'
import EstimatorClient from './EstimatorClient'
import { Suspense } from 'react'
import { requireRole } from '@/lib/auth'
import { getCachedOrgPlanAccess, tierSatisfies } from '@/lib/subscription'
import { normalizeProductionMode } from '@/lib/production-mode'
import { getStaleDefaultCostRateNames } from '../rates/actions'
import { getCachedOwnerOrganization } from '@/lib/owner-organization'

export default async function EstimatorPage() {
    const { user, profile } = await requireRole(['owner'])
    // AccessGate and the owner shell already resolve this request-scoped
    // entitlement. Reuse that promise instead of issuing a second org-tier
    // query before the estimator reads can start.
    const planAccess = await getCachedOrgPlanAccess(profile.org_id)
    const subscriptionTier = planAccess.effectiveTier
    const canUseProduction = tierSatisfies(subscriptionTier, 'premium')

    const [profileRes, templatesRes, workersRes, organizationRes, rateReviewRes, partiesRes] = await Promise.all([
        getFactoryCostProfile(),
        getEstimatorTemplates(),
        canUseProduction ? getFixedWorkersForOverhead() : Promise.resolve({ data: [] }),
        getCachedOwnerOrganization(profile.org_id),
        getStaleDefaultCostRateNames(),
        canUseProduction ? getEstimatorPartyNames() : Promise.resolve({ data: [] }),
    ])

    const staleDefaultRateNames = rateReviewRes.data ?? []

    return (
        <Suspense fallback={<div className="p-20 text-center">Loading Cost Estimate...</div>}>
            <EstimatorClient 
                initialProfile={profileRes.data}
                initialTemplates={templatesRes.data}
                initialWorkers={workersRes.data}
                userId={user.id}
                orgId={profile.org_id}
                canUseProduction={canUseProduction}
                productionMode={normalizeProductionMode(organizationRes.data?.production_mode)}
                staleDefaultRateNames={staleDefaultRateNames}
                organizationName={organizationRes.data?.name ?? ''}
                initialPartyNames={partiesRes.data ?? []}
            />
        </Suspense>
    )
}
