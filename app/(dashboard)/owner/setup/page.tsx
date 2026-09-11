import { requireRole } from '@/lib/auth'
import { getSuratTodayString } from '@/lib/time'
import BaseProductionClient from '../production/BaseProductionClient'
import { loadBaseProductionInitialData } from '../production/loaders'

export default async function SetupPage() {
    const { user, profile } = await requireRole(['owner'])
    const initialData = await loadBaseProductionInitialData(profile.org_id, getSuratTodayString())

    return <BaseProductionClient initialData={{ ...initialData, actorId: user.id }} view="setup" />
}
