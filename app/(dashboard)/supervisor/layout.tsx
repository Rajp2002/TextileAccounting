import { createClient } from '@/lib/supabase/server'
import { SupervisorSidebar } from '@/components/navigation/supervisor-nav'
import { requireRole } from '@/lib/auth'
import { OfflineSyncProvider } from '@/components/offline-sync-provider'

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
    // 🔐 F-8 fix: Server-side role check with DB-fallback against stale JWTs
    const { profile } = await requireRole(['supervisor'])
    const userOrgId = profile.org_id
    const userFullName = profile.full_name

    // Fetch factory name for the sidebar
    let factoryName = 'Weavly'
    if (userOrgId) {
        const supabase = await createClient()
        const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', userOrgId)
            .single()
        if (org?.name) factoryName = org.name
    }

    return (
        <div className="min-h-screen bg-background bg-grid-pattern overflow-x-hidden">

            <SupervisorSidebar
                factoryName={factoryName}
                userName={userFullName || undefined}
            />

            {/*
             * Content area
             *
             * md:pl-[260px]  — push content right of the persistent sidebar on desktop
             *
             * pb-[...]:      — bottom padding clears the mobile bottom nav bar.
             *   calc(72px + env(safe-area-inset-bottom)) accounts for the iPhone
             *   home indicator / Android gesture bar so no content is obscured.
             *   On desktop (md:) this collapses to 0.
             *
             * px-safe        — side clearance for iPhone landscape where the
             *   rounded screen corners / Dynamic Island eat into the sides.
             */}
            <div className="md:pl-[260px] pb-[calc(72px+env(safe-area-inset-bottom,0px))] md:pb-0 px-safe md:px-0">
                <main className="max-w-6xl mx-auto px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8">
                    <OfflineSyncProvider>
                        {children}
                    </OfflineSyncProvider>
                </main>
            </div>
        </div>
    )
}
