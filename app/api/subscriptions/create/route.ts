import { NextRequest, NextResponse } from 'next/server'
import { razorpay } from '@/lib/razorpay'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/subscriptions/create
 *
 * Body: { planId: string }  — must be one of the two known Razorpay plan IDs
 *
 * Returns { subscriptionId, keyId } for the frontend Razorpay checkout.
 *
 * Errors:
 *   400 — missing or invalid planId
 *   401 — unauthenticated
 *   403 — not an owner
 *   404 — no org found
 *   409 — active subscription already exists
 *   500 — Razorpay or Supabase error
 */
export async function POST(req: NextRequest) {
    const supabase = await createClient()

    // ── Auth check ────────────────────────────────────────────────────────────
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Parse + validate plan selection ──────────────────────────────────────
    let body: { planId?: string } = {}
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const ALLOWED_PLAN_IDS = [
        process.env.RAZORPAY_PLAN_ID_BASE,
        process.env.RAZORPAY_PLAN_ID_PREMIUM,
    ].filter(Boolean)

    if (!body.planId || !ALLOWED_PLAN_IDS.includes(body.planId)) {
        return NextResponse.json(
            { error: 'Invalid plan selected. Please choose a valid plan.' },
            { status: 400 }
        )
    }

    const selectedPlanId = body.planId

    // ── Get owner profile + org ───────────────────────────────────────────────
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

    // ── Get org name ──────────────────────────────────────────────────────────
    const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', profile.org_id)
        .single()

    // ── Check for existing ACTIVE (non-expired) subscription ─────────────────
    const { data: existing } = await supabase
        .from('org_subscriptions')
        .select('status, current_end')
        .eq('org_id', profile.org_id)
        .in('status', ['active', 'authenticated', 'created'])
        .limit(1)
        .single()

    if (existing) {
        const isExpired = existing.current_end && new Date(existing.current_end).getTime() <= Date.now()
        if (!isExpired) {
            return NextResponse.json(
                { error: 'An active subscription already exists for this organization.' },
                { status: 409 }
            )
        }
    }

    // ── Create Razorpay subscription ──────────────────────────────────────────
    try {
        const subscription = await razorpay.subscriptions.create({
            plan_id: selectedPlanId,
            total_count: 12,
            quantity: 1,
            customer_notify: 1,
            notes: {
                org_id: profile.org_id,
                org_name: org?.name ?? 'Unknown',
                owner_name: profile.full_name ?? '',
            },
        })

        // ── Persist to Supabase via admin client (bypasses RLS) ──────────────
        // Must use service_role here — org_subscriptions INSERT is restricted by RLS.
        const planTier = selectedPlanId === process.env.RAZORPAY_PLAN_ID_PREMIUM
            ? 'premium'
            : 'base'

        const admin = createAdminClient()
        const { error: insertError } = await admin
            .from('org_subscriptions')
            .insert({
                org_id:                   profile.org_id,
                razorpay_subscription_id: subscription.id,
                plan_id:                  selectedPlanId,
                plan_tier:                planTier,
                status:                   subscription.status,
                total_count:              subscription.total_count,
            })

        if (insertError) {
            console.error('[subscriptions/create] Supabase insert failed:', insertError)
        }

        return NextResponse.json({
            subscriptionId: subscription.id,
            keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        })
    } catch (err: any) {
        console.error('[subscriptions/create] Razorpay error:', err)
        return NextResponse.json(
            { error: err?.error?.description ?? err.message ?? 'Failed to create subscription' },
            { status: 500 }
        )
    }
}
