import {getFreeGrant} from '@/lib/free-account'
import SavedFreeCostings from '@/app/free/costings/SavedFreeCostings'
import { getEstimatorQuotes, getEstimatorTemplates } from '../estimator/actions'
import QuotesClient from './QuotesClient'
import { getAuthenticatedUser } from '@/lib/auth'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { getCachedOwnerOrganization } from '@/lib/owner-organization'
import { LitePriorFreeHistory } from '@/components/estimator/LitePriorFreeHistory'

export default async function QuotesPage(props: { searchParams: Promise<{ status?: string }> }) {
    const searchParamsPromise = props.searchParams
    const authPromise = getAuthenticatedUser()
    const planAccessPromise = authPromise.then(({ profile }) => getCachedOrgPlanAccess(profile.org_id))
    const organizationPromise = authPromise.then(({ user, profile }) => (
        getCachedOwnerOrganization(user.id, profile.org_id)
    ))

    const [searchParams, { data: quotes, error: quotesError }, { data: templates, error: templatesError }, auth, planAccess, organizationRes] = await Promise.all([
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
    const canUseProductionPipeline = hasCapability(planAccess.effectiveTier, 'production')

    const previousFreeGrant = await getFreeGrant(profile.org_id)
    return (<>
        {previousFreeGrant && (planAccess.effectiveTier === 'lite'
            ? <LitePriorFreeHistory><SavedFreeCostings embedded idPrefix="lite-prior-" /></LitePriorFreeHistory>
            : <SavedFreeCostings embedded />)}
        <QuotesClient 
            initialQuotes={quotes ?? []}
            tourUnavailable={Boolean(quotesError || templatesError)}
            loadError={Boolean(quotesError || templatesError)}
            initialTemplates={templates ?? []}
            initialProfile={undefined}
            initialWorkers={[]}
            initialStatus={status}
            userId={user.id}
            userMetadata={{ tour_preferences: user.user_metadata?.tour_preferences }}
            orgId={profile.org_id}
            canUseProductionPipeline={canUseProductionPipeline}
            organizationName={organizationRes.data?.name ?? ''}
        />
    </>)
}
