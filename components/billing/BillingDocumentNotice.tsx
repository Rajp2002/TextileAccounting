'use client'

import { ChevronDown, ReceiptText } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { railIcon, railSurface } from '@/components/ui/rail'
import { cn } from '@/lib/utils'

export function BillingDocumentNotice({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()

  return (
    <details
      className={cn('group overflow-hidden', railSurface, compact ? 'text-xs' : 'text-sm')}
    >
      <summary className={cn(
        'flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron/50 [&::-webkit-details-marker]:hidden',
        compact ? 'px-4 py-3' : 'p-4'
      )}>
        <span className="flex min-w-0 items-center gap-2">
          <ReceiptText className={railIcon} aria-hidden="true" />
          <span className="font-semibold text-ink">Payment receipt (PDF) and tax invoice details</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-subtle transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-1 border-t border-hairline px-4 pb-4 pt-3 leading-relaxed text-body">
        <p>{t('base_plan.billing.receipt_only')}</p>
        <p className="text-subtle">{t('base_plan.billing.future_review')}</p>
      </div>
    </details>
  )
}

