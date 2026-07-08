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

    // 1. Idempotency Check: Check if this payment already exists
    const { data: existingPayment } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('razorpay_payment_id', razorpayPaymentId)
        .maybeSingle()

    if (existingPayment) {
        // Find existing subscription matching this payment
        const { data: existingSub } = await supabase
            .from('org_subscriptions')
            .select('*')
            .eq('razorpay_payment_id', razorpayPaymentId)
            .maybeSingle()

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
        // If it exists but is not active or has old details, update it.
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
            Sentry.captureException(updateError, {
                tags: { component: 'billing-activation', phase: 'update_subscription' },
            })
            throw updateError
        }
        updatedSub = updated
        subscriptionId = existingSub.id
    } else {
        // Create new active subscription
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
            Sentry.captureException(insertError, {
                tags: { component: 'billing-activation', phase: 'insert_subscription' },
            })
            throw insertError
        }
        updatedSub = inserted
        subscriptionId = inserted.id
    }

    // 3. Insert into subscription_payments
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
