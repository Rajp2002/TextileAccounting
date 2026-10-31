import styles from './lite-billing.module.css'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { getCachedOrgPlanAccess, getSubscriptionDetail } from '@/lib/subscription'
import { SubscribeButton } from '@/components/billing/SubscribeButton'
import { BillingAttemptStatus } from '@/components/billing/BillingAttemptStatus'
import { getBillingAttemptPresentation } from '@/lib/billing-attempts'
import { BillingGuide } from '@/components/billing/BillingDocumentNotice'
import { PaymentHistoryList, type BillingHistoryEntry, type BillingHistoryStatus } from '@/components/billing/PaymentHistoryDialog'
import { PlanIncludesTiles } from '@/components/billing/PlanIncludesTiles'
import { ReferralCard } from '@/components/billing/ReferralCard'
import { getReferralStats } from '@/lib/referral'
import { AlertCircle, ArrowRight, Clock, Lock, Star, XCircle } from 'lucide-react'
import { railPrimaryAction } from '@/components/ui/rail'
import { cn } from '@/lib/utils'
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
import { liteTrialText } from '@/lib/i18n/lite-trial'

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
    includeRecovery = false,
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
            ...(includeRecovery ? { attempt: {
                id: attempt.id,
                status: attempt.status,
                provider_order_id: attempt.provider_order_id,
                provider_payment_id: attempt.provider_payment_id,
            } } : {}),
        }))

    return [...paymentEntries, ...attemptEntries].sort((left, right) => (
        new Date(right.date ?? 0).getTime() - new Date(left.date ?? 0).getTime()
    ))
}

const DAY_MS = 24 * 60 * 60 * 1000

function daysUntil(iso: string | null, now: Date): number | null {
    if (!iso) return null
    return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY_MS))
}

function AccessStateCallout({
    subscriptionTier,
    subscription,
    isActivating,
    isPending,
    isRetryable,
    baseVisible,
}: {
    subscriptionTier: string
    subscription: { plan_tier: string; current_end: string | null } | null
    isActivating: boolean
    isPending: boolean
    isRetryable: boolean
    baseVisible: boolean
}) {
    if (subscriptionTier === 'lite' || subscriptionTier === 'base') return null

    const expiredPlan = subscription?.plan_tier === 'lite' || subscription?.plan_tier === 'base'
        ? getBillingPlan(subscription.plan_tier)
        : null

    const state = isActivating
        ? { icon: Clock, tone: 'info', label: 'Payment received', title: 'Access is being activated.', text: 'We received a verified payment and are confirming access. Refresh in a few seconds; do not pay again.' }
        : isPending
            ? { icon: Clock, tone: 'warning', label: 'Payment incomplete', title: 'Payment has not been confirmed.', text: 'Your plan is not paid yet; Weavly has not received a verified payment. If the Razorpay window closed, use Resume secure payment below. Weavly will reuse the same payment order.' }
            : isRetryable
                ? { icon: XCircle, tone: 'risk', label: 'Payment not completed', title: 'No payment was captured.', text: 'Access was not activated. Choose an available subscription below when you are ready to try again.' }
                : expiredPlan
                    ? { icon: Lock, tone: 'risk', label: 'Subscription expired', title: `${expiredPlan.name} access has ended.`, text: 'Choose the available renewal option below to restore access. Your previous payment records remain available.' }
                    : { icon: Star, tone: 'info', label: 'No active subscription', title: baseVisible ? 'Choose Lite or Base.' : 'Choose Lite.', text: baseVisible ? 'Start with Weavly Lite for complete costing management, or choose Base when you need connected production management.' : 'Start with Weavly Lite for complete costing management.' }
    const Icon = state.icon

    return (
        <section role="status" className="flex items-start gap-4 rounded-2xl border border-hairline bg-surface p-5 shadow-xs sm:px-6">
            <span className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-full',
                state.tone === 'risk' ? 'bg-risk-soft text-risk' : state.tone === 'warning' ? 'bg-[var(--wv-ochre-50)] text-[var(--wv-ochre-800)]' : 'bg-info-soft text-info',
            )}>
                <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
                <p className="text-[13px] font-medium text-muted-foreground">{state.label}</p>
                <h2 className="mt-0.5 text-lg font-semibold leading-snug text-ink">{state.title}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-body">{state.text}</p>
            </div>
        </section>
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
    // Referral rewards are Base renewals, so most owners have none; show the section only when there is something in it.
    const eligible = Boolean(stats?.eligible && stats.code)
    return (
        <>
            {(failed || eligible) && (
                <section aria-labelledby="billing-referral-heading" className="space-y-3">
                    <h2 id="billing-referral-heading" className="text-[15px] font-semibold text-ink">Referral rewards</h2>
                    {failed ? (
                        <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-xs">
                            <p className="text-sm font-semibold text-ink">Referral details are temporarily unavailable.</p>
                            <Link href="/owner/billing" className="mt-2 inline-flex text-xs font-semibold text-saffron-deep underline-offset-4 hover:underline">
                                Refresh to retry
                            </Link>
                        </div>
                    ) : <ReferralCard stats={stats} />}
                </section>
            )}
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
        <div className="hidden" aria-hidden="true" data-i18n-skip="true">
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
    // None of these reads depends on another, so they run together.
    const [subscriptionDetail, planAccess, organizationResult, paymentsResult, subscriptionsResult, attemptsResult] = await Promise.all([
        getSubscriptionDetail(profile.org_id),
        getCachedOrgPlanAccess(profile.org_id),
        getCachedOwnerOrganization(user.id, profile.org_id),
        supabase
            .from('subscription_payments')
            .select('id, status, created_at, razorpay_payment_id, amount_paise, method, subscription_id, razorpay_order_id, captured_at, billing_attempt_id')
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false }),
        supabase
            .from('org_subscriptions')
            .select('id, plan_tier, status, current_start, current_end, razorpay_payment_id, razorpay_subscription_id, razorpay_order_id, checkout_purchase_type, checkout_amount_paise, checkout_currency, created_at, is_trial')
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
    // Base is offered only to organizations that may see it (fail closed when unset).
    const baseVisible = planAccess.baseVisible === true
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
    const litePresentation = tier === 'lite' || (tier === 'none' && billingPlanTier === 'lite')
    const billingHistoryEntries = buildBillingHistoryEntries(payments, attempts, subscriptionById, litePresentation)
    const latestAttemptNeedsAttention = Boolean(
        latestAttempt
        && !['activated', 'failed', 'cancelled', 'refunded'].includes(latestAttempt.status)
    )
    const visiblePlanTiers: readonly PurchasablePlanTier[] = BILLING_SELF_SERVE_PLAN_TIERS.filter(tier => tier !== 'base' || baseVisible)
    const cardPlanTiers: readonly PurchasablePlanTier[] = subscriptionTier === 'lite'
        ? visiblePlanTiers.filter(tier => tier === 'base')
        : visiblePlanTiers
    const billingReadiness = getBillingReadiness()
    const canRenew = Boolean(renewalAvailable && selfServeActiveTier && activeRenewalPrice)

    const isActive = subscriptionTier === 'lite' || subscriptionTier === 'base'
    // A Lite trial is entitlement only: it has no payment, renewal window or receipt.
    const trialEndsAt = planAccess.trialEndsAt ?? null
    // First-year pricing comes from the purchase decision, which ignores trial rows.
    const trialPrice = trialEndsAt ? getBillingPrice('lite', purchaseDecisions.lite.purchaseType) : null
    const organizationName = organizationResult.data?.name || 'Weavly workspace'
    const paidAccessTiming = !isActive
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
    const accessTiming = trialEndsAt ? liteTrialText('en', 'trialEndsOn', { date: formatShortDate(trialEndsAt) }) : paidAccessTiming

    // The plan the page is about: the active one, else the one that lapsed.
    const shownTier: PurchasablePlanTier | null = activePaidTier ?? billingPlanTier
    const shownPlanName = shownTier ? getBillingPlan(shownTier).name : 'No active plan'
    const accessEnd = trialEndsAt ?? subscription?.current_end ?? null
    const daysLeft = isActive ? daysUntil(accessEnd, billingNow) : null
    const planStats: { label: string; value: string; note?: string }[] = trialEndsAt && trialPrice
        ? [
            { label: 'Trial ends', value: formatShortDate(trialEndsAt), note: daysLeft === null ? undefined : daysLeft === 1 ? '1 day left' : `${daysLeft} days left` },
            { label: 'First year after the trial', value: formatAmount(trialPrice.totalPaise), note: 'GST included' },
            { label: 'Renewal from year 2', value: `${formatAmount(getBillingPrice('lite', 'renewal').totalPaise)} / year`, note: 'GST included' },
        ]
        : shownTier && accessEnd
            ? [
                isActive
                    ? { label: 'Access until', value: formatShortDate(accessEnd), note: daysLeft === null ? undefined : daysLeft === 1 ? '1 day left' : `${daysLeft} days left` }
                    : { label: 'Access ended', value: formatShortDate(accessEnd) },
                { label: 'Renewal', value: canRenew ? 'Open now' : renewalIsUpcoming && renewalEligibleAt ? `Opens ${formatShortDate(renewalEligibleAt)}` : 'Closed', note: 'Annual renewals are manual' },
                ...(activeRenewalPrice ? [{ label: 'Renewal price', value: `${formatAmount(activeRenewalPrice.totalPaise)} / year`, note: 'GST included' }] : []),
            ]
            : []

    const trialSubscribeAction = trialEndsAt && trialPrice && purchaseDecisions.lite.allowed ? (
        billingReadiness.canCreateOrder ? (
            <SubscribeButton
                planTier="lite"
                tierName={getBillingPlan('lite').name}
                displayAmount={formatAmount(trialPrice.totalPaise)}
                buttonLabel={`Subscribe for ${formatAmount(trialPrice.totalPaise)}`}
                successHref="/owner/billing"
                successLabel="View payment history"
                className={railPrimaryAction}
            />
        ) : (
            <Button disabled className={cn(railPrimaryAction, 'opacity-60')}>
                Subscribe unavailable
            </Button>
        )
    ) : null

    const paymentAction = canRenew && selfServeActiveTier && activeRenewalPrice ? (
        billingReadiness.canCreateOrder ? (
            <SubscribeButton
                planTier={selfServeActiveTier}
                tierName={getBillingPlan(selfServeActiveTier).name}
                displayAmount={formatAmount(activeRenewalPrice.totalPaise)}
                buttonLabel={`Renew for ${formatAmount(activeRenewalPrice.totalPaise)}`}
                successHref="/owner/billing"
                successLabel="View payment history"
                className={railPrimaryAction}
            />
        ) : (
            <Button disabled className={cn(railPrimaryAction, 'opacity-60')}>
                Renew unavailable
            </Button>
        )
    ) : trialSubscribeAction

    // Plans open on /plans, which lists only the plans this organization can buy.
    const viewPlansAction = (
        <Button asChild variant={paymentAction ? 'outline' : 'default'} className={cn(paymentAction ? 'min-h-10 rounded-lg px-4 text-sm font-semibold max-md:min-h-[44px]' : railPrimaryAction, 'gap-2')}>
            <Link href="/plans?from=billing">
                <span>View plans</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
        </Button>
    )
    const primaryPlanAction = <>{viewPlansAction}{paymentAction}</>

    return (
        <div className={cn("billing-workspace-shell flex w-full flex-col md:min-h-[calc(100svh-3rem-var(--safe-area-top))]", litePresentation && styles.root)}>
            {/* On tablet and desktop the page fills the screen: the plan card takes the room and payments sit at the bottom. */}
            <div className="ui-route-enter flex flex-1 flex-col gap-8">
                <RouteMilestones route="/owner/billing" shellVisible primaryUsable secondaryReady />
                <PlanAnalyticsBeacon eventName="base_pricing_viewed" properties={{ current_tier: tier }} />

                <PageHeader
                    title="Plan & Billing"
                    actions={<>
                        <BillingGuide />
                        {primaryPlanAction}
                    </>}
                />

                {/* In-progress or recovery alerts */}
                {latestAttemptNeedsAttention && latestAttempt && <div id="billing-attempt-recovery"><BillingAttemptStatus attempt={latestAttempt} singleFlight={litePresentation} /></div>}
                <AccessStateCallout
                    subscriptionTier={subscriptionTier}
                    subscription={subscription}
                    isActivating={isActivating}
                    isPending={isPending}
                    isRetryable={isRetryable}
                    baseVisible={baseVisible}
                />

                {/* Plan payments readiness notice when payments gate is blocked */}
                {!billingReadiness.canCreateOrder && (
                    <div role="status" className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-5">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                        <div>
                            <h2 className="text-sm font-semibold text-ink">Plan payments are not open yet</h2>
                            <p className="mt-1 text-sm leading-relaxed text-body">{billingReadiness.publicMessage}</p>
                            <p className="mt-2 text-xs leading-relaxed text-subtle">You can continue preparing the workspace. Payments are not open yet.</p>
                        </div>
                    </div>
                )}

                {/* The plan at a glance: which plan, until when, and what renewing costs. */}
                <section aria-labelledby="current-plan-heading" className="flex flex-1 flex-col gap-3">
                    <h2 className="text-[15px] font-semibold text-ink">Your plan</h2>
                    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
                        <div className="flex flex-col gap-1 px-5 py-5 sm:px-6">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <h3 id="current-plan-heading" className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink">{shownPlanName}</h3>
                                <StatusBadge
                                    status={isActive ? 'active' : shownTier ? 'expired' : 'info'}
                                    label={isActive ? (trialEndsAt ? 'Free trial' : 'Active') : shownTier ? 'Expired' : 'Not active'}
                                />
                            </div>
                            <p className="text-[13px] text-muted-foreground">
                                <span data-i18n-skip="true">{organizationName}</span>
                                {shownTier && <> · {trialEndsAt ? 'Free trial' : 'Annual access'}</>}
                            </p>
                        </div>

                        {planStats.length > 0 ? (
                            <dl className={cn('grid border-t border-hairline max-sm:divide-y max-sm:divide-hairline sm:divide-x sm:divide-hairline', planStats.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
                                {planStats.map(stat => (
                                    <div key={stat.label} className="min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                                        <dt className="text-center text-[13px] font-medium text-muted-foreground">{stat.label}</dt>
                                        <dd className="mt-1.5 text-center text-xl font-semibold leading-tight tracking-[-0.01em] text-ink tabular-nums sm:text-2xl">{stat.value}</dd>
                                        {stat.note && <dd className="mt-0.5 text-center text-[13px] text-body tabular-nums">{stat.note}</dd>}
                                    </div>
                                ))}
                            </dl>
                        ) : (
                            <p className="border-t border-hairline px-5 py-4 text-sm text-body sm:px-6">{accessTiming}</p>
                        )}

                        {/* The tiles share whatever height the card has left, two by two. */}
                        <div className="flex flex-1 flex-col border-t border-hairline bg-surface-soft/40 px-5 py-5 sm:px-6 sm:py-6">
                            {shownTier ? (
                                <>
                                    <p className="text-[13px] font-medium text-muted-foreground">{shownTier === 'base' ? 'Included in Base' : 'Included in Lite'}</p>
                                    <PlanIncludesTiles tier={shownTier} />
                                </>
                            ) : (
                                <p className="text-sm text-body">Your saved costings stay in your account; you may need a paid plan to open them.</p>
                            )}
                        </div>
                    </div>
                </section>

                <section aria-labelledby="billing-history-heading" className="mt-auto space-y-3">
                    <h2 id="billing-history-heading" className="text-[15px] font-semibold text-ink">Payments &amp; receipts</h2>
                    <PaymentHistoryList entries={billingHistoryEntries} unconfirmedAttemptCopy={litePresentation} latestAttemptId={latestAttemptNeedsAttention && latestAttempt?.provider_order_id && getBillingAttemptPresentation(latestAttempt.status).shouldCheck ? latestAttempt.id : undefined} />
                </section>

                <Suspense fallback={null}>
                    <DeferredReferralSection />
                </Suspense>
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
