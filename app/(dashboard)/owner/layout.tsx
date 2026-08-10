import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { OwnerSidebar } from '@/components/navigation/owner-sidebar'
import { OwnerRouteLoading } from '@/components/navigation/owner-route-loading'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { BrandBackground } from '@/components/brand-background'
import { normalizeProductionMode } from '@/lib/production-mode'
import { createPerfTimer } from '@/lib/perf'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { OwnerPlanProvider } from '@/components/providers/owner-plan-provider'
import { createSignInServerTimerFromCookie } from '@/lib/sign-in-telemetry.server'
import { getRateReviewStatus } from '@/lib/cost-rates'
import { getCachedOwnerOrganization } from '@/lib/owner-organization'
import { createPrincipalCacheScope } from '@/lib/auth-cache-scope'
import { AuthBoundaryCleanup } from '@/components/auth/auth-boundary-cleanup'

/**
 * The owner chrome is intentionally split into a static frame and two secure
 * request-scoped data boundaries. The frame contains no tenant data, so it can
 * commit while claims/profile/plan reads are still in flight. The boundaries
 * retain the existing server-side role, entitlement, RLS, and lockdown checks.
 */
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative isolate min-h-screen overflow-x-hidden bg-background" data-owner-shell>
            <BrandBackground />

            <Suspense fallback={<OwnerSidebarLoading />}>
                <OwnerSidebarBoundary />
            </Suspense>

            <div className="relative z-10 min-w-0 pb-[calc(72px+env(safe-area-inset-bottom,0px))] px-safe md:!pl-[248px] md:pr-0 md:pb-0">
                <main className="dashboard-main mx-auto min-h-screen w-full min-w-0 max-w-7xl px-2 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] xs:px-3 md:px-6 md:py-6 lg:px-8">
                    <Suspense fallback={<OwnerRouteLoading />}>
                        <OwnerRouteBoundary>{children}</OwnerRouteBoundary>
                    </Suspense>
                </main>
            </div>
        </div>
    )
}

async function OwnerRouteBoundary({ children }: { children: React.ReactNode }) {
    const perf = createPerfTimer('/owner/* layout')
    const signInTelemetry = await createSignInServerTimerFromCookie('sign_in_dashboard_layout')
    const { profile, user } = await signInTelemetry.measure(
        'auth_profile',
        () => perf.measure('authSession', () => requireRole(['owner']), 2),
    )
    const cacheScope = createPrincipalCacheScope({
        userId: user.id,
        organizationId: profile.org_id,
    })

    const [organizationResult, planAccess] = await Promise.all([
        signInTelemetry.measure(
            'organization_query',
            () => perf.measure('profileOrgTier', () => getCachedOwnerOrganization(user.id, profile.org_id), 1),
        ),
        signInTelemetry.measure(
            'tier_lookup',
            () => perf.measure('businessData', () => getCachedOrgPlanAccess(profile.org_id), 1),
        ),
    ])
    const { data: organization, error: organizationError } = organizationResult

    // Lockdown is an authoritative tenant check, not a Proxy-only redirect.
    // The session has already been verified, so a missing tenant must never
    // redirect to /login: middleware would correctly send the valid owner home
    // and create an infinite route loop. Fail closed at this boundary instead.
    if (organizationError) {
        console.error(JSON.stringify({
            level: 'error',
            event: 'owner_organization_lookup_failed',
            code: organizationError.code,
        }))
        throw new Error('Unable to verify the owner organization.')
    }
    if (!organization) {
        console.error(JSON.stringify({
            level: 'error',
            event: 'verified_owner_organization_missing',
        }))
        throw new Error('Verified owner organization is unavailable.')
    }
    if (organization.is_locked_down) redirect('/locked')

    perf.log({ organization_state: 'verified' })
    signInTelemetry.log('success', { route: '/owner/*' })

    return (
        <OwnerPlanProvider access={planAccess}>
            <AuthBoundaryCleanup scope={cacheScope} />
            {children}
        </OwnerPlanProvider>
    )
}

async function OwnerSidebarBoundary() {
    const perf = createPerfTimer('/owner/* sidebar')
    const signInTelemetry = await createSignInServerTimerFromCookie('sign_in_dashboard_sidebar')
    const { profile, user } = await signInTelemetry.measure(
        'auth_profile',
        () => perf.measure('authSession', () => requireRole(['owner']), 2),
    )
    const userOrgId = profile.org_id

    const organizationPromise = signInTelemetry.measure(
        'organization_query',
        () => perf.measure('profileOrgTier', () => getCachedOwnerOrganization(user.id, userOrgId), 1),
    )
    const reviewRatesPromise = (async () => {
        const supabase = await createClient()
        return supabase
            .from('cost_rate_book')
            .select('last_reviewed_at, review_interval_days')
            .eq('org_id', userOrgId)
            .eq('is_active', true)
            .in('category', ['yarn_warp', 'yarn_weft'])
    })()

    const [{ data: organization }, planAccess, { data: reviewRates }] = await Promise.all([
        organizationPromise,
        signInTelemetry.measure(
            'tier_lookup',
            () => perf.measure('businessData', () => getCachedOrgPlanAccess(userOrgId), 1),
        ),
        reviewRatesPromise,
    ])

    if (!organization || organization.is_locked_down) return null

    const yarnReviewDueCount = (reviewRates ?? []).filter(rate => getRateReviewStatus(rate) !== 'current').length
    perf.log({ organization_state: 'verified' })
    signInTelemetry.log('success', { route: '/owner/* sidebar' })

    return (
        <OwnerSidebar
            factoryName={organization.name || 'Weavly'}
            userName={profile.full_name || undefined}
            productionMode={normalizeProductionMode(organization.production_mode)}
            subscriptionTier={planAccess.effectiveTier}
            yarnReviewDueCount={yarnReviewDueCount}
        />
    )
}

function OwnerSidebarLoading() {
    return (
        <>
            <aside
                aria-hidden="true"
                className="hidden md:fixed md:inset-y-0 md:z-30 md:flex md:w-[248px] md:flex-col border-r border-white/10 bg-[#111111]"
            >
                <div className="border-b border-white/10 px-4 py-5">
                    <div className="mx-auto h-20 w-44 rounded-lg bg-white/[0.06]" />
                    <div className="mt-4 h-11 rounded-lg bg-white/[0.06]" />
                </div>
                <div className="space-y-2 px-3 py-5">
                    {Array.from({ length: 8 }, (_, index) => (
                        <div key={index} className="h-11 rounded-lg bg-white/[0.05]" />
                    ))}
                </div>
            </aside>

            <nav
                aria-hidden="true"
                className="fixed inset-x-0 bottom-0 z-50 grid min-h-[64px] grid-cols-6 items-center gap-1 border-t border-border/70 bg-canvas/92 px-safe pt-2 pb-safe shadow-[0_-4px_18px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden"
            >
                {Array.from({ length: 6 }, (_, index) => (
                    <div key={index} className="flex flex-col items-center gap-1 px-1">
                        <div className="h-5 w-5 rounded-md bg-muted/70" />
                        <div className="h-2.5 w-12 max-w-full rounded bg-muted/70" />
                    </div>
                ))}
            </nav>
        </>
    )
}
