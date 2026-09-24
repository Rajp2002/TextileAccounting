'use client'

import { ChevronDown, ReceiptText } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

export function BillingDocumentNotice({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()

  return (
    <details
      className={`group overflow-hidden rounded-xl border border-saffron/30 bg-surface text-body shadow-[var(--shadow-card)] ${compact ? 'text-xs' : 'text-sm'}`}
    >
      <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 bg-saffron-soft/25 outline-none hover:bg-saffron-soft/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron/50 ${compact ? 'px-4 py-3' : 'p-4'} [&::-webkit-details-marker]:hidden`}>
        <span className="flex min-w-0 items-center gap-2">
          <ReceiptText className="h-4 w-4 shrink-0 text-saffron-deep" aria-hidden="true" />
          <span className="font-semibold">Payment receipt (PDF) and tax invoice details</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-saffron-deep transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-1 border-t border-saffron/20 px-4 pb-4 pt-3 leading-relaxed">
        <p>{t('base_plan.billing.receipt_only')}</p>
        <p className="text-subtle">{t('base_plan.billing.future_review')}</p>
      </div>
    </details>
  )
}
