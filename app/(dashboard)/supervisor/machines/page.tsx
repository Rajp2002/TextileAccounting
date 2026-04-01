'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { MachineManagement } from '@/components/MachineManagement'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Skeleton } from '@/components/ui/skeleton'

export default function SupervisorMachinesPage() {
    const supabase = createClient()

    const { data: userProfile, isLoading } = useUserProfile()

    if (isLoading) {
        return (
            <div className="p-4 space-y-6 max-w-4xl mx-auto">
                <Skeleton className="h-8 w-48" />
                <div className="h-[400px] w-full bg-gray-50 rounded-xl animate-pulse" />
            </div>
        )
    }
    if (!userProfile?.org_id) return <div className="p-8 text-center text-red-500">Error loading organization.</div>

    return (
        <div className="p-4 space-y-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800">Manage Machines</h1>

            {/* Supervisors get view-only access to machines */}
            <MachineManagement
                orgId={userProfile.org_id}
                canAddMachines={false}
                canRenameMachines={true}
                canDeleteMachines={true}
            />
        </div>
    )
}
