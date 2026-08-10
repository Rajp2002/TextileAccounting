import { createAdminClient } from '@/lib/supabase/admin'
import { processReferralConversion } from '@/lib/referral-webhook'
import { ensureBillingInvoice } from '@/lib/billing-invoice'
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

    // Invoice issuance is deliberately non-blocking for access. If the
    // approved GST configuration or customer billing profile is incomplete,
    // the payment receipt remains available and the invoice can be issued for
    // a later eligible payment without holding up Rajesh's access.
    try {
        await ensureBillingInvoice({
            orgId,
            paymentId: result.payment.id,
            planTier,
            purchaseType,
            amountPaise,
        })
    } catch (err) {
        Sentry.captureException(err, {
            tags: { component: 'billing-activation', phase: 'issue_gst_invoice' },
            extra: { orgId, razorpayOrderId, planTier, purchaseType },
        })
    }

    // Referral conversion is safe to retry after a duplicate callback. If a
    // transient database error interrupted the first attempt, a later
    // webhook/status reconciliation can still grant the one idempotent credit.
    try {
        await processReferralConversion(orgId)
    } catch (err) {
        Sentry.captureException(err, {
            tags: { component: 'billing-activation', phase: 'process_referral' },
        })
    }

    return result
}
