import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateGstInvoicePdf } from '@/lib/generate-gst-invoice'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('org_id, role').eq('id', user.id).single()
  if (!profile?.org_id || profile.role !== 'owner') return NextResponse.json({ error: 'Owner access required' }, { status: 403 })

  const { data: invoice, error } = await supabase
    .from('billing_invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('org_id', profile.org_id)
    .eq('status', 'issued')
    .maybeSingle()

  if (error || !invoice) return NextResponse.json({ error: 'GST invoice not available.' }, { status: 404 })

  const pdf = generateGstInvoicePdf({
    invoiceNumber: invoice.invoice_number,
    issuedAt: invoice.issued_at,
    supplierLegalName: invoice.supplier_legal_name,
    supplierGstin: invoice.supplier_gstin,
    supplierAddress: invoice.supplier_address,
    supplierState: invoice.supplier_state,
    supplierStateCode: invoice.supplier_state_code,
    supplierPostalCode: invoice.supplier_postal_code,
    customerLegalName: invoice.customer_legal_name,
    customerGstin: invoice.customer_gstin,
    customerAddress: invoice.customer_address,
    customerCity: invoice.customer_city,
    customerState: invoice.customer_state,
    customerStateCode: invoice.customer_state_code,
    customerPostalCode: invoice.customer_postal_code,
    customerEmail: invoice.customer_email,
    placeOfSupply: invoice.place_of_supply,
    sac: invoice.sac,
    taxableAmountPaise: Number(invoice.taxable_amount_paise),
    cgstAmountPaise: Number(invoice.cgst_amount_paise),
    sgstAmountPaise: Number(invoice.sgst_amount_paise),
    igstAmountPaise: Number(invoice.igst_amount_paise),
    cessAmountPaise: Number(invoice.cess_amount_paise),
    totalAmountPaise: Number(invoice.total_amount_paise),
    paymentReference: invoice.razorpay_payment_id || invoice.subscription_payment_id,
    orderReference: invoice.razorpay_order_id,
  })

  const body = new Blob([pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer], { type: 'application/pdf' })
  const safeNumber = String(invoice.invoice_number).replace(/[^A-Za-z0-9_-]/g, '')
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="weavly-gst-invoice-${safeNumber || 'invoice'}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
