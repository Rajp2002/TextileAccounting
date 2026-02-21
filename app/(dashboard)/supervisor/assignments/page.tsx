'use client'

import { createClient } from '@/lib/supabase/client'
import { MachineManagement } from '@/components/MachineManagement'
import { useQuery } from '@tanstack/react-query'

export default function SupervisorAssignmentsPage() {
    const supabase = createClient()

    const { data: userProfile } = useQuery({
        queryKey: ['user_profile'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')
            const { data, error } = await supabase
                .from('profiles')
                .select('org_id')
                .eq('id', user.id)
                .single()
            if (error) throw error
            return { ...data, userId: user.id }
        }
    })

    if (!userProfile?.org_id) return <div>Loading...</div>

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
