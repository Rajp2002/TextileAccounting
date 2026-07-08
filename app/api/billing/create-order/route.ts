import { NextResponse } from 'next/server'
import { razorpay } from '@/lib/razorpay'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as Sentry from '@sentry/nextjs'
import {
    FIRST_YEAR_TOTAL_PAISE,
    FIRST_YEAR_BASE_PAISE,
    FIRST_YEAR_GST_PAISE,
    BILLING_MODEL,
    ACCESS_DAYS
} from '@/lib/billing-constants'

export const dynamic = 'force-dynamic'

/**
 * POST /api/billing/create-order
 *
 * Creates a Razorpay Order for Weavly Full Suite first-year upfront checkout (₹17,700).
 *
 * Returns { orderId, amount, currency, keyId } for the frontend checkout.
 */
export async function POST() {
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

    // 3. Check for existing active subscription (block if active premium/full-suite, not expired)
    const { data: existing } = await supabase
        .from('org_subscriptions')
        .select('status, current_end, plan_tier')
        .eq('org_id', orgId)
        .in('status', ['active', 'authenticated'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (existing) {
        const isExpired = existing.current_end && new Date(existing.current_end).getTime() <= Date.now()
        if (!isExpired && existing.plan_tier === 'premium') {
            return NextResponse.json(
                { error: 'Weavly Full Suite is already active for this organization.' },
                { status: 409 }
            )
        }
    }

    // 4. Create Razorpay order
    // Receipt format must be short (under 40 chars)
    const receipt = `wvl_${orgId.slice(0, 8)}_${Date.now()}`

    try {
        const order = await razorpay.orders.create({
            amount: FIRST_YEAR_TOTAL_PAISE,
            currency: 'INR',
            receipt: receipt,
            notes: {
                org_id: orgId,
                billing_model: BILLING_MODEL,
                payment_type: 'initial_purchase',
                base_amount_paise: FIRST_YEAR_BASE_PAISE.toString(),
                gst_paise: FIRST_YEAR_GST_PAISE.toString(),
                total_paise: FIRST_YEAR_TOTAL_PAISE.toString(),
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
                plan_tier: 'premium',
                status: 'created',
                billing_model: BILLING_MODEL,
                razorpay_order_id: order.id,
            })

        if (insertError) {
            Sentry.captureException(insertError, {
                tags: { route: 'billing_create_order', phase: 'insert_created_state' }
            })
        }

        return NextResponse.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
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
