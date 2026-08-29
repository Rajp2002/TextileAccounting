import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getBillingAttemptPresentation, isBillingAttemptRetryable } from '../lib/billing-attempts'
import { readBillingOrderContext } from '../lib/billing-lifecycle'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Sprint 4 billing trust boundaries', () => {
  it('keeps uncertain provider states non-retryable for Rajesh', () => {
    expect(getBillingAttemptPresentation('failed')).toMatchObject({
      label: 'Payment failed',
      canRetry: true,
      shouldCheck: false,
    })
    expect(getBillingAttemptPresentation('authorized')).toMatchObject({
      canRetry: false,
      shouldCheck: true,
    })
    expect(getBillingAttemptPresentation('unknown')).toMatchObject({
      canRetry: false,
      shouldCheck: true,
    })
    expect(getBillingAttemptPresentation('reconciliation_required')).toMatchObject({
      canRetry: false,
      shouldCheck: true,
    })
    expect(isBillingAttemptRetryable('failed')).toBe(true)
    expect(isBillingAttemptRetryable('cancelled')).toBe(true)
    expect(isBillingAttemptRetryable('processing')).toBe(false)
    expect(isBillingAttemptRetryable('authorized')).toBe(false)
  })

  it('accepts only a server-owned catalog order context', () => {
    const valid = readBillingOrderContext({
      amount: 999_900,
      currency: 'INR',
      notes: {
        org_id: 'org-rajesh',
        billing_model: 'upfront_first_year_plus_annual_renewal',
        plan_tier: 'base',
        purchase_type: 'initial_purchase',
        payment_type: 'initial_purchase',
        base_amount_paise: '847373',
        gst_paise: '152527',
        total_paise: '999900',
        access_days: '365',
        currency: 'INR',
      },
    })
    expect(valid).toMatchObject({ orgId: 'org-rajesh', planTier: 'base', purchaseType: 'initial_purchase', amountPaise: 999900 })

    expect(readBillingOrderContext({
      amount: 999_900,
      currency: 'INR',
      notes: { ...validNotes(), total_paise: '236000' },
    })).toBeNull()
    expect(readBillingOrderContext({
      amount: 999_900,
      currency: 'INR',
      notes: { ...validNotes(), plan_tier: 'premium' },
    })).toBeNull()
  })

  it('adds RLS, service-role-only mutations, and durable ledgers for money and exports', () => {
    const migration = read('supabase/migrations/20260801162646_20260801143840_sprint4_billing_trust_boundaries.sql')
    for (const table of [
      'billing_checkout_attempts',
      'billing_payment_refunds',
      'organization_billing_profiles',
      'billing_invoices',
      'organization_export_runs',
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(migration).toContain(`REVOKE ALL ON TABLE public.${table} FROM anon, authenticated`)
    }
    expect(migration).toContain('idx_billing_attempts_one_active_intent')
    expect(migration).toContain("status IN ('creating', 'created', 'processing', 'unknown', 'authorized', 'activation_pending')")
    expect(migration).toContain('claim_billing_checkout_attempt')
    expect(migration).toContain('activate_order_billing_purchase_legacy')
    expect(migration).toContain('already has a captured purchase')
    expect(migration).toContain('next_billing_invoice_number')
  })

  it('routes callback, refresh, and webhook outcomes through one reconciliation service', () => {
    const verify = read('app/api/billing/verify-payment/route.ts')
    const status = read('app/api/billing/status/route.ts')
    const webhook = read('app/api/webhooks/razorpay/route.ts')
    const button = read('components/billing/SubscribeButton.tsx')

    expect(verify).toContain('reconcileBillingOrder')
    expect(status).toContain("profile.role !== 'owner'")
    expect(status).toContain('reconcileBillingOrder')
    expect(status).toContain("/^order_[A-Za-z0-9]+$/")
    expect(webhook).toContain('reconcileBillingOrder')
    expect(webhook).toContain("case 'payment.authorized'")
    expect(button).toContain('clientRequestId')
    expect(button).toContain('checkPaymentStatus')
    expect(button).toContain('Do not pay again')
  })

  it('links formal invoices and export history to the requesting organization', () => {
    const invoiceRoute = read('app/api/billing/invoice/[invoiceId]/route.ts')
    const invoiceActivation = read('lib/billing-invoice.ts')
    const receiptRoute = read('app/api/billing/receipt/[paymentId]/route.ts')
    const receiptGenerator = read('lib/generate-payment-receipt.ts')
    const exportAction = read('app/(dashboard)/owner/settings/data-export.ts')
    const exportButton = read('components/settings/organization-data-export-button.tsx')

    expect(invoiceRoute).toContain(".eq('id', invoiceId)")
    expect(invoiceRoute).toContain(".eq('org_id', profile.org_id)")
    expect(invoiceRoute).toContain(".eq('status', 'issued')")
    expect(invoiceActivation).toContain('billing_invoices')
    expect(invoiceActivation).toContain('ensureBillingInvoice')
    expect(receiptRoute).toContain(".eq('id', paymentId)")
    expect(receiptRoute).toContain(".eq('org_id', profile.org_id)")
    expect(receiptRoute).toContain("payment.status !== 'captured'")
    expect(receiptGenerator).toContain('not a GST tax invoice')
    expect(exportAction).toContain('organization_export_runs')
    expect(exportAction).toContain("status: 'failed'")
    expect(exportAction).toContain('persistFailedExportRun')
    expect(exportAction).toContain('payload_hash')
    expect(exportAction).toContain('billing_invoices')
    expect(exportAction).toContain('billing_checkout_attempts')
    expect(exportAction).toContain('billing_payment_refunds')
    expect(exportButton).toContain('Export generated; download requested')
    expect(exportButton).toContain('The browser save location cannot be verified automatically.')
  })
})

function validNotes() {
  return {
    org_id: 'org-rajesh',
    billing_model: 'upfront_first_year_plus_annual_renewal',
    plan_tier: 'base',
    purchase_type: 'initial_purchase',
    payment_type: 'initial_purchase',
    base_amount_paise: '847373',
    gst_paise: '152527',
    total_paise: '999900',
    access_days: '365',
    currency: 'INR',
  }
}
