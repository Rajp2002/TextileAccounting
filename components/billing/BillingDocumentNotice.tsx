'use client'

import { ReceiptText } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { PageGuide } from '@/components/tours/TourInvitation'

/** What a payment receipt is (and is not), read from the billing page's Guide. */
export function BillingDocumentContent() {
  const { t } = useTranslation()

  return (
    <div className="space-y-2 text-sm leading-relaxed text-body">
      <p>{t('base_plan.billing.receipt_only')}</p>
      <p className="text-subtle">{t('base_plan.billing.future_review')}</p>
    </div>
  )
}

/** The billing page's Guide: it has no tour, only its document notes. */
export function BillingGuide() {
  return (
    <PageGuide
      topics={[{
        id: 'billing-documents',
        icon: ReceiptText,
        title: 'Payment receipt (PDF) and tax invoice details',
        content: <BillingDocumentContent />,
      }]}
    />
  )
}
