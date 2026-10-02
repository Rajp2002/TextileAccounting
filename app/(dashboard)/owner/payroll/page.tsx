import PayrollGuidedTour from '@/components/payroll/PayrollGuidedTour'
import { requireRole } from '@/lib/auth'
import { getSuratTodayString } from '@/lib/time'
import BaseProductionClient from '../production/BaseProductionClient'
import { loadBaseProductionInitialData } from '../production/loaders'

export default async function PayrollPage() {
    const { user, profile } = await requireRole(['owner'])
    const initialData = await loadBaseProductionInitialData(profile.org_id, getSuratTodayString(), 'payroll')
    return <PayrollGuidedTour variant="base" userId={user.id} orgId={profile.org_id} userMetadata={{ tour_preferences: user.user_metadata?.tour_preferences }}>
        <BaseProductionClient initialData={{ ...initialData, actorId: user.id }} view="payroll" />
    </PayrollGuidedTour>
}
