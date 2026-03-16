import { MachineManagement } from '@/components/MachineManagement'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function MachinesPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single()

    if (!profile?.org_id) {
        return <div>Error loading profile</div>
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Machines</h1>
                <p className="text-sm text-gray-500 mt-0.5">Manage rates and machine status</p>
            </div>

            <MachineManagement orgId={profile.org_id} />
        </div>
    )
}
