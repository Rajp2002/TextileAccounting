import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { getCachedOrgPlanAccess, getSubscriptionDetail } from '@/lib/subscription'
import { SubscribeButton } from '@/components/billing/SubscribeButton'
import { UpgradeWall } from '@/components/billing/UpgradeWall'
import { BillingAttemptStatus } from '@/components/billing/BillingAttemptStatus'
import { BillingDocumentNotice } from '@/components/billing/BillingDocumentNotice'
import { PaymentHistoryDialog, type BillingHistoryEntry, type BillingHistoryStatus } from '@/components/billing/PaymentHistoryDialog'
import { ReferralCard } from '@/components/billing/ReferralCard'
import { getReferralStatsAction } from '../actions'
import {
    AlertCircle, ChevronDown, Clock, XCircle,
    ShieldCheck, Star, Zap, Timer, Lock, CreditCard,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
    BILLING_SELF_SERVE_PLAN_TIERS,
    getBillingPlan,
    getBillingPrice,
    isSelfServePlanTier,
    type BillingPlanTier,
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
import { getBillingReadiness } from '@/lib/billing-readiness'
import { RouteMilestones } from '@/components/performance/route-milestones'
import { Suspense } from 'react'
import { PageHeader, StatusBadge } from '@/components/ui/page-header'
import PlanAnalyticsBeacon from '@/components/billing/PlanAnalyticsBeacon'

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
    billing_attempt_id?: string | null
}

type BillingAttemptHistoryRow = BillingAttemptRow & {
    total_amount_paise?: number | null
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

function normalizePaymentHistoryStatus(status: string): BillingHistoryStatus {
    if (status === 'captured') return 'captured'
    if (status === 'failed') return 'failed'
    if (status === 'refunded') return 'refunded'
    return 'incomplete'
}

function normalizeAttemptHistoryStatus(status: string): BillingHistoryStatus {
    if (status === 'activated' || status === 'captured') return 'captured'
    if (status === 'refunded') return 'refunded'
    if (status === 'failed' || status === 'cancelled') return 'failed'
    return 'incomplete'
}

function buildBillingHistoryEntries(
    payments: SubscriptionPaymentRow[],
    attempts: BillingAttemptHistoryRow[],
    subscriptionById: Map<string, BillingSubscriptionRow>,
): BillingHistoryEntry[] {
    const paymentOrderIds = new Set(
        payments.map((payment) => payment.razorpay_order_id).filter((value): value is string => Boolean(value))
    )
    const paymentIds = new Set(
        payments.map((payment) => payment.razorpay_payment_id).filter((value): value is string => Boolean(value))
    )
    const attemptIds = new Set(
        payments.map((payment) => payment.billing_attempt_id).filter((value): value is string => Boolean(value))
    )

    const paymentEntries: BillingHistoryEntry[] = payments.map((payment) => {
        const subscription = subscriptionById.get(payment.subscription_id ?? '')
        return {
            id: `payment-${payment.id}`,
            kind: 'payment',
            date: payment.captured_at || payment.created_at,
            planTier: subscription?.plan_tier ?? null,
            purchaseType: subscription?.checkout_purchase_type ?? null,
            amountPaise: payment.amount_paise,
            method: payment.method ?? null,
            paymentId: payment.razorpay_payment_id ?? null,
            orderId: payment.razorpay_order_id ?? null,
            receiptPaymentId: payment.status === 'captured' ? payment.id : null,
            status: normalizePaymentHistoryStatus(payment.status),
        }
    })

    // Captured and failed provider records are already represented by
    // subscription_payments. Keep only attempts without a matching payment so
    // dismissed or still-unresolved checkouts remain recoverable without
    // duplicating the same transaction in the default view.
    const attemptEntries: BillingHistoryEntry[] = attempts
        .filter((attempt) => (
            !attemptIds.has(attempt.id)
            && !(attempt.provider_order_id && paymentOrderIds.has(attempt.provider_order_id))
            && !(attempt.provider_payment_id && paymentIds.has(attempt.provider_payment_id))
        ))
        .map((attempt) => ({
            id: `attempt-${attempt.id}`,
            kind: 'attempt',
            date: attempt.created_at ?? null,
            planTier: attempt.plan_tier,
            purchaseType: attempt.purchase_type,
            amountPaise: attempt.total_amount_paise ?? null,
            method: null,
            paymentId: attempt.provider_payment_id ?? null,
            orderId: attempt.provider_order_id ?? null,
            receiptPaymentId: null,
            status: normalizeAttemptHistoryStatus(attempt.status),
        }))

    return [...paymentEntries, ...attemptEntries].sort((left, right) => (
        new Date(right.date ?? 0).getTime() - new Date(left.date ?? 0).getTime()
    ))
}

function WorkspaceCard({
    workspaceTier,
    paidSubscriptionTier,
}: {
    workspaceTier: string
    paidSubscriptionTier: string
}) {
    const isLiteWorkspace = workspaceTier === 'lite'
    const isBaseWorkspace = workspaceTier === 'base'
    const isLegacyWorkspace = paidSubscriptionTier === 'premium' && !isBaseWorkspace && !isLiteWorkspace
    const isActive = workspaceTier !== 'none'

    return (
        <Card className="min-w-0 gap-4 p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-subtle">Workspace</p>
                    <p className="mt-1 text-xs text-body">The product experience currently enabled for your team.</p>
                </div>
                <StatusBadge status={isActive ? 'active' : 'info'} label={isActive ? 'Enabled' : 'Not active'} />
            </div>
            <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-loom text-saffron">
                    {isBaseWorkspace ? <Zap className="h-5 w-5" aria-hidden="true" /> : <Star className="h-5 w-5" aria-hidden="true" />}
                </span>
                <div className="min-w-0">
                    <h2 className="text-lg font-bold tracking-tight text-ink">
                        {isLiteWorkspace ? 'Weavly Lite' : isBaseWorkspace ? 'Weavly Base' : isLegacyWorkspace ? 'Legacy operations workspace' : 'Workspace not active'}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-body">
                        {!isActive
                            ? 'Choose an available subscription below to activate a workspace.'
                            : isLiteWorkspace
                                ? 'Complete textile costing, saved costings, qualities, Rate Book, and account data are enabled here.'
                                : isBaseWorkspace
                                    ? 'Everything in Lite plus connected production jobs, progress, machines, and worker settlement records is enabled here.'
                                    : isLegacyWorkspace
                                        ? 'This retained legacy entitlement is separate from the current Lite and Base catalog.'
                                        : 'Choose a plan to activate the costing workspace.'}
                    </p>
                </div>
            </div>
        </Card>
    )
}

function SubscriptionCard({
    subscriptionTier,
    displayPlanTier,
    subscription,
    activeRenewalPrice,
    renewalPlanTier,
    renewalAvailable,
    renewalEligibleAt,
    renewalIsUpcoming,
    billingReady,
    billingReadinessMessage,
}: {
    subscriptionTier: string
    displayPlanTier: BillingPlanTier | null
    subscription: { plan_tier: string; current_end: string | null } | null
    activeRenewalPrice: ReturnType<typeof getBillingPrice> | null
    renewalPlanTier: PurchasablePlanTier | null
    renewalAvailable: boolean
    renewalEligibleAt: string | null
    renewalIsUpcoming: boolean
    billingReady: boolean
    billingReadinessMessage: string
}) {
    const isActive = ['lite', 'base', 'premium', 'trial'].includes(subscriptionTier)
    const isTrial = subscriptionTier === 'trial'
    const hasExpiredPlan = !isActive && Boolean(displayPlanTier)
    const planName = displayPlanTier
        ? getBillingPlan(displayPlanTier).name
        : isTrial
            ? 'Legacy trial access'
            : 'No active subscription'
    const subscriptionDescription = isTrial
        ? 'Legacy trial access is temporary and does not create a paid subscription.'
        : hasExpiredPlan
            ? 'This paid period has ended. A new payment is required to restore access.'
            : displayPlanTier === 'premium'
                ? 'This retained subscription provides legacy operational access for existing accounts.'
                : displayPlanTier === 'base'
                    ? 'This subscription provides the complete Lite costing desk plus Base production management.'
                    : displayPlanTier === 'lite'
                        ? 'This subscription provides the complete textile costing desk.'
                        : 'A paid subscription has not been activated yet.'
    const canRenew = Boolean(renewalAvailable && renewalPlanTier && activeRenewalPrice)

    return (
        <Card className="min-w-0 gap-4 p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-subtle">Paid subscription</p>
                    <p className="mt-1 text-xs text-body">The commercial plan that funds access and receipts.</p>
                </div>
                <StatusBadge
                    status={isActive ? (isTrial ? 'pending' : 'active') : hasExpiredPlan ? 'expired' : 'info'}
                    label={isActive ? (isTrial ? 'Trial' : 'Active') : hasExpiredPlan ? 'Expired' : 'Not active'}
                />
            </div>
            <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saffron-soft text-saffron-deep">
                    <CreditCard className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h2 className="text-lg font-bold tracking-tight text-ink">{planName}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-body">{subscriptionDescription}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-hairline pt-4">
                <div className="rounded-lg bg-surface-soft px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-subtle">Billing period</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{isTrial ? 'Trial' : 'Annual'}</p>
                </div>
                <div className="rounded-lg bg-saffron-soft px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-saffron-deep">Renewal / expiry</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{subscription?.current_end ? formatShortDate(subscription.current_end) : '—'}</p>
                </div>
            </div>
            <div className="rounded-lg border border-hairline bg-surface-soft p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-subtle">Next action</p>
                {canRenew && renewalPlanTier && activeRenewalPrice ? (
                    <>
                        <p className="mt-1 text-sm font-semibold text-ink">Renew {getBillingPlan(renewalPlanTier).name} for {formatAmount(activeRenewalPrice.totalPaise)}.</p>
                        <p className="mt-1 text-xs leading-relaxed text-body">Renewal is manual; no automatic charge will be made.</p>
                        {billingReady ? (
                            <SubscribeButton
                                planTier={renewalPlanTier}
                                tierName={getBillingPlan(renewalPlanTier).name}
                                displayAmount={formatAmount(activeRenewalPrice.totalPaise)}
                                buttonLabel={`Renew for ${formatAmount(activeRenewalPrice.totalPaise)}`}
                                successHref="/owner/billing"
                                successLabel="View billing details"
                                className="mt-3 w-full shadow-none"
                            />
                        ) : (
                            <p className="mt-3 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs font-semibold leading-relaxed text-warning">
                                {billingReadinessMessage}
                            </p>
                        )}
                    </>
                ) : displayPlanTier === 'premium' ? (
                    <p className="mt-1 text-xs leading-relaxed text-body">Legacy operations checkout is not available from the current Lite/Base catalog.</p>
                ) : renewalIsUpcoming && subscription?.current_end ? (
                    <p className="mt-1 text-xs leading-relaxed text-body">Renewal opens on {formatShortDate(renewalEligibleAt)}. No automatic charge will be made.</p>
                ) : isActive ? (
                    <p className="mt-1 text-xs leading-relaxed text-body">Renewal is manual. Return to Billing when you are ready to renew.</p>
                ) : hasExpiredPlan ? (
                    <p className="mt-1 text-xs leading-relaxed text-body">Choose the available renewal option below to restore access.</p>
                ) : (
                    <p className="mt-1 text-xs leading-relaxed text-body">Choose an available subscription below to activate access.</p>
                )}
            </div>
        </Card>
    )
}

function AccessStateCallout({
    subscriptionTier,
    subscription,
    isActivating,
    isPending,
    isRetryable,
}: {
    subscriptionTier: string
    subscription: { plan_tier: string; current_end: string | null } | null
    isActivating: boolean
    isPending: boolean
    isRetryable: boolean
}) {
    if (subscriptionTier === 'lite' || subscriptionTier === 'base' || subscriptionTier === 'premium') return null

    const expiredPlan = subscription?.plan_tier === 'lite' || subscription?.plan_tier === 'base' || subscription?.plan_tier === 'premium'
        ? getBillingPlan(subscription.plan_tier)
        : null

    if (subscriptionTier === 'trial') {
        return (
            <Card className="overflow-hidden border-warning/30 bg-surface">
                <div className="h-1.5 w-full bg-warning" />
                <CardContent className="space-y-3 p-5">
                    <div className="flex items-center gap-2 text-warning"><Timer className="h-4 w-4" aria-hidden="true" /><p className="text-xs font-bold uppercase tracking-wider">Legacy trial access</p></div>
                    <h2 className="text-xl font-bold tracking-tight text-ink">Temporary access</h2>
                    <p className="text-sm leading-relaxed text-body">Access is available until {formatDate(subscription?.current_end ?? null)}. Choose Weavly Lite or Weavly Base below when you are ready for a paid plan.</p>
                </CardContent>
            </Card>
        )
    }

    const state = isActivating
        ? { icon: Clock, label: 'Payment received', title: 'Access is being activated.', text: 'We received a verified payment and are confirming access. Refresh in a few seconds; do not pay again.' }
        : isPending
            ? { icon: Clock, label: 'Payment incomplete', title: 'Payment has not been confirmed.', text: <>The checkout is not a paid subscription yet; Weavly has <strong>not received a verified payment yet</strong>. If the Razorpay window closed, use <strong>Resume secure payment</strong> below. Weavly will reuse the existing payment order.</> }
            : isRetryable
                ? { icon: XCircle, label: 'Payment not completed', title: 'No payment was captured.', text: 'Access was not activated. Choose an available subscription below when you are ready to try again.' }
                : expiredPlan
                    ? { icon: Lock, label: 'Subscription expired', title: `${expiredPlan.name} access has ended.`, text: 'Choose the available renewal option below to restore access. Your previous payment records remain available.' }
                    : { icon: Star, label: 'No active subscription', title: 'Choose Lite or Base.', text: 'Start with Weavly Lite for complete costing management, or choose Base when you need connected production management.' }
    const Icon = state.icon

    return (
        <Card className="border-loom-elevated bg-loom p-5 text-white shadow-[var(--shadow-panel)]">
            <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-saffron"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-surface-muted">{state.label}</p>
                    <h2 className="mt-1 text-xl font-bold tracking-tight">{state.title}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-surface-muted">{state.text}</p>
                </div>
            </div>
        </Card>
    )
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
    resumePendingCheckout = false,
}: {
    label: string
    currentTier: string
    decisions: Record<PurchasablePlanTier, BillingPurchaseDecision>
    visibleTiers: readonly PurchasablePlanTier[]
    resumePendingCheckout?: boolean
}) {
    const action = (planTier: PurchasablePlanTier) => {
        const decision = decisions[planTier]
        if (!visibleTiers.includes(planTier) || !decision.allowed) return undefined
        const plan = getBillingPlan(planTier)
        const price = getBillingPrice(planTier, decision.purchaseType)
        const total = formatAmount(price.totalPaise)
        const isRenewal = decision.purchaseType === 'renewal'
        return <>
            <div className="space-y-1">
                <p><span className="text-3xl font-bold tracking-tight text-ink">{total}</span><span className="ml-2 text-sm text-subtle">/{isRenewal ? 'renewal year' : 'first year'}</span></p>
                <p className="text-xs text-body">{formatAmount(price.basePaise)} + {formatAmount(price.gstPaise)} GST (18%)</p>
                <p className="text-sm text-body">{formatAmount(getBillingPrice(planTier, 'renewal').totalPaise)} / year to renew</p>
                <p className="text-xs text-subtle">GST included · manual annual renewal</p>
            </div>
            <SubscribeButton
                planTier={planTier}
                tierName={plan.name}
                displayAmount={total}
                buttonLabel={resumePendingCheckout
                    ? `Resume secure payment · ${total}`
                    : `Pay ${total} & ${isRenewal ? 'Renew' : 'Activate'}`}
                successHref="/owner/estimator"
                successLabel={isRenewal ? 'View payment history' : 'Start your first Cost Estimate'}
            />
        </>
    }

    return <div className="space-y-5 pt-4" aria-label={label}>
        <PlanAnalyticsBeacon eventName="base_pricing_viewed" properties={{ current_tier: currentTier }} />
        <UpgradeWall currentPlan={currentTier} actions={{ lite: action('lite'), base: action('base') }} />
        <div className="flex items-center justify-center gap-2 rounded-xl border border-hairline bg-surface-soft p-3">
            <ShieldCheck className="h-4 w-4 text-subtle" aria-hidden="true" />
            <p className="text-xs font-medium text-body">Secure Razorpay checkout · GST-inclusive totals shown</p>
        </div>
    </div>
}

export default async function BillingPage({
    searchParams,
}: {
    searchParams?: Promise<{ from?: string | string[]; plan?: string | string[] }>
}) {
    const { profile } = await requireRole(['owner'])
    if (!profile.org_id) redirect('/owner/today')

    const queryPromise: Promise<{ from?: string | string[]; plan?: string | string[] }> = searchParams
        ? searchParams
        : Promise.resolve({})

    const supabase = await createClient()
    // Critical billing state stays authoritative and server-owned. Referral
    // statistics are an independent secondary panel and stream below.
    const [query, subscriptionDetail, planAccess, paymentsResult, subscriptionsResult, attemptsResult] = await Promise.all([
        queryPromise,
        getSubscriptionDetail(profile.org_id),
        getCachedOrgPlanAccess(profile.org_id),
        supabase
            .from('subscription_payments')
            .select('id, status, created_at, razorpay_payment_id, amount_paise, method, subscription_id, razorpay_order_id, captured_at, billing_attempt_id')
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false }),
        supabase
            .from('org_subscriptions')
            .select('id, plan_tier, status, current_start, current_end, razorpay_payment_id, razorpay_subscription_id, razorpay_order_id, checkout_purchase_type, checkout_amount_paise, checkout_currency, created_at')
            .eq('org_id', profile.org_id),
        supabase
            .from('billing_checkout_attempts')
            .select('id, org_id, client_request_id, plan_tier, purchase_type, status, provider_order_id, provider_payment_id, provider_order_status, provider_status, failure_code, failure_reason, total_amount_paise, created_at, updated_at, last_checked_at')
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false }),
    ])
    const { subscription } = subscriptionDetail
    // `tier` is the workspace capability tier enforced by the owner shell;
    // the paid subscription tier remains separate for legacy history.
    const tier = planAccess.effectiveTier
    const subscriptionTier = planAccess.subscriptionTier
    const requestedRoute = typeof query.from === 'string' ? query.from : null
    const requestedPlan = query.plan === 'base' || query.plan === 'lite' ? query.plan : null
    const requestedFeature = getFeatureLabel(requestedRoute)
    const payments = (paymentsResult.data ?? []) as SubscriptionPaymentRow[]
    const billingSubscriptions = (subscriptionsResult.data ?? []) as BillingSubscriptionRow[]
    const billingPayments = payments as BillingPaymentRow[]
    const attempts = (attemptsResult.data ?? []) as BillingAttemptHistoryRow[]
    const latestAttempt = attempts[0] ?? null
    // Billing lifecycle is evaluated on the server so expired paid customers
    // see renewal pricing while trials still see first-year pricing.
    const billingNow = new Date()
    const purchaseDecisions: Record<PurchasablePlanTier, BillingPurchaseDecision> = {
        lite: resolveBillingPurchase(billingSubscriptions, billingPayments, 'lite', billingNow),
        base: resolveBillingPurchase(billingSubscriptions, billingPayments, 'base', billingNow),
    }
    const subscriptionById = new Map(
        billingSubscriptions.map((row) => [row.id, row])
    )
    const activePaidTier = subscriptionTier === 'lite' || subscriptionTier === 'base' || subscriptionTier === 'premium' ? subscriptionTier : null
    const latestSubscriptionTier = subscription?.plan_tier === 'lite' || subscription?.plan_tier === 'base' || subscription?.plan_tier === 'premium'
        ? subscription.plan_tier
        : null
    const latestSelfServeTier = latestSubscriptionTier === 'lite' || latestSubscriptionTier === 'base'
        ? latestSubscriptionTier
        : null
    const historicalPaidTier = latestSelfServeTier && purchaseDecisions[latestSelfServeTier].purchaseType === 'renewal'
        ? latestSelfServeTier
        : null
    const billingPlanTier = activePaidTier ?? historicalPaidTier
    const activeRenewalPrice = billingPlanTier ? getBillingPrice(billingPlanTier, 'renewal') : null
    const selfServeActiveTier = billingPlanTier && isSelfServePlanTier(billingPlanTier)
        ? billingPlanTier
        : null

    const checkoutPresentation = resolveBillingCheckoutPresentation(
        billingSubscriptions,
        billingPayments,
        billingNow,
    )
    const isActivating = checkoutPresentation.state === 'activating'
    const isPending = checkoutPresentation.state === 'pending'
    const isRetryable = checkoutPresentation.state === 'retryable'
    const activeRenewalDecision = selfServeActiveTier ? purchaseDecisions[selfServeActiveTier] : null
    const visiblePlanTiers: readonly PurchasablePlanTier[] = BILLING_SELF_SERVE_PLAN_TIERS
    const renewalAvailable = Boolean(
        activeRenewalDecision?.allowed
        && activeRenewalDecision.purchaseType === 'renewal'
    )
    const renewalEligibleAt = subscription?.current_end
        ? getRenewalEligibilityDate(subscription.current_end)
        : null
    const renewalIsUpcoming = Boolean(
        renewalEligibleAt && new Date(renewalEligibleAt).getTime() > billingNow.getTime()
    )
    const billingHistoryEntries = buildBillingHistoryEntries(payments, attempts, subscriptionById)
    const latestAttemptNeedsAttention = Boolean(
        latestAttempt
        && !['activated', 'failed', 'cancelled', 'refunded'].includes(latestAttempt.status)
    )
    // A created Razorpay order is not a payment. Keep a recovery action visible
    // after a tab, browser, or checkout crash; create-order safely reuses the
    // tenant's existing provider order instead of creating a second intent.
    // A Lite customer can upgrade to Base during the current paid period. Do
    // not let the Lite renewal card hide that upgrade path; the plan cards
    // omit the duplicate Lite renewal option below.
    const cardPlanTiers: readonly PurchasablePlanTier[] = subscriptionTier === 'lite'
        ? ['base']
        : visiblePlanTiers
    const canShowPlanCards = subscriptionTier !== 'premium'
        && !isActivating
        && (subscriptionTier === 'lite' ? purchaseDecisions.base.allowed : !renewalAvailable)
    const billingReadiness = getBillingReadiness()
    const planSectionLabel = billingPlanTier && subscriptionTier === 'none'
        ? `Renew ${getBillingPlan(billingPlanTier).name}`
        : requestedPlan === 'base'
            ? 'Take your costing into production'
            : requestedPlan === 'lite'
                ? 'Choose Weavly Lite'
                : tier === 'base'
            ? 'Available subscriptions'
            : 'Choose Weavly Lite or Base'

    // ── LAYOUT START ───────────────────────────────────────────────────────────
    return (
        <>
        <div className="premium-route-enter mx-auto w-full max-w-6xl space-y-8 px-4 pb-20 sm:px-6 lg:px-0">
            <RouteMilestones route="/owner/billing" shellVisible primaryUsable />
            <PageHeader
                icon={CreditCard}
                eyebrow="Account"
                title="Billing & Plan"
                description={(
                    <>
                        <span>See which workspace is enabled, what subscription funds it, when it renews, and review your payment history.</span>
                        {requestedFeature && tier === 'none' && (
                            <span className="mt-2 block font-semibold text-saffron-deep">
                                You arrived here from {requestedFeature}. Choose a plan to unlock it.
                            </span>
                        )}
                    </>
                )}
                meta={subscriptionTier === 'lite' || subscriptionTier === 'base' || subscriptionTier === 'premium' ? <StatusBadge status="active" /> : subscriptionTier === 'trial' ? <StatusBadge status="pending" label="Trial" /> : null}
            />

            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
                <WorkspaceCard
                    workspaceTier={tier}
                    paidSubscriptionTier={subscriptionTier}
                />
                <SubscriptionCard
                    subscriptionTier={subscriptionTier}
                    displayPlanTier={billingPlanTier}
                    subscription={subscription}
                    activeRenewalPrice={activeRenewalPrice}
                    renewalPlanTier={selfServeActiveTier}
                    renewalAvailable={renewalAvailable}
                    renewalEligibleAt={renewalEligibleAt}
                    renewalIsUpcoming={renewalIsUpcoming}
                    billingReady={billingReadiness.canCreateOrder}
                    billingReadinessMessage={billingReadiness.publicMessage}
                />
            </div>
            <BillingDocumentNotice compact />

            {canShowPlanCards && billingReadiness.canCreateOrder && (
                <PlanCards
                    label={planSectionLabel}
                    currentTier={tier}
                    decisions={purchaseDecisions}
                    visibleTiers={cardPlanTiers}
                    resumePendingCheckout={isPending}
                />
            )}
            {canShowPlanCards && !billingReadiness.canCreateOrder && <UpgradeWall currentPlan={tier} />}

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                <div className="space-y-6 lg:col-span-8">
                    {latestAttemptNeedsAttention && latestAttempt && <BillingAttemptStatus attempt={latestAttempt} />}
                    <AccessStateCallout
                        subscriptionTier={subscriptionTier}
                        subscription={subscription}
                        isActivating={isActivating}
                        isPending={isPending}
                        isRetryable={isRetryable}
                    />
                    {canShowPlanCards && !billingReadiness.canCreateOrder && (
                        <Card className="border-warning/30 bg-warning-soft p-5 shadow-none">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                                <div>
                            <h2 className="text-sm font-bold text-ink">Plan payments are not open yet</h2>
                                    <p className="mt-1 text-sm leading-relaxed text-body">{billingReadiness.publicMessage}</p>
                                    <p className="mt-2 text-xs leading-relaxed text-subtle">You can continue preparing the workspace. No Razorpay order can be created until the server configuration passes the launch gate.</p>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>

                <aside className="space-y-6 lg:col-span-4">
                    <div className="min-[1540px]:hidden">
                        {/* Payment history and Download receipt actions stay in the flow below wide desktop. */}
                        <PaymentHistoryDialog entries={billingHistoryEntries} />
                    </div>
                    <details className="group overflow-hidden rounded-xl border border-hairline bg-surface">
                        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink hover:bg-surface-soft [&::-webkit-details-marker]:hidden">
                            Referral rewards
                            <ChevronDown className="h-4 w-4 text-subtle transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="border-t border-hairline p-3">
                            <Suspense fallback={<ReferralLoading />}>
                                <DeferredReferralSection />
                            </Suspense>
                        </div>
                    </details>
                    {process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.startsWith('rzp_test_') && (
                        <Card className="space-y-3 p-5">
                            <div className="flex items-start gap-3 rounded-xl border border-dashed border-warning/40 bg-warning-soft px-4 py-3">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                                <p className="text-[10px] font-semibold uppercase leading-relaxed tracking-wider text-warning">
                                    Test checkout environment: use test payment details only. No real payment will be captured.
                                </p>
                            </div>
                            <div className="flex items-start gap-2 text-xs leading-relaxed text-subtle">
                                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                <p>Billing status and access decisions remain server-authoritative.</p>
                            </div>
                        </Card>
                    )}
                </aside>
            </div>
        </div>
        {/* Keep the wide-desktop payment history rail outside the animated route wrapper. */}
        <aside className="billing-payment-history-rail-desktop" aria-label="Payment history and receipts">
            <PaymentHistoryDialog entries={billingHistoryEntries} />
        </aside>
        </>
    )
}
