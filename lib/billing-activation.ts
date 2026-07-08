import { createAdminClient } from '@/lib/supabase/admin'
import { processReferralConversion, issueReferralRefund } from '@/lib/referral-webhook'
import * as Sentry from '@sentry/nextjs'

export async function activateInitialPurchase({
    orgId,
    razorpayOrderId,
    razorpayPaymentId,
    amountPaise,
    method,
}: {
    orgId: string
    razorpayOrderId: string
    razorpayPaymentId: string
    amountPaise: number
    method: string | null
}) {
    const supabase = createAdminClient()

    console.log(`[billing-activation] Starting activation for org: ${orgId}, order: ${razorpayOrderId}, payment: ${razorpayPaymentId}, amount: ${amountPaise}`)

    // 1. Idempotency Check: Check if this payment already exists with 'captured' status
    let { data: existingPayment } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('razorpay_payment_id', razorpayPaymentId)
        .eq('status', 'captured')
        .maybeSingle()

    // Also check if there's any captured payment for this order ID
    if (!existingPayment) {
        const { data: payByOrder } = await supabase
            .from('subscription_payments')
            .select('*')
            .eq('razorpay_order_id', razorpayOrderId)
            .eq('status', 'captured')
            .maybeSingle()
        if (payByOrder) {
            console.log(`[billing-activation] Found existing captured payment by order ID: ${razorpayOrderId}`)
            existingPayment = payByOrder
        }
    } else {
        console.log(`[billing-activation] Found existing captured payment by payment ID: ${razorpayPaymentId}`)
    }

    if (existingPayment) {
        // Find existing subscription matching this payment/order
        const { data: existingSub } = await supabase
            .from('org_subscriptions')
            .select('*')
            .eq('id', existingPayment.subscription_id)
            .maybeSingle()

        console.log(`[billing-activation] Payment already processed. Returning success. Sub status: ${existingSub?.status}`)
        return {
            success: true,
            subscription: existingSub,
            payment: existingPayment,
            alreadyProcessed: true,
        }
    }

    // 2. Fetch or update subscription for this order
    // Determine the period start and end (365 days)
    const now = new Date()
    const currentEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

    let subscriptionId: string
    let updatedSub = null

    // Check if subscription record already exists for this order
    const { data: existingSub } = await supabase
        .from('org_subscriptions')
        .select('*')
        .eq('razorpay_order_id', razorpayOrderId)
        .maybeSingle()

    if (existingSub) {
        if (existingSub.status === 'active' && existingSub.razorpay_payment_id) {
            console.log(`[billing-activation] Subscription for order ${razorpayOrderId} is already active with payment ${existingSub.razorpay_payment_id}`)
            const { data: pay } = await supabase
                .from('subscription_payments')
                .select('*')
                .eq('razorpay_payment_id', existingSub.razorpay_payment_id)
                .eq('status', 'captured')
                .maybeSingle()

            return {
                success: true,
                subscription: existingSub,
                payment: pay || existingPayment,
                alreadyProcessed: true,
            }
        }

        console.log(`[billing-activation] Updating existing subscription ${existingSub.id} status to active...`)
        const { data: updated, error: updateError } = await supabase
            .from('org_subscriptions')
            .update({
                status: 'active',
                plan_tier: 'premium',
                billing_model: 'upfront_first_year_plus_annual_renewal',
                current_start: now.toISOString(),
                current_end: currentEnd.toISOString(),
                razorpay_payment_id: razorpayPaymentId,
                updated_at: now.toISOString(),
            })
            .eq('id', existingSub.id)
            .select()
            .single()

        if (updateError) {
            console.error('[billing-activation] Update subscription error:', JSON.stringify(updateError, null, 2))
            Sentry.captureException(updateError, {
                tags: { component: 'billing-activation', phase: 'update_subscription' },
            })
            throw updateError
        }
        updatedSub = updated
        subscriptionId = existingSub.id
    } else {
        // Create new active subscription
        console.log(`[billing-activation] Creating new active subscription for org ${orgId}...`)
        const { data: inserted, error: insertError } = await supabase
            .from('org_subscriptions')
            .insert({
                org_id: orgId,
                plan_id: null, // order-based subscriptions don't use Plan ID
                plan_tier: 'premium',
                status: 'active',
                billing_model: 'upfront_first_year_plus_annual_renewal',
                current_start: now.toISOString(),
                current_end: currentEnd.toISOString(),
                razorpay_order_id: razorpayOrderId,
                razorpay_payment_id: razorpayPaymentId,
            })
            .select()
            .single()

        if (insertError) {
            console.error('[billing-activation] Insert subscription error:', JSON.stringify(insertError, null, 2))
            Sentry.captureException(insertError, {
                tags: { component: 'billing-activation', phase: 'insert_subscription' },
            })
            throw insertError
        }
        updatedSub = inserted
        subscriptionId = inserted.id
    }

    // 3. Insert into subscription_payments
    console.log(`[billing-activation] Recording payment history...`)
    let insertedPayment = null
    const { data: newPayment, error: paymentError } = await supabase
        .from('subscription_payments')
        .insert({
            org_id: orgId,
            subscription_id: subscriptionId,
            razorpay_payment_id: razorpayPaymentId,
            razorpay_order_id: razorpayOrderId,
            amount_paise: amountPaise,
            status: 'captured',
            method: method,
            captured_at: now.toISOString(),
        })
        .select()
        .single()

    if (paymentError) {
        console.error('[billing-activation] Insert payment error:', JSON.stringify(paymentError, null, 2))
        if (paymentError.code === '23505') {
            // Concurrent payment insert
            Sentry.captureMessage(
                `Concurrent payment insert prevented for ${razorpayPaymentId}`,
                'warning'
            )
            // Fetch the existing payment recorded by the concurrent thread
            const { data: finalPayment } = await supabase
                .from('subscription_payments')
                .select('*')
                .eq('razorpay_payment_id', razorpayPaymentId)
                .single()
            return {
                success: true,
                subscription: updatedSub,
                payment: finalPayment,
                alreadyProcessed: true,
            }
        } else {
            Sentry.captureException(paymentError, {
                tags: { component: 'billing-activation', phase: 'insert_payment' },
            })
            throw paymentError
        }
    }
    insertedPayment = newPayment

    // 4. Trigger referrals & refunds post-activation
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

    return {
        success: true,
        subscription: updatedSub,
        payment: insertedPayment,
        alreadyProcessed: false,
    }
}
