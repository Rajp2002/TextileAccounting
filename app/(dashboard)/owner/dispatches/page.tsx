import { requireRole } from '@/lib/auth'
import DispatchGuidedTour from '@/components/dispatches/DispatchGuidedTour'
import { createPerfTimer } from '@/lib/perf'
import ChallansClient from './ChallansClient'
import { listChallans } from './challan-actions'
import { getQualityStockBoard } from '../stock/actions'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Delivery challans | Weavly' }
export default async function DispatchesPage() {
    const { user, profile } = await requireRole(['owner'])
    const perf = createPerfTimer('/owner/dispatches')
    const [challans, stock] = await perf.measure(
        'businessData',
        () => Promise.all([listChallans(), getQualityStockBoard()]),
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
        />
        </DispatchGuidedTour>
    )
}
