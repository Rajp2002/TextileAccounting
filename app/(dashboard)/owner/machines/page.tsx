import { MachineManagement } from '@/components/MachineManagement'
import { requireRole } from '@/lib/auth'
import { createPerfTimer } from '@/lib/perf'
import { loadOwnerMachinesInitialData } from './loaders'

export default async function MachinesPage() {
    const perf = createPerfTimer('/owner/machines')
    const { profile } = await perf.measure('authSession', () => requireRole(['owner']), 0)
    const initialData = await perf.measure(
        'businessData',
        () => loadOwnerMachinesInitialData(profile.org_id),
        7
    )

    perf.log({
        note: 'business includes machines, workers, fixed workers, production targets, and assignments',
    })

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Looms</h1>
                <p className="mt-0.5 text-sm text-gray-500">Manage machines and worker shift assignments</p>
            </div>

            <MachineManagement
                orgId={profile.org_id}
                userRole="owner"
                initialData={initialData}
                perfRouteName="/owner/machines"
            />
        </div>
    )
}
