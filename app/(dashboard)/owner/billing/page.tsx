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
    ShieldCheck, ReceiptText, Star, Zap, Timer, Lock, ArrowRight,
    type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
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

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; icon: LucideIcon; classes: string }> = {
        active:        { label: 'Active',          icon: CheckCircle2, classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        authenticated: { label: 'Activating',      icon: Clock,        classes: 'bg-blue-50 text-blue-700 border-blue-200' },
        created:       { label: 'Pending Payment', icon: Clock,        classes: 'bg-amber-50 text-amber-700 border-amber-200' },
        halted:        { label: 'Payment Failed',  icon: AlertCircle,  classes: 'bg-red-50 text-red-700 border-red-200' },
        cancelled:     { label: 'Cancelled',       icon: XCircle,      classes: 'bg-slate-50 text-slate-700 border-slate-200' },
        completed:     { label: 'Completed',       icon: CheckCircle2, classes: 'bg-slate-50 text-slate-700 border-slate-200' },
    }
    const cfg = config[status] ?? config.cancelled
    const Icon = cfg.icon
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.classes}`}>
            <Icon className="h-3.5 w-3.5" />
            {cfg.label}
        </span>
    )
}

function PlanCards({
    label,
    currentTier,
    decisions,
}: {
    label: string
    currentTier: string
    decisions: Record<PurchasablePlanTier, BillingPurchaseDecision>
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
        .filter((plan) => currentTier !== 'base' || plan.tier === 'premium')
        .filter((plan) => decisions[plan.tier].allowed)

    return (
        <div className="space-y-5">
            <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Plans</p>
                <h2 className="text-2xl font-bold tracking-tight text-slate-950">{label}</h2>
                <p className="mt-1 text-sm text-slate-500">Clear annual pricing. 18% GST is included in every total shown.</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
                {plans.map((plan) => {
                    const Icon = plan.icon
                    const decision = decisions[plan.tier]
                    const price = getBillingPrice(plan.tier, decision.purchaseType)
                    const total = formatAmount(price.totalPaise)
                    const breakdown = `${formatAmount(price.basePaise)} + ${formatAmount(price.gstPaise)} GST (18%)`
                    const isRenewal = decision.purchaseType === 'renewal'
                    return (
                    <div key={plan.tier} className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-orange-300">
                        <span className="absolute right-5 top-5 rounded-full bg-orange-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-orange-700">
                            {plan.badge}
                        </span>
                        <div className="flex h-full flex-col gap-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 pr-24">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-orange-400"><Icon className="h-5 w-5" /></div>
                                    <h3 className="text-lg font-bold tracking-tight text-slate-950">{plan.name}</h3>
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-1"><span className="text-3xl font-bold tracking-tight text-slate-950">{total}</span><span className="text-sm text-slate-500">/{isRenewal ? 'renewal year' : 'first year'}</span></div>
                                    <p className="mt-1 text-xs text-slate-500">{breakdown}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700">
                                    <p>Manual renewal from year 2</p><p className="mt-0.5 text-xs text-slate-500">{plan.renewal}</p>
                                </div>
                            </div>
                            <ul className="flex-1 space-y-3">
                                {plan.features.map((feature) => <li key={feature} className="flex items-start gap-3 text-sm leading-tight text-slate-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{feature}</li>)}
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
            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <ShieldCheck className="h-4 w-4 text-slate-400" />
                <p className="text-xs font-medium text-slate-500">
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

    const query = searchParams ? await searchParams : {}
    const requestedRoute = typeof query.from === 'string' ? query.from : null
    const requestedFeature = getFeatureLabel(requestedRoute)

    const supabase = await createClient()
    const { tier, subscription } = await getSubscriptionDetail(profile.org_id)

    const [paymentsResult, subscriptionsResult, attemptsResult] = await Promise.all([
        supabase
            .from('subscription_payments')
            .select('*')
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

    const referralStats = await getReferralStatsAction()

    const checkoutPresentation = resolveBillingCheckoutPresentation(
        billingSubscriptions,
        billingPayments,
        billingNow,
    )
    const isActivating = checkoutPresentation.state === 'activating'
    const isPending = checkoutPresentation.state === 'pending'
    const isRetryable = checkoutPresentation.state === 'retryable'
    const activeRenewalDecision = activePaidTier ? purchaseDecisions[activePaidTier] : null
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
        <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-20 sm:px-6 lg:px-0">
            {/* Header Area */}
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Account</p>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Billing & Plan</h1>
                    <p className="mt-2 text-sm text-slate-500">See your plan, payment status, manual renewal, and payment receipts.</p>
                    <BillingDocumentNotice />
                    {requestedFeature && tier === 'none' && (
                        <p className="mt-2 text-sm font-semibold text-orange-700">
                            You arrived here from {requestedFeature}. Choose a plan to unlock it.
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Link href="/owner/data-export" className="text-sm font-semibold text-blue-700 underline-offset-4 hover:underline">Export organization data</Link>
                    {tier !== 'none' && !latestAttempt?.status?.match(/processing|unknown|authorized|activation_pending|reconciliation_required|duplicate/) && <StatusBadge status="active" />}
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                
                {/* Left/Main Column - Context Sensitive */}
                <div className="space-y-6 lg:col-span-8">
                    {latestAttempt && latestAttempt.status !== 'activated' && latestAttempt.status !== 'failed' && latestAttempt.status !== 'cancelled' && latestAttempt.status !== 'refunded' && (
                        <BillingAttemptStatus attempt={latestAttempt} />
                    )}
                    
                    {/* 1. STATE-SPECIFIC HERO CARD */}
                    {tier === 'none' ? (
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 p-6 text-white shadow-2xl shadow-indigo-500/20 sm:rounded-[2.5rem] sm:p-8 md:p-12">
                            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                                <Zap className="w-64 h-64 rotate-12" />
                            </div>
                            <div className="relative z-10 space-y-6 max-w-lg">
                                {isActivating ? (
                                    <>
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-400/20 border border-blue-400/30 text-xs font-black uppercase tracking-widest">
                                            <Clock className="w-3 h-3 animate-spin" /> Activating access
                                        </div>
                                        <h2 className="text-2xl font-black tracking-tight leading-[1.1] sm:text-3xl md:text-5xl">Your factory is coming online.</h2>
                                        <p className="text-indigo-100 text-lg font-medium">
                                            We&apos;ve received your payment. Your selected <strong>Weavly plan</strong> is being configured. Refresh in a few seconds.
                                        </p>
                                    </>
                                ) : isPending ? (
                                    <>
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/30 text-xs font-black uppercase tracking-widest">
                                            <Clock className="w-3 h-3 animate-spin" /> Checkout pending
                                        </div>
                                        <h2 className="text-2xl font-black tracking-tight leading-[1.1] sm:text-3xl md:text-5xl">Complete payment in Razorpay.</h2>
                                        <p className="text-indigo-100 text-lg font-medium">
                                            Your order is ready, but Weavly has <strong>not received a verified payment yet</strong>. Complete or close the checkout to continue.
                                        </p>
                                    </>
                                ) : isRetryable ? (
                                    <>
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-400/20 border border-red-400/30 text-xs font-black uppercase tracking-widest text-red-100">
                                            <XCircle className="w-3 h-3" /> Payment not completed
                                        </div>
                                        <h2 className="text-2xl font-black tracking-tight leading-[1.1] sm:text-3xl md:text-5xl">No payment was captured.</h2>
                                        <p className="text-indigo-100 text-lg font-medium">
                                            Your access was not activated. Choose a plan below to retry the checkout safely.
                                        </p>
                                    </>
                                ) : subscription ? (
                                    <>
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-400/20 border border-red-400/30 text-xs font-black uppercase tracking-widest text-red-100">
                                            <Lock className="w-3 h-3" /> Access Suspended
                                        </div>
                                        <h2 className="text-2xl font-black tracking-tight leading-[1.1] sm:text-3xl md:text-5xl">
                                            {subscription?.plan_tier === 'base' ? 'Estimator access expired.' : 'Factory access expired.'}
                                        </h2>
                                        <p className="text-indigo-100 text-lg font-medium">
                                            {subscription?.plan_tier === 'base'
                                                ? 'Your Estimator workspace period has ended. Renew it to continue creating and exporting costings and customer quotations.'
                                                : 'Your connected factory period has ended. Renew it or choose the plan that matches how you work.'}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-400/20 border border-indigo-400/30 text-xs font-black uppercase tracking-widest">
                                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> Limited Access
                                        </div>
                                        <h2 className="text-2xl font-black tracking-tight leading-[1.1] sm:text-3xl md:text-5xl">Choose your Weavly workspace.</h2>
                                        <p className="text-indigo-100 text-lg font-medium">
                                            Start with the standalone Estimator for costing and quotes, or choose Full Suite for production, stock, dispatch, and payroll.
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : tier === 'trial' ? (
                        <Card className="rounded-[2.5rem] border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-xl shadow-amber-500/5 overflow-hidden">
                            <div className="h-2 w-full bg-gradient-to-r from-amber-400 to-amber-600" />
                            <CardContent className="p-8 md:p-10 space-y-8">
                                <div className="flex flex-col md:flex-row justify-between gap-6">
                                    <div className="space-y-2">
                                        <div className="inline-flex items-center gap-2 text-xs font-black text-amber-700 bg-amber-200/40 px-3 py-1 rounded-full uppercase tracking-wider">
                                            <Timer className="w-3.5 h-3.5" />
                                            Legacy trial access
                                        </div>
                                        <h2 className="text-3xl font-black tracking-tight text-gray-900">Temporary Full Suite access</h2>
                                        <p className="text-gray-500 font-medium text-lg">Full access until {formatDate(subscription?.current_end ?? null)}</p>
                                    </div>
                                    <div className="flex flex-col items-center md:items-end p-4 rounded-3xl bg-white shadow-sm border border-amber-100 min-w-[200px]">
                                        <p className="text-xs text-amber-600 font-black uppercase tracking-widest mb-1">Time Remaining</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-5xl font-black text-amber-700 leading-none">{trialDaysLeft(subscription?.current_end ?? null)}</span>
                                            <span className="text-xl font-bold text-amber-600">DAYS</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs font-black text-gray-400 uppercase tracking-widest">
                                        <span>Trial Started</span>
                                        <span>{trialProgressPct(subscription?.current_end ?? null)}% Elapsed</span>
                                    </div>
                                    <div className="h-4 bg-gray-100 rounded-full p-1 border shadow-inner">
                                        <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-1000" style={{ width: `${trialProgressPct(subscription?.current_end ?? null)}%` }}>
                                            <div className="h-full w-full bg-white/20 animate-pulse rounded-full" />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-200/50 flex items-start gap-4">
                                    <ShieldCheck className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-amber-900">Full Access Unlocked</p>
                                        <p className="text-sm text-amber-700/80 leading-relaxed">
                                            This access was created under an earlier trial policy. To continue after it ends, choose Weavly Full Suite below. New trials are not currently available.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        /* PREMIUM/BASE ACTIVE STATE INFO */
                        <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
                            <div className="h-1 w-full bg-orange-500" />
                            <CardContent className="p-6 md:p-8">
                                <div className="flex flex-col gap-8 md:flex-row md:justify-between">
                                    <div className="space-y-5">
                                        <div>
                                            <StatusBadge status="active" />
                                        </div>
                                        <div className="space-y-1">
                                            <h2 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-slate-950">
                                                {tier === 'base'
                                                    ? <Zap className="w-8 h-8 text-amber-500 fill-amber-400" />
                                                    : <Star className="w-8 h-8 text-amber-500 fill-amber-400" />}
                                                {activePlan?.name ?? 'Weavly Plan'}
                                            </h2>
                                        <p className="mt-2 max-w-lg text-base leading-6 text-slate-500">
                                                {tier === 'base'
                                                    ? 'Your Estimator workspace is active and in good standing. Costing, saved qualities, and customer quotation documents are included.'
                                                    : 'Your Full Suite plan is active and in good standing.'}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-5">
                                            <div className="flex flex-col justify-center rounded-xl bg-slate-50 px-4 py-3">
                                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Billing Period</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-lg font-semibold text-slate-950">Annual</span>
                                                </div>
                                            </div>
                                            {subscription?.current_end && (
                                                <div className="flex flex-col justify-center rounded-xl bg-orange-50 px-4 py-3">
                                                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-orange-700">Active Until</p>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-lg font-semibold text-orange-950">{formatShortDate(subscription.current_end)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex min-w-[220px] flex-col justify-center rounded-2xl bg-slate-950 p-6 text-white">
                                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Manual renewal</p>
                                        <div className="mb-1 text-3xl font-bold tracking-tight">
                                            {activeRenewalPrice ? formatAmount(activeRenewalPrice.totalPaise) : '—'}
                                        </div>
                                        <p className="text-xs text-slate-400">total per year from year 2</p>
                                        <p className="mt-2 text-[10px] text-slate-500">
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
                                            <p className="mt-5 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs leading-relaxed text-slate-300">
                                                Renewal opens on {formatShortDate(renewalEligibleAt)} ({RENEWAL_ELIGIBILITY_DAYS} days before expiry). No automatic charge will be made.
                                            </p>
                                        ) : (
                                            <p className="mt-5 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs leading-relaxed text-slate-300">
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
                        <div className="pt-4">
                            <PlanCards
                                label={tier === 'base' ? 'Upgrade to Weavly Full Suite' : 'Select your Weavly Plan'}
                                currentTier={tier}
                                decisions={purchaseDecisions}
                            />
                        </div>
                    )}

                    {/* 3. PAYMENT HISTORY - CLEAN & COMPACT */}
                    {payments && payments.length > 0 && (
                        <div className="space-y-6 pt-6">
                            <div className="flex items-center gap-2 border-l-4 border-gray-400 pl-4 py-1">
                                <ReceiptText className="h-5 w-5 text-gray-500" />
                                <h3 className="text-xl font-black text-gray-900 tracking-tight">Payment history</h3>
                            </div>
                            <div className="rounded-[2rem] border border-gray-100 bg-white shadow-sm overflow-hidden">
                                <div className="divide-y divide-gray-50">
                                    {(payments as SubscriptionPaymentRow[]).map((p) => (
                                        <div key={p.id} className="group flex flex-col gap-3 p-5 hover:bg-gray-50 transition-colors sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-center gap-5">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                                                    p.status === 'captured'
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                        : 'bg-red-50 text-red-600 border-red-100'
                                                }`}>
                                                    {p.status === 'captured' ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-sm font-black text-gray-900 uppercase tracking-tight">
                                                        {subscriptionById.get(p.subscription_id ?? '')?.plan_tier === 'base'
                                                            ? 'Weavly Estimator'
                                                            : subscriptionById.get(p.subscription_id ?? '')?.plan_tier === 'premium'
                                                                ? 'Weavly Full Suite'
                                                                : 'Weavly payment'} {p.status !== 'captured' && '— Not completed'}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                                                        <span>{formatShortDate(p.captured_at || p.created_at)}</span>
                                                        <span className="text-gray-200">/</span>
                                                        <span>{subscriptionById.get(p.subscription_id ?? '')?.checkout_purchase_type === 'renewal' ? 'Annual renewal' : subscriptionById.get(p.subscription_id ?? '')?.checkout_purchase_type === 'initial_purchase' ? 'First-year payment' : 'Subscription payment'}</span>
                                                        <span className="text-gray-200">/</span>
                                                        <span className="flex items-center gap-1">
                                                            <ReceiptText className="h-3 w-3" />
                                                            {p.razorpay_payment_id?.slice(-8) || p.id.slice(-8)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-left sm:text-right">
                                                <p className={`text-lg font-black tracking-tight ${p.status === 'captured' ? 'text-gray-900' : 'text-red-600'}`}>
                                                    {formatAmount(p.amount_paise)}
                                                </p>
                                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{p.method || 'UNSPECIFIED'}</p>
                                                {p.status === 'captured' && (
                                                    <>
                                                        <Link
                                                            href={`/api/billing/receipt/${p.id}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-orange-700 hover:underline"
                                                        >
                                                            Download receipt <ArrowRight className="h-3 w-3" />
                                                        </Link>
                                                        <p className="mt-1 text-[10px] text-slate-400">Payment receipt only · not a GST tax invoice</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right/Side Column */}
                <div className="space-y-6 lg:col-span-4">
                    
                    {/* REFERRAL CARD */}
                    <ReferralCard stats={referralStats} />

                    {/* QUICK LINKS / HELP */}
                    <Card className="space-y-5 rounded-2xl border-slate-200 bg-white p-5 shadow-none">
                        <div className="flex items-center gap-2">
                             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                                <ShieldCheck className="h-4 w-4 text-gray-600" />
                             </div>
                             <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">Billing documents</p>
                        </div>
                        <div className="space-y-4">
                            {latestCapturedPayment ? (
                                <Link
                                    href={`/api/billing/receipt/${latestCapturedPayment.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-medium text-slate-700 transition-colors hover:border-orange-300 hover:bg-orange-50"
                                >
                                    <span className="flex items-center gap-2">
                                        <ReceiptText className="w-4 h-4 text-gray-400" />
                                        Download latest payment receipt
                                    </span>
                                    <ArrowRight className="w-4 h-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-orange-600" />
                                </Link>
                            ) : (
                                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-500">
                                    Payment receipts appear here after a successful payment.
                                </p>
                            )}
                            <BillingDocumentNotice compact />
                        </div>

                        {/* Test mode notice */}
                        {process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.startsWith('rzp_test_') && (
                            <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider leading-relaxed">
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
