import { getEstimatorQuotes, getEstimatorTemplates } from '../estimator/actions'
import QuotesClient from './QuotesClient'
import { getAuthenticatedUser } from '@/lib/auth'
import { getCachedOrgPlanAccess, tierSatisfies } from '@/lib/subscription'
import { getEstimatorWorkflowConfig, normalizeProductionMode } from '@/lib/production-mode'
import { getCachedOwnerOrganization } from '@/lib/owner-organization'

export default async function QuotesPage(props: { searchParams: Promise<{ status?: string }> }) {
    const searchParamsPromise = props.searchParams
    const authPromise = getAuthenticatedUser()
    const planAccessPromise = authPromise.then(({ profile }) => getCachedOrgPlanAccess(profile.org_id))
    const organizationPromise = authPromise.then(({ profile }) => getCachedOwnerOrganization(profile.org_id))

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
    const productionMode = normalizeProductionMode(organizationRes.data?.production_mode)
    const canUseQuotationWorkflow = canUseProduction
        && getEstimatorWorkflowConfig(productionMode).allowsPartyOrders

    return (
        <QuotesClient 
            initialQuotes={quotes ?? []} 
            initialTemplates={templates ?? []}
            initialProfile={undefined}
            initialWorkers={[]}
            initialStatus={status}
            userId={user.id}
            orgId={profile.org_id}
            canUseProduction={canUseProduction}
            canUseQuotationWorkflow={canUseQuotationWorkflow}
            organizationName={organizationRes.data?.name ?? ''}
        />
    )
}
