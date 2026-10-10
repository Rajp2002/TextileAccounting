import type { BillingPurchaseType, PurchasablePlanTier } from './billing-constants'

export type BillingAttemptState =
  | 'creating'
  | 'created'
  | 'processing'
  | 'unknown'
  | 'failed'
  | 'cancelled'
  | 'authorized'
  | 'captured'
  | 'activation_pending'
  | 'activated'
  | 'duplicate'
  | 'reconciliation_required'
  | 'refunded'

export type BillingAttemptRow = {
  id: string
  org_id: string
  client_request_id: string
  plan_tier: PurchasablePlanTier
  purchase_type: BillingPurchaseType
  status: BillingAttemptState
  provider_order_id: string | null
  provider_payment_id: string | null
  provider_order_status?: string | null
  provider_status?: string | null
  failure_code?: string | null
  failure_reason?: string | null
  created_at?: string | null
  updated_at?: string | null
  last_checked_at?: string | null
}
export type BillingAttemptPresentation = {
  label: string
  message: string
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  canRetry: boolean
  shouldCheck: boolean
}

const RETRYABLE_STATES = new Set<BillingAttemptState>(['failed', 'cancelled', 'refunded'])

export function isBillingAttemptState(value: unknown): value is BillingAttemptState {
  return [
    'creating',
    'created',
    'processing',
    'unknown',
    'failed',
    'cancelled',
    'authorized',
    'captured',
    'activation_pending',
    'activated',
    'duplicate',
    'reconciliation_required',
    'refunded',
  ].includes(value as BillingAttemptState)
}

export function getBillingAttemptPresentation(state: BillingAttemptState): BillingAttemptPresentation {
  switch (state) {
    case 'activated':
      return {
        label: 'Payment successful',
        message: 'Your plan is active. Keep this payment reference for your records.',
        tone: 'success',
        canRetry: false,
        shouldCheck: false,
      }
    case 'captured':
    case 'activation_pending':
      return {
        label: 'Payment received',
        message: 'We received the payment and are confirming access. Do not pay again.',
        tone: 'info',
        canRetry: false,
        shouldCheck: true,
      }
    case 'authorized':
      return {
        label: 'Payment being confirmed',
        message: 'The bank has authorized the payment, but access starts only after capture. Do not retry yet.',
        tone: 'warning',
        canRetry: false,
        shouldCheck: true,
      }
    case 'failed':
      return {
        label: 'Payment failed',
        message: 'No access was activated. You can safely try again.',
        tone: 'danger',
        canRetry: true,
        shouldCheck: false,
      }
    case 'cancelled':
      return {
        label: 'Payment cancelled',
        message: 'No payment was confirmed. You can try again when ready.',
        tone: 'neutral',
        canRetry: true,
        shouldCheck: false,
      }
    case 'refunded':
      return {
        label: 'Payment refunded',
        message: 'This payment was refunded and did not extend access.',
        tone: 'neutral',
        canRetry: true,
        shouldCheck: false,
      }
    case 'duplicate':
      return {
        label: 'Duplicate payment detected',
        message: 'Your plan is active. We are checking the extra payment; do not pay again.',
        tone: 'warning',
        canRetry: false,
        shouldCheck: true,
      }
    case 'reconciliation_required':
      return {
        label: 'Payment needs verification',
        message: 'We received an unusual payment result. Please do not retry; support will verify it.',
        tone: 'warning',
        canRetry: false,
        shouldCheck: true,
      }
    case 'unknown':
      return {
        label: 'Payment status unknown',
        message: 'We could not confirm the bank result yet. Check status before trying again.',
        tone: 'warning',
        canRetry: false,
        shouldCheck: true,
      }
    case 'creating':
    case 'created':
      return {
        label: 'Payment setup ready',
        message: 'Complete the secure Razorpay checkout. Closing it does not confirm a payment.',
        tone: 'neutral',
        canRetry: false,
        shouldCheck: true,
      }
    case 'processing':
    default:
      return {
        label: 'Payment being checked',
        message: 'We are checking the payment provider. Do not pay again while this is shown.',
        tone: 'info',
        canRetry: false,
        shouldCheck: true,
      }
  }
}

export function isBillingAttemptRetryable(state: BillingAttemptState) {
  return RETRYABLE_STATES.has(state)
}
