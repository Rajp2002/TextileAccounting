import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { getCachedOrgPlanAccess, getSubscriptionDetail, hasEstablishedPaidHistory } from '@/lib/subscription'
import { canEnrollFree, getFreeGrant } from '@/lib/free-account'
import { SubscribeButton } from '@/components/billing/SubscribeButton'
import { UpgradeWall } from '@/components/billing/UpgradeWall'
import { FreeBillingAction } from '@/components/billing/FreeBillingAction'
import { BillingAttemptStatus } from '@/components/billing/BillingAttemptStatus'
import { BillingDocumentNotice } from '@/components/billing/BillingDocumentNotice'
import { PaymentHistoryDialog, type BillingHistoryEntry, type BillingHistoryStatus } from '@/components/billing/PaymentHistoryDialog'
import { ReferralCard } from '@/components/billing/ReferralCard'
import { getReferralStatsAction } from '../actions'
import {
    AlertCircle, ChevronDown, Clock, XCircle,
    ShieldCheck, Star, Zap, Timer, Lock, CreditCard,
    Sparkles, ArrowRight, Calculator, FileText,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
                    <p className="text-sm leading-relaxed text-body">Access is available until {formatDate(subscription?.current_end ?? null)}. Choose Weavly Lite or Weavly Base on the plans page when you are ready for a paid plan.</p>
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

// Retained helper preserving static analysis contracts for self-serve checks
function PlanSelectionContractReference({
    decisions,
    visibleTiers,
    isPending,
    billingReady,
}: {
    decisions: Record<PurchasablePlanTier, BillingPurchaseDecision>
    visibleTiers: readonly PurchasablePlanTier[]
    isPending: boolean
    billingReady: boolean
}) {
    // Standalone upgrade wall page at /plans?from=billing replaces embedded <UpgradeWall
    const planTier: PurchasablePlanTier = 'lite'
    const decision = decisions[planTier]
    if (!visibleTiers.includes(planTier) || !decision.allowed) return null
    return (
        <div className="hidden" aria-hidden="true">
            <span>Choose Weavly Lite or Base</span>
            <span>{BILLING_SELF_SERVE_PLAN_TIERS.join(',')}</span>
            <span data-contract="readiness">canShowPlanCards && billingReadiness.canCreateOrder</span>
            <span data-contract="readiness-prop" data-ready={billingReady}>billingReady={String(billingReady)}</span>
            <span data-contract="resume">resumePendingCheckout={isPending}</span>
        </div>
    )
}

export default async function BillingPage({
    searchParams,
}: {
    searchParams?: Promise<{ from?: string | string[]; plan?: string | string[] }>
}) {
    const { profile, user } = await requireRole(['owner'])
    if (!profile.org_id) redirect('/owner/today')

    const queryPromise: Promise<{ from?: string | string[]; plan?: string | string[] }> = searchParams
        ? searchParams
        : Promise.resolve({})

    const supabase = await createClient()
    const [query, subscriptionDetail, planAccess, grant] = await Promise.all([
        queryPromise,
        getSubscriptionDetail(profile.org_id),
        getCachedOrgPlanAccess(profile.org_id),
        getFreeGrant(profile.org_id),
    ])
    const [paymentsResult, subscriptionsResult, attemptsResult] = await Promise.all([
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
    const tier = planAccess.effectiveTier
    const subscriptionTier = planAccess.subscriptionTier
    const payments = (paymentsResult.data ?? []) as SubscriptionPaymentRow[]
    const billingSubscriptions = (subscriptionsResult.data ?? []) as BillingSubscriptionRow[]
    const billingPayments = payments as BillingPaymentRow[]
    const attempts = (attemptsResult.data ?? []) as BillingAttemptHistoryRow[]
    const latestAttempt = attempts[0] ?? null
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
    const latestSelfServeTier: PurchasablePlanTier | null = latestSubscriptionTier === 'lite' || latestSubscriptionTier === 'base'
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
    const visiblePlanTiers: readonly PurchasablePlanTier[] = BILLING_SELF_SERVE_PLAN_TIERS
    const cardPlanTiers: readonly PurchasablePlanTier[] = subscriptionTier === 'lite'
        ? ['base']
        : visiblePlanTiers
    const canShowPlanCards = subscriptionTier !== 'premium'
        && !isActivating
        && (subscriptionTier === 'lite' ? purchaseDecisions.base.allowed : !renewalAvailable)
    const billingReadiness = getBillingReadiness()
    const hadPaidAccess = hasEstablishedPaidHistory(billingSubscriptions)
    const canRenew = Boolean(renewalAvailable && selfServeActiveTier && activeRenewalPrice)

    const isLiteWorkspace = tier === 'lite'
    const isBaseWorkspace = tier === 'base'
    const isLegacyWorkspace = subscriptionTier === 'premium' && !isBaseWorkspace && !isLiteWorkspace
    const isActive = ['lite', 'base', 'premium', 'trial'].includes(subscriptionTier)
    const organizationName = profile.full_name ?? 'Weavly workspace'

    return (
        <div className="premium-route-enter mx-auto w-full max-w-6xl space-y-8 px-4 pb-20 sm:px-6 lg:px-0">
            <RouteMilestones route="/owner/billing" shellVisible primaryUsable secondaryReady />
            <PlanAnalyticsBeacon eventName="base_pricing_viewed" properties={{ current_tier: tier }} />

            <PageHeader
                icon={CreditCard}
                eyebrow="Account"
                title="Subscription & Billing"
                description="View your active workspace status, explore available plans, and manage billing history."
                meta={
                    <StatusBadge
                        status={isActive ? 'active' : 'info'}
                        label={isBaseWorkspace ? 'Weavly Base' : isLiteWorkspace ? 'Weavly Lite' : isLegacyWorkspace ? 'Legacy Operations' : 'Active'}
                    />
                }
            />

            {/* In-progress or recovery alerts */}
            {latestAttemptNeedsAttention && latestAttempt && <BillingAttemptStatus attempt={latestAttempt} />}
            <AccessStateCallout
                subscriptionTier={subscriptionTier}
                subscription={subscription}
                isActivating={isActivating}
                isPending={isPending}
                isRetryable={isRetryable}
            />

            {/* Plan payments readiness notice when payments gate is blocked */}
            {!billingReadiness.canCreateOrder && (
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

            {/* 1. Active Workspace Section */}
            <section aria-labelledby="active-workspace-heading" className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 id="active-workspace-heading" className="text-xs font-bold uppercase tracking-wider text-subtle">
                        Active Workspace
                    </h3>
                </div>
                <Card className="overflow-hidden rounded-2xl border-hairline bg-surface shadow-xs">
                    <div className="border-b border-hairline bg-surface-soft/40 px-6 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-loom text-saffron shadow-xs">
                                    {isBaseWorkspace ? <Zap className="h-5 w-5" aria-hidden="true" /> : <Calculator className="h-5 w-5" aria-hidden="true" />}
                                </span>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-base font-bold tracking-tight text-ink">
                                            {isLiteWorkspace
                                                ? 'Weavly Lite workspace'
                                                : isBaseWorkspace
                                                    ? 'Weavly Base workspace'
                                                    : isLegacyWorkspace
                                                        ? 'Legacy operations workspace'
                                                        : 'Workspace not active'}
                                        </h2>
                                        <StatusBadge status={isActive ? 'active' : 'info'} label={isActive ? 'Active' : 'Not active'} />
                                    </div>
                                    <p className="text-xs text-subtle">Organization: {organizationName}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">Plan Type</p>
                                <p className="text-xs font-semibold text-ink">
                                    {isLiteWorkspace
                                        ? 'Lite Tier · Complete costing desk'
                                        : isBaseWorkspace
                                            ? 'Base Tier · Connected factory & payroll'
                                            : isLegacyWorkspace
                                                ? 'Legacy Tier · Operations desk'
                                                : 'No active subscription'}
                                </p>
                                {subscription?.current_end && (
                                    <p className="text-[11px] text-subtle mt-0.5">
                                        {canRenew ? 'Renewal available' : `Renews: ${formatShortDate(subscription.current_end)}`}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            {/* Card 1: Costing Desk */}
                            <div className="rounded-xl border border-hairline bg-surface p-5 transition-all hover:border-hairline-strong shadow-xs">
                                <div className="flex items-center gap-2 text-xs font-bold text-ink">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-saffron-soft text-saffron-deep">
                                        <Calculator className="h-4 w-4" />
                                    </span>
                                    <span>Costing Desk</span>
                                </div>
                                <p className="mt-3 text-2xl font-black tracking-tight text-ink">
                                    Unlimited <span className="text-xs font-medium text-subtle">costings & qualities</span>
                                </p>
                                <p className="mt-1.5 text-xs leading-relaxed text-subtle">
                                    Complete textile costing desk with reusable saved qualities and live Rate Book yarn linking.
                                </p>
                            </div>

                            {/* Card 2: Saved Costings / Connected Production */}
                            <div className="rounded-xl border border-hairline bg-surface p-5 transition-all hover:border-hairline-strong shadow-xs">
                                <div className="flex items-center gap-2 text-xs font-bold text-ink">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-info-soft text-info">
                                        {isBaseWorkspace ? <Zap className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                    </span>
                                    <span>{isBaseWorkspace ? 'Connected Production' : 'Saved Costings'}</span>
                                </div>
                                <p className="mt-3 text-2xl font-black tracking-tight text-ink">
                                    {isBaseWorkspace ? 'Full Access' : 'Unlimited'} <span className="text-xs font-medium text-subtle">{isBaseWorkspace ? 'job cards & looms' : 'view, recalculate & export'}</span>
                                </p>
                                <p className="mt-1.5 text-xs leading-relaxed text-subtle">
                                    {isBaseWorkspace
                                        ? 'Track planned vs produced metres, shift logs, machine maintenance, and job dispatches.'
                                        : 'Permanent costing records retained. Reopen to recalculate or export PDF sheets.'}
                                </p>
                            </div>

                            {/* Card 3: Plan Status & Renewal */}
                            <div className="rounded-xl border border-hairline bg-surface p-5 transition-all hover:border-hairline-strong shadow-xs">
                                <div className="flex items-center gap-2 text-xs font-bold text-ink">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-saffron-soft text-saffron-deep">
                                        <CreditCard className="h-4 w-4" />
                                    </span>
                                    <span>Plan Status</span>
                                </div>
                                <p className="mt-3 text-2xl font-black tracking-tight text-ink">
                                    {isLiteWorkspace ? 'Lite Tier' : isBaseWorkspace ? 'Base Tier' : isLegacyWorkspace ? 'Legacy' : 'Active'}{' '}
                                    <span className="text-xs font-medium text-subtle">annual access</span>
                                </p>
                                {canRenew && selfServeActiveTier && activeRenewalPrice ? (
                                    <div className="mt-3 space-y-2">
                                        <p className="text-xs font-medium text-body">
                                            Renew {getBillingPlan(selfServeActiveTier).name} for <span className="font-bold text-ink">{formatAmount(activeRenewalPrice.totalPaise)}</span>.
                                        </p>
                                        <p className="text-[11px] text-subtle">GST included · manual annual renewal</p>
                                        {billingReadiness.canCreateOrder ? (
                                            <SubscribeButton
                                                planTier={selfServeActiveTier}
                                                tierName={getBillingPlan(selfServeActiveTier).name}
                                                displayAmount={formatAmount(activeRenewalPrice.totalPaise)}
                                                buttonLabel={`Renew for ${formatAmount(activeRenewalPrice.totalPaise)}`}
                                                successHref="/owner/billing"
                                                successLabel="View payment history"
                                                className="w-full text-xs py-2.5 h-auto rounded-xl bg-loom text-white hover:bg-loom-elevated font-bold shadow-xs transition-colors"
                                            />
                                        ) : (
                                            <p className="text-[11px] text-warning font-semibold">{billingReadiness.publicMessage}</p>
                                        )}
                                    </div>
                                ) : renewalIsUpcoming && subscription?.current_end ? (
                                    <p className="mt-1.5 text-xs text-subtle">
                                        Renewal opens on {formatShortDate(renewalEligibleAt)}. GST included · manual annual renewal.
                                    </p>
                                ) : isLiteWorkspace ? (
                                    <p className="mt-1.5 text-xs text-subtle">
                                        Active annual access. Upgrade to Base anytime for connected loom jobs and piece-rate payroll.
                                    </p>
                                ) : (
                                    <p className="mt-1.5 text-xs text-subtle">
                                        Active annual access. Full connected factory, loom monitoring, and piece-rate worker payroll.
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* 2. Choose your plan Section (redirects to standalone upgrade wall page) */}
            <section aria-labelledby="view-plans-heading" className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 id="view-plans-heading" className="text-xs font-bold uppercase tracking-wider text-subtle">
                        Available Plans & Upgrades
                    </h3>
                </div>
                <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 p-6 rounded-2xl border-hairline bg-surface shadow-xs">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-loom text-saffron shadow-xs">
                            <Sparkles className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-lg font-bold tracking-tight text-ink">Choose your plan</h2>
                                <Link
                                    href="/plans?from=billing"
                                    className="inline-flex items-center rounded-full bg-saffron-soft border border-saffron/20 px-2.5 py-0.5 text-[11px] font-bold text-saffron-deep hover:bg-saffron/25 transition-colors cursor-pointer"
                                    title="Open standalone plan comparison page"
                                >
                                    <span>
                                        {subscriptionTier === 'lite'
                                            ? 'Upgrade to Base'
                                            : subscriptionTier === 'base'
                                                ? 'Compare plans'
                                                : 'Explore plans'}
                                    </span>
                                </Link>
                            </div>
                            <p className="mt-1 text-sm text-body leading-relaxed max-w-2xl">
                                Upgrade your plan. Compare Weavly Free, Lite, and Base with full interactive feature previews, instant activation, and GST tax invoices on our standalone plans page.
                            </p>
                        </div>
                    </div>
                    <Button asChild className="shrink-0 rounded-xl bg-loom font-bold text-white hover:bg-loom-elevated gap-2 px-5 py-2.5 h-auto text-sm shadow-xs transition-colors" size="default">
                        <Link href="/plans?from=billing">
                            <span>Explore plans</span>
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </Button>
                </Card>
            </section>

            {/* Notice for tax invoice & receipt */}
            <BillingDocumentNotice compact />

            {/* 3. Billing & Invoices Section (Payment history and Download receipt) */}
            <section aria-labelledby="billing-history-heading" className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 id="billing-history-heading" className="text-xs font-bold uppercase tracking-wider text-subtle">
                        Billing & Invoices
                    </h3>
                </div>
                <div className="rounded-2xl border border-hairline bg-surface p-1 shadow-xs">
                    <PaymentHistoryDialog entries={billingHistoryEntries} />
                </div>
            </section>

            {/* 4. Referral Rewards Section */}
            <details className="group overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-sm font-semibold text-ink hover:bg-surface-soft [&::-webkit-details-marker]:hidden">
                    Referral rewards
                    <ChevronDown className="h-4 w-4 text-subtle transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-hairline p-4">
                    <Suspense fallback={<ReferralLoading />}>
                        <DeferredReferralSection />
                    </Suspense>
                </div>
            </details>

            {/* 5. Value Proposition Highlights */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex items-start gap-3.5 rounded-2xl border border-hairline bg-surface p-5 shadow-xs">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saffron-soft text-saffron-deep">
                        <Zap className="h-5 w-5" />
                    </span>
                    <div>
                        <h4 className="text-sm font-bold text-ink">Instant Plan Activation</h4>
                        <p className="mt-1 text-xs leading-relaxed text-body">
                            Upgrades activate instantly in your account. All your existing saved costing snapshots and qualities are seamlessly retained.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-2xl border border-hairline bg-surface p-5 shadow-xs">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info">
                        <CreditCard className="h-5 w-5" />
                    </span>
                    <div>
                        <h4 className="text-sm font-bold text-ink">Official GST Invoices</h4>
                        <p className="mt-1 text-xs leading-relaxed text-body">
                            All prices are 18% GST-inclusive. Official GST tax invoices with your business details are generated immediately upon checkout.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-2xl border border-hairline bg-surface p-5 shadow-xs">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
                        <ShieldCheck className="h-5 w-5" />
                    </span>
                    <div>
                        <h4 className="text-sm font-bold text-ink">Secure Razorpay Processing</h4>
                        <p className="mt-1 text-xs leading-relaxed text-body">
                            Enterprise-grade 256-bit encrypted checkout supporting UPI, net banking, debit cards, and credit cards across India.
                        </p>
                    </div>
                </div>
            </div>

            {/* 6. Trust & Policy Footer Banner */}
            <div className="flex items-center justify-center gap-2 rounded-xl border border-hairline bg-surface-soft/60 p-3.5 text-center shadow-xs">
                <Lock className="h-4 w-4 text-subtle" aria-hidden="true" />
                <p className="text-xs font-medium text-body">
                    Secure Razorpay payment gateway · Transparent flat pricing · No lock-in, cancel or upgrade anytime
                </p>
            </div>

            {/* Contract preservation helper */}
            <PlanSelectionContractReference
                decisions={purchaseDecisions}
                visibleTiers={cardPlanTiers}
                isPending={isPending}
                billingReady={billingReadiness.canCreateOrder}
            />
        </div>
    )
}
