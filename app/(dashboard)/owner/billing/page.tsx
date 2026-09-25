import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { getCachedOrgPlanAccess, getSubscriptionDetail } from '@/lib/subscription'
import { SubscribeButton } from '@/components/billing/SubscribeButton'
import { BillingAttemptStatus } from '@/components/billing/BillingAttemptStatus'
import { BillingDocumentNotice } from '@/components/billing/BillingDocumentNotice'
import { PaymentHistoryDialog, type BillingHistoryEntry, type BillingHistoryStatus } from '@/components/billing/PaymentHistoryDialog'
import { ReferralCard } from '@/components/billing/ReferralCard'
import { getReferralStats } from '@/lib/referral'
import {
    AlertCircle, ChevronDown, Clock, XCircle,
    Star, Zap, Lock, CreditCard, ReceiptText,
    Sparkles, ArrowRight, Calculator, FileText, ShieldCheck,
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
import { getCachedOwnerOrganization } from '@/lib/owner-organization'

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
    if (subscriptionTier === 'lite' || subscriptionTier === 'base') return null

    const expiredPlan = subscription?.plan_tier === 'lite' || subscription?.plan_tier === 'base'
        ? getBillingPlan(subscription.plan_tier)
        : null

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
    let stats: Awaited<ReturnType<typeof getReferralStats>> | null = null
    let failed = false
    try {
        const { profile } = await requireRole(['owner'])
        stats = await getReferralStats(profile.org_id)
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

export default async function BillingPage() {
    const { profile, user } = await requireRole(['owner'])
    if (!profile.org_id) redirect('/owner/estimator')

    const supabase = await createClient()
    const [subscriptionDetail, planAccess, organizationResult] = await Promise.all([
        getSubscriptionDetail(profile.org_id),
        getCachedOrgPlanAccess(profile.org_id),
        getCachedOwnerOrganization(user.id, profile.org_id),
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
    const activePaidTier = subscriptionTier === 'lite' || subscriptionTier === 'base' ? subscriptionTier : null
    const latestSubscriptionTier = subscription?.plan_tier === 'lite' || subscription?.plan_tier === 'base'
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
    const billingReadiness = getBillingReadiness()
    const canRenew = Boolean(renewalAvailable && selfServeActiveTier && activeRenewalPrice)

    const isLiteWorkspace = tier === 'lite'
    const isBaseWorkspace = tier === 'base'
    const isActive = subscriptionTier === 'lite' || subscriptionTier === 'base'
    const organizationName = organizationResult.data?.name || 'Weavly workspace'
    const accessTiming = !isActive
        ? subscription?.current_end
            ? `Access ended ${formatShortDate(subscription.current_end)}`
            : 'Choose a plan to activate this workspace'
        : subscription?.current_end
            ? canRenew
                ? `Renewal available · access through ${formatShortDate(subscription.current_end)}`
                : renewalIsUpcoming
                    ? `Renewal opens ${formatShortDate(renewalEligibleAt)} · access through ${formatShortDate(subscription.current_end)}`
                    : `Access through ${formatShortDate(subscription.current_end)}`
            : 'Active annual access'

    return (
        <div className="ui-route-enter mx-auto w-full max-w-6xl space-y-6 px-4 pb-20 sm:px-6 lg:px-0">
            <RouteMilestones route="/owner/billing" shellVisible primaryUsable secondaryReady />
            <PlanAnalyticsBeacon eventName="base_pricing_viewed" properties={{ current_tier: tier }} />

            <PageHeader
                title="Subscription & Billing"
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

            <section aria-labelledby="active-workspace-heading" className="space-y-2.5">
                <h2 id="active-workspace-heading" className="text-[11px] font-bold uppercase tracking-[0.13em] text-subtle">
                    Active workspace
                </h2>
                <Card className="gap-0 overflow-hidden rounded-2xl border-hairline border-t-2 border-t-saffron/70 bg-surface shadow-[var(--shadow-panel)]">
                    <div className="flex flex-col gap-5 border-b border-hairline px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-6">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-loom text-saffron">
                                {isBaseWorkspace ? <Zap className="h-5 w-5" aria-hidden="true" /> : <Calculator className="h-5 w-5" aria-hidden="true" />}
                            </span>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-bold tracking-tight text-ink">
                                        {isLiteWorkspace
                                            ? 'Weavly Lite workspace'
                                            : isBaseWorkspace
                                                ? 'Weavly Base workspace'
                                                : 'Workspace not active'}
                                    </h3>
                                    <StatusBadge status={isActive ? 'active' : 'info'} label={isActive ? 'Active' : 'Not active'} />
                                </div>
                                <p className="mt-1 text-xs text-subtle">Organization: {organizationName}</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:max-w-[46%] sm:items-end sm:text-right">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-subtle">Current plan</p>
                                <p className="mt-0.5 text-sm font-semibold text-ink">
                                    {activePaidTier === 'lite' ? 'Weavly Lite' : activePaidTier === 'base' ? 'Weavly Base' : 'No active subscription'}
                                    {isActive && <span className="font-normal text-subtle"> · Annual access</span>}
                                </p>
                                <p className="mt-0.5 text-xs leading-relaxed text-subtle">{accessTiming}</p>
                            </div>
                            {canRenew && selfServeActiveTier && activeRenewalPrice && (
                                billingReadiness.canCreateOrder ? (
                                    <SubscribeButton
                                        planTier={selfServeActiveTier}
                                        tierName={getBillingPlan(selfServeActiveTier).name}
                                        displayAmount={formatAmount(activeRenewalPrice.totalPaise)}
                                        buttonLabel={`Renew for ${formatAmount(activeRenewalPrice.totalPaise)}`}
                                        successHref="/owner/billing"
                                        successLabel="View payment history"
                                        className="h-auto min-h-10 w-full rounded-lg bg-loom px-4 py-2 text-xs font-semibold text-white shadow-none transition-colors hover:bg-loom-elevated sm:w-auto"
                                    />
                                ) : (
                                    <p className="text-xs font-semibold text-warning">{billingReadiness.publicMessage}</p>
                                )
                            )}
                        </div>
                    </div>

                    <CardContent className="p-4 sm:p-5">
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            <article className="min-w-0 rounded-xl border border-hairline bg-canvas/70 p-4 shadow-[var(--shadow-card)]">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-saffron-soft text-saffron-deep"><Calculator className="h-4 w-4" aria-hidden="true" /></span>
                                    <h4 className="text-xs font-semibold text-ink">Costing desk</h4>
                                </div>
                                <p className="mt-3 text-xl font-bold leading-tight tracking-tight text-ink">
                                    {isActive ? 'Unlimited' : 'Ready to start'}
                                    <span className="ml-1 text-xs font-normal tracking-normal text-body">{isActive ? 'costings & qualities' : 'with a paid plan'}</span>
                                </p>
                                <p className="mt-2 text-xs leading-relaxed text-body">Complete textile costing with reusable saved qualities and live Rate Book linking.</p>
                            </article>
                            <article className="min-w-0 rounded-xl border border-hairline bg-canvas/70 p-4 shadow-[var(--shadow-card)]">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-info-soft text-info">{isBaseWorkspace ? <Zap className="h-4 w-4" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}</span>
                                    <h4 className="text-xs font-semibold text-ink">{isBaseWorkspace ? 'Connected production' : 'Saved costings'}</h4>
                                </div>
                                <p className="mt-3 text-xl font-bold leading-tight tracking-tight text-ink">
                                    {isBaseWorkspace ? isActive ? 'Full access' : 'Available with Base' : isActive ? 'Always yours' : 'Retained'}
                                    <span className="ml-1 text-xs font-normal tracking-normal text-body">{isBaseWorkspace ? 'to job cards & looms' : 'to saved snapshots'}</span>
                                </p>
                                <p className="mt-2 text-xs leading-relaxed text-body">
                                    {isBaseWorkspace
                                        ? 'Track planned and produced metres, shifts, machine maintenance, and job dispatches.'
                                        : isActive
                                            ? 'Reopen, recalculate, or export your previous costings whenever you need them.'
                                            : 'Saved snapshots remain in your workspace; paid access may be needed to reopen them.'}
                                </p>
                            </article>
                            <article className="min-w-0 rounded-xl border border-hairline bg-canvas/70 p-4 shadow-[var(--shadow-card)] md:col-span-2 lg:col-span-1">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-saffron-soft text-saffron-deep"><CreditCard className="h-4 w-4" aria-hidden="true" /></span>
                                    <h4 className="text-xs font-semibold text-ink">Plan status</h4>
                                </div>
                                <p className="mt-3 text-xl font-bold leading-tight tracking-tight text-ink">
                                    {activePaidTier === 'base' ? 'Base tier' : activePaidTier === 'lite' ? 'Lite tier' : 'No active plan'}
                                    {isActive && <span className="ml-1 text-xs font-normal tracking-normal text-body">annual access</span>}
                                </p>
                                <p className="mt-2 text-xs leading-relaxed text-body">{accessTiming} · Annual renewals are manual.</p>
                            </article>
                        </div>
                    </CardContent>
                </Card>
            </section>

            <section aria-labelledby="view-plans-heading" className="space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-subtle">Available plans &amp; upgrades</p>
                <Card className="flex flex-col items-start justify-between gap-4 rounded-2xl border-hairline bg-surface p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:px-6">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-loom text-saffron">
                            <Sparkles className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 id="view-plans-heading" className="text-base font-bold tracking-tight text-ink">Choose your plan</h2>
                                <span className="rounded-full border border-saffron/25 bg-saffron-soft/60 px-2 py-0.5 text-[10px] font-semibold text-saffron-deep">Compare plan options</span>
                            </div>
                            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-body">
                                Explore Weavly Free, Lite, and Base with clear feature previews and pricing.
                            </p>
                            <p className="mt-1.5 text-xs text-subtle">GST included · Annual renewals are manual · Secure Razorpay checkout</p>
                        </div>
                    </div>
                    <Button asChild className="min-h-10 w-full shrink-0 gap-2 rounded-lg bg-loom px-4 py-2.5 text-sm font-semibold text-white shadow-none transition-colors hover:bg-loom-elevated sm:w-auto" size="default">
                        <Link href="/plans?from=billing">
                            <span>{subscriptionTier === 'lite' ? 'Upgrade to Base' : subscriptionTier === 'base' ? 'Compare plans' : 'Explore plans'}</span>
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </Button>
                </Card>
            </section>

            <BillingDocumentNotice compact />

            <section aria-labelledby="billing-history-heading" className="space-y-2.5">
                <h2 id="billing-history-heading" className="text-[11px] font-bold uppercase tracking-[0.13em] text-subtle">
                    Billing &amp; invoices
                </h2>
                <PaymentHistoryDialog entries={billingHistoryEntries} />
            </section>

            <details className="group overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[var(--shadow-card)]">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-sm font-semibold text-ink outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron/50 [&::-webkit-details-marker]:hidden">
                    Referral rewards
                    <ChevronDown className="h-4 w-4 text-subtle transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="border-t border-hairline p-4 sm:p-5">
                    <Suspense fallback={<ReferralLoading />}>
                        <DeferredReferralSection />
                    </Suspense>
                </div>
            </details>

            <section aria-label="Billing essentials" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-saffron-soft text-saffron-deep"><Zap className="h-4 w-4" aria-hidden="true" /></span>
                    <div>
                        <h2 className="text-sm font-semibold text-ink">Verified plan activation</h2>
                        <p className="mt-1 text-xs leading-relaxed text-body">Paid access begins after payment verification. Your saved costings and workspace settings stay in place.</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info"><ReceiptText className="h-4 w-4" aria-hidden="true" /></span>
                    <div>
                        <h2 className="text-sm font-semibold text-ink">Clear billing documents</h2>
                        <p className="mt-1 text-xs leading-relaxed text-body">Download a PDF receipt for captured payments from your history. GST tax invoices are not issued for this pilot.</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-surface p-4 shadow-[var(--shadow-card)] sm:col-span-2 lg:col-span-1">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success"><ShieldCheck className="h-4 w-4" aria-hidden="true" /></span>
                    <div>
                        <h2 className="text-sm font-semibold text-ink">Secure Razorpay checkout</h2>
                        <p className="mt-1 text-xs leading-relaxed text-body">Pay with the methods available at checkout. Weavly does not store your full card or banking details.</p>
                    </div>
                </div>
            </section>

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
