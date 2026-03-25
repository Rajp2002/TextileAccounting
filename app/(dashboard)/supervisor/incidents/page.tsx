import { requireRole } from '@/lib/auth'
import { IncidentsClient } from '@/components/IncidentsClient'

export const metadata = {
    title: 'Safety Incidents | Supervisor Dashboard',
    description: 'Report and view workplace safety incidents',
}

export default async function SupervisorIncidentsPage() {
    await requireRole(['supervisor', 'owner'])

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <IncidentsClient role="supervisor" />
        </div>
    )
}
