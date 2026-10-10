import { getCachedSession } from '@/lib/auth'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { hasCapability, type PlanCapability, type SubscriptionTier } from '@/lib/subscription-access'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, ArrowLeft, Lock, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createPerfTimer } from '@/lib/perf'
import { getBillingPrice } from '@/lib/billing-constants'
import PlanAnalyticsBeacon from '@/components/billing/PlanAnalyticsBeacon'
import { UpgradeWall } from '@/components/billing/UpgradeWall'
import PlanAnalyticsLink from '@/components/billing/PlanAnalyticsLink'

interface AccessGateProps {
    requiredCapability: PlanCapability
    /** Optional route label for performance logs and upgrade context. */
    routeName?: string
    children: React.ReactNode
}

/**
 * Server component that gates a capability while keeping plan inheritance in
 * one place. Lite and Base share the same costing capabilities; Base adds the
 * production capabilities.
 */
export default async function AccessGate({
    requiredCapability,
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
    const capability = requiredCapability
    const tier = planAccess.effectiveTier
    perf.log({ required_capability: capability })

    if (tier === 'none') {
        redirect(`/owner/billing?from=${encodeURIComponent(routeName)}`)
    }

    if (hasCapability(tier, capability)) {
        return <>{children}</>
    }

    if (capability === 'production' || capability === 'production_management' || capability === 'production_tracking' || capability === 'production_linked') {
        // A hidden org gets the generic wall: no Base upsell it may not buy.
        if (planAccess.baseVisible !== true) return <UnavailableCapabilityWall routeName={routeName} baseVisible={false} />
        return <ProductionUpgradeWall currentTier={tier} routeName={routeName} />
    }

    return <UnavailableCapabilityWall routeName={routeName} baseVisible={planAccess.baseVisible === true} />
}

function routeLabel(routeName: string): string {
    const routeLabels: Record<string, string> = {
        '/owner/stock': 'Stock',
        '/owner/dispatches': 'Dispatches',
        '/owner/payroll': 'Payroll',
        '/owner/workers': 'Workers',
        '/owner/assignments': 'Machine Assignments',
        '/owner/operations': 'Machine Assignments',
        '/owner/setup': 'Workers',
        '/owner/machines': 'Machines',
    }
    return routeLabels[routeName] ?? 'This factory feature'
}

function UnavailableCapabilityWall({ routeName, baseVisible = false }: { routeName: string; baseVisible?: boolean }) {
    const featureName = routeLabel(routeName)

    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <div className="w-full max-w-md space-y-5 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-soft">
                    <Lock className="h-7 w-7 text-subtle" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-ink">{`${featureName} is outside your current plan`}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-body">
                        {`Your Weavly plan includes the complete costing desk. This broader factory module is not part of the current ${baseVisible ? 'Lite or Base' : 'Lite'} rollout.`}
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
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
            <PlanAnalyticsBeacon eventName="production_cta_viewed" properties={{ feature: featureName }} />
            <PlanAnalyticsBeacon eventName="upgrade_screen_opened" properties={{ feature: featureName, plan_tier: currentTier }} />
            <div className="max-w-2xl">
                <h2 className="text-2xl font-bold text-ink">Take your costing into production</h2>
                <p className="mt-2 text-sm leading-relaxed text-body">
                    {currentTier === 'lite'
                        ? `${featureName} is available with Weavly Base. Keep your costing connected while you create jobs and track production progress.`
                        : `${featureName} needs an active Weavly Base plan.`}
                </p>
            </div>
            <UpgradeWall currentPlan={currentTier} baseVisible actions={{ base: <>
                <div className="space-y-1">
                    <p><span className="text-3xl font-bold tracking-tight text-ink">{formatAmount(price.totalPaise)}</span><span className="ml-2 text-sm text-subtle">/ first year</span></p>
                    <p className="text-sm text-body">{formatAmount(renewal.totalPaise)} / year to renew</p>
                    <p className="text-xs text-subtle">GST included · manual annual renewal</p>
                </div>
                <PlanAnalyticsLink
                    href="/owner/billing?plan=base"
                    className="block"
                    eventName="production_cta_clicked"
                    properties={{ feature: featureName, source: 'production_upgrade_wall' }}
                >
                    <Button id="upgrade-to-base-production-btn" className="h-auto min-h-11 w-full gap-2 whitespace-normal py-3">
                        <Zap className="h-4 w-4 shrink-0" aria-hidden="true" />
                        Take costing into production
                        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </Button>
                </PlanAnalyticsLink>
            </> }} />
        </div>
    )
}
