import { requireRole } from '@/lib/auth'
import DispatchGuidedTour from '@/components/dispatches/DispatchGuidedTour'
import { createPerfTimer } from '@/lib/perf'
import { getCachedOwnerOrganization } from '@/lib/owner-organization'
import ChallansClient from './ChallansClient'
import { listChallans } from './challan-actions'
import { getQualityStockBoard } from '../stock/actions'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Delivery challans | Weavly' }
export default async function DispatchesPage() {
    const { user, profile } = await requireRole(['owner'])
    const perf = createPerfTimer('/owner/dispatches')
    // The organization read is shared with the owner shell, which already made it for this request.
    const [challans, stock, organization] = await perf.measure(
        'businessData',
        () =>
            Promise.all([
                listChallans(),
                getQualityStockBoard(),
                getCachedOwnerOrganization(user.id, profile.org_id),
            ]),
        2,
    )
    perf.log()
    if ('error' in challans || 'error' in stock)
        throw new Error('Dispatches could not be loaded. Please retry.')
    return (
        <DispatchGuidedTour userId={user.id} orgId={profile.org_id} userMetadata={user.user_metadata}>
        <ChallansClient
            initialData={challans.data!}
            qualities={stock.data.qualities}
            businessName={organization.data?.name ?? ''}
        />
        </DispatchGuidedTour>
    )
}
