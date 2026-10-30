import { getFreeGrant, hasSavedFreeCostings } from '@/lib/free-account'
import SavedFreeCostings from '@/app/free/costings/SavedFreeCostings'
import { getEstimatorQuotes, getEstimatorTemplates } from '../estimator/actions'
import QuotesClient from './QuotesClient'
import { getAuthenticatedUser, getSessionHint } from '@/lib/auth'
import { startEarly } from '@/lib/start-early'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { getCachedOwnerOrganization } from '@/lib/owner-organization'
import { LitePriorFreeHistory } from '@/components/estimator/LitePriorFreeHistory'

// A Lite owner who started on Free also sees their Free costings. A Lite
// trial carries a dormant Free grant; only saved Free costings earn the
// history block. Both reads are request-cached by org.
function readPreviousFreeGrant(orgId: string) {
    return getFreeGrant(orgId).then(freeGrant => freeGrant ? hasSavedFreeCostings(orgId, freeGrant.subjectId) : false)
}

export default async function QuotesPage(props: { searchParams: Promise<{ status?: string; offer?: string }> }) {
    // The grant and its count need only the org id, so they start with Proxy's
    // session hint while the identity is verified. The verified org reuses
    // them through the request cache; a read for another org is discarded.
    const hint = await getSessionHint()
    if (hint?.orgId) startEarly(readPreviousFreeGrant(hint.orgId))
    const searchParamsPromise = props.searchParams
    const authPromise = getAuthenticatedUser()
    const planAccessPromise = authPromise.then(({ profile }) => getCachedOrgPlanAccess(profile.org_id))
    const organizationPromise = authPromise.then(({ user, profile }) => (
        getCachedOwnerOrganization(user.id, profile.org_id)
    ))
    const previousFreeGrantPromise = authPromise.then(({ profile }) => readPreviousFreeGrant(profile.org_id))

    const [searchParams, { data: quotes, error: quotesError }, { data: templates, error: templatesError }, auth, planAccess, organizationRes, previousFreeGrant] = await Promise.all([
        searchParamsPromise,
        getEstimatorQuotes(),
        getEstimatorTemplates({ includeArchived: true, summary: true }),
        authPromise,
        planAccessPromise,
        organizationPromise,
        previousFreeGrantPromise,
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
            initialOffer={searchParams.offer}
            userId={user.id}
            userMetadata={{ tour_preferences: user.user_metadata?.tour_preferences }}
            orgId={profile.org_id}
            canUseProductionPipeline={canUseProductionPipeline}
            organizationName={organizationRes.data?.name ?? ''}
        />
    </>)
}
