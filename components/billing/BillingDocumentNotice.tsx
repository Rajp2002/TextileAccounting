'use client'

import { ReceiptText } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

export function BillingDocumentNotice({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()

  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50 text-amber-950 ${compact ? 'p-3 text-xs' : 'p-4 text-sm'}`} role="note">
      <div className="flex items-start gap-2">
        <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="space-y-1 leading-relaxed">
          <p className="font-bold">{t('base_plan.billing.status')}</p>
          <p>{t('base_plan.billing.receipt_only')}</p>
          <p className="text-amber-800">{t('base_plan.billing.future_review')}</p>
        </div>
      </div>
    </div>
  )
}
