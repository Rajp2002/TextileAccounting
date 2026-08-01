import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { reconcileBillingOrder } from '@/lib/billing-reconciliation'
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

    // The reconciliation service performs the canonical Razorpay order and
    // payment fetch, exact catalog validation, and atomic activation. Keeping
    // that logic shared with webhooks prevents callback/webhook divergence.
    try {
        const result = await reconcileBillingOrder({
            orgId,
            orderId: razorpay_order_id,
            hintedPaymentId: razorpay_payment_id,
            source: 'callback',
        })

        if (result.state === 'activated') {
            return NextResponse.json({
                success: true,
                activeUntil: result.activeUntil,
                paymentId: result.paymentId ?? razorpay_payment_id,
                orderId: result.orderId,
                planTier: result.planTier,
                purchaseType: result.purchaseType,
                amountPaise: result.amountPaise,
            })
        }

        const status = result.state === 'failed' || result.state === 'duplicate' || result.state === 'reconciliation_required' ? 409 : 202
        return NextResponse.json({
            error: result.message,
            activationPending: status === 202,
            state: result.state,
            paymentId: result.paymentId ?? razorpay_payment_id,
            orderId: result.orderId,
            planTier: result.planTier,
            purchaseType: result.purchaseType,
        }, { status })
    } catch (err) {
        Sentry.captureException(err, {
            tags: { route: 'billing_verify_payment', phase: 'verification_process' }
        })
        // An upstream timeout after a real payment must never instruct Rajesh
        // to pay again. Webhook/status reconciliation will finish the attempt.
        return NextResponse.json({
            error: 'Payment status is being confirmed. Do not pay again; check Billing again shortly.',
            activationPending: true,
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
        }, { status: 202 })
    }
}
