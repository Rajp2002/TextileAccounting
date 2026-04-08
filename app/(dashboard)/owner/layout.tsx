import { createClient } from '@/lib/supabase/server'
import { OwnerSidebar } from '@/components/navigation/owner-sidebar'
import { requireRole } from '@/lib/auth'
import { PwaSessionGuard } from '@/components/pwa-session-guard'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
    // 🔐 F-8 fix: Server-side role check with DB-fallback against stale JWTs
    const { profile } = await requireRole(['owner'])
    const userRole = profile.role
    const userOrgId = profile.org_id
    const userFullName = profile.full_name

    // Fetch factory name for the sidebar
    let factoryName = 'Textile SaaS'
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
            {/* Signs out stale sessions when the PWA is killed from multitasking */}
            <PwaSessionGuard />

            <OwnerSidebar
                factoryName={factoryName}
                userName={userFullName || undefined}
            />

            {/* Content area — offset by sidebar on desktop, padding-bottom for bottom nav on mobile */}
            <div className="md:pl-[260px] pb-[72px] md:pb-0">
                <main className="max-w-6xl mx-auto px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8">
                    {children}
                </main>
            </div>
        </div>
    )
}
