import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { razorpay } from '@/lib/razorpay'
import { createClient } from '@/lib/supabase/server'
import { activateInitialPurchase } from '@/lib/billing-activation'
import {
    FIRST_YEAR_TOTAL_PAISE,
    BILLING_MODEL
} from '@/lib/billing-constants'
import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'

/**
 * POST /api/billing/verify-payment
 *
 * Verifies Razorpay signature and checks order details from Razorpay server-side before activating full-suite premium entitlement.
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

    if (generatedSignature !== razorpay_signature) {
        return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    // 4. Server-side validation against Razorpay API
    try {
        console.log(`[verify-payment] Fetching order from Razorpay: ${razorpay_order_id}`)
        // Fetch order to verify details
        const order = await razorpay.orders.fetch(razorpay_order_id)
        if (!order) {
            console.error(`[verify-payment] Order ${razorpay_order_id} not found on Razorpay`)
            return NextResponse.json({ error: 'Order not found on Razorpay' }, { status: 400 })
        }

        // Validate amount, currency, billing model, payment type, and org_id matching
        const notes = order.notes || {}
        const notesOrgId = notes.org_id
        const paymentType = notes.payment_type
        const billingModel = notes.billing_model

        console.log(`[verify-payment] Checking order notes: org_id=${notesOrgId} (expected: ${orgId}), payment_type=${paymentType}, billing_model=${billingModel}`)
        console.log(`[verify-payment] Checking order properties: amount=${order.amount} (expected: ${FIRST_YEAR_TOTAL_PAISE}), currency=${order.currency} (expected: INR)`)

        if (
            Number(order.amount) !== FIRST_YEAR_TOTAL_PAISE ||
            order.currency !== 'INR' ||
            paymentType !== 'initial_purchase' ||
            billingModel !== BILLING_MODEL ||
            notesOrgId !== orgId
        ) {
            console.error(`[verify-payment] Context mismatch for order: ${razorpay_order_id}`)
            Sentry.captureMessage(`Razorpay order verification failed. Context mismatch for order: ${razorpay_order_id}`, 'warning')
            return NextResponse.json({ error: 'Payment validation failed' }, { status: 400 })
        }

        console.log(`[verify-payment] Fetching payment from Razorpay: ${razorpay_payment_id}`)
        // Fetch payment details to check status and method
        const payment = await razorpay.payments.fetch(razorpay_payment_id)
        if (!payment) {
            console.error(`[verify-payment] Payment ${razorpay_payment_id} not found on Razorpay`)
            return NextResponse.json({ error: 'Payment not found on Razorpay' }, { status: 400 })
        }

        console.log(`[verify-payment] Checking payment: status=${payment.status}, order_id=${payment.order_id}`)

        if (payment.order_id !== razorpay_order_id) {
            console.error(`[verify-payment] Payment ${razorpay_payment_id} order ID mismatch (expected: ${razorpay_order_id}, got: ${payment.order_id})`)
            return NextResponse.json({ error: 'Payment does not belong to this order' }, { status: 400 })
        }

        // Activate the subscription using the shared helper
        const result = await activateInitialPurchase({
            orgId: orgId,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            amountPaise: Number(payment.amount),
            method: payment.method || null,
        })

        console.log(`[verify-payment] Activation successful! Sub end: ${result.subscription?.current_end}`)

        return NextResponse.json({
            success: true,
            activeUntil: result.subscription?.current_end,
        })
    } catch (err) {
        console.error('[verify-payment] Unexpected verification error:', err)
        Sentry.captureException(err, {
            tags: { route: 'billing_verify_payment', phase: 'verification_process' }
        })
        return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 })
    }
}
