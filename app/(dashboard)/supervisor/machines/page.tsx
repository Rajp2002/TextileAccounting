'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { MachineManagement } from '@/components/MachineManagement'
import { useUserProfile } from '@/hooks/use-user-profile'

export default function SupervisorMachinesPage() {
    const supabase = createClient()

    const { data: userProfile, isLoading } = useUserProfile()

    if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
    if (!userProfile?.org_id) return <div className="p-8 text-center text-red-500">Error loading organization.</div>

    return (
        <div className="p-4 space-y-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800">Manage Machines</h1>

            {/* Reuse the MachineManagement component which handles listing, adding, and rates */}
            {/* Supervisors have full access as requested */}
            <MachineManagement
                orgId={userProfile.org_id}
                canEditRates={true}
                canAddMachines={true}
            />
        </div>
    )
}
