'use client'

import { MachineManagement } from '@/components/MachineManagement'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Skeleton } from '@/components/ui/skeleton'

export default function MachinesPage() {
    const { data: userProfile, isLoading } = useUserProfile()

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="h-[400px] w-full bg-gray-50 rounded-xl animate-pulse" />
            </div>
        )
    }

    if (!userProfile?.org_id) {
        return (
            <div className="p-8 text-center border-2 border-dashed rounded-xl">
                <p className="text-red-500 font-medium">Error loading profile. Please try refreshing.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Machines</h1>
                <p className="text-sm text-gray-500 mt-0.5">Manage rates and machine status</p>
            </div>

            <MachineManagement orgId={userProfile.org_id} />
        </div>
    )
}
