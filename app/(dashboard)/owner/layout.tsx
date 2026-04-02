import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OwnerSidebar } from '@/components/navigation/owner-sidebar'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
    // 🔐 F-8 fix: Server-side role check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const userRole = user.app_metadata?.role
    const userFullName = user.app_metadata?.full_name
    const userOrgId = user.app_metadata?.org_id

    if (userRole !== 'owner') {
        redirect('/supervisor/production')
    }

    // Fetch factory name for the sidebar
    let factoryName = 'Textile SaaS'
    if (userOrgId) {
        const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', userOrgId)
            .single()
        if (org?.name) factoryName = org.name
    }

    return (
        <div className="min-h-screen bg-background bg-grid-pattern">
            <OwnerSidebar
                factoryName={factoryName}
                userName={userFullName || undefined}
            />

            {/* Content area — offset by sidebar on desktop, padding-bottom for bottom nav on mobile */}
            <div className="md:pl-[260px] pb-20 md:pb-0">
                <main className="max-w-5xl mx-auto px-4 py-6 md:px-6 lg:px-8 lg:py-8">
                    {children}
                </main>
            </div>
        </div>
    )
}
