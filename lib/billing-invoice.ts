import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { getBillingPrice, type BillingPurchaseType, type BillingPlanTier } from '@/lib/billing-constants'
import { BILLING_DOCUMENT_POLICY, isGstInvoiceSupported } from '@/lib/billing-document-policy'

type BillingProfile = {
  legal_name: string
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  state_code: string
  postal_code: string
  billing_email: string
  gstin: string | null
}

type IssuedInvoice = {
  id: string
  invoice_number: string
  status: 'issued' | 'voided'
}

function invoiceFeatureEnabled() {
  return process.env.BILLING_GST_INVOICE_ENABLED === 'true'
}

function supplierConfig() {
  const values = {
    legalName: process.env.BILLING_SUPPLIER_LEGAL_NAME,
    gstin: process.env.BILLING_SUPPLIER_GSTIN,
    address: process.env.BILLING_SUPPLIER_ADDRESS,
    state: process.env.BILLING_SUPPLIER_STATE,
    stateCode: process.env.BILLING_SUPPLIER_STATE_CODE,
    postalCode: process.env.BILLING_SUPPLIER_POSTAL_CODE,
    sac: process.env.BILLING_SUPPLIER_SAC,
  }
  return Object.values(values).every(value => typeof value === 'string' && value.trim().length > 0) ? values as {
    legalName: string
    gstin: string
    address: string
    state: string
    stateCode: string
    postalCode: string
    sac: string
  } : null
}

function indianFinancialYear(date: Date) {
  const year = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(date)
  const month = Number(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'numeric' }).format(date))
  const startYear = Number(year) - (month < 4 ? 1 : 0)
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

function profileIsComplete(profile: BillingProfile | null): profile is BillingProfile {
  return Boolean(
    profile?.legal_name
      && profile.address_line1
      && profile.city
      && profile.state
      && profile.state_code
      && profile.postal_code
      && profile.billing_email
  )
}

export async function ensureBillingInvoice({
  orgId,
  paymentId,
  planTier,
  purchaseType,
  amountPaise,
}: {
  orgId: string
  paymentId: string
  planTier: BillingPlanTier
  purchaseType: BillingPurchaseType
  amountPaise: number
}): Promise<{ issued: boolean; invoice?: IssuedInvoice; reason?: string }> {
  if (!isGstInvoiceSupported()) {
    return { issued: false, reason: 'GST tax invoices are not supported for the current paid pilot.' }
  }

  if (!invoiceFeatureEnabled()) return { issued: false, reason: 'GST invoice feature is not enabled.' }

  const supplier = supplierConfig()
  if (!supplier) return { issued: false, reason: 'Supplier tax identity is not configured.' }

  const admin = createAdminClient()
  const [{ data: profile }, { data: payment }] = await Promise.all([
    admin
      .from('organization_billing_profiles')
      .select('legal_name, address_line1, address_line2, city, state, state_code, postal_code, billing_email, gstin')
      .eq('org_id', orgId)
      .maybeSingle(),
    admin
      .from('subscription_payments')
      .select('id, org_id, razorpay_payment_id, razorpay_order_id')
      .eq('id', paymentId)
      .eq('org_id', orgId)
      .maybeSingle(),
  ])

  if (!payment) return { issued: false, reason: 'Captured payment was not found for this organization.' }
  const customer = profile as BillingProfile | null
  if (!profileIsComplete(customer)) {
    return { issued: false, reason: 'Customer billing details are not complete.' }
  }

  const expected = getBillingPrice(planTier, purchaseType)
  if (amountPaise !== expected.totalPaise) {
    return { issued: false, reason: 'Payment amount does not match the approved invoice catalog.' }
  }

  const { data: existing } = await admin
    .from('billing_invoices')
    .select('id, invoice_number, status')
    .eq('subscription_payment_id', paymentId)
    .maybeSingle()
  if (existing) return { issued: true, invoice: existing as IssuedInvoice }

  const financialYear = indianFinancialYear(new Date())
  const { data: invoiceNumber, error: sequenceError } = await admin.rpc('next_billing_invoice_number', {
    p_financial_year: financialYear,
  })
  if (sequenceError || typeof invoiceNumber !== 'string') {
    throw sequenceError ?? new Error('Invoice number could not be generated.')
  }

  const intraState = customer.state_code === supplier.stateCode
  const cgst = intraState ? Math.floor(expected.gstPaise / 2) : 0
  const sgst = intraState ? expected.gstPaise - cgst : 0
  const igst = intraState ? 0 : expected.gstPaise
  const customerAddress = [customer.address_line1, customer.address_line2].filter(Boolean).join(', ')

  const { data: inserted, error } = await admin
    .from('billing_invoices')
    .insert({
      org_id: orgId,
      subscription_payment_id: paymentId,
      razorpay_payment_id: payment.razorpay_payment_id,
      razorpay_order_id: payment.razorpay_order_id,
      invoice_number: invoiceNumber,
      financial_year: financialYear,
      supplier_legal_name: supplier.legalName,
      supplier_gstin: supplier.gstin,
      supplier_address: supplier.address,
      supplier_state: supplier.state,
      supplier_state_code: supplier.stateCode,
      supplier_postal_code: supplier.postalCode,
      customer_legal_name: customer.legal_name,
      customer_gstin: customer.gstin,
      customer_address: customerAddress,
      customer_city: customer.city,
      customer_state: customer.state,
      customer_state_code: customer.state_code,
      customer_postal_code: customer.postal_code,
      customer_email: customer.billing_email,
      place_of_supply: `${customer.state} (${customer.state_code})`,
      sac: supplier.sac,
      taxable_amount_paise: expected.basePaise,
      cgst_amount_paise: cgst,
      sgst_amount_paise: sgst,
      igst_amount_paise: igst,
      cess_amount_paise: 0,
      total_amount_paise: expected.totalPaise,
      currency: 'INR',
      status: 'issued',
    })
    .select('id, invoice_number, status')
    .single()

  if (error) {
    if (error.code === '23505') {
      const { data: concurrent } = await admin
        .from('billing_invoices')
        .select('id, invoice_number, status')
        .eq('subscription_payment_id', paymentId)
        .maybeSingle()
      if (concurrent) return { issued: true, invoice: concurrent as IssuedInvoice }
    }
    throw error
  }

  return { issued: true, invoice: inserted as IssuedInvoice }
}

export function billingInvoiceFeatureIsConfigured() {
  return BILLING_DOCUMENT_POLICY.state === 'supported' && invoiceFeatureEnabled() && Boolean(supplierConfig())
}
