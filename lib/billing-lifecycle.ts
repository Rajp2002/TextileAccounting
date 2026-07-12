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
  created_at?: string | null
}

export type BillingPaymentRow = {
  subscription_id: string | null
  status: string
}

export type BillingPurchaseDecision = {
  allowed: boolean
  purchaseType: BillingPurchaseType
  periodStart: string
  reason?: string
}

const PAID_LIFECYCLE_STATUSES = new Set([
  'active',
  'paused',
  'halted',
  'cancelled',
  'completed',
  'expired',
])

function validTime(value: string | null | undefined): number | null {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

function rowHasPaidHistory(row: BillingSubscriptionRow, capturedSubscriptionIds: Set<string>): boolean {
  if (!isPurchasablePlanTier(row.plan_tier)) return false
  if (capturedSubscriptionIds.has(row.id)) return true
  if (row.razorpay_payment_id || row.razorpay_subscription_id) return true
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
