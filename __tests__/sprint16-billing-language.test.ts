import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BASE_PLAN_FACTORY_GLOSSARY, BASE_PLAN_LANGUAGE_POLICY } from '../lib/base-plan-policy'
import { BILLING_DOCUMENT_POLICY } from '../lib/billing-document-policy'
import { formatDateOnly } from '../lib/format'
import { formatSuratDateTime } from '../lib/time'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Sprint 16 billing and language policy', () => {
  it('records the pilot as receipt-only before payment', () => {
    expect(BILLING_DOCUMENT_POLICY.state).toBe('not_supported')
    expect(BILLING_DOCUMENT_POLICY.customerDocument).toBe('Payment receipt (PDF)')
    expect(BILLING_DOCUMENT_POLICY.prePaymentNotice).toContain('not a GST tax invoice')

    const billingPage = read('app/(dashboard)/owner/billing/page.tsx')
    const notice = read('components/billing/BillingDocumentNotice.tsx')
    const checkout = read('components/billing/SubscribeButton.tsx')
    const invoiceRoute = read('app/api/billing/invoice/[invoiceId]/route.ts')

    expect(billingPage).toContain('BillingDocumentNotice')
    expect(billingPage).not.toContain('BillingProfileForm')
    expect(notice).toContain("base_plan.billing.receipt_only")
    expect(checkout).toContain("base_plan.billing.checkout")
    expect(checkout).toContain("base_plan.billing.success")
    expect(invoiceRoute).toContain('isGstInvoiceSupported')
    expect(invoiceRoute).toContain('status: 404')
  })

  it('promises all three Base Plan languages and preserves factory terminology', () => {
    expect(BASE_PLAN_LANGUAGE_POLICY.supportedLanguages).toEqual(['en', 'hi', 'gu'])
    expect(BASE_PLAN_LANGUAGE_POLICY.surfaces).toEqual(expect.arrayContaining([
      'navigation',
      'estimator',
      'saved_costings',
      'quotations',
      'rate_book',
      'settings',
      'billing',
      'export',
      'validation',
      'status_and_toasts',
    ]))

    for (const locale of ['en', 'hi', 'gu']) {
      const source = read(`lib/i18n/locales/${locale}.ts`)
      expect(source).toContain('base_plan:')
      for (const { term } of BASE_PLAN_FACTORY_GLOSSARY) expect(source.toLowerCase()).toContain(term.toLowerCase())
    }

    expect(read('components/estimator/BasePlanFactoryGlossary.tsx')).toContain('base_plan.glossary')
    expect(read('components/i18n/language-switcher.tsx')).toContain('common.language_changed')
  })

  it('keeps archive policy visible and explains restore and retention', () => {
    const notice = read('components/records/ArchivePolicyNotice.tsx')
    expect(notice).toContain('base_plan.archive.description')
    expect(notice).toContain('base_plan.archive.restore')
    expect(notice).toContain('base_plan.archive.deletion')
    expect(notice).toContain('base_plan.archive.privacy')

    for (const source of [
      read('app/(dashboard)/owner/estimator/EstimatorClient.tsx'),
      read('app/(dashboard)/owner/quotes/QuotesClient.tsx'),
      read('app/(dashboard)/owner/rates/RatesClient.tsx'),
      read('app/(dashboard)/owner/archive/page.tsx'),
    ]) expect(source).toContain('ArchivePolicyNotice')
  })

  it('formats business dates in Surat time and audit timestamps with IST', () => {
    expect(formatDateOnly('2026-03-01T23:30:00.000Z', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })).toBe('01 Mar 2026')
    expect(formatSuratDateTime('2026-03-01T00:00:00.000Z')).toContain('IST')
    expect(read('components/settings/organization-data-export-button.tsx')).toContain("base_plan.export.timezone")
  })
})
