import { MachineManagement } from '@/components/MachineManagement'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
        <div className="p-4 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <a href="/owner/analytics">
                        <ArrowLeft className="h-5 w-5" />
                    </a>
                </Button>
                <h1 className="text-2xl font-bold">Manage Machines</h1>
            </div>

            <MachineManagement orgId={profile.org_id} />
        </div>
    )
}
