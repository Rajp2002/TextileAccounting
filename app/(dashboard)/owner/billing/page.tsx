import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { getSubscriptionDetail } from '@/lib/subscription'
import { SubscribeButton } from '@/components/billing/SubscribeButton'
import { BillingAttemptStatus } from '@/components/billing/BillingAttemptStatus'
import { BillingDocumentNotice } from '@/components/billing/BillingDocumentNotice'
import { ReferralCard } from '@/components/billing/ReferralCard'
import { getReferralStatsAction } from '../actions'
import {
    CheckCircle2, AlertCircle, Clock, XCircle,
    ShieldCheck, ReceiptText, Star, Zap, Timer, Lock, ArrowRight, CreditCard,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
    BILLING_SELF_SERVE_PLAN_TIERS,
    getBillingPlan,
    getBillingPrice,
    RENEWAL_ELIGIBILITY_DAYS,
    type PurchasablePlanTier,
} from '@/lib/billing-constants'
import {
    resolveBillingPurchase,
    resolveBillingCheckoutPresentation,
    getRenewalEligibilityDate,
    type BillingPaymentRow,
    type BillingPurchaseDecision,
    type BillingSubscriptionRow,
} from '@/lib/billing-lifecycle'
import { type BillingAttemptRow } from '@/lib/billing-attempts'
import { RouteMilestones } from '@/components/performance/route-milestones'
import { Suspense } from 'react'
import { PageHeader, SectionHeader, StatusBadge } from '@/components/ui/page-header'

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SubscriptionPaymentRow = {
    id: string
    status: string
    created_at: string | null
    razorpay_payment_id?: string | null
    amount_paise: number
    method?: string | null
    subscription_id: string | null
    razorpay_order_id?: string | null
    captured_at?: string | null
}

function formatDate(iso: string | null): string {
    if (!iso) return '—'
    return `${new Date(iso).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        timeZone: 'Asia/Kolkata',
    })} IST`
}

function formatShortDate(iso: string | null): string {
    if (!iso) return '—'
    return `${new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        timeZone: 'Asia/Kolkata',
    })} IST`
}

function formatAmount(paise: number): string {
    return `₹${(paise / 100).toLocaleString('en-IN')}`
}

function getFeatureLabel(route: string | null): string | null {
    if (!route || !route.startsWith('/owner/')) return null
    const labels: Record<string, string> = {
        '/owner/today': 'Factory Today',
        '/owner/analytics': 'Analytics',
        '/owner/orders': 'Party Orders',
        '/owner/market-runs': 'Market Runs',
        '/owner/stock': 'Godown Stock',
        '/owner/dispatches': 'Dispatches',
        '/owner/commercials': 'Commercials',
        '/owner/payroll': 'Payroll',
        '/owner/advances': 'Worker Advances',
        '/owner/fixed-workers': 'Fixed Workers',
        '/owner/machines': 'Loom Management',
        '/owner/archive': 'Archive',
        '/owner/system-health': 'System Health',
    }
    return labels[route] ?? 'this connected factory feature'
}

function trialDaysLeft(currentEnd: string | null): number {
    if (!currentEnd) return 0
    const ms = new Date(currentEnd).getTime() - Date.now()
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

function trialProgressPct(currentEnd: string | null): number {
    if (!currentEnd) return 100
    const total = 7 * 24 * 60 * 60 * 1000
    const remaining = new Date(currentEnd).getTime() - Date.now()
    const used = total - Math.max(0, remaining)
    return Math.min(100, Math.round((used / total) * 100))
}

function ReferralLoading() {
    return (
        <Card className="min-h-[220px] border-loom bg-loom p-5 shadow-[var(--shadow-card)]">
            <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
            <div className="mt-5 h-20 animate-pulse rounded-xl bg-white/10" />
            <p className="mt-4 text-xs font-medium text-surface-muted/80">Loading referral details…</p>
        </Card>
    )
}

function ReferralUnavailable() {
    return (
        <Card className="p-5">
            <p className="text-sm font-semibold text-ink">Referral details are temporarily unavailable.</p>
            <Link href="/owner/billing" className="mt-2 inline-flex text-xs font-semibold text-saffron-deep underline-offset-4 hover:underline">
                Refresh to retry
            </Link>
        </Card>
    )
}

async function DeferredReferralSection() {
    let stats: Awaited<ReturnType<typeof getReferralStatsAction>> | null = null
    let failed = false
    try {
        stats = await getReferralStatsAction()
    } catch {
        failed = true
    }
    return (
        <>
            {failed ? <ReferralUnavailable /> : <ReferralCard stats={stats} />}
            <RouteMilestones route="/owner/billing" shellVisible={false} primaryUsable={false} secondaryReady />
        </>
    )
}

function PlanCards({
    label,
    currentTier,
    decisions,
    visibleTiers,
}: {
    label: string
    currentTier: string
    decisions: Record<PurchasablePlanTier, BillingPurchaseDecision>
    visibleTiers: readonly PurchasablePlanTier[]
}) {
    const plans = [
        {
            tier: 'base' as const,
            name: 'Weavly Estimator',
            badge: 'Standalone',
            renewal: '₹2,360 total/year (₹2,000 + ₹360 GST)',
            features: ['Estimator workspace', 'Saved Fabric Qualities', 'Customer quotation documents', 'Draft recovery', 'Independent account access'],
            icon: Zap,
        },
        {
            tier: 'premium' as const,
            name: 'Weavly Full Suite',
            badge: 'Complete factory',
            renewal: '₹8,260 total/year (₹7,000 + ₹1,260 GST)',
            features: ['Everything in Estimator', 'Production & order tracking', 'Market runs and godown stock', 'Dispatches', 'Payroll, advances, and analytics'],
            icon: Star,
        },
    ]
        .filter((plan) => visibleTiers.includes(plan.tier))
        .filter((plan) => currentTier !== 'base' || plan.tier === 'premium')
        .filter((plan) => decisions[plan.tier].allowed)

    if (plans.length === 0) return null

    return (
        <div className="space-y-5 pt-4">
            <SectionHeader title={label} description="Clear annual pricing. 18% GST is included in every total shown." />
            <div className="grid gap-6 lg:grid-cols-2">
                {plans.map((plan) => {
                    const Icon = plan.icon
                    const decision = decisions[plan.tier]
                    const price = getBillingPrice(plan.tier, decision.purchaseType)
                    const total = formatAmount(price.totalPaise)
                    const breakdown = `${formatAmount(price.basePaise)} + ${formatAmount(price.gstPaise)} GST (18%)`
                    const isRenewal = decision.purchaseType === 'renewal'
                    return (
                    <div key={plan.tier} className="premium-surface group relative rounded-xl border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
                        <span className="absolute right-5 top-5 rounded-full bg-saffron-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-saffron-deep">
                            {plan.badge}
                        </span>
                        <div className="flex h-full flex-col gap-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 pr-24">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-loom text-saffron"><Icon className="h-5 w-5" /></div>
                                    <h3 className="text-lg font-semibold tracking-tight text-ink">{plan.name}</h3>
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-1"><span className="text-3xl font-bold tracking-tight text-ink">{total}</span><span className="text-sm text-subtle">/{isRenewal ? 'renewal year' : 'first year'}</span></div>
                                    <p className="mt-1 text-xs text-body">{breakdown}</p>
                                </div>
                                <div className="rounded-lg border border-hairline bg-surface-soft p-3 text-sm font-medium text-body">
                                    <p>Manual renewal from year 2</p><p className="mt-0.5 text-xs text-subtle">{plan.renewal}</p>
                                </div>
                            </div>
                            <ul className="flex-1 space-y-3">
                                {plan.features.map((feature) => <li key={feature} className="flex items-start gap-3 text-sm leading-tight text-body"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />{feature}</li>)}
                            </ul>
                            <BillingDocumentNotice compact />
                            <SubscribeButton
                                planTier={plan.tier}
                                tierName={plan.name}
                                displayAmount={total}
                                buttonLabel={`Pay ${total} & ${isRenewal ? 'Renew' : 'Activate'}`}
                                successHref={isRenewal ? '/owner/billing' : plan.tier === 'premium' ? '/onboarding' : '/owner/estimator'}
                                successLabel={isRenewal ? 'View payment history' : plan.tier === 'premium' ? 'Set up your factory' : 'Start your first Cost Estimate'}
                            />
                        </div>
                    </div>
                    )
                })}
            </div>
            <div className="flex items-center justify-center gap-2 rounded-xl border border-hairline bg-surface-soft p-3">
                <ShieldCheck className="h-4 w-4 text-subtle" />
                <p className="text-xs font-medium text-body">
                    Secure Razorpay checkout · Tenant-scoped data access
                </p>
            </div>
        </div>
    )
}

export default async function BillingPage({
    searchParams,
}: {
    searchParams?: Promise<{ from?: string | string[] }>
}) {
    const { profile } = await requireRole(['owner'])
    if (!profile.org_id) redirect('/owner/today')

    const queryPromise: Promise<{ from?: string | string[] }> = searchParams
        ? searchParams
        : Promise.resolve({})

    const supabase = await createClient()
    // Critical billing state stays authoritative and server-owned. Referral
    // statistics are an independent secondary panel and stream below.
    const [query, subscriptionDetail, paymentsResult, subscriptionsResult, attemptsResult] = await Promise.all([
        queryPromise,
        getSubscriptionDetail(profile.org_id),
        supabase
            .from('subscription_payments')
            .select('id, status, created_at, razorpay_payment_id, amount_paise, method, subscription_id, razorpay_order_id, captured_at')
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false })
            .limit(10),
        supabase
            .from('org_subscriptions')
            .select('id, plan_tier, status, current_start, current_end, razorpay_payment_id, razorpay_subscription_id, razorpay_order_id, checkout_purchase_type, checkout_amount_paise, checkout_currency, created_at')
            .eq('org_id', profile.org_id),
        supabase
            .from('billing_checkout_attempts')
            .select('id, org_id, client_request_id, plan_tier, purchase_type, status, provider_order_id, provider_payment_id, provider_order_status, provider_status, failure_code, failure_reason, created_at, updated_at, last_checked_at')
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false })
            .limit(1),
    ])
    const { tier, subscription } = subscriptionDetail
    const requestedRoute = typeof query.from === 'string' ? query.from : null
    const requestedFeature = getFeatureLabel(requestedRoute)
    const payments = paymentsResult.data ?? []
    const billingSubscriptions = (subscriptionsResult.data ?? []) as BillingSubscriptionRow[]
    const billingPayments = payments as BillingPaymentRow[]
    const latestAttempt = (attemptsResult.data?.[0] ?? null) as BillingAttemptRow | null
    // Billing lifecycle is evaluated on the server so expired paid customers
    // see renewal pricing while trials still see first-year pricing.
    const billingNow = new Date()
    const purchaseDecisions: Record<PurchasablePlanTier, BillingPurchaseDecision> = {
        base: resolveBillingPurchase(billingSubscriptions, billingPayments, 'base', billingNow),
        premium: resolveBillingPurchase(billingSubscriptions, billingPayments, 'premium', billingNow),
    }
    const subscriptionById = new Map(
        billingSubscriptions.map((row) => [row.id, row])
    )
    const activePaidTier = tier === 'base' || tier === 'premium' ? tier : null
    const activePlan = activePaidTier ? getBillingPlan(activePaidTier) : null
    const activeRenewalPrice = activePaidTier ? getBillingPrice(activePaidTier, 'renewal') : null

    const checkoutPresentation = resolveBillingCheckoutPresentation(
        billingSubscriptions,
        billingPayments,
        billingNow,
    )
    const isActivating = checkoutPresentation.state === 'activating'
    const isPending = checkoutPresentation.state === 'pending'
    const isRetryable = checkoutPresentation.state === 'retryable'
    const activeRenewalDecision = activePaidTier ? purchaseDecisions[activePaidTier] : null
    const hasPaidPremiumHistory = purchaseDecisions.premium.purchaseType === 'renewal'
    const visiblePlanTiers: readonly PurchasablePlanTier[] = tier === 'trial' || hasPaidPremiumHistory
        ? ['base', 'premium']
        : BILLING_SELF_SERVE_PLAN_TIERS
    const renewalAvailable = Boolean(
        activeRenewalDecision?.allowed
        && activeRenewalDecision.purchaseType === 'renewal'
    )
    const renewalEligibleAt = subscription?.current_end
        ? getRenewalEligibilityDate(subscription.current_end)
        : null
    const latestCapturedPayment = (payments as SubscriptionPaymentRow[]).find((payment) => payment.status === 'captured') ?? null

    // ── LAYOUT START ───────────────────────────────────────────────────────────
    return (
        <div className="premium-route-enter mx-auto w-full max-w-6xl space-y-8 px-4 pb-20 sm:px-6 lg:px-0">
            <RouteMilestones route="/owner/billing" shellVisible primaryUsable />
            <PageHeader
                icon={CreditCard}
                eyebrow="Account"
                title="Billing & Plan"
                description={(
                    <>
                        <span>See your current plan, renewal date, payment history, and billing documents.</span>
                        {requestedFeature && tier === 'none' && (
                            <span className="mt-2 block font-semibold text-saffron-deep">
                                You arrived here from {requestedFeature}. Choose a plan to unlock it.
                            </span>
                        )}
                    </>
                )}
                meta={tier !== 'none' && !latestAttempt?.status?.match(/processing|unknown|authorized|activation_pending|reconciliation_required|duplicate/) ? <StatusBadge status="active" /> : null}
                actions={(
                    <Link href="/owner/data-export" className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-saffron-deep underline-offset-4 hover:bg-saffron-soft hover:underline">
                        Export organization data
                    </Link>
                )}
            />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                
                {/* Left/Main Column - Context Sensitive */}
                <div className="space-y-6 lg:col-span-8">
                    {latestAttempt && latestAttempt.status !== 'activated' && latestAttempt.status !== 'failed' && latestAttempt.status !== 'cancelled' && latestAttempt.status !== 'refunded' && (
                        <BillingAttemptStatus attempt={latestAttempt} />
                    )}
                    
                    {/* 1. STATE-SPECIFIC HERO CARD */}
                    {tier === 'none' ? (
                        <div className="relative overflow-hidden rounded-xl border border-loom-elevated bg-loom p-6 text-white shadow-[var(--shadow-panel)] sm:p-8 md:p-10">
                            <div className="relative z-10 max-w-lg space-y-6">
                                {isActivating ? (
                                    <>
                                        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                                            <Clock className="h-3 w-3 animate-spin" /> Activating access
                                        </div>
                                        <h2 className="text-2xl font-black tracking-tight leading-[1.1] sm:text-3xl md:text-5xl">Your factory is coming online.</h2>
                                        <p className="text-surface-muted text-base font-medium">
                                            We&apos;ve received your payment. Your selected <strong>Weavly plan</strong> is being configured. Refresh in a few seconds.
                                        </p>
                                    </>
                                ) : isPending ? (
                                    <>
                                        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                                            <Clock className="h-3 w-3 animate-spin" /> Checkout pending
                                        </div>
                                        <h2 className="text-2xl font-black tracking-tight leading-[1.1] sm:text-3xl md:text-5xl">Complete payment in Razorpay.</h2>
                                        <p className="text-surface-muted text-base font-medium">
                                            Your order is ready, but Weavly has <strong>not received a verified payment yet</strong>. Complete or close the checkout to continue.
                                        </p>
                                    </>
                                ) : isRetryable ? (
                                    <>
                                        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                                            <XCircle className="h-3 w-3" /> Payment not completed
                                        </div>
                                        <h2 className="text-2xl font-black tracking-tight leading-[1.1] sm:text-3xl md:text-5xl">No payment was captured.</h2>
                                        <p className="text-surface-muted text-base font-medium">
                                            Your access was not activated. Choose a plan below to retry the checkout safely.
                                        </p>
                                    </>
                                ) : subscription ? (
                                    <>
                                        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                                            <Lock className="h-3 w-3" /> Access suspended
                                        </div>
                                        <h2 className="text-2xl font-black tracking-tight leading-[1.1] sm:text-3xl md:text-5xl">
                                            {subscription?.plan_tier === 'base' ? 'Estimator access expired.' : 'Factory access expired.'}
                                        </h2>
                                        <p className="text-surface-muted text-base font-medium">
                                            {subscription?.plan_tier === 'base'
                                                ? 'Your Estimator workspace period has ended. Renew it to continue creating and exporting costings and customer quotations.'
                                                : 'Your connected factory period has ended. Renew it or choose the plan that matches how you work.'}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <StatusBadge status="info" label="Limited access" icon={Star} className="border-white/20 bg-white/10 text-white" />
                                        <h2 className="text-2xl font-black tracking-tight leading-[1.1] sm:text-3xl md:text-5xl">Choose your Weavly workspace.</h2>
                                        <p className="text-surface-muted text-base font-medium">
                                            Start with the standalone Estimator for costing, saved qualities, and customer quotations.
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : tier === 'trial' ? (
                        <Card className="premium-disclosure-card overflow-hidden border-warning/30 bg-surface">
                            <div className="h-2 w-full bg-warning" />
                            <CardContent className="p-8 md:p-10 space-y-8">
                                <div className="flex flex-col md:flex-row justify-between gap-6">
                                    <div className="space-y-2">
                                        <div className="inline-flex items-center gap-2 rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-warning">
                                            <Timer className="w-3.5 h-3.5" />
                                            Legacy trial access
                                        </div>
                                        <h2 className="text-2xl font-bold tracking-tight text-ink">Temporary Full Suite access</h2>
                                        <p className="text-base font-medium text-body">Full access until {formatDate(subscription?.current_end ?? null)}</p>
                                    </div>
                                    <div className="flex min-w-[200px] flex-col items-center rounded-xl border border-hairline bg-surface-soft p-4 md:items-end">
                                        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-warning">Time remaining</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-5xl font-bold leading-none text-saffron-deep">{trialDaysLeft(subscription?.current_end ?? null)}</span>
                                            <span className="text-xl font-bold text-warning">days</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs font-semibold uppercase tracking-widest text-subtle">
                                        <span>Trial started</span>
                                        <span>{trialProgressPct(subscription?.current_end ?? null)}% elapsed</span>
                                    </div>
                                    <div className="h-3 rounded-full border border-hairline bg-surface-soft p-0.5" role="progressbar" aria-label="Trial elapsed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={trialProgressPct(subscription?.current_end ?? null)}>
                                        <div className="premium-progress-fill h-full w-full rounded-full bg-warning" style={{ transform: `scaleX(${trialProgressPct(subscription?.current_end ?? null) / 100})` }}>
                                            <div className="h-full w-full rounded-full bg-white/20" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 rounded-xl border border-warning/30 bg-warning-soft/45 p-4">
                                    <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-warning" />
                                    <div>
                                        <p className="text-sm font-semibold text-ink">Full access unlocked</p>
                                        <p className="text-sm leading-relaxed text-body">
                                            This access was created under an earlier trial policy. To continue after it ends, choose Weavly Full Suite below. New trials are not currently available.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        /* PREMIUM/BASE ACTIVE STATE INFO */
                        <Card className="premium-disclosure-card gap-0 overflow-hidden p-0">
                            <div className="h-1 w-full bg-saffron" />
                            <CardContent className="p-6 md:p-8">
                                <div className="flex flex-col gap-8 md:flex-row md:justify-between">
                                    <div className="space-y-5">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-subtle">Current plan</p>
                                                <StatusBadge status="active" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-ink">
                                                {tier === 'base'
                                                    ? <Zap className="h-7 w-7 fill-saffron-soft text-saffron" />
                                                    : <Star className="h-7 w-7 fill-warning-soft text-warning" />}
                                                {activePlan?.name ?? 'Weavly Plan'}
                                            </h2>
                                        <p className="mt-2 max-w-lg text-base leading-6 text-body">
                                                {tier === 'base'
                                                    ? 'Your Estimator workspace is active and in good standing. Costing, saved qualities, and customer quotation documents are included.'
                                                    : 'Your Full Suite plan is active and in good standing.'}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 border-t border-hairline pt-5">
                                            <div className="flex flex-col justify-center rounded-lg bg-surface-soft px-4 py-3">
                                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-subtle">Billing period</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-lg font-semibold text-ink">Annual</span>
                                                </div>
                                            </div>
                                            {subscription?.current_end && (
                                                <div className="flex flex-col justify-center rounded-lg bg-saffron-soft px-4 py-3">
                                                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-saffron-deep">Active until</p>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-lg font-semibold text-ink">{formatShortDate(subscription.current_end)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex min-w-[220px] flex-col justify-center rounded-xl bg-loom p-6 text-white">
                                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-surface-muted">Manual renewal</p>
                                        <div className="mb-1 text-3xl font-bold tracking-tight">
                                            {activeRenewalPrice ? formatAmount(activeRenewalPrice.totalPaise) : '—'}
                                        </div>
                                        <p className="text-xs text-surface-muted">total per year from year 2</p>
                                        <p className="mt-2 text-[10px] text-subtle">
                                            {activeRenewalPrice ? `${formatAmount(activeRenewalPrice.basePaise)} + ${formatAmount(activeRenewalPrice.gstPaise)} GST` : ''}
                                        </p>
                                        {renewalAvailable && activePaidTier && activeRenewalPrice ? (
                                            <SubscribeButton
                                                planTier={activePaidTier}
                                                tierName={activePlan?.name}
                                                displayAmount={formatAmount(activeRenewalPrice.totalPaise)}
                                                buttonLabel={`Renew for ${formatAmount(activeRenewalPrice.totalPaise)}`}
                                                successHref="/owner/billing"
                                                successLabel="View payment history"
                                                className="mt-5 shadow-none"
                                            />
                                        ) : renewalEligibleAt && subscription?.current_end ? (
                                            <p className="mt-5 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs leading-relaxed text-surface-muted">
                                                Renewal opens on {formatShortDate(renewalEligibleAt)} ({RENEWAL_ELIGIBILITY_DAYS} days before expiry). No automatic charge will be made.
                                            </p>
                                        ) : (
                                            <p className="mt-5 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs leading-relaxed text-surface-muted">
                                                Renewal is manual. Open Billing again when you are ready to renew.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* 2. PLAN CARDS SECTION (If not premium or if base) */}
                    {(tier !== 'premium' && !isActivating && !isPending) && (
                        <PlanCards
                            label={tier === 'base' ? 'Upgrade to Weavly Full Suite' : 'Select Weavly Estimator'}
                            currentTier={tier}
                            decisions={purchaseDecisions}
                            visibleTiers={visiblePlanTiers}
                        />
                    )}

                    {/* 3. PAYMENT HISTORY - CLEAN & COMPACT */}
                    <div className="space-y-4 pt-2">
                        <SectionHeader icon={ReceiptText} title="Payment history" />
                        {payments && payments.length > 0 ? <Card className="gap-0 overflow-hidden p-0">
                            <div className="divide-y divide-hairline">
                                {(payments as SubscriptionPaymentRow[]).map((p) => (
                                        <div key={p.id} className="group flex flex-col gap-3 p-5 transition-colors hover:bg-surface-soft sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-center gap-5">
                                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                                                    p.status === 'captured'
                                                        ? 'border-success/25 bg-success-soft text-success'
                                                        : 'border-risk/25 bg-risk-soft text-risk'
                                                }`}>
                                                    {p.status === 'captured' ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-sm font-semibold uppercase tracking-tight text-ink">
                                                        {subscriptionById.get(p.subscription_id ?? '')?.plan_tier === 'base'
                                                            ? 'Weavly Estimator'
                                                            : subscriptionById.get(p.subscription_id ?? '')?.plan_tier === 'premium'
                                                                ? 'Weavly Full Suite'
                                                                : 'Weavly payment'} {p.status !== 'captured' && '— Not completed'}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-subtle">
                                                        <span>{formatShortDate(p.captured_at || p.created_at)}</span>
                                                        <span className="text-hairline-strong">/</span>
                                                        <span>{subscriptionById.get(p.subscription_id ?? '')?.checkout_purchase_type === 'renewal' ? 'Annual renewal' : subscriptionById.get(p.subscription_id ?? '')?.checkout_purchase_type === 'initial_purchase' ? 'First-year payment' : 'Subscription payment'}</span>
                                                        <span className="text-hairline-strong">/</span>
                                                        <span className="flex items-center gap-1">
                                                            <ReceiptText className="h-3 w-3" />
                                                            {p.razorpay_payment_id?.slice(-8) || p.id.slice(-8)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-left sm:text-right">
                                                <p className={`text-lg font-bold tracking-tight ${p.status === 'captured' ? 'text-ink' : 'text-risk'}`}>
                                                    {formatAmount(p.amount_paise)}
                                                </p>
                                                <p className="text-[10px] font-semibold uppercase tracking-widest text-subtle">{p.method || 'UNSPECIFIED'}</p>
                                                {p.status === 'captured' && (
                                                    <>
                                                        <Link
                                                            href={`/api/billing/receipt/${p.id}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-saffron-deep hover:underline"
                                                        >
                                                            Download receipt <ArrowRight className="h-3 w-3" />
                                                        </Link>
                                                        <p className="mt-1 text-[10px] text-subtle">Payment receipt only · not a GST tax invoice</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                ))}
                            </div>
                        </Card> : <Card className="border-dashed p-5">
                            <p className="text-sm font-semibold text-ink">No payment history yet.</p>
                            <p className="mt-1 text-sm leading-relaxed text-subtle">Successful payments and downloadable receipts will appear here.</p>
                        </Card>}
                    </div>
                </div>

                {/* Right/Side Column */}
                <div className="space-y-6 lg:col-span-4">
                    
                    {/* REFERRAL CARD */}
                    <Suspense fallback={<ReferralLoading />}>
                        <DeferredReferralSection />
                    </Suspense>

                    {/* QUICK LINKS / HELP */}
                    <Card className="premium-disclosure-card space-y-5 p-5">
                        <div className="flex items-center gap-2">
                             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-soft">
                                <ShieldCheck className="h-4 w-4 text-subtle" />
                             </div>
                             <p className="text-xs font-semibold uppercase tracking-[0.14em] text-body">Billing documents</p>
                        </div>
                        <div className="space-y-4">
                            {latestCapturedPayment ? (
                                <Link
                                    href={`/api/billing/receipt/${latestCapturedPayment.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group flex items-center justify-between rounded-lg border border-hairline bg-surface-soft p-3.5 text-sm font-medium text-body transition-colors hover:border-saffron/50 hover:bg-saffron-soft"
                                >
                                    <span className="flex items-center gap-2">
                                        <ReceiptText className="h-4 w-4 text-subtle" />
                                        Download latest payment receipt
                                    </span>
                                    <ArrowRight className="h-4 w-4 text-hairline-strong transition-all group-hover:translate-x-0.5 group-hover:text-saffron" />
                                </Link>
                            ) : (
                                <p className="rounded-lg border border-hairline bg-surface-soft p-3.5 text-sm leading-relaxed text-subtle">
                                    Payment receipts appear here after a successful payment.
                                </p>
                            )}
                            <BillingDocumentNotice compact />
                        </div>

                        {/* Test mode notice */}
                        {process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.startsWith('rzp_test_') && (
                            <div className="flex items-start gap-3 rounded-xl border border-dashed border-warning/40 bg-warning-soft px-4 py-3">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                                <p className="text-[10px] font-semibold uppercase leading-relaxed tracking-wider text-warning">
                                    Test checkout environment: use test payment details only. No real payment will be captured.
                                </p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    )
}
