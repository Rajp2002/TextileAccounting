'use client'

import { ArchiveRestore, RotateCcw, ShieldCheck } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import type { GuideTopic } from '@/components/tours/TourInvitation'

/** Archive and restore principles, read from a route's Guide. */
export function ArchivePolicyContent() {
  const { t } = useTranslation()

  return (
    <div role="note" className="space-y-3">
      <p className="text-sm text-muted-foreground">Data retention & restore principles</p>
      <div className="rounded-xl border border-hairline bg-surface-soft/60 p-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <RotateCcw className="h-4 w-4 shrink-0 text-info" aria-hidden="true" />
          <span>Safe Archiving & Restore</span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-body">
          {t('base_plan.archive.description')} {t('base_plan.archive.restore')}
        </p>
      </div>

      <div className="rounded-xl border border-hairline bg-surface-soft/60 p-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <span>Privacy & Retention Controls</span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-body">
          {t('base_plan.archive.deletion')} {t('base_plan.archive.privacy')}
        </p>
      </div>
    </div>
  )
}

/** The archive policy as a Guide topic, shared by every route that archives records. */
export function useArchivePolicyTopic(): GuideTopic {
  const { t } = useTranslation()
  return { id: 'archive-policy', icon: ArchiveRestore, title: t('base_plan.archive.title'), content: <ArchivePolicyContent /> }
}
