import { requireRole } from '@/lib/auth'
import StockGuidedTour from '@/components/stock/StockGuidedTour'
import { getQualityStockBoard } from './actions'
import QualityStockClient from './QualityStockClient'
import { getBaseGoLiveState } from '@/lib/base-go-live.server'

export const dynamic = 'force-dynamic'

export default async function StockPage() {
    const { user, profile } = await requireRole(['owner'])
    const [result, goLive] = await Promise.all([getQualityStockBoard({ activity: true }), getBaseGoLiveState(profile.org_id)])
    if ('error' in result) throw new Error(result.error)
    return <StockGuidedTour kind="fabric-stock" userId={user.id} orgId={profile.org_id} userMetadata={user.user_metadata}>
        <QualityStockClient initialData={result.data} inSetup={goLive.phase !== 'live'} />
    </StockGuidedTour>
}
