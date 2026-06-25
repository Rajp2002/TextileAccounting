import { createClient } from '@/lib/supabase/server'
import { OwnerSidebar } from '@/components/navigation/owner-sidebar'
import { requireRole } from '@/lib/auth'
import { BrandBackground } from '@/components/brand-background'
import { normalizeProductionMode } from '@/lib/production-mode'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
    // 🔐 F-8 fix: Server-side role check with DB-fallback against stale JWTs
    const { profile } = await requireRole(['owner'])
    const userOrgId = profile.org_id
    const userFullName = profile.full_name

    // Fetch factory name for the sidebar
    let factoryName = 'Weavly'
    let productionMode = normalizeProductionMode(null)

    if (userOrgId) {
        const supabase = await createClient()
        const { data: org } = await supabase
            .from('organizations')
            .select('name, production_mode')
            .eq('id', userOrgId)
            .single()
        
        if (org?.name) factoryName = org.name
        productionMode = normalizeProductionMode(org?.production_mode)
    }

    return (
        <div className="relative isolate min-h-screen overflow-x-hidden bg-background">
            <BrandBackground />

            <OwnerSidebar
                factoryName={factoryName}
                userName={userFullName || undefined}
                productionMode={productionMode}
            />

            {/* Content area — offset by sidebar on desktop, padding-bottom for bottom nav on mobile */}
            <div className="relative z-10 min-w-0 pb-[calc(72px+env(safe-area-inset-bottom,0px))] px-safe md:!pl-[248px] md:pr-0 md:pb-0">
                <main className="mx-auto min-h-screen w-full min-w-0 max-w-7xl px-2 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] xs:px-3 md:px-6 md:py-6 lg:px-8">
                    {children}
                </main>
            </div>

        </div>
    )
}
