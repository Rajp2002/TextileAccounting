import { createAdminClient } from '@/lib/supabase/admin'
import { processReferralConversion, issueReferralRefund } from '@/lib/referral-webhook'
import * as Sentry from '@sentry/nextjs'
import {
    getBillingPrice,
    type BillingPurchaseType,
    type PurchasablePlanTier,
} from '@/lib/billing-constants'

type AtomicActivationResult = {
    success: boolean
    subscription: {
        id: string
        org_id: string
        plan_tier: string
        status: string
        current_start: string | null
        current_end: string | null
    } | null
    payment: {
        id: string
        razorpay_payment_id: string
        razorpay_order_id: string | null
        amount_paise: number
    } | null
    alreadyProcessed: boolean
}

/**
 * Activate an order-based first purchase or renewal through one database
 * transaction. The legacy export name is retained for existing callers.
 */
export async function activateInitialPurchase({
    orgId,
    razorpayOrderId,
    razorpayPaymentId,
    amountPaise,
    method,
    planTier,
    purchaseType,
}: {
    orgId: string
    razorpayOrderId: string
    razorpayPaymentId: string
    amountPaise: number
    method: string | null
    planTier: PurchasablePlanTier
    purchaseType: BillingPurchaseType
}) {
    const expectedAmount = getBillingPrice(planTier, purchaseType).totalPaise
    if (amountPaise !== expectedAmount) {
        throw new Error(`Payment amount does not match the ${planTier} ${purchaseType}.`)
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('activate_order_billing_purchase', {
        p_org_id: orgId,
        p_razorpay_order_id: razorpayOrderId,
        p_razorpay_payment_id: razorpayPaymentId,
        p_amount_paise: amountPaise,
        p_method: method,
        p_plan_tier: planTier,
        p_purchase_type: purchaseType,
        p_currency: 'INR',
    })

    if (error) {
        Sentry.captureException(error, {
            tags: { component: 'billing-activation', phase: 'atomic_activation' },
            extra: { orgId, razorpayOrderId, planTier, purchaseType },
        })
        throw error
    }

    const result = data as AtomicActivationResult | null
    if (!result?.success || !result.subscription || !result.payment) {
        throw new Error('Atomic billing activation returned an invalid result.')
    }

    // Side effects run only for the transaction that inserted the payment.
    // Duplicate verification/webhook deliveries return the committed result.
    if (!result.alreadyProcessed) {
        try {
            await processReferralConversion(orgId)
        } catch (err) {
            Sentry.captureException(err, {
                tags: { component: 'billing-activation', phase: 'process_referral' },
            })
        }

        try {
            await issueReferralRefund(orgId, razorpayPaymentId, amountPaise)
        } catch (err) {
            Sentry.captureException(err, {
                tags: { component: 'billing-activation', phase: 'issue_refund' },
            })
        }
    }

    return result
}
