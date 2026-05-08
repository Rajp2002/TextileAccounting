import { createClient } from '@/lib/supabase/server'
import { SupervisorSidebar } from '@/components/navigation/supervisor-nav'
import { requireRole } from '@/lib/auth'
import { OfflineSyncProvider } from '@/components/offline-sync-provider'
import { BrandBackground } from '@/components/brand-background'

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
    // 🔐 F-8 fix: Server-side role check with DB-fallback against stale JWTs
    const { profile } = await requireRole(['supervisor', 'owner'])
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
        <div className="relative isolate min-h-screen overflow-x-hidden bg-background">
            <BrandBackground />

            <SupervisorSidebar
                factoryName={factoryName}
                userName={userFullName || undefined}
            />

            {/*
             * Content area
             *
             * md:pl-[248px]  — push content right of the persistent sidebar on desktop
             *
             * pb-[...]:      — bottom padding clears the mobile bottom nav bar.
             *   calc(72px + env(safe-area-inset-bottom)) accounts for the iPhone
             *   home indicator / Android gesture bar so no content is obscured.
             *   On desktop (md:) this collapses to 0.
             *
             * px-safe        — side clearance for iPhone landscape where the
             *   rounded screen corners / Dynamic Island eat into the sides.
             */}
            <div className="relative z-10 md:pl-[248px] pb-[calc(72px+env(safe-area-inset-bottom,0px))] md:pb-0 px-safe md:px-0">
                <main className="mx-auto min-h-screen max-w-7xl px-3 py-4 md:px-6 md:py-6 lg:px-8">
                    <OfflineSyncProvider>
                        {children}
                    </OfflineSyncProvider>
                </main>
            </div>
        </div>
    )
}
