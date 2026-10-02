import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { getSuratTodayString } from '@/lib/time'

import ProductionGuidedTour from '@/components/production/ProductionGuidedTour'

import BaseProductionClient from './BaseProductionClient'
import { loadBaseProductionInitialData } from './loaders'

export default async function BaseProductionPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const query = searchParams ? await searchParams : {}
    if (query.tab === 'production') {
        const params = new URLSearchParams()
        for (const [key, value] of Object.entries(query)) {
            if (key === 'tab' || value === undefined) continue
            for (const entry of Array.isArray(value) ? value : [value]) params.append(key, entry)
        }
        redirect(`/owner/production/daily-sheet${params.size ? `?${params}` : ''}`)
    }
    const { user, profile } = await requireRole(['owner'])
    const today = getSuratTodayString()
    const initialData = await loadBaseProductionInitialData(profile.org_id, today, 'production')
    const initialCostingId = typeof query.costingId === 'string' ? query.costingId : null

    return (
        <ProductionGuidedTour userId={user.id} orgId={profile.org_id} userMetadata={user.user_metadata}>
            <BaseProductionClient initialData={{ ...initialData, actorId: user.id }} initialCostingId={initialCostingId} />
        </ProductionGuidedTour>
    )
}
