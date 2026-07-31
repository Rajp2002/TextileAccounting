import { NextRequest, NextResponse } from 'next/server'
import { razorpay } from '@/lib/razorpay'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as Sentry from '@sentry/nextjs'
import {
    getBillingPlan,
    getBillingPrice,
    isPurchasablePlanTier,
    BILLING_MODEL,
    ACCESS_DAYS,
    RENEWAL_ELIGIBILITY_DAYS,
} from '@/lib/billing-constants'
import {
    resolveBillingPurchase,
    type BillingPaymentRow,
    type BillingSubscriptionRow,
} from '@/lib/billing-lifecycle'

export const dynamic = 'force-dynamic'

/**
 * POST /api/billing/create-order
 *
 * Creates a Razorpay order using server-derived first-year or renewal pricing.
 *
 * Returns { orderId, amount, currency, keyId } for the frontend checkout.
 */
export async function POST(req: NextRequest) {
    const supabase = await createClient()

    // 1. Auth check
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get owner profile & org
    const { data: profile } = await supabase
        .from('profiles')
        .select('org_id, role, full_name')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'owner') {
        return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
    }

    if (!profile.org_id) {
        return NextResponse.json({ error: 'No organization found for this user' }, { status: 404 })
    }

    const orgId = profile.org_id

    const requested = await req.json().catch(() => ({})) as { planTier?: unknown }
    const planTier = requested.planTier ?? 'premium'
    if (!isPurchasablePlanTier(planTier)) {
        return NextResponse.json({ error: 'Select a valid Weavly plan.' }, { status: 400 })
    }
    const plan = getBillingPlan(planTier)

    // 3. Derive purchase type exclusively from server-owned lifecycle history.
    // The request deliberately does not accept amount or purchase type.
    const [subscriptionsResult, paymentsResult] = await Promise.all([
        supabase
            .from('org_subscriptions')
            .select('id, plan_tier, status, current_start, current_end, razorpay_payment_id, razorpay_subscription_id, razorpay_order_id, checkout_purchase_type, checkout_amount_paise, checkout_currency, created_at')
            .eq('org_id', orgId),
        supabase
            .from('subscription_payments')
            .select('subscription_id, status')
            .eq('org_id', orgId)
            .eq('status', 'captured'),
    ])

    if (subscriptionsResult.error || paymentsResult.error) {
        Sentry.captureException(subscriptionsResult.error ?? paymentsResult.error, {
            tags: { route: 'billing_create_order', phase: 'resolve_lifecycle' },
        })
        return NextResponse.json({ error: 'Unable to determine billing status.' }, { status: 500 })
    }

    const decision = resolveBillingPurchase(
        (subscriptionsResult.data ?? []) as BillingSubscriptionRow[],
        (paymentsResult.data ?? []) as BillingPaymentRow[],
        planTier
    )
    if (!decision.allowed) {
        return NextResponse.json({ error: decision.reason }, { status: 409 })
    }
    const price = getBillingPrice(planTier, decision.purchaseType)

    // A browser double-click, a second tab, or a slow network must not create
    // multiple live Razorpay orders for the same purchase. Reuse a recent
    // untouched order and never open a second checkout while activation is in
    // progress.
    const nowMs = Date.now()
    const recentPending = (subscriptionsResult.data ?? []).find((row) => {
        const createdAt = row.created_at ? new Date(row.created_at).getTime() : Number.NaN
        return row.plan_tier === planTier
            && row.checkout_purchase_type === decision.purchaseType
            && row.status === 'created'
            && typeof row.razorpay_order_id === 'string'
            && row.checkout_currency === 'INR'
            && Number(row.checkout_amount_paise) === price.totalPaise
            && Number.isFinite(createdAt)
            && createdAt > nowMs - 15 * 60 * 1000
    })

    if (recentPending?.razorpay_order_id) {
        return NextResponse.json({
            orderId: recentPending.razorpay_order_id,
            amount: price.totalPaise,
            currency: 'INR',
            keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            planName: plan.name,
            purchaseType: decision.purchaseType,
            reused: true,
        })
    }

    const activating = (subscriptionsResult.data ?? []).some((row) =>
        row.plan_tier === planTier
        && row.status === 'authenticated'
        && row.checkout_purchase_type === decision.purchaseType
    )
    if (activating) {
        return NextResponse.json(
            { error: 'Your payment is being confirmed. Please wait for access to activate before trying again.' },
            { status: 409 }
        )
    }

    // 4. Create Razorpay order
    // Receipt format must be short (under 40 chars)
    const receipt = `wvl_${orgId.slice(0, 8)}_${Date.now()}`

    try {
        const order = await razorpay.orders.create({
            amount: price.totalPaise,
            currency: 'INR',
            receipt: receipt,
            notes: {
                org_id: orgId,
                billing_model: BILLING_MODEL,
                payment_type: decision.purchaseType,
                purchase_type: decision.purchaseType,
                plan_tier: planTier,
                base_amount_paise: price.basePaise.toString(),
                gst_paise: price.gstPaise.toString(),
                total_paise: price.totalPaise.toString(),
                currency: 'INR',
                access_days: ACCESS_DAYS.toString(),
            },
        })

        // Also pre-create a 'created' state row in org_subscriptions to track the order
        // This is safe since we handle duplicate activation gracefully.
        const admin = createAdminClient()
        const { error: insertError } = await admin
            .from('org_subscriptions')
            .insert({
                org_id: orgId,
                plan_id: null,
                plan_tier: planTier,
                status: 'created',
                billing_model: BILLING_MODEL,
                razorpay_order_id: order.id,
                checkout_purchase_type: decision.purchaseType,
                checkout_amount_paise: price.totalPaise,
                checkout_currency: 'INR',
            })

        if (insertError) {
            Sentry.captureException(insertError, {
                tags: { route: 'billing_create_order', phase: 'insert_created_state' }
            })
            throw new Error('Unable to persist checkout state.')
        }

        return NextResponse.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            planName: plan.name,
            purchaseType: decision.purchaseType,
            renewalEligibilityDays: RENEWAL_ELIGIBILITY_DAYS,
        })
    } catch (err) {
        Sentry.captureException(err, {
            tags: { route: 'billing_create_order', phase: 'create_razorpay_order' }
        })
        return NextResponse.json(
            { error: 'Failed to create payment order. Please try again.' },
            { status: 500 }
        )
    }
}
