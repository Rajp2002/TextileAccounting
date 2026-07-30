import {
  ACCESS_DAYS,
  BILLING_MODEL,
  getBillingPrice,
  isBillingPurchaseType,
  isPurchasablePlanTier,
  type BillingPurchaseType,
  type PurchasablePlanTier,
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
  created_at?: string | null
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
  const latest = [...subscriptions].sort((left, right) => {
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
  if (!isPurchasablePlanTier(row.plan_tier)) return false
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
 * Trial rows never count as a paid purchase. A same-tier paid history receives
 * renewal pricing; a first purchase of the target tier receives first-year
 * pricing. Active Premium access cannot be downgraded through checkout.
 */
export function resolveBillingPurchase(
  subscriptions: BillingSubscriptionRow[],
  payments: BillingPaymentRow[],
  targetTier: PurchasablePlanTier,
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
  const hasActivePremium = activePaidRows.some((row) => row.plan_tier === 'premium')

  if (targetTier === 'base' && hasActivePremium) {
    return {
      allowed: false,
      purchaseType: 'initial_purchase',
      periodStart: now.toISOString(),
      reason: 'Weavly Full Suite already includes Estimator access. A downgrade can be selected after the current Premium period ends.',
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

  return {
    allowed: true,
    purchaseType,
    periodStart: new Date(periodStartMs).toISOString(),
  }
}

export type BillingOrderLike = {
  amount?: string | number | null
  currency?: string | null
  notes?: Record<string, string | number | null | undefined> | null
}

export type BillingOrderContext = {
  orgId: string
  planTier: PurchasablePlanTier
  purchaseType: BillingPurchaseType
  amountPaise: number
}

/** Validate every server-owned commercial field stored on a Razorpay order. */
export function readBillingOrderContext(order: BillingOrderLike): BillingOrderContext | null {
  const notes = order.notes ?? {}
  const orgId = typeof notes.org_id === 'string' ? notes.org_id : ''
  const planTier = notes.plan_tier
  const purchaseType = notes.purchase_type ?? notes.payment_type

  if (!orgId || !isPurchasablePlanTier(planTier) || !isBillingPurchaseType(purchaseType)) return null
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
