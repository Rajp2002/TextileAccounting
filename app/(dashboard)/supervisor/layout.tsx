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
import { getCachedOrgTier, tierSatisfies } from '@/lib/subscription'

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
    if (profile.role === 'owner') {
        const tier = await getCachedOrgTier(userOrgId)
        if (!tierSatisfies(tier, 'premium')) redirect('/owner/estimator')
    }
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
        <div className="relative isolate min-h-svh overflow-x-hidden bg-background">
            <BrandBackground />

            <SupervisorSidebar
                factoryName={factoryName}
                userName={userFullName || undefined}
            />

            {/* Shared measured clearance follows mobile navigation and safe areas. */}
            <div className="mobile-workspace-content relative z-10 min-w-0 px-safe">
                <main id="supervisor-main" tabIndex={-1} className="dashboard-main mx-auto min-h-svh w-full min-w-0 max-w-7xl px-3 py-4 xs:px-4 md:px-6 md:py-6 lg:px-8">
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
