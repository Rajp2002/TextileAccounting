'use client'

import { ChevronDown, ReceiptText } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

export function BillingDocumentNotice({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()

  return (
    <details
      className={`group rounded-xl border border-hairline bg-surface/80 text-body ${compact ? 'text-xs' : 'text-sm'}`}
      role="note"
    >
      <summary className={`flex cursor-pointer list-none items-center justify-between gap-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron/40 ${compact ? 'p-3' : 'p-4'} [&::-webkit-details-marker]:hidden`}>
        <span className="flex min-w-0 items-center gap-2">
          <ReceiptText className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
          <span className="font-semibold">Payment receipt (PDF) and tax invoice details</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-subtle transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className={`space-y-1 border-t border-hairline leading-relaxed ${compact ? 'px-3 pb-3 pt-2' : 'px-4 pb-4 pt-3'}`}>
        <p>{t('base_plan.billing.receipt_only')}</p>
        <p className="text-subtle">{t('base_plan.billing.future_review')}</p>
      </div>
    </details>
  )
}
