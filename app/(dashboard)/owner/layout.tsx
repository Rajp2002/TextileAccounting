import { OwnerSidebar } from '@/components/navigation/owner-sidebar'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { BrandBackground } from '@/components/brand-background'
import { normalizeProductionMode } from '@/lib/production-mode'
import { createPerfTimer } from '@/lib/perf'
import { getCachedOrgTier } from '@/lib/subscription'
import { OwnerPlanProvider } from '@/components/providers/owner-plan-provider'
import { createSignInServerTimerFromCookie } from '@/lib/sign-in-telemetry.server'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
    const perf = createPerfTimer('/owner/* layout')
    const signInTelemetry = await createSignInServerTimerFromCookie('sign_in_dashboard_layout')

    // 🔐 F-8 fix: Server-side role check with DB-fallback against stale JWTs.
    // requireRole() calls getCachedSession() internally — subsequent calls in
    // AccessGate and page server actions within this request are cache hits.
    const { profile } = await signInTelemetry.measure(
        'auth_profile',
        () => perf.measure('authSession', () => requireRole(['owner']), 2)
    )
    const userOrgId = profile.org_id
    const userFullName = profile.full_name

    // Fetch org name + production_mode in parallel with the already-resolved auth.
    // This runs concurrently instead of sequentially after requireRole().
    let factoryName = 'Weavly'
    let productionMode = normalizeProductionMode(null)

    const supabase = await createClient()
    const orgPromise = signInTelemetry.measure(
        'organization_query',
        () => perf.measure(
            'profileOrgTier',
            () => supabase
                .from('organizations')
                .select('name, production_mode')
                .eq('id', userOrgId)
                .single(),
            1
        )
    )
    const [{ data: org }, subscriptionTier] = await Promise.all([
        orgPromise,
        signInTelemetry.measure(
            'tier_lookup',
            () => perf.measure('businessData', () => getCachedOrgTier(userOrgId), 1)
        ),
    ])

    if (org?.name) factoryName = org.name
    productionMode = normalizeProductionMode(org?.production_mode)
    perf.log()
    signInTelemetry.log('success', { route: '/owner/*' })

    return (
        <div className="relative isolate min-h-screen overflow-x-hidden bg-background">
            <BrandBackground />

            <OwnerSidebar
                factoryName={factoryName}
                userName={userFullName || undefined}
                productionMode={productionMode}
                subscriptionTier={subscriptionTier}
            />

            {/* Content area — offset by sidebar on desktop, padding-bottom for bottom nav on mobile */}
            <div className="relative z-10 min-w-0 pb-[calc(72px+env(safe-area-inset-bottom,0px))] px-safe md:!pl-[248px] md:pr-0 md:pb-0">
                <main className="mx-auto min-h-screen w-full min-w-0 max-w-7xl px-2 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] xs:px-3 md:px-6 md:py-6 lg:px-8">
                    <OwnerPlanProvider tier={subscriptionTier}>{children}</OwnerPlanProvider>
                </main>
            </div>

        </div>
    )
}
