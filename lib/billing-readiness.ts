import { BILLING_DOCUMENT_POLICY, type BillingDocumentState } from './billing-document-policy'

type BillingEnvironmentKey =
  | 'RAZORPAY_KEY_ID'
  | 'RAZORPAY_KEY_SECRET'
  | 'NEXT_PUBLIC_RAZORPAY_KEY_ID'
  | 'BILLING_GST_INVOICE_ENABLED'
  | 'BILLING_SUPPLIER_LEGAL_NAME'
  | 'BILLING_SUPPLIER_GSTIN'
  | 'BILLING_SUPPLIER_ADDRESS'
  | 'BILLING_SUPPLIER_STATE'
  | 'BILLING_SUPPLIER_STATE_CODE'
  | 'BILLING_SUPPLIER_POSTAL_CODE'
  | 'BILLING_SUPPLIER_SAC'

type BillingEnvironment = Partial<Record<BillingEnvironmentKey, string | undefined>>

export type BillingReadiness = {
  canCreateOrder: boolean
  mode: 'test' | 'live' | 'blocked'
  code: 'test_ready' | 'live_ready' | 'gateway_not_configured' | 'live_supplier_not_ready'
  publicMessage: string
  missing: string[]
}

const value = (input: string | undefined) => input?.trim() ?? ''
const validGstin = (gstin: string) => /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[A-Z0-9]$/.test(gstin)

/** Company, GST and document requirements for live checkout, whatever keys are configured. */
function liveSupplierGaps(env: BillingEnvironment, documentState: BillingDocumentState): string[] {
  const gstin = value(env.BILLING_SUPPLIER_GSTIN).toUpperCase()
  const stateCode = value(env.BILLING_SUPPLIER_STATE_CODE)
  return [
    documentState === 'supported' ? null : 'billing document policy approval',
    env.BILLING_GST_INVOICE_ENABLED === 'true' ? null : 'GST invoice feature flag',
    value(env.BILLING_SUPPLIER_LEGAL_NAME).length >= 2 ? null : 'supplier legal name',
    validGstin(gstin) ? null : 'valid supplier GSTIN',
    value(env.BILLING_SUPPLIER_ADDRESS).length >= 5 ? null : 'supplier address',
    value(env.BILLING_SUPPLIER_STATE).length >= 2 ? null : 'supplier state',
    /^\d{2}$/.test(stateCode) && gstin.startsWith(stateCode) ? null : 'matching supplier state code',
    /^[1-9]\d{5}$/.test(value(env.BILLING_SUPPLIER_POSTAL_CODE)) ? null : 'supplier postal code',
    /^\d{6}$/.test(value(env.BILLING_SUPPLIER_SAC)) ? null : 'six-digit service accounting code',
  ].filter((item): item is string => item !== null)
}

/**
 * Everything still needed before real payments can open (the founder's Go live checklist).
 * Unlike evaluateBillingReadiness, test keys do not short-circuit this list.
 */
export function liveReadinessGaps(env: BillingEnvironment, documentState: BillingDocumentState = BILLING_DOCUMENT_POLICY.state): string[] {
  const privateKeyId = value(env.RAZORPAY_KEY_ID)
  const liveKeys = privateKeyId.startsWith('rzp_live_') && privateKeyId === value(env.NEXT_PUBLIC_RAZORPAY_KEY_ID) && value(env.RAZORPAY_KEY_SECRET).length > 0
  return [...(liveKeys ? [] : ['live Razorpay keys']), ...liveSupplierGaps(env, documentState)]
}

export function evaluateBillingReadiness(
  env: BillingEnvironment,
  documentState: BillingDocumentState = BILLING_DOCUMENT_POLICY.state,
): BillingReadiness {
  const privateKeyId = value(env.RAZORPAY_KEY_ID)
  const publicKeyId = value(env.NEXT_PUBLIC_RAZORPAY_KEY_ID)
  const keySecret = value(env.RAZORPAY_KEY_SECRET)
  const keyPairMatches = privateKeyId.length > 0 && privateKeyId === publicKeyId && keySecret.length > 0

  if (keyPairMatches && privateKeyId.startsWith('rzp_test_')) {
    return {
      canCreateOrder: true,
      mode: 'test',
      code: 'test_ready',
      publicMessage: 'Test checkout is enabled. No real payment will be captured.',
      missing: [],
    }
  }

  if (!keyPairMatches || !privateKeyId.startsWith('rzp_live_')) {
    return {
      canCreateOrder: false,
      mode: 'blocked',
      code: 'gateway_not_configured',
      publicMessage: 'Checkout is not configured yet. No payment can be accepted.',
      missing: ['matching Razorpay key ID and secret'],
    }
  }

  const missing = liveSupplierGaps(env, documentState)

  if (missing.length > 0) {
    return {
      canCreateOrder: false,
      mode: 'blocked',
      code: 'live_supplier_not_ready',
      publicMessage: 'Live Lite and Base checkout is not enabled yet. Complete incorporation, GST supplier, invoice, and Razorpay configuration before accepting payment.',
      missing,
    }
  }

  return {
    canCreateOrder: true,
    mode: 'live',
    code: 'live_ready',
    publicMessage: 'Live Lite and Base checkout is ready.',
    missing: [],
  }
}

function billingEnvironment(): BillingEnvironment {
  return {
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    BILLING_GST_INVOICE_ENABLED: process.env.BILLING_GST_INVOICE_ENABLED,
    BILLING_SUPPLIER_LEGAL_NAME: process.env.BILLING_SUPPLIER_LEGAL_NAME,
    BILLING_SUPPLIER_GSTIN: process.env.BILLING_SUPPLIER_GSTIN,
    BILLING_SUPPLIER_ADDRESS: process.env.BILLING_SUPPLIER_ADDRESS,
    BILLING_SUPPLIER_STATE: process.env.BILLING_SUPPLIER_STATE,
    BILLING_SUPPLIER_STATE_CODE: process.env.BILLING_SUPPLIER_STATE_CODE,
    BILLING_SUPPLIER_POSTAL_CODE: process.env.BILLING_SUPPLIER_POSTAL_CODE,
    BILLING_SUPPLIER_SAC: process.env.BILLING_SUPPLIER_SAC,
  }
}

export function getBillingReadiness() {
  return evaluateBillingReadiness(billingEnvironment())
}

export function getLiveReadinessGaps(): string[] {
  return liveReadinessGaps(billingEnvironment())
}
