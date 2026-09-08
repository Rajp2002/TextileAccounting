import {getFreeGrant} from '@/lib/free-account'
import SavedFreeCostings from '@/app/free/costings/SavedFreeCostings'
import { getEstimatorQuotes, getEstimatorTemplates } from '../estimator/actions'
import QuotesClient from './QuotesClient'
import { getAuthenticatedUser } from '@/lib/auth'
import { getCachedOrgPlanAccess, tierSatisfies } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { getEstimatorWorkflowConfig, normalizeProductionMode } from '@/lib/production-mode'
import { getCachedOwnerOrganization } from '@/lib/owner-organization'

export default async function QuotesPage(props: { searchParams: Promise<{ status?: string }> }) {
    const searchParamsPromise = props.searchParams
    const authPromise = getAuthenticatedUser()
    const planAccessPromise = authPromise.then(({ profile }) => getCachedOrgPlanAccess(profile.org_id))
    const organizationPromise = authPromise.then(({ user, profile }) => (
        getCachedOwnerOrganization(user.id, profile.org_id)
    ))

    const [searchParams, { data: quotes }, { data: templates }, auth, planAccess, organizationRes] = await Promise.all([
        searchParamsPromise,
        getEstimatorQuotes(),
        getEstimatorTemplates({ includeArchived: true, summary: true }),
        authPromise,
        planAccessPromise,
        organizationPromise,
    ])
    // The prior getEstimatorTemplates({ includeArchived: true }) full read is
    // intentionally represented by summary=true here; complete recipe rows
    // remain an intent-time detail payload.
    const requestedStatus = searchParams.status
    const status = requestedStatus && ['costings', 'draft', 'sent', 'accepted', 'rejected'].includes(requestedStatus)
        ? requestedStatus
        : undefined
    const { user, profile } = auth
    const canUseProduction = tierSatisfies(planAccess.effectiveTier, 'premium')
    const canUseProductionPipeline = hasCapability(planAccess.effectiveTier, 'production')
    const productionMode = normalizeProductionMode(organizationRes.data?.production_mode)
    const canUseQuotationWorkflow = canUseProduction
        && getEstimatorWorkflowConfig(productionMode).allowsPartyOrders

    const previousFreeGrant = await getFreeGrant(profile.org_id)
    return (<>
        {previousFreeGrant && <SavedFreeCostings />}
        <QuotesClient 
            initialQuotes={quotes ?? []} 
            initialTemplates={templates ?? []}
            initialProfile={undefined}
            initialWorkers={[]}
            initialStatus={status}
            userId={user.id}
            orgId={profile.org_id}
            canUseProduction={canUseProduction}
            canUseProductionPipeline={canUseProductionPipeline}
            canUseQuotationWorkflow={canUseQuotationWorkflow}
            organizationName={organizationRes.data?.name ?? ''}
        />
    </>)
}
