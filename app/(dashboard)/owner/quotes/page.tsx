import { getFreeGrant, hasSavedFreeCostings } from '@/lib/free-account'
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
    // A Lite owner who started on Free also sees their Free costings; the
    // grant read needs only the org id, so it runs with the page's reads.
    const freeGrantPromise = authPromise.then(({ profile }) => getFreeGrant(profile.org_id))

    const [searchParams, { data: quotes, error: quotesError }, { data: templates, error: templatesError }, auth, planAccess, organizationRes, freeGrant] = await Promise.all([
        searchParamsPromise,
        getEstimatorQuotes(),
        getEstimatorTemplates({ includeArchived: true, summary: true }),
        authPromise,
        planAccessPromise,
        organizationPromise,
        freeGrantPromise,
    ])
    // The prior getEstimatorTemplates({ includeArchived: true }) full read is
    // intentionally represented by summary=true here. The summary carries the
    // warp and weft rows only for the yarn names on each quality card; the rest
    // of a recipe (profile, rates, costing assumptions) stays an intent-time
    // detail payload.
    const requestedStatus = searchParams.status
    const status = requestedStatus && ['costings', 'draft', 'sent', 'accepted', 'rejected'].includes(requestedStatus)
        ? requestedStatus
        : undefined
    const { user, profile } = auth
    const canUseProductionPipeline = hasCapability(planAccess.effectiveTier, 'production')

    // Only real Free records earn the history block; a trial's dormant grant
    // would otherwise render an empty Free list with its demo example.
    const previousFreeGrant = freeGrant && await hasSavedFreeCostings(profile.org_id, freeGrant.subjectId)
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
