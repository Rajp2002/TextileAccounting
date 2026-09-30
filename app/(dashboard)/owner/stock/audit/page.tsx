import { requireRole } from '@/lib/auth'
import { getInventoryAuditDataAction } from './actions'
import InventoryAuditClient from './InventoryAuditClient'

export const dynamic = 'force-dynamic'

export default async function InventoryAuditPage() {
    await requireRole(['owner'])
    const result = await getInventoryAuditDataAction()

    if ('error' in result) {
        throw new Error(result.error)
    }

    return (
        <div className="stock-workspace-shell">
            <InventoryAuditClient initialData={result.data} />
        </div>
    )
}
