/**
 * Customer-facing billing document decision for the current paid pilot.
 *
 * Keep this decision separate from the future GST-invoice implementation so an
 * environment variable cannot accidentally make the product promise a tax
 * invoice before the company and supplier setup are ready.
 */
export const BILLING_DOCUMENT_STATES = ['supported', 'configured_later', 'not_supported'] as const

export type BillingDocumentState = (typeof BILLING_DOCUMENT_STATES)[number]

export const BILLING_DOCUMENT_POLICY = {
  state: 'not_supported' as BillingDocumentState,
  customerDocument: 'Payment receipt (PDF)',
  customerDocumentShort: 'Payment receipt only',
  notAvailableDocument: 'GST tax invoice',
  prePaymentNotice:
    'This paid pilot provides a payment receipt (PDF) only. It is not a GST tax invoice. GST tax invoice support will be reviewed after Weavly is incorporated.',
  checkoutNotice:
    'Before you pay: you will receive a payment receipt (PDF) for the captured payment. This pilot does not issue a GST tax invoice.',
  successNotice:
    'Payment receipt available in Billing. No GST tax invoice is issued for this pilot.',
  archiveNote:
    'A payment receipt confirms that money was received. Keep it for your records; it is not a GST tax invoice.',
} as const

export function isGstInvoiceSupported() {
  return BILLING_DOCUMENT_POLICY.state === 'supported'
}
