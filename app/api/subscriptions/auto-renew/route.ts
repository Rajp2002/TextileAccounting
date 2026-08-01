import { NextResponse } from 'next/server'
import { getRazorpay } from '@/lib/razorpay'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'

/**
 * POST /api/subscriptions/auto-renew
 *
 * Turns OFF auto-renewal for the calling org's active subscription.
 * Calls Razorpay cancel-at-cycle-end, then updates our DB flag.
 *
 * This action is ONE-WAY — Razorpay does not support un-cancelling
 * a subscription. To re-enable, the user must create a new subscription.
 *
 * Errors:
 *   401 — unauthenticated
 *   403 — not an owner
 *   404 — no active subscription found
 *   409 — already set to cancel at cycle end
 *   500 — Razorpay or Supabase error
 */
export async function POST() {
    const supabase = await createClient()

    // ── Auth check ────────────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Get owner profile ─────────────────────────────────────────────────────
    const { data: profile } = await supabase
        .from('profiles')
        .select('org_id, role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'owner') {
        return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
    }

    if (!profile.org_id) {
        return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // ── Find active subscription ──────────────────────────────────────────────
    const admin = createAdminClient()
    const { data: sub } = await admin
        .from('org_subscriptions')
        .select('id, razorpay_subscription_id, status, cancel_at_cycle_end')
        .eq('org_id', profile.org_id)
        .in('status', ['active', 'authenticated'])
        .not('razorpay_subscription_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (!sub) {
        return NextResponse.json(
            { error: 'No active subscription found for this organization.' },
            { status: 404 }
        )
    }

    if (sub.cancel_at_cycle_end) {
        return NextResponse.json(
            { error: 'Auto-renewal is already off for this subscription.' },
            { status: 409 }
        )
    }

    // ── Tell Razorpay to cancel at cycle end ──────────────────────────────────
    try {
        const razorpay = getRazorpay()
        await razorpay.subscriptions.cancel(sub.razorpay_subscription_id!, true)
    } catch (err) {
        Sentry.captureException(err, { tags: { route: 'subscriptions_auto_renew', phase: 'cancel_razorpay_subscription' } })
        return NextResponse.json(
            { error: 'Failed to update subscription. Please try again.' },
            { status: 500 }
        )
    }

    // ── Update DB ─────────────────────────────────────────────────────────────
    const { error: updateError } = await admin
        .from('org_subscriptions')
        .update({
            cancel_at_cycle_end: true,
            updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id)

    if (updateError) {
        Sentry.captureException(updateError, { tags: { route: 'subscriptions_auto_renew', phase: 'subscription_update' } })
        // Razorpay is already updated — flag mismatch, but non-fatal
    }

    return NextResponse.json({ success: true })
}
