import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { razorpay } from '@/lib/razorpay'
import { createClient } from '@/lib/supabase/server'
import { activateInitialPurchase } from '@/lib/billing-activation'
import { BILLING_MODEL } from '@/lib/billing-constants'
import { readBillingOrderContext, type BillingOrderContext } from '@/lib/billing-lifecycle'
import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'

/**
 * POST /api/billing/verify-payment
 *
 * Verifies Razorpay signature and canonical order/payment details before
 * atomically activating or renewing the bound Estimator/Full Suite plan.
 */
export async function POST(req: NextRequest) {
    // 1. Auth check
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get owner profile & org
    const { data: profile } = await supabase
        .from('profiles')
        .select('org_id, role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'owner' || !profile.org_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgId = profile.org_id

    // 2. Parse request body
    let body: {
        razorpay_order_id?: string
        razorpay_payment_id?: string
        razorpay_signature?: string
    } = {}

    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // 3. Verify HMAC signature
    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret) {
        Sentry.captureMessage('RAZORPAY_KEY_SECRET is not set', 'error')
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex')

    const expectedSignature = Buffer.from(generatedSignature, 'hex')
    const providedSignature = Buffer.from(razorpay_signature, 'hex')
    if (
        expectedSignature.length !== providedSignature.length ||
        !crypto.timingSafeEqual(expectedSignature, providedSignature)
    ) {
        return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    let capturedContext: BillingOrderContext | null = null
    let paymentWasCaptured = false

    // 4. Server-side validation against Razorpay API
    try {
        // Fetch order to verify details
        const order = await razorpay.orders.fetch(razorpay_order_id)
        if (!order) {
            return NextResponse.json({ error: 'Order not found on Razorpay' }, { status: 400 })
        }

        // Validate the complete commercial context from the canonical Razorpay
        // order. No amount, tier, or purchase type is accepted from the client.
        const orderContext = readBillingOrderContext(order)
        if (!orderContext || orderContext.orgId !== orgId) {
            Sentry.captureMessage(`Razorpay order verification failed. Context mismatch for order: ${razorpay_order_id}`, 'warning')
            return NextResponse.json({ error: 'Payment validation failed' }, { status: 400 })
        }
        capturedContext = orderContext

        // Bind the Razorpay order to the local server-created checkout row.
        const { data: trackedOrder, error: trackedOrderError } = await supabase
            .from('org_subscriptions')
            .select('org_id, plan_tier, billing_model, razorpay_order_id, checkout_purchase_type, checkout_amount_paise, checkout_currency')
            .eq('razorpay_order_id', razorpay_order_id)
            .maybeSingle()

        if (
            trackedOrderError ||
            !trackedOrder ||
            trackedOrder.org_id !== orgId ||
            trackedOrder.plan_tier !== orderContext.planTier ||
            trackedOrder.billing_model !== BILLING_MODEL ||
            trackedOrder.checkout_purchase_type !== orderContext.purchaseType ||
            Number(trackedOrder.checkout_amount_paise) !== orderContext.amountPaise ||
            trackedOrder.checkout_currency !== 'INR'
        ) {
            Sentry.captureMessage(`Untracked or mismatched Razorpay order rejected: ${razorpay_order_id}`, 'warning')
            return NextResponse.json({ error: 'Payment order is not recognized.' }, { status: 400 })
        }

        // Fetch payment details to check status and method
        const payment = await razorpay.payments.fetch(razorpay_payment_id)
        if (!payment) {
            return NextResponse.json({ error: 'Payment not found on Razorpay' }, { status: 400 })
        }

        if (payment.order_id !== razorpay_order_id) {
            return NextResponse.json({ error: 'Payment does not belong to this order' }, { status: 400 })
        }

        if (
            payment.status !== 'captured' ||
            Number(payment.amount) !== orderContext.amountPaise ||
            payment.currency !== 'INR'
        ) {
            Sentry.captureMessage(`Uncaptured or amount-mismatched payment rejected: ${razorpay_payment_id}`, 'warning')
            return NextResponse.json({ error: 'Payment has not been captured for the selected plan.' }, { status: 400 })
        }
        paymentWasCaptured = true

        // Activate the subscription using the shared helper
        const result = await activateInitialPurchase({
            orgId: orgId,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            amountPaise: Number(payment.amount),
            method: payment.method || null,
            planTier: orderContext.planTier,
            purchaseType: orderContext.purchaseType,
        })

        return NextResponse.json({
            success: true,
            activeUntil: result.subscription?.current_end,
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            planTier: orderContext.planTier,
            purchaseType: orderContext.purchaseType,
            amountPaise: Number(payment.amount),
        })
    } catch (err) {
        Sentry.captureException(err, {
            tags: { route: 'billing_verify_payment', phase: 'verification_process' }
        })
        if (paymentWasCaptured && capturedContext) {
            // Razorpay has confirmed the money, but the local activation may
            // still complete through the webhook. Do not ask the owner to pay
            // again while this state is reconciling.
            return NextResponse.json({
                error: 'Payment received. We are confirming access now.',
                activationPending: true,
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
                planTier: capturedContext.planTier,
                purchaseType: capturedContext.purchaseType,
            }, { status: 202 })
        }
        return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 })
    }
}
