import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SupervisorSidebar } from '@/components/navigation/supervisor-nav'
import { requireRole } from '@/lib/auth'
import { OfflineSyncProvider } from '@/components/offline-sync-provider'
import { BrandBackground } from '@/components/brand-background'
import { createSignInServerTimerFromCookie } from '@/lib/sign-in-telemetry.server'
import QueryProvider from '@/components/query-provider'
import { createPrincipalCacheScope } from '@/lib/auth-cache-scope'
import { AuthBoundaryCleanup } from '@/components/auth/auth-boundary-cleanup'

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
    const signInTelemetry = await createSignInServerTimerFromCookie('sign_in_dashboard_layout')
    // 🔐 F-8 fix: Server-side role check with DB-fallback against stale JWTs.
    // requireRole() uses getCachedSession() internally — subsequent calls in
    // page server actions within this request will be cache hits.
    const { profile, user } = await signInTelemetry.measure(
        'auth_profile',
        () => requireRole(['supervisor', 'owner'])
    )
    const userOrgId = profile.org_id
    const cacheScope = createPrincipalCacheScope({ userId: user.id, organizationId: userOrgId })
    const userFullName = profile.full_name

    // Fetch factory name for the sidebar
    // requireRole() guarantees org_id is set, so no null guard needed.
    let factoryName = 'Weavly'
    const supabase = await createClient()
    const { data: org } = await signInTelemetry.measure(
        'organization_query',
        () => supabase
            .from('organizations')
            .select('name, is_locked_down')
            .eq('id', userOrgId)
            .single()
    )
    if (org?.is_locked_down) redirect('/locked')
    if (org?.name) factoryName = org.name
    signInTelemetry.log('success', { route: '/supervisor/*' })

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
            <div className="relative z-10 min-w-0 pb-[calc(72px+env(safe-area-inset-bottom,0px))] px-safe md:!pl-[248px] md:pr-0 md:pb-0">
                <main className="dashboard-main mx-auto min-h-screen w-full min-w-0 max-w-7xl px-2 py-4 xs:px-3 md:px-6 md:py-6 lg:px-8">
                    <QueryProvider scope={cacheScope}>
                        <AuthBoundaryCleanup scope={cacheScope} />
                        <OfflineSyncProvider scope={cacheScope}>
                            {children}
                        </OfflineSyncProvider>
                    </QueryProvider>
                </main>
            </div>
        </div>
    )
}
