import { getCachedSession } from '@/lib/auth'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { hasCapability, type PlanCapability, type SubscriptionTier } from '@/lib/subscription-access'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calculator, ArrowRight, ArrowLeft, CheckCircle2, Lock, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createPerfTimer } from '@/lib/perf'
import { getBillingPrice } from '@/lib/billing-constants'
import PlanAnalyticsBeacon from '@/components/billing/PlanAnalyticsBeacon'
import PlanAnalyticsLink from '@/components/billing/PlanAnalyticsLink'

interface AccessGateProps {
    /** Preferred capability boundary for new routes. */
    requiredCapability?: PlanCapability
    /** Compatibility prop for the older route declarations. */
    requiredTier?: 'base' | 'premium'
    /** Optional route label for performance logs and upgrade context. */
    routeName?: string
    children: React.ReactNode
}

/**
 * Server component that gates a capability while keeping plan inheritance in
 * one place. Lite and Base share the same costing capabilities; Base adds the
 * production capabilities. Legacy premium routes remain readable for old
 * accounts but are not part of the new self-serve catalog.
 */
export default async function AccessGate({
    requiredCapability,
    requiredTier,
    routeName = '/owner/* access-gate',
    children,
}: AccessGateProps) {
    const perf = createPerfTimer(routeName)
    const session = await perf.measure('authSession', () => getCachedSession(), 0)
    if (!session) redirect('/login')

    const planAccess = await perf.measure(
        'profileOrgTier',
        () => getCachedOrgPlanAccess(session.profile.org_id),
        1,
    )
    const capability = requiredCapability ?? (requiredTier === 'premium' ? 'legacy_full_suite' : 'estimator')
    const tier = planAccess.effectiveTier
    perf.log({ required_capability: capability })

    if (tier === 'none') {
        redirect(`/owner/billing?from=${encodeURIComponent(routeName)}`)
    }

    if (hasCapability(tier, capability)) {
        return <>{children}</>
    }

    if (
        capability === 'legacy_full_suite'
        && planAccess.subscriptionTier === 'premium'
        && planAccess.productExperience === 'base'
    ) {
        return <LegacyWorkspaceWall routeName={routeName} />
    }

    if (capability === 'production' || capability === 'production_management' || capability === 'production_tracking' || capability === 'production_linked') {
        return <ProductionUpgradeWall currentTier={tier} routeName={routeName} />
    }

    return <LegacyCapabilityWall routeName={routeName} />
}

function routeLabel(routeName: string): string {
    const routeLabels: Record<string, string> = {
        '/owner/today': 'Factory Today',
        '/owner/analytics': 'Analytics',
        '/owner/orders': 'Party Orders',
        '/owner/market-runs': 'Market Runs',
        '/owner/stock': 'Godown Stock',
        '/owner/dispatches': 'Dispatches',
        '/owner/commercials': 'Commercials',
        '/owner/payroll': 'Payroll',
        '/owner/operations': 'Operations',
        '/owner/advances': 'Worker Advances',
        '/owner/fixed-workers': 'Fixed Workers',
        '/owner/machines': 'Loom Management',
        '/owner/archive': 'Archive',
        '/owner/system-health': 'System Health',
    }
    return routeLabels[routeName] ?? 'This factory feature'
}

function LegacyWorkspaceWall({ routeName }: { routeName: string }) {
    const featureName = routeLabel(routeName)

    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <div className="w-full max-w-md space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 shadow-sm">
                    <Calculator className="h-8 w-8 text-orange-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Costing workspace is active</h2>
                    <p className="mt-2 text-sm leading-relaxed text-gray-500">
                        {featureName} is hidden while this account uses the costing workspace. Existing factory records remain unchanged.
                    </p>
                </div>
                <Link href="/owner/estimator" className="block">
                    <Button variant="outline" size="lg" className="w-full gap-2 rounded-xl">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Cost Estimates
                    </Button>
                </Link>
                <Link href="/owner/settings#workspace-experience" className="block">
                    <Button size="lg" className="w-full gap-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700">
                        Open workspace settings
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    )
}

function LegacyCapabilityWall({ routeName }: { routeName: string }) {
    const featureName = routeLabel(routeName)

    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <div className="w-full max-w-md space-y-5 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-soft">
                    <Lock className="h-7 w-7 text-subtle" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-ink">{featureName} is outside your current plan</h2>
                    <p className="mt-2 text-sm leading-relaxed text-body">
                        Your Weavly plan includes the complete costing desk. This broader factory module is not part of the current Lite or Base rollout.
                    </p>
                </div>
                <Link href="/owner/estimator" className="block">
                    <Button variant="outline" size="lg" className="w-full gap-2 rounded-xl">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Cost Estimates
                    </Button>
                </Link>
            </div>
        </div>
    )
}

function ProductionUpgradeWall({ currentTier, routeName }: { currentTier: SubscriptionTier; routeName: string }) {
    const price = getBillingPrice('base', 'initial_purchase')
    const renewal = getBillingPrice('base', 'renewal')
    const featureName = routeName === '/owner/production' ? 'Production' : routeLabel(routeName)
    const formatAmount = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <div className="w-full max-w-md space-y-6 text-center">
                <PlanAnalyticsBeacon eventName="production_cta_viewed" properties={{ feature: featureName }} />
                <PlanAnalyticsBeacon eventName="upgrade_screen_opened" properties={{ feature: featureName, plan_tier: currentTier }} />
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 shadow-sm">
                    <Zap className="h-8 w-8 text-orange-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Take your costing into production</h2>
                    <p className="mt-2 text-sm leading-relaxed text-gray-500">
                        {currentTier === 'lite'
                            ? `${featureName} is available with Weavly Base. Keep your costing connected while you create jobs and track production progress.`
                            : `${featureName} requires an active Weavly Base entitlement.`}
                    </p>
                </div>
                <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left">
                    {[
                        'Create production directly from a saved costing',
                        'Track planned, produced, and remaining metres',
                        'Keep costing, machine, worker, and settlement data connected',
                    ].map((feature) => (
                        <div key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <span>{feature}</span>
                        </div>
                    ))}
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-sm text-gray-500">Weavly Base</p>
                    <p className="mt-1 text-3xl font-extrabold text-gray-900">
                        {formatAmount(price.totalPaise)}<span className="text-lg font-normal text-gray-400"> total / first year</span>
                    </p>
                    <p className="text-xs text-gray-400">{formatAmount(price.basePaise)} + {formatAmount(price.gstPaise)} GST · {formatAmount(renewal.totalPaise)} total renewal</p>
                </div>
                <PlanAnalyticsLink
                    href="/owner/billing?plan=base"
                    className="block"
                    eventName="production_cta_clicked"
                    properties={{ feature: featureName, source: 'production_upgrade_wall' }}
                >
                    <Button id="upgrade-to-base-production-btn" size="lg" className="w-full gap-2 rounded-xl bg-amber-600 text-white shadow-lg shadow-amber-200 hover:bg-amber-700">
                        <Zap className="h-4 w-4" />
                        Take costing into production
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </PlanAnalyticsLink>
                <p className="text-xs text-gray-400">Secure Razorpay checkout · GST-inclusive totals shown</p>
            </div>
        </div>
    )
}
