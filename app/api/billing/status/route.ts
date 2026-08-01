import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { reconcileBillingOrder } from '@/lib/billing-reconciliation'

export const dynamic = 'force-dynamic'

/** Owner-only provider reconciliation for browser-close, refresh, and timeout recovery. */
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
    paymentId?: unknown
  }
  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
  const paymentId = typeof body.paymentId === 'string' ? body.paymentId.trim() : null
  if (!/^order_[A-Za-z0-9]+$/.test(orderId)) {
    return NextResponse.json({ error: 'A valid payment order is required.' }, { status: 400 })
  }
  if (paymentId && !/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
    return NextResponse.json({ error: 'A valid payment reference is required.' }, { status: 400 })
  }

  try {
    const result = await reconcileBillingOrder({
      orgId: profile.org_id,
      orderId,
      hintedPaymentId: paymentId,
      source: 'owner_status',
    })
    const status = result.state === 'activated' ? 200
      : result.state === 'failed' || result.state === 'cancelled' ? 409
        : result.state === 'reconciliation_required' || result.state === 'duplicate' ? 409
          : 202
    return NextResponse.json(result, { status })
  } catch {
    return NextResponse.json({
      state: 'unknown',
      orderId,
      message: 'We could not check the payment right now. Do not pay again; try checking status again.',
    }, { status: 202 })
  }
}
