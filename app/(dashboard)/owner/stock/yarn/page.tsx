import { requireRole } from '@/lib/auth'
import StockGuidedTour from '@/components/stock/StockGuidedTour'
import { getYarnStockBoard } from '../yarn-actions'
import YarnStockClient from '../YarnStockClient'

export const dynamic = 'force-dynamic'
export default async function YarnStockPage() {
    const { user, profile } = await requireRole(['owner'])
    const result = await getYarnStockBoard({ activity: true })
    if ('error' in result) throw new Error(result.error)
    return <StockGuidedTour kind="yarn-stock" userId={user.id} orgId={profile.org_id} userMetadata={user.user_metadata}>
        <YarnStockClient initialData={result.data} />
    </StockGuidedTour>
}
