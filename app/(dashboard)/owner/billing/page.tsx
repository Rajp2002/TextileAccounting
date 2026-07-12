import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { getSubscriptionDetail } from '@/lib/subscription'
import { SubscribeButton } from '@/components/billing/SubscribeButton'
import { ReferralCard } from '@/components/billing/ReferralCard'
import { getReferralStatsAction } from '../actions'
import {
    CheckCircle2, AlertCircle, Clock, XCircle,
    ShieldCheck, ReceiptText, Star, Zap, Timer, Lock, ArrowRight,
    type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import {
    getBillingPlan,
    getBillingPrice,
    type PurchasablePlanTier,
} from '@/lib/billing-constants'
import {
    resolveBillingPurchase,
    type BillingPaymentRow,
    type BillingPurchaseDecision,
    type BillingSubscriptionRow,
} from '@/lib/billing-lifecycle'

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SubscriptionPaymentRow = {
    id: string
    status: string
    created_at: string | null
    razorpay_payment_id?: string | null
    amount_paise: number
    method?: string | null
    subscription_id: string | null
}

function formatDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        timeZone: 'Asia/Kolkata',
    })
}

function formatShortDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        timeZone: 'Asia/Kolkata',
    })
}

function formatAmount(paise: number): string {
    return `₹${(paise / 100).toLocaleString('en-IN')}`
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
        active:        { label: 'Active',          icon: CheckCircle2, classes: 'bg-emerald-50 text-emerald-700 border-emerald-100 ring-2 ring-emerald-500/10' },
        authenticated: { label: 'Activating',      icon: Clock,        classes: 'bg-blue-50 text-blue-700 border-blue-100 ring-2 ring-blue-500/10' },
        created:       { label: 'Pending Payment', icon: Clock,        classes: 'bg-amber-50 text-amber-700 border-amber-100 ring-2 ring-amber-500/10' },
        halted:        { label: 'Payment Failed',  icon: AlertCircle,  classes: 'bg-red-50 text-red-700 border-red-100 ring-2 ring-red-500/10' },
        cancelled:     { label: 'Cancelled',       icon: XCircle,      classes: 'bg-gray-50 text-gray-700 border-gray-100 ring-2 ring-gray-500/10' },
        completed:     { label: 'Completed',       icon: CheckCircle2, classes: 'bg-gray-50 text-gray-700 border-gray-100 ring-2 ring-gray-500/10' },
    }
    const cfg = config[status] ?? config.cancelled
    const Icon = cfg.icon
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border shadow-sm transition-all hover:scale-105 ${cfg.classes}`}>
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
            renewal: '₹2,000/year + GST (₹2,360/year total)',
            features: ['Estimator workspace', 'Saved qualities', 'Quote history', 'Draft recovery', 'Independent customer access'],
            icon: Zap,
        },
        {
            tier: 'premium' as const,
            name: 'Weavly Full Suite',
            badge: 'Complete factory',
            renewal: '₹7,000/year + GST (₹8,260/year total)',
            features: ['Everything in Estimator', 'Production & order tracking', 'Market runs and godown stock', 'Dispatches', 'Payroll, advances, and analytics'],
            icon: Star,
        },
    ]
        .filter((plan) => currentTier !== 'base' || plan.tier === 'premium')
        .filter((plan) => decisions[plan.tier].allowed)

    return (
        <div className="space-y-6">
            <div className="border-l-4 border-amber-500 pl-4 py-1">
                <h2 className="text-xl font-black text-gray-900 tracking-tight">{label}</h2>
                <p className="text-sm text-gray-500 font-medium">Pricing includes 18% GST.</p>
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
                    <div key={plan.tier} className="group relative rounded-3xl border border-amber-300 bg-gradient-to-br from-amber-50/80 to-white p-8 shadow-xl shadow-amber-500/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                        <span className="absolute -top-3 right-6 rounded-full bg-amber-500 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-amber-500/20">
                            {plan.badge}
                        </span>
                        <div className="flex h-full flex-col gap-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600"><Icon className="h-6 w-6" /></div>
                                    <h3 className="text-xl font-black tracking-tight text-gray-900">{plan.name}</h3>
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-1"><span className="text-4xl font-black tracking-tighter text-gray-900">{total}</span><span className="text-sm font-bold text-gray-400">/{isRenewal ? 'renewal year' : 'first year'}</span></div>
                                    <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-gray-400">{breakdown}</p>
                                </div>
                                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm font-semibold text-gray-700">
                                    <p className="text-amber-800">Renewal from year 2:</p><p className="mt-0.5 text-xs text-gray-600">{plan.renewal}</p>
                                </div>
                            </div>
                            <ul className="flex-1 space-y-3">
                                {plan.features.map((feature) => <li key={feature} className="flex items-start gap-3 text-sm font-medium leading-tight text-gray-600"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50"><CheckCircle2 className="h-3 w-3 text-emerald-600" /></span>{feature}</li>)}
                            </ul>
                            <SubscribeButton
                                planTier={plan.tier}
                                tierName={plan.name}
                                displayAmount={total}
                                buttonLabel={`Pay ${total} & ${isRenewal ? 'Renew' : 'Activate'}`}
                            />
                        </div>
                    </div>
                    )
                })}
            </div>
            <div className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-gray-50/50 border border-gray-100 border-dashed">
                <ShieldCheck className="h-4 w-4 text-gray-400" />
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                    Secure Razorpay checkout · Tenant-scoped data access
                </p>
            </div>
        </div>
    )
}

export default async function BillingPage() {
    const { profile } = await requireRole(['owner'])
    if (!profile.org_id) redirect('/owner/today')

    const supabase = await createClient()
    const { tier, subscription } = await getSubscriptionDetail(profile.org_id)

    const [paymentsResult, subscriptionsResult] = await Promise.all([
        supabase
            .from('subscription_payments')
            .select('*')
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false })
            .limit(10),
        supabase
            .from('org_subscriptions')
            .select('id, plan_tier, status, current_start, current_end, razorpay_payment_id, razorpay_subscription_id, created_at')
            .eq('org_id', profile.org_id),
    ])
    const payments = paymentsResult.data ?? []
    const billingSubscriptions = (subscriptionsResult.data ?? []) as BillingSubscriptionRow[]
    const billingPayments = payments as BillingPaymentRow[]

    // Billing lifecycle is evaluated on the server so expired paid customers
    // see renewal pricing while trials still see first-year pricing.
    const billingNow = new Date()
    const purchaseDecisions: Record<PurchasablePlanTier, BillingPurchaseDecision> = {
        base: resolveBillingPurchase(billingSubscriptions, billingPayments, 'base', billingNow),
        premium: resolveBillingPurchase(billingSubscriptions, billingPayments, 'premium', billingNow),
    }
    const subscriptionTierById = new Map(
        billingSubscriptions.map((row) => [row.id, row.plan_tier])
    )
    const activePaidTier = tier === 'base' || tier === 'premium' ? tier : null
    const activePlan = activePaidTier ? getBillingPlan(activePaidTier) : null
    const activeRenewalPrice = activePaidTier ? getBillingPrice(activePaidTier, 'renewal') : null

    const referralStats = await getReferralStatsAction()

    const isActivating = subscription?.status === 'authenticated' || 
                         (subscription?.status === 'created' && 
                          subscription.razorpay_order_id && 
                          subscription.created_at && 
                          // Server-request clock is intentionally used to expire a stale pending checkout.
                          // eslint-disable-next-line react-hooks/purity
                          new Date(subscription.created_at).getTime() > Date.now() - 15 * 60 * 1000)

    // ── LAYOUT START ───────────────────────────────────────────────────────────
    return (
        <div className="space-y-10 max-w-6xl pb-20">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Billing & Subscription</h1>
                    <p className="text-base text-gray-500 font-medium">Manage your Weavly factory operations plan</p>
                </div>
                {tier !== 'none' && <StatusBadge status={subscription?.status ?? 'active'} />}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left/Main Column - Context Sensitive */}
                <div className="lg:col-span-8 space-y-8">
                    
                    {/* 1. STATE-SPECIFIC HERO CARD */}
                    {tier === 'none' ? (
                        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 p-8 md:p-12 text-white shadow-2xl shadow-indigo-500/20">
                            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                                <Zap className="w-64 h-64 rotate-12" />
                            </div>
                            <div className="relative z-10 space-y-6 max-w-lg">
                                {isActivating ? (
                                    <>
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-400/20 border border-blue-400/30 text-xs font-black uppercase tracking-widest">
                                            <Clock className="w-3 h-3 animate-spin" /> Activating access
                                        </div>
                                        <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.1]">Your factory is coming online.</h2>
                                        <p className="text-indigo-100 text-lg font-medium">
                                            We&apos;ve received your payment. Your selected <strong>Weavly plan</strong> is being configured. Refresh in a few seconds.
                                        </p>
                                    </>
                                ) : subscription ? (
                                    <>
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-400/20 border border-red-400/30 text-xs font-black uppercase tracking-widest text-red-100">
                                            <Lock className="w-3 h-3" /> Access Suspended
                                        </div>
                                        <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.1]">Plan expired.</h2>
                                        <p className="text-indigo-100 text-lg font-medium">
                                            Your account access has been paused. Renew your current plan or choose the plan that matches how you work.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-400/20 border border-indigo-400/30 text-xs font-black uppercase tracking-widest">
                                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> Limited Access
                                        </div>
                                        <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.1]">Choose your Weavly workspace.</h2>
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
                                            Free Trial Active
                                        </div>
                                        <h2 className="text-3xl font-black tracking-tight text-gray-900">Experience Weavly Premium</h2>
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
                                            You are enjoying full Premium features. To prevent service disruption after the trial ends, you can upgrade to Weavly Full Suite below today.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        /* PREMIUM/BASE ACTIVE STATE INFO */
                        <Card className="rounded-[2.5rem] border-gray-100 shadow-xl shadow-gray-200/30 overflow-hidden bg-white">
                            <div className="h-2 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600" />
                            <CardContent className="p-8 md:p-10 space-y-10">
                                <div className="flex flex-col md:flex-row justify-between gap-10">
                                    <div className="space-y-6">
                                        <div className="scale-110 origin-left">
                                            <StatusBadge status={subscription?.status ?? 'active'} />
                                        </div>
                                        <div className="space-y-1">
                                            <h2 className="text-4xl font-black tracking-tight text-gray-900 flex items-center gap-3">
                                                {tier === 'base'
                                                    ? <Zap className="w-8 h-8 text-amber-500 fill-amber-400" />
                                                    : <Star className="w-8 h-8 text-amber-500 fill-amber-400" />}
                                                {activePlan?.name ?? 'Weavly Plan'}
                                            </h2>
                                            <p className="text-lg text-gray-500 font-medium">
                                                {tier === 'base'
                                                    ? 'Your standalone Estimator plan is active and in good standing.'
                                                    : 'Your Full Suite plan is active and in good standing.'}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-4 pt-2">
                                            <div className="px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm flex flex-col justify-center">
                                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Billing Period</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-black text-gray-900">Annual</span>
                                                </div>
                                            </div>
                                            {subscription?.current_end && (
                                                <div className="px-5 py-3 rounded-2xl bg-orange-50 border border-orange-100 shadow-sm flex flex-col justify-center">
                                                    <p className="text-[10px] text-orange-600 font-black uppercase tracking-widest mb-1">Renewal Due / Active Until</p>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-2xl font-black text-orange-900 tracking-tighter">{formatShortDate(subscription.current_end)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-8 rounded-[2rem] bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-2xl shadow-gray-400/20 min-w-[220px]">
                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-4">Renewal Rate</p>
                                        <div className="text-4xl font-black tracking-tighter mb-1 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                                            {activeRenewalPrice ? formatAmount(activeRenewalPrice.totalPaise) : '—'}
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">/year from year 2</p>
                                        <p className="text-[9px] text-gray-500 mt-2 font-bold uppercase">
                                            {activeRenewalPrice ? `${formatAmount(activeRenewalPrice.basePaise)}/yr + GST` : ''}
                                        </p>
                                        {activePaidTier && activeRenewalPrice && (
                                            <SubscribeButton
                                                planTier={activePaidTier}
                                                tierName={activePlan?.name}
                                                displayAmount={formatAmount(activeRenewalPrice.totalPaise)}
                                                buttonLabel={`Renew for ${formatAmount(activeRenewalPrice.totalPaise)}`}
                                                className="mt-5 shadow-none"
                                            />
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* 2. PLAN CARDS SECTION (If not premium or if base) */}
                    {(tier !== 'premium' && !isActivating) && (
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
                                <h3 className="text-xl font-black text-gray-900 tracking-tight">Recent Invoices</h3>
                            </div>
                            <div className="rounded-[2rem] border border-gray-100 bg-white shadow-sm overflow-hidden">
                                <div className="divide-y divide-gray-50">
                                    {(payments as SubscriptionPaymentRow[]).map((p) => (
                                        <div key={p.id} className="group flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
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
                                                        {subscriptionTierById.get(p.subscription_id ?? '') === 'base'
                                                            ? 'Weavly Estimator'
                                                            : 'Weavly Full Suite'} {p.status !== 'captured' && '— Failed'}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                                                        <span>{formatShortDate(p.created_at)}</span>
                                                        <span className="text-gray-200">/</span>
                                                        <span className="flex items-center gap-1">
                                                            <ReceiptText className="h-3 w-3" />
                                                            {p.razorpay_payment_id?.slice(-8) || p.id.slice(-8)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-lg font-black tracking-tight ${p.status === 'captured' ? 'text-gray-900' : 'text-red-600'}`}>
                                                    {formatAmount(p.amount_paise)}
                                                </p>
                                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{p.method || 'UNSPECIFIED'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right/Side Column */}
                <div className="lg:col-span-4 space-y-8">
                    
                    {/* REFERRAL CARD */}
                    <ReferralCard stats={referralStats} />

                    {/* QUICK LINKS / HELP */}
                    <Card className="rounded-[2.5rem] border-gray-100/50 bg-gray-50/50 shadow-sm p-6 space-y-6">
                        <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-xl bg-gray-200/50 flex items-center justify-center">
                                <ShieldCheck className="h-4 w-4 text-gray-600" />
                             </div>
                             <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Billing Support</p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-100 text-sm font-bold text-gray-700 hover:border-gray-300 transition-all cursor-pointer group">
                                <span className="flex items-center gap-2">
                                    <ReceiptText className="w-4 h-4 text-gray-400" />
                                    Download Invoices
                                </span>
                                <ArrowRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-all" />
                            </div>
                        </div>
                        
                        {/* Test mode notice */}
                        {process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.startsWith('rzp_test_') && (
                            <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider leading-relaxed">
                                    🧪 Test Mode Active: Use card 4111-1111-1111-1111 for test payments.
                                </p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    )
}
