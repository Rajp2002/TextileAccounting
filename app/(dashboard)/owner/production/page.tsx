import { requireRole } from '@/lib/auth'
import { getSuratTodayString } from '@/lib/time'

import ProductionGuidedTour from '@/components/production/ProductionGuidedTour'

import BaseProductionClient from './BaseProductionClient'
import { loadBaseProductionInitialData } from './loaders'

export default async function BaseProductionPage({
    searchParams,
}: {
    searchParams?: Promise<{ costingId?: string | string[] }>
}) {
    const { user, profile } = await requireRole(['owner'])
    const today = getSuratTodayString()
    const initialData = await loadBaseProductionInitialData(profile.org_id, today)
    const query = searchParams ? await searchParams : {}
    const initialCostingId = typeof query.costingId === 'string' ? query.costingId : null

    return (
        <ProductionGuidedTour userId={user.id} orgId={profile.org_id} userMetadata={user.user_metadata}>
            <BaseProductionClient initialData={{ ...initialData, actorId: user.id }} initialCostingId={initialCostingId} />
        </ProductionGuidedTour>
    )
}
