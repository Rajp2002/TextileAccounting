import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { getSubscriptionDetail } from '@/lib/subscription'
import { SubscribeButton } from '@/components/billing/SubscribeButton'
import { TrialButton } from '@/components/billing/TrialButton'
import {
    CheckCircle2, AlertCircle, Clock, XCircle,
    ShieldCheck, ReceiptText, Star, Zap, Timer, Lock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { redirect } from 'next/navigation'

// ─── Plan definitions ─────────────────────────────────────────────────────────

const PLANS = [
    {
        tier: 'base' as const,
        name: 'Base',
        planIdEnv: process.env.RAZORPAY_PLAN_ID_BASE ?? '',
        basePrice: '₹2,000',
        gst: '₹360',
        total: '₹2,360',
        features: [
            'Loomi Estimator',
            'Basic order cost calculations',
            'Single owner account',
        ],
        highlight: false,
        icon: Zap,
    },
    {
        tier: 'premium' as const,
        name: 'Premium',
        planIdEnv: process.env.RAZORPAY_PLAN_ID_PREMIUM ?? '',
        basePrice: '₹5,000',
        gst: '₹900',
        total: '₹5,900',
        features: [
            'Everything in Base',
            'Production & order tracking',
            'Payroll & advances',
            'Daily WhatsApp briefs',
            'Analytics & reports',
            'Unlimited machines & workers',
            'Priority support',
        ],
        highlight: true,
        icon: Star,
    },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
}

function formatShortDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
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
    const config: Record<string, { label: string; icon: any; classes: string }> = {
        active:        { label: 'Active',          icon: CheckCircle2, classes: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
        authenticated: { label: 'Activating',      icon: Clock,        classes: 'bg-blue-100 text-blue-800 border-blue-200' },
        created:       { label: 'Pending Payment', icon: Clock,        classes: 'bg-amber-100 text-amber-800 border-amber-200' },
        halted:        { label: 'Payment Failed',  icon: AlertCircle,  classes: 'bg-red-100 text-red-800 border-red-200' },
        cancelled:     { label: 'Cancelled',       icon: XCircle,      classes: 'bg-gray-100 text-gray-700 border-gray-200' },
        completed:     { label: 'Completed',       icon: CheckCircle2, classes: 'bg-gray-100 text-gray-700 border-gray-200' },
    }
    const cfg = config[status] ?? config.cancelled
    const Icon = cfg.icon
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.classes}`}>
            <Icon className="h-3.5 w-3.5" />
            {cfg.label}
        </span>
    )
}

// ─── Plan Cards — shared between blocked + trial states ───────────────────────

function PlanCards({ label }: { label: string }) {
    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">{label}</h2>
                <p className="text-sm text-gray-500">All prices include 18% GST. Cancel anytime.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PLANS.map((plan) => {
                    const Icon = plan.icon
                    return (
                        <div
                            key={plan.tier}
                            className={`relative rounded-2xl border p-6 flex flex-col gap-5 ${
                                plan.highlight
                                    ? 'border-amber-400 bg-amber-50/40 shadow-md shadow-amber-100'
                                    : 'border-gray-200 bg-white shadow-sm'
                            }`}
                        >
                            {plan.highlight && (
                                <span className="absolute -top-3 right-4 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                                    Most Popular
                                </span>
                            )}
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon className={`h-5 w-5 ${plan.highlight ? 'text-amber-500 fill-amber-400' : 'text-amber-600'}`} />
                                    <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
                                </div>
                                <div className="flex items-end gap-1">
                                    <span className="text-3xl font-extrabold text-gray-900">{plan.total}</span>
                                    <span className="text-gray-500 text-sm mb-1">/month</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {plan.basePrice} + {plan.gst} GST (18%)
                                </p>
                            </div>
                            <ul className="space-y-2 flex-1">
                                {plan.features.map((f) => (
                                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            {plan.planIdEnv ? (
                                <SubscribeButton
                                    planId={plan.planIdEnv}
                                    tierName={plan.name}
                                    displayAmount={`${plan.total}/mo`}
                                />
                            ) : (
                                <p className="text-xs text-center text-gray-400">Coming soon</p>
                            )}
                        </div>
                    )
                })}
            </div>
            <p className="text-xs text-gray-400 text-center">
                Payments secured by Razorpay. Auto-renews monthly.
            </p>
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BillingPage() {
    const { profile } = await requireRole(['owner'])
    if (!profile.org_id) redirect('/owner/analytics')

    const supabase = await createClient()
    const { tier, subscription } = await getSubscriptionDetail(profile.org_id)

    // Fetch recent payments
    const { data: payments } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(12)

    const activePlanDef = subscription?.plan_tier
        ? PLANS.find(p => p.tier === subscription.plan_tier)
        : null

    // ── BLOCKED STATE (no subscription) ──────────────────────────────────────
    if (tier === 'none') {
        return (
            <div className="space-y-8 max-w-3xl pb-10">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Choose a plan to unlock Loomi</p>
                </div>

                {/* Blocking banner */}
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 flex items-start gap-4">
                    <Lock className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-red-900">Your access has expired</p>
                        <p className="text-sm text-red-700 mt-1">
                            {subscription?.plan_tier === 'trial'
                                ? 'Your 7-day free trial has ended. Subscribe to continue using Loomi.'
                                : 'Your subscription is no longer active. Renew to restore access.'}
                        </p>
                    </div>
                </div>

                {/* Trial CTA — only if they haven't already had a trial */}
                {(!subscription || subscription.plan_tier !== 'trial') && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <p className="font-semibold text-emerald-900 flex items-center gap-2">
                                <Timer className="h-4 w-4" />
                                Start your 7-day free trial
                            </p>
                            <p className="text-sm text-emerald-700 mt-1">
                                Full Premium access. No credit card required.
                            </p>
                        </div>
                        <TrialButton />
                    </div>
                )}

                <PlanCards label="Choose a subscription plan" />
            </div>
        )
    }

    // ── TRIAL STATE ───────────────────────────────────────────────────────────
    if (tier === 'trial') {
        const daysLeft = trialDaysLeft(subscription?.current_end ?? null)
        const progressPct = trialProgressPct(subscription?.current_end ?? null)
        const endDate = formatDate(subscription?.current_end ?? null)

        return (
            <div className="space-y-8 max-w-3xl pb-10">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Manage your Loomi subscription</p>
                </div>

                {/* Trial countdown card */}
                <Card className="shadow-sm border-amber-200 overflow-hidden">
                    <div className="h-1 w-full bg-gradient-to-r from-amber-300 to-amber-500" />
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Timer className="h-5 w-5 text-amber-600" />
                                <CardTitle>Free Trial — Premium Access</CardTitle>
                            </div>
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-amber-100 text-amber-800 border-amber-200">
                                <Clock className="h-3.5 w-3.5" />
                                {daysLeft === 0 ? 'Expires today' : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {/* Visual trial end date */}
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <p className="text-sm font-medium text-amber-900 flex items-center gap-2">
                                <Clock className="h-4 w-4 shrink-0" />
                                Your trial ends on{' '}
                                <strong>{endDate}</strong>
                            </p>
                            <p className="text-xs text-amber-700 mt-1">
                                After this date, you'll need an active subscription to continue.
                            </p>
                        </div>

                        {/* Progress bar */}
                        <div>
                            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                                <span>Trial started</span>
                                <span>{progressPct}% used</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all"
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                                <span>Day 1</span>
                                <span>Day 7</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                            <ShieldCheck className="h-4 w-4 shrink-0" />
                            You have full Premium access during your trial. Subscribe below to keep it after {formatShortDate(subscription?.current_end ?? null)}.
                        </div>
                    </CardContent>
                </Card>

                <PlanCards label="Subscribe before your trial ends" />
            </div>
        )
    }

    // ── ACTIVE SUBSCRIPTION STATE (base or premium) ───────────────────────────
    return (
        <div className="space-y-8 max-w-3xl pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
                <p className="text-sm text-gray-500 mt-0.5">Manage your Loomi monthly subscription</p>
            </div>

            {/* Current Plan Summary */}
            <Card className="shadow-sm border-gray-200 overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-amber-600" />
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {tier === 'premium'
                                ? <Star className="h-5 w-5 text-amber-500 fill-amber-400" />
                                : <Zap className="h-5 w-5 text-amber-600" />
                            }
                            <CardTitle>Loomi {activePlanDef?.name ?? tier.charAt(0).toUpperCase() + tier.slice(1)} Plan</CardTitle>
                        </div>
                        <StatusBadge status={subscription?.status ?? 'active'} />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                            <p className="text-xs text-gray-500 font-medium">Monthly</p>
                            <p className="text-lg font-bold text-gray-900">{activePlanDef?.total ?? '—'}</p>
                            <p className="text-[11px] text-gray-400">{activePlanDef?.basePrice} + 18% GST</p>
                        </div>
                        {subscription?.current_end && (
                            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                                <p className="text-xs text-gray-500 font-medium">Next renewal</p>
                                <p className="text-sm font-semibold text-gray-900">{formatShortDate(subscription.current_end)}</p>
                            </div>
                        )}
                        {subscription?.paid_count != null && (
                            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                                <p className="text-xs text-gray-500 font-medium">Months paid</p>
                                <p className="text-sm font-semibold text-gray-900">
                                    {subscription.paid_count} / {subscription.total_count ?? 12}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                        Subscription active — auto-renews via your registered payment method.
                    </div>

                    {/* Upgrade nudge for base plan users */}
                    {tier === 'base' && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                            <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                                <Star className="h-4 w-4 text-amber-500" />
                                Upgrade to Premium for full access
                            </p>
                            <p className="text-xs text-amber-700">
                                Your Base plan includes the Estimator. Upgrade to unlock production tracking, payroll, WhatsApp briefs, analytics, and more.
                            </p>
                            {process.env.RAZORPAY_PLAN_ID_PREMIUM && (
                                <SubscribeButton
                                    planId={process.env.RAZORPAY_PLAN_ID_PREMIUM}
                                    tierName="Premium"
                                    displayAmount="₹5,900/mo"
                                />
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Payment History */}
            {payments && payments.length > 0 && (
                <Card className="shadow-sm border-gray-200">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <ReceiptText className="h-5 w-5 text-gray-600" />
                            <CardTitle>Payment History</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="divide-y divide-gray-100">
                            {payments.map((p: any) => (
                                <div key={p.id} className="flex items-center justify-between py-3 gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                                            p.status === 'captured'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}>
                                            {p.status === 'captured'
                                                ? <CheckCircle2 className="h-4 w-4" />
                                                : <XCircle className="h-4 w-4" />
                                            }
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-900">
                                                {p.status === 'captured' ? 'Payment captured' : 'Payment failed'}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {formatShortDate(p.created_at)}
                                                {p.method && ` · ${p.method.toUpperCase()}`}
                                            </p>
                                        </div>
                                    </div>
                                    <p className={`text-sm font-bold shrink-0 ${
                                        p.status === 'captured' ? 'text-gray-900' : 'text-red-600'
                                    }`}>
                                        {formatAmount(p.amount_paise)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Test mode notice */}
            {process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.startsWith('rzp_test_') && (
                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-4 py-3">
                    <p className="text-xs text-amber-700 font-medium">
                        🧪 Test mode — card <span className="font-mono">4111 1111 1111 1111</span>, any future expiry, CVV <span className="font-mono">123</span>.
                    </p>
                </div>
            )}
        </div>
    )
}
