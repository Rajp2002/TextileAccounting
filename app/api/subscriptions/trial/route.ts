import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/subscriptions/trial
 *
 * Starts a 7-day free trial for the authenticated owner's org.
 * No payment required. Only one trial is allowed per org, ever.
 *
 * Errors:
 *   401 — unauthenticated
 *   403 — not an owner
 *   404 — no org found
 *   409 — trial or active subscription already exists
 *   500 — Supabase error
 */
export async function POST(_req: NextRequest) {
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

    // ── Check for any existing active subscription (including previous trials) ──
    const { data: existing } = await supabase
        .from('org_subscriptions')
        .select('status, plan_tier')
        .eq('org_id', profile.org_id)
        .in('status', ['active', 'authenticated', 'created'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (existing) {
        const msg = existing.plan_tier === 'trial'
            ? 'You have already used your free trial.'
            : 'An active subscription already exists.'
        return NextResponse.json({ error: msg }, { status: 409 })
    }

    // ── Create trial record via admin client ──────────────────────────────────
    const admin = createAdminClient()
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await admin
        .from('org_subscriptions')
        .insert({
            org_id:     profile.org_id,
            plan_id:    'trial',
            plan_tier:  'trial',
            status:     'active',
            current_end: trialEnd,
        })

    if (error) {
        console.error('[subscriptions/trial] Insert failed:', error)
        return NextResponse.json({ error: 'Failed to start trial. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, trialEnd })
}
