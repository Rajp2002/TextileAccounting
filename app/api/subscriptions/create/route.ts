import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Legacy monthly Razorpay subscriptions are retired. All paid access must use
 * the order-based commercial catalog at /api/billing/create-order so callers
 * cannot activate stale plan IDs or stale monthly pricing directly.
 */
export async function POST() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    return NextResponse.json(
        { error: 'Legacy subscriptions are retired. Select a current plan on the Billing page.' },
        { status: 410 }
    )
}
