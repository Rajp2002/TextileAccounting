import PayrollGuidedTour from '@/components/payroll/PayrollGuidedTour'
import { requireRole } from '@/lib/auth'
import { createPerfTimer } from '@/lib/perf'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { getSuratTodayString } from '@/lib/time'
import BaseProductionClient from '../production/BaseProductionClient'
import { loadBaseProductionInitialData } from '../production/loaders'
import PayrollClient from './PayrollClient'
import { loadOwnerPayrollInitialData } from './loaders'

export default async function PayrollPage({
    searchParams,
}: {
    searchParams: Promise<{ cycle?: string | string[] }>
}) {
    const perf = createPerfTimer('/owner/payroll')
    const { user, profile } = await perf.measure('authSession', () => requireRole(['owner']), 0)
    const planAccess = await getCachedOrgPlanAccess(profile.org_id)

    if (!hasCapability(planAccess.effectiveTier, 'legacy_full_suite')) {
        const initialData = await loadBaseProductionInitialData(profile.org_id, getSuratTodayString())
        return <PayrollGuidedTour variant="base" userId={user.id} orgId={profile.org_id} userMetadata={{ tour_preferences: user.user_metadata?.tour_preferences }}>
            <BaseProductionClient initialData={{ ...initialData, actorId: user.id }} view="payroll" />
        </PayrollGuidedTour>
    }

    const params = await searchParams
    const requestedMonth = typeof params.cycle === 'string' ? params.cycle : undefined
    const initialData = await perf.measure(
        'businessData',
        () => loadOwnerPayrollInitialData(profile.org_id, requestedMonth),
        11
    )

    perf.log({
        note: 'server initial payroll shares cycle logs, settlements, and advances across meter and fixed ledgers; pay-date overview is deferred',
    })

    return <PayrollGuidedTour variant="full" userId={user.id} orgId={profile.org_id} userMetadata={{ tour_preferences: user.user_metadata?.tour_preferences }}>
        <PayrollClient initialData={initialData} />
    </PayrollGuidedTour>
}
