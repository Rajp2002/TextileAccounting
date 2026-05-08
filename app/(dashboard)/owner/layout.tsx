import { createClient } from '@/lib/supabase/server'
import { OwnerSidebar } from '@/components/navigation/owner-sidebar'
import { requireRole } from '@/lib/auth'
import { AccessCodeBanner } from '@/components/AccessCodeBanner'
import { BrandBackground } from '@/components/brand-background'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
    // 🔐 F-8 fix: Server-side role check with DB-fallback against stale JWTs
    const { profile } = await requireRole(['owner'])
    const userOrgId = profile.org_id
    const userFullName = profile.full_name

    // Fetch factory name for the sidebar
    let factoryName = 'Weavly'
    let activeCode: string | null = null
    let codeExpiresAt: string | null = null

    if (userOrgId) {
        const supabase = await createClient()
        const { data: org } = await supabase
            .from('organizations')
            .select('name, last_code_plain, access_code_expires_at')
            .eq('id', userOrgId)
            .single()
        
        if (org?.name) factoryName = org.name
        if (org?.last_code_plain) {
            activeCode = org.last_code_plain
            codeExpiresAt = org.access_code_expires_at
        }
    }

    return (
        <div className="relative isolate min-h-screen overflow-x-hidden bg-background">
            <BrandBackground />

            <OwnerSidebar
                factoryName={factoryName}
                userName={userFullName || undefined}
            />

            {/* Content area — offset by sidebar on desktop, padding-bottom for bottom nav on mobile */}
            <div className="relative z-10 pb-[72px] md:pl-[248px] md:pb-0">
                <main className="mx-auto min-h-screen max-w-7xl px-3 py-4 md:px-6 md:py-6 lg:px-8">
                    {children}
                </main>
            </div>

            {activeCode && codeExpiresAt && (
                <AccessCodeBanner code={activeCode} expiresAt={codeExpiresAt} />
            )}
        </div>
    )
}
