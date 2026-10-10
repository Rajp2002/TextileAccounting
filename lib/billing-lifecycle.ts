import {
  ACCESS_DAYS,
  BILLING_MODEL,
  getBillingPrice,
  isBillingPurchaseType,
  isBillingPlanTier,
  RENEWAL_ELIGIBILITY_DAYS,
  type BillingPurchaseType,
  type BillingPlanTier,
} from './billing-constants'

export type BillingSubscriptionRow = {
  id: string
  plan_tier: string | null
  status: string
  current_start?: string | null
  current_end: string | null
  razorpay_payment_id?: string | null
  razorpay_subscription_id?: string | null
  razorpay_order_id?: string | null
  checkout_purchase_type?: BillingPurchaseType | null
  checkout_amount_paise?: number | null
  checkout_currency?: string | null
  created_at?: string | null
  /** A Lite trial row is entitlement only; it is never paid or renewal history. */
  is_trial?: boolean | null
}

export type BillingPaymentRow = {
  subscription_id: string | null
  status: string
  razorpay_order_id?: string | null
  razorpay_payment_id?: string | null
}

export type BillingCheckoutPresentation =
  | { state: 'none'; subscription: BillingSubscriptionRow | null }
  | { state: 'pending'; subscription: BillingSubscriptionRow }
  | { state: 'activating'; subscription: BillingSubscriptionRow }
  | { state: 'retryable'; subscription: BillingSubscriptionRow }

export type BillingPurchaseDecision = {
  allowed: boolean
  purchaseType: BillingPurchaseType
  periodStart: string
  renewalEligibleAt?: string | null
  reason?: string
}

const PAID_LIFECYCLE_STATUSES = new Set([
  'active',
  'authenticated',
  'paused',
  'completed',
  'expired',
])

function validTime(value: string | null | undefined): number | null {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

/** Return the first instant at which a same-plan renewal may be purchased. */
export function getRenewalEligibilityDate(
  currentEnd: string | null | undefined,
  eligibilityDays = RENEWAL_ELIGIBILITY_DAYS,
): string | null {
  const endMs = validTime(currentEnd)
  if (endMs === null) return null
  return new Date(endMs - eligibilityDays * 24 * 60 * 60 * 1000).toISOString()
}

export function isRenewalEligible(
  currentEnd: string | null | undefined,
  now = new Date(),
  eligibilityDays = RENEWAL_ELIGIBILITY_DAYS,
): boolean {
  const endMs = validTime(currentEnd)
  if (endMs === null) return true
  // A lapsed plan must still be renewable. The 30-day restriction applies
  // only while the current paid period is still active.
  if (endMs <= now.getTime()) return true
  return endMs - now.getTime() <= eligibilityDays * 24 * 60 * 60 * 1000
}

/**
 * Resolve the truthful checkout state shown on the billing page.
 *
 * Creating a Razorpay order is not proof that payment was received. Failed or
 * dismissed checkouts must immediately return to a retryable state, while only
 * a verified `authenticated` row may claim that activation is in progress.
 */
export function resolveBillingCheckoutPresentation(
  subscriptions: BillingSubscriptionRow[],
  payments: BillingPaymentRow[],
  now = new Date(),
  pendingWindowMs = 15 * 60 * 1000,
): BillingCheckoutPresentation {
  // A Lite trial is entitlement, not a checkout, so it can never be the latest
  // checkout that hides a retryable or pending one.
  const latest = subscriptions
    .filter((row) => row.is_trial !== true)
    .sort((left, right) => {
      const leftTime = validTime(left.created_at) ?? 0
      const rightTime = validTime(right.created_at) ?? 0
      return rightTime - leftTime
    })[0] ?? null

  if (!latest) return { state: 'none', subscription: null }
  if (latest.status === 'authenticated') return { state: 'activating', subscription: latest }

  const failed = payments.some((payment) =>
    payment.status === 'failed'
    && (
      (payment.subscription_id && payment.subscription_id === latest.id)
      || (payment.razorpay_order_id && payment.razorpay_order_id === latest.razorpay_order_id)
    ))
  const createdAt = validTime(latest.created_at)
  const pendingIsFresh = createdAt !== null && createdAt > now.getTime() - pendingWindowMs

  if (latest.status === 'created' && !failed && pendingIsFresh) {
    return { state: 'pending', subscription: latest }
  }
  if (['created', 'halted', 'cancelled', 'failed'].includes(latest.status) || failed) {
    return { state: 'retryable', subscription: latest }
  }
  return { state: 'none', subscription: latest }
}

function rowHasPaidHistory(row: BillingSubscriptionRow, capturedSubscriptionIds: Set<string>): boolean {
  // A trial is active entitlement with no payment. Checking it first keeps a
  // trial out of pricing history even if payment evidence points at its id.
  if (row.is_trial === true) return false
  if (!isBillingPlanTier(row.plan_tier)) return false
  if (capturedSubscriptionIds.has(row.id)) return true
  if (row.razorpay_payment_id) return true
  if (row.razorpay_subscription_id && validTime(row.current_start) !== null && validTime(row.current_end) !== null) {
    return true
  }
  // `halted` and `cancelled` are also used for failed or dismissed first
  // checkouts. They are paid history only when a captured payment or a
  // completed paid period on the entitlement row proves it.
  return PAID_LIFECYCLE_STATUSES.has(row.status)
}

function isCurrentlyActive(row: BillingSubscriptionRow, nowMs: number): boolean {
  if (!['active', 'authenticated'].includes(row.status)) return false
  const endMs = validTime(row.current_end)
  return endMs === null || endMs > nowMs
}

/**
 * Resolve checkout pricing from server-owned subscription and payment history.
 * A same-tier paid history receives
 * renewal pricing; a first purchase of the target tier receives first-year
 * pricing.
 */
export function resolveBillingPurchase(
  subscriptions: BillingSubscriptionRow[],
  payments: BillingPaymentRow[],
  targetTier: 'lite' | 'base',
  now = new Date()
): BillingPurchaseDecision {
  const nowMs = now.getTime()
  const capturedSubscriptionIds = new Set(
    payments
      .filter((payment) => payment.status === 'captured' && payment.subscription_id)
      .map((payment) => payment.subscription_id as string)
  )

  const paidRows = subscriptions.filter((row) => rowHasPaidHistory(row, capturedSubscriptionIds))
  const activePaidRows = paidRows.filter((row) => isCurrentlyActive(row, nowMs))
  const hasActiveBase = activePaidRows.some((row) => row.plan_tier === 'base')

  if (targetTier === 'lite' && hasActiveBase) {
    return {
      allowed: false,
      purchaseType: 'renewal',
      periodStart: now.toISOString(),
      reason: 'A Lite subscription can be selected after the current Base period ends.',
    }
  }

  const targetHistory = paidRows.filter((row) => row.plan_tier === targetTier)
  const purchaseType: BillingPurchaseType = targetHistory.length > 0 ? 'renewal' : 'initial_purchase'

  const futureTargetEnds = targetHistory
    .map((row) => validTime(row.current_end))
    .filter((time): time is number => time !== null && time > nowMs)
  const periodStartMs = purchaseType === 'renewal' && futureTargetEnds.length > 0
    ? Math.max(...futureTargetEnds)
    : nowMs

  const targetEndMs = futureTargetEnds.length > 0 ? Math.max(...futureTargetEnds) : null
  const renewalEligibleAt = targetEndMs === null
    ? null
    : getRenewalEligibilityDate(new Date(targetEndMs).toISOString())

  if (
    purchaseType === 'renewal'
    && targetEndMs !== null
    && !isRenewalEligible(new Date(targetEndMs).toISOString(), now)
  ) {
    return {
      allowed: false,
      purchaseType,
      periodStart: new Date(periodStartMs).toISOString(),
      renewalEligibleAt,
      reason: `Renewal opens ${RENEWAL_ELIGIBILITY_DAYS} days before your current plan expires.`,
    }
  }

  return {
    allowed: true,
    purchaseType,
    periodStart: new Date(periodStartMs).toISOString(),
    renewalEligibleAt,
  }
}

export type BillingOrderLike = {
  amount?: string | number | null
  currency?: string | null
  notes?: Record<string, string | number | null | undefined> | null
}

export type BillingOrderContext = {
  orgId: string
  planTier: BillingPlanTier
  purchaseType: BillingPurchaseType
  amountPaise: number
}

/** Validate every server-owned commercial field stored on a Razorpay order. */
export function readBillingOrderContext(order: BillingOrderLike): BillingOrderContext | null {
  const notes = order.notes ?? {}
  const orgId = typeof notes.org_id === 'string' ? notes.org_id : ''
  const planTier = notes.plan_tier
  const purchaseType = notes.purchase_type ?? notes.payment_type

  if (!orgId || !isBillingPlanTier(planTier) || !isBillingPurchaseType(purchaseType)) return null
  if (notes.purchase_type && notes.payment_type && notes.purchase_type !== notes.payment_type) return null

  const price = getBillingPrice(planTier, purchaseType)
  const amount = Number(order.amount)
  const currency = order.currency

  if (
    amount !== price.totalPaise ||
    currency !== 'INR' ||
    notes.billing_model !== BILLING_MODEL ||
    Number(notes.base_amount_paise) !== price.basePaise ||
    Number(notes.gst_paise) !== price.gstPaise ||
    Number(notes.total_paise) !== price.totalPaise ||
    Number(notes.access_days) !== ACCESS_DAYS ||
    (notes.currency !== undefined && notes.currency !== 'INR')
  ) {
    return null
  }

  return { orgId, planTier, purchaseType, amountPaise: price.totalPaise }
}
