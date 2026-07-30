import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type CheckoutOutcome = 'failed' | 'cancelled'

function isCheckoutOutcome(value: unknown): value is CheckoutOutcome {
  return value === 'failed' || value === 'cancelled'
}

/**
 * Mark a locally tracked Razorpay order retryable after the checkout reports a
 * failure or the owner dismisses it. This does not activate, refund, or cancel
 * anything at Razorpay; it only prevents a `created` order from masquerading
 * as received payment in the Weavly billing UI.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()
  if (!profile?.org_id || profile.role !== 'owner') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    orderId?: unknown
    outcome?: unknown
  }
  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
  if (!/^order_[A-Za-z0-9]+$/.test(orderId) || !isCheckoutOutcome(body.outcome)) {
    return NextResponse.json({ error: 'Invalid checkout state.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('org_subscriptions')
    .update({ status: body.outcome === 'failed' ? 'halted' : 'cancelled' })
    .eq('org_id', profile.org_id)
    .eq('razorpay_order_id', orderId)
    .eq('status', 'created')
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Unable to update checkout state.' }, { status: 500 })
  }
  return NextResponse.json({ updated: Boolean(data) })
}
