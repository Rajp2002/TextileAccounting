import { getEstimatorQuotes, getEstimatorTemplates } from '../estimator/actions'
import QuotesClient from './QuotesClient'
import { getAuthenticatedUser } from '@/lib/auth'
import { getOrgTier, tierSatisfies } from '@/lib/subscription'
import { getEstimatorWorkflowConfig, getOrganizationProductionMode } from '@/lib/production-mode'

export default async function QuotesPage(props: { searchParams: Promise<{ status?: string }> }) {
    const searchParams = await props.searchParams;
    const requestedStatus = searchParams.status
    const status = requestedStatus && ['costings', 'draft', 'sent', 'accepted', 'rejected'].includes(requestedStatus)
        ? requestedStatus
        : undefined
    const [{ data: quotes }, { data: templates }, auth] = await Promise.all([
        getEstimatorQuotes(),
        getEstimatorTemplates(),
        getAuthenticatedUser(),
    ])
    const { user, profile, supabase } = auth
    const [tier, organizationRes, productionModeRes] = await Promise.all([
        getOrgTier(profile.org_id),
        supabase.from('organizations').select('name').eq('id', profile.org_id).maybeSingle(),
        getOrganizationProductionMode(supabase, profile.org_id),
    ])
    const canUseProduction = tierSatisfies(tier, 'premium')
    const canUseQuotationWorkflow = canUseProduction
        && getEstimatorWorkflowConfig(productionModeRes.productionMode).allowsPartyOrders

    return (
        <QuotesClient 
            initialQuotes={quotes ?? []} 
            initialTemplates={templates ?? []}
            initialStatus={status}
            userId={user.id}
            orgId={profile.org_id}
            canUseProduction={canUseProduction}
            canUseQuotationWorkflow={canUseQuotationWorkflow}
            organizationName={organizationRes.data?.name ?? ''}
        />
    )
}
