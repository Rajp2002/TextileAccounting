'use client'

import { MachineManagement } from '@/components/MachineManagement'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Skeleton } from '@/components/ui/skeleton'

export default function SupervisorMachinesPage() {
    const { data: userProfile, isLoading } = useUserProfile()

    if (isLoading) {
        return (
            <div className="mx-auto max-w-5xl space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="h-[400px] w-full animate-pulse rounded-xl border border-hairline bg-surface/70" />
            </div>
        )
    }
    if (!userProfile?.org_id) return <div className="p-8 text-center text-risk">Error loading organization.</div>

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="weavly-canvas rounded-xl p-4">
                <h1 className="text-2xl font-semibold text-ink">Loom Board</h1>
                <p className="mt-1 text-sm text-muted-foreground">Review running, idle, and assigned looms for the factory floor.</p>
            </div>

            {/* Supervisors can pause/resume looms without owner-only edit controls. */}
            <MachineManagement
                orgId={userProfile.org_id}
                canAddMachines={false}
                canToggleMachineStatus={true}
                canRenameMachines={false}
                canDeleteMachines={false}
            />
        </div>
    )
}
