import { requireRole } from '@/lib/auth'
import { getSuratTodayString } from '@/lib/time'

import BaseProductionClient from '../production/BaseProductionClient'
import { loadBaseProductionInitialData } from '../production/loaders'

export default async function OperationsPage() {
    const { profile } = await requireRole(['owner'])
    const initialData = await loadBaseProductionInitialData(profile.org_id, getSuratTodayString())

    return <BaseProductionClient initialData={initialData} view="operations" />
}
