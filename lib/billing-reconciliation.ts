import 'server-only'

import * as Sentry from '@sentry/nextjs'
import { getRazorpay } from '@/lib/razorpay'
import { createAdminClient } from '@/lib/supabase/admin'
import { activateInitialPurchase } from '@/lib/billing-activation'
import { createIdempotentRazorpayRefund } from '@/lib/razorpay-refund-client'
import { readBillingOrderContext, type BillingOrderContext } from '@/lib/billing-lifecycle'
import type { BillingAttemptState } from '@/lib/billing-attempts'

type ProviderPayment = {
  id: string
  status?: string | null
  order_id?: string | null
  amount?: number | string | null
  currency?: string | null
  method?: string | null
  subscription_id?: string | null
  error_code?: string | null
  error_description?: string | null
}

type ProviderOrder = {
  id: string
  status?: string | null
  amount?: number | string | null
  currency?: string | null
  notes?: Record<string, string | number | null | undefined> | null
}

export type BillingReconciliationResult = {
  state: BillingAttemptState
  orderId: string
  paymentId?: string | null
  attemptId?: string | null
  planTier?: BillingOrderContext['planTier']
  purchaseType?: BillingOrderContext['purchaseType']
  amountPaise?: number
  activeUntil?: string | null
  message: string
}

function safeProviderPayment(value: unknown): ProviderPayment {
  return (value ?? {}) as ProviderPayment
}

function safeProviderOrder(value: unknown): ProviderOrder {
  return (value ?? {}) as ProviderOrder
}

function isMatchingPayment(payment: ProviderPayment, orderId: string, amountPaise: number) {
  return payment.order_id === orderId
    && payment.currency === 'INR'
    && Number(payment.amount) === amountPaise
}

function isKnownDuplicateActivation(error: unknown, purchaseType: BillingOrderContext['purchaseType']) {
  // The Sprint 4 activation wrapper emits this exact, deliberately narrow
  // signal when a second first-purchase payment reaches the same tenant/plan.
  // Other activation errors stay in reconciliation_required: an arbitrary
  // database/provider failure must never be mistaken for a duplicate and
  // automatically refunded.
  return purchaseType === 'initial_purchase'
    && error instanceof Error
    && error.message.includes('already has a captured purchase')
}

async function updateAttempt(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  orderId: string,
  values: Record<string, unknown>,
) {
  const { error } = await admin
    .from('billing_checkout_attempts')
    .update({ ...values, last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('provider_order_id', orderId)

  if (error) {
    Sentry.captureException(error, {
      tags: { component: 'billing-reconciliation', phase: 'update_attempt' },
      extra: { orgId, orderId },
    })
  }
}

async function maybeRecordDuplicateRefund({
  admin,
  orgId,
  paymentId,
  amountPaise,
  reason,
}: {
  admin: ReturnType<typeof createAdminClient>
  orgId: string
  paymentId: string
  amountPaise: number
  reason: string
}) {
  if (process.env.BILLING_DUPLICATE_REFUND_ENABLED !== 'true') return 'reconciliation_required' as const

  const idempotencyKey = `wvl_duplicate_${paymentId}`.slice(0, 80)
  const { data: existing, error: existingError } = await admin
    .from('billing_payment_refunds')
    .select('id, status, idempotency_key')
    .eq('razorpay_payment_id', paymentId)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing?.status === 'issued') return 'refunded' as const

  if (!existing) {
    const { error: insertError } = await admin.from('billing_payment_refunds').insert({
      org_id: orgId,
      razorpay_payment_id: paymentId,
      amount_paise: amountPaise,
      reason,
      status: 'pending',
      idempotency_key: idempotencyKey,
    })
    if (insertError && insertError.code !== '23505') throw insertError
  }

  try {
    const refund = await createIdempotentRazorpayRefund({
      paymentId,
      amountPaise,
      idempotencyKey,
      note: reason,
    })
    await admin.from('billing_payment_refunds').update({
      status: 'issued',
      provider_refund_id: refund.id,
      updated_at: new Date().toISOString(),
      last_error: null,
    }).eq('razorpay_payment_id', paymentId).eq('org_id', orgId)
    return 'refunded' as const
  } catch (error) {
    await admin.from('billing_payment_refunds').update({
      status: 'failed',
      attempts: 2,
      last_error: error instanceof Error ? error.message.slice(0, 500) : 'Refund request failed',
      updated_at: new Date().toISOString(),
    }).eq('razorpay_payment_id', paymentId).eq('org_id', orgId)
    Sentry.captureException(error, {
      tags: { component: 'billing-reconciliation', phase: 'duplicate_refund' },
      extra: { orgId, paymentId },
    })
    return 'reconciliation_required' as const
  }
}

async function loadProviderPayments(orderId: string, hintedPaymentId?: string | null) {
  const razorpay = getRazorpay()
  const response = await razorpay.orders.fetchPayments(orderId) as unknown as { items?: unknown[] }
  const payments = (response.items ?? []).map(safeProviderPayment)
  if (hintedPaymentId && !payments.some(payment => payment.id === hintedPaymentId)) {
    try {
      payments.push(safeProviderPayment(await razorpay.payments.fetch(hintedPaymentId)))
    } catch {
      // The order payment list remains the authoritative fallback.
    }
  }
  return payments
}

/**
 * Reconcile one provider order. This is the only shared path that decides
 * whether a one-time payment can activate access. Browser callbacks and
 * webhooks both call it, so late or duplicate delivery converges safely.
 */
export async function reconcileBillingOrder({
  orgId,
  orderId,
  hintedPaymentId,
  source,
}: {
  orgId: string
  orderId: string
  hintedPaymentId?: string | null
  source: 'callback' | 'webhook' | 'owner_status'
}): Promise<BillingReconciliationResult> {
  const admin = createAdminClient()
  const razorpay = getRazorpay()
  const providerOrder = safeProviderOrder(await razorpay.orders.fetch(orderId))
  const context = readBillingOrderContext(providerOrder)

  if (!context || context.orgId !== orgId || providerOrder.id !== orderId) {
    await updateAttempt(admin, orgId, orderId, {
      status: 'reconciliation_required',
      failure_reason: 'Provider order context did not match the organization billing catalog.',
    })
    return {
      state: 'reconciliation_required',
      orderId,
      message: 'Payment order is not recognized for this organization.',
    }
  }

  const [{ data: attempt }, { data: trackedOrder }] = await Promise.all([
    admin.from('billing_checkout_attempts')
      .select('id, status, provider_payment_id')
      .eq('org_id', orgId)
      .eq('provider_order_id', orderId)
      .maybeSingle(),
    admin.from('org_subscriptions')
      .select('id, org_id, status, razorpay_order_id')
      .eq('org_id', orgId)
      .eq('razorpay_order_id', orderId)
      .maybeSingle(),
  ])

  if (!attempt && !trackedOrder) {
    return {
      state: 'reconciliation_required',
      orderId,
      planTier: context.planTier,
      purchaseType: context.purchaseType,
      amountPaise: context.amountPaise,
      message: 'Payment order exists at the provider but is not tracked locally. Support verification is required.',
    }
  }

  const payments = await loadProviderPayments(orderId, hintedPaymentId)
  const captured = payments.find(payment => payment.status === 'captured' && isMatchingPayment(payment, orderId, context.amountPaise))
  if (captured?.id) {
    try {
      const activation = await activateInitialPurchase({
        orgId,
        razorpayOrderId: orderId,
        razorpayPaymentId: captured.id,
        amountPaise: Number(captured.amount),
        method: captured.method ?? null,
        planTier: context.planTier,
        purchaseType: context.purchaseType,
      })
      await updateAttempt(admin, orgId, orderId, {
        status: 'activated',
        provider_payment_id: captured.id,
        provider_status: 'captured',
        provider_order_status: providerOrder.status ?? null,
        failure_reason: null,
      })
      return {
        state: 'activated',
        orderId,
        paymentId: captured.id,
        attemptId: attempt?.id ?? null,
        planTier: context.planTier,
        purchaseType: context.purchaseType,
        amountPaise: context.amountPaise,
        activeUntil: activation.subscription?.current_end ?? null,
        message: 'Payment received and access is active.',
      }
    } catch (error) {
      if (isKnownDuplicateActivation(error, context.purchaseType)) {
        const refundState = await maybeRecordDuplicateRefund({
          admin,
          orgId,
          paymentId: captured.id,
          amountPaise: context.amountPaise,
          reason: 'Duplicate Weavly checkout payment; access was already settled once.',
        })
        await updateAttempt(admin, orgId, orderId, {
          status: refundState,
          provider_payment_id: captured.id,
          provider_status: 'captured',
          failure_reason: 'A prior captured payment already settled this billing intent.',
        })
        return {
          state: refundState,
          orderId,
          paymentId: captured.id,
          attemptId: attempt?.id ?? null,
          planTier: context.planTier,
          purchaseType: context.purchaseType,
          amountPaise: context.amountPaise,
          message: refundState === 'refunded'
            ? 'A duplicate payment was refunded; access was granted once.'
            : 'A duplicate payment needs verification. Do not pay again.',
        }
      }

      await updateAttempt(admin, orgId, orderId, {
        status: 'reconciliation_required',
        provider_payment_id: captured.id,
        provider_status: 'captured',
        failure_reason: error instanceof Error ? error.message.slice(0, 500) : 'Access activation failed after capture.',
      })
      Sentry.captureException(error, {
        tags: { component: 'billing-reconciliation', phase: 'activate_captured', source },
        extra: { orgId, orderId, paymentId: captured.id },
      })
      return {
        state: 'reconciliation_required',
        orderId,
        paymentId: captured.id,
        attemptId: attempt?.id ?? null,
        planTier: context.planTier,
        purchaseType: context.purchaseType,
        amountPaise: context.amountPaise,
        message: 'Payment was received, but access needs verification. Do not pay again.',
      }
    }
  }

  const authorized = payments.find(payment => payment.status === 'authorized' && isMatchingPayment(payment, orderId, context.amountPaise))
  if (authorized?.id) {
    await updateAttempt(admin, orgId, orderId, {
      status: 'authorized',
      provider_payment_id: authorized.id,
      provider_status: 'authorized',
      provider_order_status: providerOrder.status ?? null,
    })
    return {
      state: 'authorized',
      orderId,
      paymentId: authorized.id,
      attemptId: attempt?.id ?? null,
      planTier: context.planTier,
      purchaseType: context.purchaseType,
      amountPaise: context.amountPaise,
      message: 'Payment is authorized and still being confirmed. Do not retry yet.',
    }
  }

  const failed = payments.find(payment => payment.status === 'failed' && isMatchingPayment(payment, orderId, context.amountPaise))
  if (failed?.id) {
    await updateAttempt(admin, orgId, orderId, {
      status: 'failed',
      provider_payment_id: failed.id,
      provider_status: 'failed',
      provider_order_status: providerOrder.status ?? null,
      failure_reason: failed.error_description ?? 'The payment provider reported a failed payment.',
    })
    return {
      state: 'failed',
      orderId,
      paymentId: failed.id,
      attemptId: attempt?.id ?? null,
      planTier: context.planTier,
      purchaseType: context.purchaseType,
      amountPaise: context.amountPaise,
      message: 'Payment failed. No access was activated; you can safely retry.',
    }
  }

  const orderStatus = providerOrder.status ?? 'unknown'
  const state: BillingAttemptState = orderStatus === 'created' || orderStatus === 'attempted' ? 'processing' : 'unknown'
  await updateAttempt(admin, orgId, orderId, {
    status: state,
    provider_order_status: orderStatus,
    provider_status: null,
  })
  return {
    state,
    orderId,
    attemptId: attempt?.id ?? null,
    planTier: context.planTier,
    purchaseType: context.purchaseType,
    amountPaise: context.amountPaise,
    message: 'Payment status is not final yet. Check again before retrying.',
  }
}
