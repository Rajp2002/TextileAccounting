import { requireRole } from '@/lib/auth'
import { IncidentsClient } from '@/components/IncidentsClient'

export const metadata = {
    title: 'Safety Incidents | Owner Dashboard',
    description: 'Track and manage workplace safety incidents',
}

export default async function OwnerIncidentsPage() {
    await requireRole(['owner'])

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <IncidentsClient role="owner" />
        </div>
    )
}
