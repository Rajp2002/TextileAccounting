'use client'

import { createClient } from '@/lib/supabase/client'
import { MachineManagement } from '@/components/MachineManagement'
import { useQuery } from '@tanstack/react-query'
import { useUserProfile } from '@/hooks/use-user-profile'

import { Loader2 } from 'lucide-react'

export default function SupervisorAssignmentsPage() {
    const supabase = createClient()

    const { data: userProfile } = useUserProfile()

    if (!userProfile?.org_id) return (
        <div className="flex flex-col items-center justify-center h-[50vh]">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-4" />
            <p className="text-gray-500 font-medium text-sm">Loading profile...</p>
        </div>
    )

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Worker Assignments</h1>
            <MachineManagement
                orgId={userProfile.org_id}
                canEditRates={false}
                canAddMachines={false}
            />
        </div>
    )
}
