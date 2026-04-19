import { getEstimatorQuotes } from '../estimator/actions'
import QuotesClient from './QuotesClient'
import { getAuthenticatedUser } from '@/lib/auth'

export default async function QuotesPage(props: { searchParams: Promise<{ status?: string }> }) {
    const searchParams = await props.searchParams;
    const status = searchParams.status || undefined
    const { data: quotes, error } = await getEstimatorQuotes(status ? { status } : undefined)
    const { user, profile } = await getAuthenticatedUser()

    return (
        <QuotesClient 
            initialQuotes={quotes ?? []} 
            initialStatus={status}
            userId={user.id}
            orgId={profile.org_id}
        />
    )
}
