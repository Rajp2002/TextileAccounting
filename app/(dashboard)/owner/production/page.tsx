import { requireRole } from '@/lib/auth'
import { getSuratTodayString } from '@/lib/time'

import BaseProductionClient from './BaseProductionClient'
import { loadBaseProductionInitialData } from './loaders'

export default async function BaseProductionPage() {
    const { profile } = await requireRole(['owner'])
    const today = getSuratTodayString()
    const initialData = await loadBaseProductionInitialData(profile.org_id, today)

    return <BaseProductionClient initialData={initialData} />
}
