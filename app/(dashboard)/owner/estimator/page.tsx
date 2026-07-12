import { getFactoryCostProfile, getEstimatorTemplates, getFixedWorkersForOverhead } from './actions'
import EstimatorClient from './EstimatorClient'
import { Suspense } from 'react'
import { requireRole } from '@/lib/auth'
import { getOrgTier, tierSatisfies } from '@/lib/subscription'

export default async function EstimatorPage() {
    const { user, profile } = await requireRole(['owner'])
    const subscriptionTier = await getOrgTier(profile.org_id)
    const canUseProduction = tierSatisfies(subscriptionTier, 'premium')

    // Parallelize server-side data fetching for zero-latency initial load
    const [profileRes, templatesRes, workersRes] = await Promise.all([
        getFactoryCostProfile(),
        getEstimatorTemplates(),
        canUseProduction ? getFixedWorkersForOverhead() : Promise.resolve({ data: [] }),
    ])

    return (
        <Suspense fallback={<div className="p-20 text-center">Loading Estimator...</div>}>
            <EstimatorClient 
                initialProfile={profileRes.data}
                initialTemplates={templatesRes.data}
                initialWorkers={workersRes.data}
                userId={user.id}
                orgId={profile.org_id}
                canUseProduction={canUseProduction}
            />
        </Suspense>
    )
}
