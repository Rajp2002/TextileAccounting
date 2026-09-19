import { requireRole } from '@/lib/auth'
import StockGuidedTour from '@/components/stock/StockGuidedTour'
import { getInventoryAuditDataAction } from './actions'
import InventoryAuditClient from './InventoryAuditClient'

export const dynamic = 'force-dynamic'

export default async function InventoryAuditPage() {
    const { user, profile } = await requireRole(['owner'])
    const result = await getInventoryAuditDataAction()

    if ('error' in result) {
        throw new Error(result.error)
    }

    return (
        <StockGuidedTour kind="fabric-stock" userId={user.id} orgId={profile.org_id} userMetadata={user.user_metadata}>
            <InventoryAuditClient initialData={result.data} />
        </StockGuidedTour>
    )
}
