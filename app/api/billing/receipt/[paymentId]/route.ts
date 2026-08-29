import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generatePaymentReceiptPdf } from '@/lib/generate-payment-receipt'
import { isBillingPurchaseType, isBillingPlanTier } from '@/lib/billing-constants'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const { paymentId } = await params
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

  const { data: payment, error: paymentError } = await supabase
    .from('subscription_payments')
    .select('id, org_id, subscription_id, razorpay_payment_id, razorpay_order_id, amount_paise, status, method, captured_at, created_at')
    .eq('id', paymentId)
    .eq('org_id', profile.org_id)
    .maybeSingle()

  if (paymentError || !payment || payment.status !== 'captured' || !payment.razorpay_payment_id) {
    return NextResponse.json({ error: 'Payment receipt not available.' }, { status: 404 })
  }

  const { data: subscription } = await supabase
    .from('org_subscriptions')
    .select('plan_tier, checkout_purchase_type, current_start, current_end')
    .eq('id', payment.subscription_id)
    .eq('org_id', profile.org_id)
    .maybeSingle()

  const planTier = subscription?.plan_tier
  const purchaseType = subscription?.checkout_purchase_type
  if (!subscription || !isBillingPlanTier(planTier) || !isBillingPurchaseType(purchaseType)) {
    return NextResponse.json({ error: 'Payment receipt details are incomplete.' }, { status: 409 })
  }

  const { data: organization } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', profile.org_id)
    .maybeSingle()

  const pdf = generatePaymentReceiptPdf({
    organizationName: organization?.name || 'Weavly customer',
    planTier,
    purchaseType,
    amountPaise: Number(payment.amount_paise),
    paymentId: payment.razorpay_payment_id,
    orderId: payment.razorpay_order_id,
    paidAt: payment.captured_at || payment.created_at,
    accessStart: subscription.current_start,
    accessEnd: subscription.current_end,
    method: payment.method,
  })

  const fileSuffix = payment.razorpay_payment_id.slice(-8).replace(/[^A-Za-z0-9_-]/g, '')
  const pdfBody = new Blob([
    pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer,
  ], { type: 'application/pdf' })

  return new NextResponse(pdfBody, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="weavly-payment-receipt-${fileSuffix || 'payment'}.pdf"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}
