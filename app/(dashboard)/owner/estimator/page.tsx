import { getEstimatorPartyNames, getFactoryCostProfile, getEstimatorTemplates, getFixedWorkersForOverhead } from './actions'
import EstimatorClient from './EstimatorClient'
import { Suspense } from 'react'
import { requireRole } from '@/lib/auth'
import { getOrgTier, tierSatisfies } from '@/lib/subscription'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationProductionMode } from '@/lib/production-mode'
import { getCostRates } from '../rates/actions'
import { getRateReviewStatus, type CostRateRow } from '@/lib/cost-rates'

export default async function EstimatorPage() {
    const { user, profile } = await requireRole(['owner'])
    const subscriptionTier = await getOrgTier(profile.org_id)
    const canUseProduction = tierSatisfies(subscriptionTier, 'premium')
    const supabase = await createClient()

    // Parallelize server-side data fetching for zero-latency initial load
    const [profileRes, templatesRes, workersRes, productionModeRes, costRatesRes, organizationRes, partiesRes] = await Promise.all([
        getFactoryCostProfile(),
        getEstimatorTemplates(),
        canUseProduction ? getFixedWorkersForOverhead() : Promise.resolve({ data: [] }),
        getOrganizationProductionMode(supabase, profile.org_id),
        getCostRates(),
        supabase.from('organizations').select('name').eq('id', profile.org_id).maybeSingle(),
        getEstimatorPartyNames(),
    ])

    const staleDefaultRateNames = ((costRatesRes.data ?? []) as CostRateRow[])
        .filter(rate => rate.apply_as_default && getRateReviewStatus(rate) === 'overdue')
        .map(rate => rate.name)

    return (
        <Suspense fallback={<div className="p-20 text-center">Loading Cost Estimate...</div>}>
            <EstimatorClient 
                initialProfile={profileRes.data}
                initialTemplates={templatesRes.data}
                initialWorkers={workersRes.data}
                userId={user.id}
                orgId={profile.org_id}
                canUseProduction={canUseProduction}
                productionMode={productionModeRes.productionMode}
                staleDefaultRateNames={staleDefaultRateNames}
                organizationName={organizationRes.data?.name ?? ''}
                initialPartyNames={partiesRes.data ?? []}
            />
        </Suspense>
    )
}
